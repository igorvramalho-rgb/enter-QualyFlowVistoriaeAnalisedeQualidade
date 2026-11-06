# QUALY AUDITOR — Inteligência de Fiscalização
## Etapa 1 — Diagnóstico da arquitetura e plano de integração

> Documento de planejamento. **Nenhum código, tabela, permissão ou dado foi alterado nesta etapa.**

## 1. Diagnóstico resumido do Qualy Flow atual

| Camada | Situação |
|---|---|
| Frontend | Vite + React 19 + TypeScript + Tailwind + shadcn; 6 rotas internas |
| Autenticação | Login por usuário (`<usuario>@qualyflow.local`), cadastro fechado; perfis em `qualyflow_profiles` (gestor / vistoriador, ativo/pendente/bloqueado) |
| Banco | `qualyflow_reports` (5), `qualyflow_analyses` (1.113), `qualyflow_settings`, `qualyflow_user_settings`, `qualyflow_profiles` (2) — todas com RLS |
| Armazenamento | Bucket privado `qualyflow-fotos` (541 arquivos, ~280 MB), leitura por **links assinados de 12 h**; políticas já aceitam **qualquer caminho iniciado em `qualyflow/`** |
| Backend | 1 função (`qualyflow-users`, gestor-only). Nenhuma IA paga; OCR roda local |
| Analista | Importa PDF/planilha no navegador, extrai campos, guarda `qualyflow_analyses` (não guarda o PDF) |
| Relatórios (Emissor) | 3 modelos fiéis aos PDFs da AlphaGeos (SGZ-156, Pós 60 Passeio, Pós 60 Via), PDF por `html2canvas` + `jsPDF` a ~290 dpi |
| BI | `RelatorioBi` usa `BiReportSheets` + `downloadReportPdf`; Excel via `downloadXlsx` |
| Retenção | Emissor mantém **2 relatórios por usuário** — apaga linhas de `qualyflow_reports`, nunca fotos |

## 2. O que será reaproveitado (sem duplicar)

| Existente | Uso no Qualy Auditor |
|---|---|
| `analyzePdfFile()` (`pdf-extract.ts`) + `pdf-ocr.ts` | Leitura assistida do FV, OCR opcional e páginas de origem |
| `quality-status.ts` | Classificação **apenas como referência**, separada da classificação interna (§5/§10) |
| `PhotoSlotGrid`, `PhotoCropDialog`, `PhotoAdjustDialog`, `image.ts`, `photo-history.ts` | Inserção, recorte, Filtros PRO, desfazer/restaurar das evidências |
| `photo-storage.ts` | Upload e links assinados (mesmo bucket, novo prefixo) |
| Modelos SGZ-156 / Pós 60 | Relatório de resposta por FV/OS, com o mesmo padrão visual |
| `report-export.ts` (`html2canvas` + `jsPDF`) | PDF do relatório individual e do BI executivo |
| `csv.ts`, `xlsx-export.ts` | Exportações do BI |
| `PageHeader`, `Card`, `KpiCards`, `charts.tsx` (recharts) | Painel BI e telas do módulo |
| `usePersistedState` | Filtros do painel |
| `AccessGate`, `useAuth` | Controle de acesso |

**Não serão alterados:** `qualyflow_analyses`, `qualyflow_reports`, `qualyflow_settings`, perfis, políticas, bucket e a retenção do Emissor.

## 3. Por que tabelas novas (e por que não reutilizar as atuais)

- `qualyflow_analyses` é o histórico do **Analista** e tem regra própria de classificação por etapas. Misturar a tratativa de fiscalização ali contaminaria os indicadores existentes.
- `qualyflow_reports` sofre a **retenção de 2 por usuário** — um relatório de resposta à AlphaGeos seria apagado. Não pode ser usado.
- Portanto: tabelas próprias com prefixo **`qa_`**, RLS no mesmo padrão (autenticado), sem tocar nas existentes.

### Modelo proposto
| Tabela | Papel | Campos principais |
|---|---|---|
| `qa_documents` | O PDF importado e sua leitura assistida | `id`, `fingerprint` (único), `file_name`, `pdf_path`, `pages`, `fields` jsonb, `confidence` jsonb, `snippet`, `source`, `text_available`, `imported_by`, `imported_at` |
| `qa_document_items` | Etapas/itens do FV | `id`, `document_id`, `code` (1.1…), `description`, `original_result` (**imutável**), `complement`, `page`, `internal_result` (só humano), `notes` |
| `qa_cases` | Tratativa única por FV/OS | `id`, `document_id`, `fac`, `os`, `address`, `municipality`, `locality`, `service_type`, `contractor`, `analysis_status`, `outcome`, `reopen_count`, datas |
| `qa_case_events` | Histórico imutável (auditoria) | `id`, `case_id`, `type`, `at`, `by`, `payload` jsonb |
| `qa_redo` | Serviços a refazer (1 por caso) | `case_id`, `item_code`, `problem`, `reason`, `team_type`, `foreman`, `sent_at`, `scheduled_at`, `redo_status`, `finished_at`, `notes` |
| `qa_reports` | Relatório de resposta por FV/OS | `case_id`, `template_id`, `values` jsonb, `photos` jsonb, `justification`, `sent_at`, `status` |

Enums separados por etapa (não somar categorias diferentes):

- **Análise (§5):** aguardando_analise · em_analise · encaminhado_fiscalizacao · conforme_verificado · nao_conforme_confirmado · necessita_esclarecimento
- **Réplica (§8):** pendente_encaminhamento · encaminhado · aguardando_programacao · programado · em_execucao · aguardando_verificacao · corrigido_fotos · aguardando_resposta · encerrado

## 4. Armazenamento (sem bucket novo, sem nova permissão)

- Mesmo bucket privado, prefixo **`qualyflow/auditor/<caso>/...`** — já coberto pelas políticas atuais (`qualyflow/%`), então **nenhuma alteração de permissão**.
- Guarda-se: o **PDF original** (conferência visual e rastreabilidade) e as **fotografias** do fiscal.
- Deduplicação por `fingerprint`: reimportar o mesmo PDF **atualiza** o registro, não cria outro.
- Fotos seguem o mesmo padrão: comprime → envia → guarda só o `path`; link assinado ao abrir.

## 5. Leitura assistida — regras que o código vai respeitar

1. Nunca preencher campo ausente por suposição: fica vazio e marcado para revisão.
2. `original_result` vem do FV e é **somente leitura** na interface.
3. N/A e item sem classificação **nunca** contam como conformidade.
4. Cada dado guarda a **página de origem**; divergência entre tabela, observação e legenda gera alerta, não decisão.
5. Nenhum encaminhamento automático para fiscalização, refazer ou relatório.
6. Extração sempre revisável: o documento original fica ao lado dos campos.

## 6. Contagem correta dos indicadores (§10)

| Indicador | Conta | Não conta |
|---|---|---|
| FV/OS recebidas | 1 por `qa_cases` | itens |
| Itens apontados | linhas de `qa_document_items` | documentos |
| Serviços a refazer | 1 por `qa_redo` ativo | itens |
| Relatórios emitidos | 1 por `qa_reports` enviado | casos |
| Devoluções | eventos `retorno_alphageos` | casos |
| Conforme / Não conforme | `outcome` do caso | etapas isoladas |

## 7. Rotas novas (navegação independente, integrada ao shell atual)

`/auditor` (visão geral + fila do dia) · `/auditor/recebimento` · `/auditor/analise/:id` · `/auditor/refazer` · `/auditor/relatorios` · `/auditor/bi`

## 8. Etapas seguintes

| Etapa | Entrega | Teste de aceite |
|---|---|---|
| 2 | Navegação, layout navy/branco/cinza, assinatura "Criado por Igor Ramalho", tabelas `qa_*` com RLS | rotas abrem; nada existente muda |
| 3 | Importação manual + leitura assistida + PDF original + página de origem + alertas | PDFs com texto, escaneado (OCR), tabela, fotos e modelos diferentes |
| 4 | Análise técnica e validação humana (classificação interna separada) | N/A e item sem classificação não viram conforme |
| 5 | Fiscalização, relatório individual e REFAZER | conforme→relatório; não conforme→refazer→fotos finais |
| 6 | Tratativas, devoluções e reabertura do mesmo registro | devolução incrementa histórico, não cria FV nova |
| 7 | Painel BI + relatório semanal PDF/Excel | mesmos filtros nos dois arquivos; sem número fictício |
| 8 | Testes finais e correções | os 15 cenários da §14 |

## 9. Decisões que dependem de você

1. **Guardar o PDF original na nuvem?** Recomendo sim (é o que permite "visualizar o documento original" e preservar a prova). Custo estimado: 0,5–2 MB por FV.
2. **Quem acessa o Auditor?** Recomendo gestor + auxiliar (vistoriador), com criação/edição liberada e exclusão restrita ao gestor.
3. **Relatório de resposta:** usar os modelos existentes SGZ-156 / Pós 60 (recomendado, mantém o padrão da AlphaGeos) — confirma?

## 10. Riscos mapeados

- PDFs sem texto → OCR local (mais lento); nada é enviado para fora.
- Modelos variados de FV → leitura assistida com alerta, nunca decisão automática.
- Volume de fotos no mesmo bucket → órfãos já existem hoje; o Auditor nasce com referência obrigatória e inventário próprio no futuro.
- Não há restauração de backup comprovada — vale para o módulo novo também.
