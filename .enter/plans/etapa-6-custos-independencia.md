# Etapa 6 — Análise de custos e independência da plataforma

> **Etapa exclusivamente de diagnóstico.** Nenhuma migração, configuração, permissão, exclusão, contratação ou alteração de dados de produção foi executada. Todos os números abaixo vieram de consultas **somente leitura** ao banco, ao armazenamento e ao repositório.

## Correção factual obrigatória

- O projeto **não roda em Lovable Cloud**. Não existe nenhuma referência a "Lovable" no repositório (verificado por busca textual: **0 ocorrências**).
- A base real é: **frontend Vite + React 19 + TypeScript + Tailwind** e **Enter Cloud** (Postgres + Auth + Storage + funções de backend).
- Portanto, "independência do Lovable Cloud" foi tratado como **independência do Enter Cloud**, e **não há plano, créditos ou faturas de Lovable a auditar**.

## 1. Arquitetura atual (mapa)

| Camada | O que existe | Números medidos |
|---|---|---|
| Frontend | SPA estática (Vite), 4 rotas internas + login; 20.654 linhas em `src/`; `dist/` = **5,7 MB** | hospedável em qualquer host estático |
| Autenticação | Login por **usuário** (mapeado para `<usuario>@qualyflow.local`), e-mail/senha; cadastro público **desativado**; sem provedor social | **4** usuários em `auth.users`, **2** perfis, 49 refresh tokens |
| Banco | 5 tabelas com RLS: `qualyflow_reports`, `qualyflow_analyses`, `qualyflow_settings`, `qualyflow_user_settings`, `qualyflow_profiles` | 5 relatórios, **1.115** análises, 1 settings compartilhada, 1 por usuário |
| Permissões | RLS por usuário no relatório; `qualyflow_is_manager()` governa perfis; foto só para autenticado | 2 papéis: gestor e vistoriador |
| Armazenamento | 1 bucket **privado** (`qualyflow-fotos`), links assinados de 12 h | **541 arquivos · 281 MB**, média **531 KB**, maior **1,29 MB** |
| Funções de backend | **1** função (`qualyflow-users`, 194 linhas, somente gestor: criar/bloquear/senha/excluir) | contagem de execuções **não mensurável** (busca de logs indisponível) |
| Análise de PDFs | `pdfjs-dist` + OCR **local** (`tesseract.js`, WASM) — opcional, desligado por padrão | nenhum documento sai do navegador |
| Relatórios | PDF via `html2canvas` + `jsPDF`, 1 página por folha A4; Excel via SheetJS | 100% no cliente |
| Serviços externos pagos | **Nenhum** | zero chamadas de IA, zero APIs de terceiros |
| Exceção de rede | OCR baixa worker WASM + modelo de português (~15 MB) de CDN pública na 1ª execução | depois fica em cache |
| Analytics | SDK do template inicializado em `main.tsx` | ver observação abaixo |

**Observações relevantes (confirmadas):**
- Banco ocupa **94 MB**, mas as tabelas do QualyFlow somam **~9 MB**. O restante vem de tabelas **internas da plataforma** no schema `_analytics` (**~70 MB**, ~31,6 mil eventos de log em 6 tabelas). **Não é possível, em modo leitura, associar cada tabela de log a este projeto nem a outro.**
- `qualyflow_reports` ocupa **5,2 MB físicos para 5 linhas** cujo conteúdo lógico é de ~1 KB cada: indício de espaço não recuperado de versões anteriores. Sem impacto relevante de custo hoje.
- Dos **541** arquivos de foto, apenas **26** caminhos aparecem nos 5 relatórios existentes: **~515 arquivos estão órfãos** (~270 MB, estimativa pela média de 531 KB).
- A retenção ("2 relatórios mais recentes") apaga **somente as linhas do banco** (`pruneMyReports`); **não apaga arquivo de foto** — o bucket não tem política de exclusão. Cada nova versão de filtro/recorte também cria um arquivo novo.

## 2. Custos confirmados e estimados

### Confirmado
- **Não tenho acesso a dados de faturamento.** Nenhum valor de plano, crédito, consumo cobrado ou fatura é visível pelas ferramentas.
- Consumo técnico confirmado: 94 MB de banco, 281 MB de armazenamento, 541 arquivos, 1.115 registros de análise, 1 função de backend, ~9 MB de dados próprios.
- Ausência total de dependência de serviços pagos de IA/terceiros no código.

### Estimativas com premissas explícitas (não são fatura)
- Crescimento de armazenamento: ~13 fotos por relatório × 531 KB ≈ **6,9 MB por relatório**; retenção não apaga arquivos → **crescimento monotônico**.
  *Premissa*: 5 usuários × 4 relatórios/mês ≈ 140 MB/mês ≈ **1,7 GB/ano**, mais ~50% de versões de edição ≈ **2,5 GB/ano**.
- Crescimento de banco: ~3 KB por análise → 20 mil análises ≈ **60 MB**. Irrelevante frente ao armazenamento.
- Tráfego de saída: abrir um relatório carrega ~7 MB de fotos; *premissa* 5 usuários × 5 aberturas/dia × 20 dias ≈ **3,5 GB/mês**.
- Referência de preços públicos de mercado (consulta na web, **não é a fatura deste projeto**): backend gerenciado equivalente na faixa de **US$ 25/mês** (inclui ~8 GB de banco, ~100 GB de armazenamento, ~250 GB de tráfego, ~100 mil usuários ativos e ~2 milhões de invocações), com excedentes da ordem de US$ 0,021/GB-mês (armazenamento) e US$ 0,09/GB (saída). VPS de 2 vCPU/4 GB na faixa de **US$ 5–7/mês**.

## 3. Dados ainda necessários (com você)

1. **Plano e consumo reais da plataforma** (painel da conta): valor mensal, créditos, data de renovação.
2. Se o **analytics do template** deve continuar ligado e quem responde pelos logs internos.
3. **Volume real de operação**: quantos vistoriadores e quantos relatórios por dia/semana.
4. **Obrigação de guarda das fotos** (prazo legal/contratual de retenção de prova de fiscalização) — define se órfãos podem ser apagados e quando.
5. **Requisito de sigilo/LGPD**: exigência de dados e fotos em território nacional ou em nuvem corporativa própria.
6. Se existe **orçamento** definido para hospedagem e se há restrição a cartão internacional.

## 4. Comparativo de cenários

| | A. Manter atual | B. Otimizar o atual | C. Frontend separado, backend mantido | D. Infraestrutura independente |
|---|---|---|---|---|
| **Vantagens** | nada a fazer; risco zero; já em uso | corta o principal vetor de custo (fotos órfãs/versões) sem trocar de plataforma | ganho de controle de deploy e URL; **reversível em minutos** | controle total, custo fixo previsível, soberania de dados |
| **Desvantagens** | armazenamento cresce sem limite; ~515 órfãos já pagos | exige função de limpeza com verificação de referências (autorização) | dois provedores a gerenciar; CORS/redirect a ajustar | vira operação de TI: backup, updates, monitoração, TLS |
| **Custo estimado** | atual (não informado) + crescimento ~2,5 GB/ano | ~igual ao atual, com teto | ~igual ao atual + host estático (faixa gratuita a poucos US$/mês) | US$ 5–7/mês (VPS) + domínio; **mais tempo de manutenção** |
| **Complexidade** | nenhuma | baixa | baixa | alta |
| **Segurança** | RLS + bucket privado + links assinados de 12 h | igual, com menos exposição acumulada | igual (backend intacto) | **exige reassumir tudo**: RLS, políticas, backup, TLS, atualização do Postgres |
| **Manutenção** | nenhuma | pequena | pequena | contínua, e depende de pessoa disponível |
| **Riscos** | custo crescente silencioso; banco sem restauração testada | exclusão indevida de foto em uso | quebra de login se redirect não for configurado | perda dos dados se a restauração **não comprovada** for usada como plano |

## 5. Segurança e continuidade

- **Backup:** a exportação (JSON/Excel/CSV) está implementada e com verificação de integridade, mas **a restauração nunca foi executada em ambiente separado** — portanto **não é considerado validado**, apesar dos arquivos gerados.
- **Fotos de fiscalização:** privadas, acessíveis só por link assinado autenticado; porém **sem exclusão**, o que acumula prova antiga e eleva o custo.
- **Perfis:** gestor único (`ramalhoigor`) com poder de criar/bloquear usuários; cadastro público fechado; 2 contas ativas.
- **Perdas possíveis hoje:** nenhuma cópia fora da plataforma (o backup é gerado sob demanda pelo gestor).
- **Ponto crítico:** migrar sem uma restauração comprovada transforma qualquer mudança em risco irreversível.

## 6. Recomendação para uso interno na Célula da Qualidade

1. **Agora: cenário B, sem trocar de plataforma.** Limpeza dos ~515 arquivos órfãos por função de backend com verificação de referência; limite de versões guardadas por foto (hoje cada ajuste cria arquivo novo); reavaliar resolução final das fotos (a 2200 px/0,90 e upscale 4× chegam a 1,29 MB por arquivo).
2. **Depois: cenário C**, apenas se houver exigência de URL/identidade própria — é o passo mais barato e reversível.
3. **Cenário D somente se** houver exigência de soberania/LGPD ou se o custo crescer de forma relevante; hoje o volume (94 MB de banco, 281 MB de fotos, 2 usuários) **não justifica** assumir operação de servidor.
4. **Antes de qualquer migração:** executar a restauração do backup em ambiente separado, com os três modelos de relatório conferidos.
5. Definir com a Célula o **prazo de guarda das fotos** — é o que define o custo no longo prazo.

## 7. Plano de migração reversível (se for decidido)

- **Fase 0 — Gate:** restaurar o backup exportado em ambiente isolado e conferir contagens e fotos. Sem isso, não avançar.
- **Fase 1 — Frontend (reversível):** publicar o mesmo `dist/` em host estático apontando para o backend atual; login por redirect ajustado. Reversão: voltar à URL antiga.
- **Fase 2 — Cópia de dados:** exportar banco (dump lógico) e copiar o bucket; manter a origem **intacta**.
- **Fase 3 — Espelho:** rodar destino em paralelo e comparar contagens, fotos e geração de PDF.
- **Fase 4 — Corte:** trocar a URL, manter a origem por ≥1 ciclo completo de uso.
- **Reversão:** em qualquer fase, basta apontar de volta para a origem — nenhum dado é apagado.

**Ordem**: Fase 0 → 1 → 2 → 3 → 4. Nenhuma fase inicia sem validação da anterior.
