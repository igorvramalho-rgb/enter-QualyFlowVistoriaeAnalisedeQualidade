# QualyFlow — Fase 2: campos FV/OS/equipe/tipo de NC, Excel, Observação e redesign

## Contexto

A fase 1 do QualyFlow (Emissor de Relatórios + Analista de Vistorias, 100% no navegador, folhas A4 fiéis aos três modelos, extração por colunas validada nos PDFs reais) está entregue e verificada.

Esta fase atende quatro pedidos do usuário:

1. **Analista:** passar a extrair e exibir o **FV** (ex.: `FV-108101`) e a **Ordem de Serviço** (ex.: `2699610379`) — dados que também vêm no PDF.
2. **Analista:** gerar uma **planilha Excel (.xlsx)** com: Endereço, FV, Ordem de Serviço, Data de Vistoria, Equipe Executante e Tipo de Não Conformidade — mantendo o botão CSV.
3. **Emissor:** novo campo de **Observação** impresso nas folhas SGZ-156 e Pós 60 (logo abaixo dos dados de cabeçalho e **apenas quando preenchido**, preservando a fidelidade dos modelos).
4. **Design:** layout mais **tecnológico e atrativo** — painéis de vidro com brilho, gradiente azul/verde e malha de fundo.

Decisões confirmadas com o usuário:
- Gerar **`.xlsx` real** e **manter o CSV**.
- FV / Equipe Executante / Tipo de Não Conformidade: **amostra de PDF será anexada pelo usuário** para calibrar os rótulos (os três PDFs modelo atuais não trazem esses dados). Até lá, valem heurísticas por rótulo.
- Observação: **nos dois modelos, abaixo dos dados de cabeçalho, só quando preenchida**.
- Design: **painéis de vidro com brilho, gradiente azul/verde e malha de fundo**.

Regra de idioma: interface e textos em **português do Brasil**.

---

## 1. Novos campos extraídos (Analista)

### `src/lib/analysis.ts`
- `ANALYSIS_FIELDS` (ordem do diálogo de revisão): `os`, **`fv`**, `fac`, `protocoloSgz`, `contratada`, `servicoExda`, `equipeExecutante`, `tipoNaoConformidade`, `origemDemanda`, `prazo`, `situacao`, `polo`, `endereco`, `data`.
- Renomear o rótulo de `data` para **"Data de Vistoria"** (o key permanece `data` para não invalidar registros já salvos).
- Novo `EXPORT_FIELDS` — **fonte única de verdade** da planilha, na ordem pedida:
  `Endereço (endereco)`, `FV (fv)`, `Ordem de Serviço (os)`, `Data de Vistoria (data)`, `Equipe Executante (equipeExecutante)`, `Tipo de Não Conformidade (tipoNaoConformidade)`
  seguido de `Polo`, `Status`, `Arquivo`, `Páginas`, `Revisado`.
- Novo `NC_TYPE_LABELS`? não — tipo de NC é texto livre; normalizar por `stripAccents + trim + UPPER` apenas para agrupar no gráfico.

### `src/lib/pdf-extract.ts`
Novos padrões em `INLINE_PATTERNS` (rodam sobre o texto sem acentos/minúsculo e devolvem o trecho original):
- `fv`: `/\b(fv[\s-]*[0-9][0-9./-]{2,})/` (captura `FV-108101` como impresso) e `/\bfv\s*[:=]\s*([0-9][0-9./-]{2,})/` (captura `108101` em "FV: 108101").
- `equipeExecutante`: `/equipe\s*(?:executante|de\s*execucao)?\s*[:=]?\s*([^\n|]{3,60})/`.
- `tipoNaoConformidade`: `/tipo\s*de\s*nao\s*conformidade\s*[:=]?\s*([^\n|]{3,80})/` e `/tipo\s*[:=]\s*([^\n|]{3,80})/` (o segundo só é aceito se não vier de uma linha de rótulos).
- Reforço em `TABLE_LABELS`/colunas: incluir `fv` como coluna reconhecível antes de `fac` (`/\bfv\b/`) para tabelas que trazem "FV | OS | ...".
- `STOP_WORDS` + `OWN_LABELS`: acrescentar `fv`, `equipe executante`, `equipe`, `tipo de nao conformidade` para o corte de valores e evitar autolimpeza indevida.
- Ordem de prioridade mantida: tabela por colunas (alta) → rótulo inline (média) → nome do arquivo (baixa). Nada é inventado: campo não encontrado fica vazio com confiança "Não encontrado".
- **Calibração pendente:** ao receber a amostra do usuário, ajustar os rótulos/variações de FV, Equipe Executante e Tipo de Não Conformidade (inclusive quando vierem em bloco de texto no fim do PDF).

### `src/components/analista/review-dialog.tsx`
- Nenhuma mudança estrutural: os novos campos entram automaticamente por `ANALYSIS_FIELDS` e continuam editáveis com selo de confiança + texto lido.

---

## 2. Planilha Excel (.xlsx)

### Dependência
```bash
pnpm add xlsx
```
(SheetJS CE — gera `.xlsx` real sem planilha HTML falsa.)

### `src/lib/xlsx-export.ts` (novo)
- `buildWorkbook(headers, rows, sheetName)` → monta a planilha com **larguras de coluna automáticas** e a linha de cabeçalho congelada (`!cols`, `!freeze`).
- `downloadXlsx(fileName, headers, rows, sheetName)` → `XLSX.writeFile` com **import dinâmico** (`await import("xlsx")`) para não pesar o carregamento inicial.
- Reaproveita a mesma matriz de linhas usada pelo CSV: `src/lib/analysis-export.ts` (novo) expõe `buildAnalysisMatrix(records, { includeStatus })` retornando `{ headers, rows }` a partir de `EXPORT_FIELDS`.

### `src/lib/csv.ts`
- Mantido; passa a consumir `buildAnalysisMatrix` para que **CSV e Excel tenham exatamente as mesmas colunas e ordem**.

### `src/components/analista/vistorias-table.tsx`
- Botão **"Baixar Excel (.xlsx)"** ao lado de **"Exportar CSV"**, exportando **somente as linhas filtradas**.
- Colunas da tabela: `Arquivo | FV | OS | Data | Polo | Endereço | Não Conformidade | Status | Ações`, onde "Não Conformidade" mostra o **tipo** (linha principal) e a **equipe executante** (subtexto). O tipo do relatório e as páginas continuam no subtítulo de "Arquivo".
- Busca passa a considerar também `fv` e `equipeExecutante`.
- Filtro novo: **Tipo de Não Conformidade** (populado com os valores distintos já normalizados).

---

## 3. Analista — indicadores do tipo de não conformidade

- `src/components/analista/charts.tsx`: novo gráfico **"Não conformidades por tipo"** (barras horizontais, top 8 + "Outros", usando `--chart-*` e `--destructive`), com estado vazio tratado.
- `src/components/analista/kpi-cards.tsx`: novo KPI **"Tipos de não conformidade"** (quantidade de tipos distintos) e campo de última análise (data/hora) no rodapé do card, reforçando o tom "painel".
- `src/pages/Analista.tsx`: monta os dados por tipo e repassa aos componentes.

---

## 4. Emissor — campo de Observação

- `src/lib/report-document.ts`: `ReportDraft.observacoes?: string` e helper `hasObservacoes(value)`.
- `src/components/emissores/report-form.tsx`: `Textarea` **"Observações"** (todos os modelos), com contador de caracteres e dica de que só é impressa quando preenchida.
- `src/pages/Emissor.tsx`: estado `observacoes`, persistido em rascunho (salvar/abrir/duplicar/novo) e passado para `ReportDocumentView`.
- `src/components/report/report-document-view.tsx` → repassa às folhas.
- Folhas:
  - `report-sheet-sgz.tsx`: bloco com borda fina **abaixo da tabela DADOS DA VISTORIA**, rótulo "Observações" em negrito e texto; renderizado **apenas na primeira página** e só se preenchido; com `line-clamp` para não estourar a folha.
  - `report-sheet-pos60.tsx`: bloco equivalente **abaixo da tabela de 6 colunas e acima da grade de fotos**, só quando preenchido; a grade continua `flex-1`, absorvendo a redução.
- Quando o campo está vazio, as folhas ficam **idênticas aos modelos** (fidelidade preservada).

---

## 5. Redesign tecnológico (vidro + brilho + malha)

### `src/index.css`
- Novos tokens (claro e escuro): `--glass`, `--glass-border`, `--mesh`, `--glow-primary`, `--glow-accent`, `--hairline`.
- Fundo do `body`: dois gradientes radiais (azul da marca no topo-esquerda, verde no topo-direita) + **malha de 44px** via `repeating`/linear-gradients, com intensidades diferentes por tema.
- Componentes utilitários novos:
  - `.panel-glass` — cartão de vidro (gradiente translúcido + `backdrop-blur` + borda hairline + brilho superior em gradiente azul→verde);
  - `.panel-glass-hover` — elevação e `--shadow-glow` no hover;
  - `.glow-dot` — ponto luminoso pulsante (indicadores de status);
  - `.tech-strip` — faixa fina com gradiente animado (usada no topo do shell e no cabeçalho das seções);
  - `.chip-tech` — etiqueta discreta com fonte mono e borda hairline (números/IDs).
- Animação nova: `pulse-glow` e `sheen` (varredura de brilho na faixa do topo). Keyframes no `index.css` e em `tailwind.config.ts`.
- **Nada disso toca as folhas A4** — `.print-sheet` continua papel branco e as regras de impressão seguem isolando `#print-portal`.

### Componentes
- `src/components/layout/app-shell.tsx`: barra superior de vidro com `.tech-strip` animada no topo, indicador de "sistema local" com `.glow-dot` e avatar/credito como chip.
- `src/components/layout/app-sidebar.tsx`: sidebar com gradiente profundo, logo com halo (`shadow-glow`), itens com marcador luminoso na rota ativa, rodapé com status pulsante.
- `src/components/common/page-header.tsx`: passa a ser um painel de vidro com ícone em tile gradiente, linha de "chips" técnicos (ex.: total de vistorias / páginas / polos no Analista; modelo e páginas no Emissor) e borda hairline.
- `src/components/ui/card.tsx`: base mais "vidro" (fundo translúcido e borda hairline) — todos os cartões do app herdam o novo visual sem reescrever cada tela.
- `src/components/ui/button.tsx`: variantes novas `glow` (gradiente da marca + `shadow-glow`) e `glass`, usadas nas ações principais (Baixar PDF, Baixar Excel).
- KPIs, gráficos, tabela, slots de foto e picker de modelos: troca de classes para `.panel-glass`, cabeçalhos com `.tech-strip`, **badges de status com `.glow-dot`** e gráficos com preenchimento em gradiente (defs `linearGradient` no Recharts).
- Contraste AA preservado nos dois temas; sem `bg-white`/`text-white` crus e sem emojis (ícones só de `lucide-react`).

---

## Arquivos principais

| Arquivo | Mudança |
|---|---|
| `src/lib/analysis.ts` | novos campos, rótulos, `EXPORT_FIELDS` |
| `src/lib/pdf-extract.ts` | padrões de FV, equipe, tipo de NC; stop words; coluna FV |
| `src/lib/analysis-export.ts` (novo) | matriz única de exportação |
| `src/lib/xlsx-export.ts` (novo) | geração do `.xlsx` com import dinâmico |
| `src/lib/csv.ts` | passa a usar a matriz única |
| `src/components/analista/vistorias-table.tsx` | colunas FV/Não Conformidade, filtro por tipo, botão Excel |
| `src/components/analista/charts.tsx` | gráfico por tipo de NC + gradientes |
| `src/components/analista/kpi-cards.tsx` | KPI de tipos de NC + última análise |
| `src/lib/report-document.ts`, `report-form.tsx`, `Emissor.tsx`, `report-document-view.tsx`, `report-sheet-sgz.tsx`, `report-sheet-pos60.tsx` | campo Observação ponta a ponta |
| `src/index.css`, `tailwind.config.ts`, `app-shell.tsx`, `app-sidebar.tsx`, `page-header.tsx`, `ui/card.tsx`, `ui/button.tsx`, telas | redesign tecnológico |
| `package.json` | `xlsx` |

Reutilizar: `cn`, `useLocalStorage`, `useScaledContainer`, `downloadCsv`, `tidyValue/stripAccents`, `PrintPortal`, `ReportDocumentView`, e os componentes `ui/*` já existentes.

---

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm run build`.
- Extração: harness temporário (mesmo método da fase 1) com os PDFs reais + texto sintético contendo `FV-108101`, `OS 2699610379`, `Equipe Executante` e `Tipo de Não Conformidade`; conferir valores e a origem (coluna/rótulo/nome do arquivo) e depois remover o harness.
- Excel: no harness, gerar o workbook e conferir **nome da aba, cabeçalho na ordem pedida e nº de linhas** sem depender de clique de download.
- Folhas: conferir visualmente a folha SGZ-156 e a Pós 60 Via **com e sem observação**, garantindo que sem observação o layout segue idêntico ao modelo.
- Design: capturas em `desktop_1280` e `mobile_390` de `/emissor` e `/analista`, nos temas escuro e claro, verificando contraste, ausência de overflow e que a folha do relatório continua clara.

## Notas de implementação (desvios)

- `xlsx` (SheetJS CE) **não escreve painéis congelados** na versão gratuita: a planilha sai com cabeçalho na primeira linha e larguras de coluna calculadas, sem `freeze`.
- A amostra de PDF com FV / Equipe Executante / Tipo de Não Conformidade **ainda não foi anexada**: os padrões atuais são por rótulo (`FV-108101`, `FV: 108101`, `Equipe Executante:`, `Tipo de Não Conformidade:`) e a calibração final depende dessa amostra.
- Os novos campos também são preenchíveis manualmente no diálogo de revisão, cobrindo PDFs digitalizados.
- O texto sobre superfícies de gradiente passou a usar o token novo `--on-brand` (o `--primary-foreground` do tema escuro é azul-escuro e ficava ilegível sobre o gradiente da marca).
- Os tokens de vidro/malha (`--glass`, `--mesh`, `--hairline`, `--glow-*`, `--on-brand`) existem nos dois temas, em blocos separados (`:root` e `.dark`).

## Implementation checklist

- [x] `xlsx` adicionado às dependências (0.18.5).
- [x] `src/lib/analysis.ts` com `fv`, `equipeExecutante`, `tipoNaoConformidade`, `data` rotulado "Data de Vistoria" e `EXPORT_FIELDS` na ordem pedida.
- [x] `src/lib/pdf-extract.ts` extrai `FV-108101` (com hífen) e `108101` (após "FV:").
- [x] Extração de OS por rótulo (inclui OS de 10 dígitos, ex.: `2699610379`).
- [x] Extração de Equipe Executante e Tipo de Não Conformidade por rótulo, com corte antes do próximo rótulo.
- [x] `STOP_WORDS`/`OWN_LABELS` incluem `fv`, `equipe`, `tipo de nao conformidade`.
- [x] Coluna `fv` reconhecida na leitura por colunas, com busca de rótulos independente e ordenada pela posição no documento.
- [x] `src/lib/analysis-export.ts` produz a matriz única usada por CSV e Excel.
- [x] `downloadXlsx` gera `.xlsx` com a aba "Vistorias", cabeçalho na ordem pedida e larguras calculadas (verificado: 18 colunas × 6 linhas, arquivo de ~29 KB).
- [x] `vistorias-table` mostra FV, Ordem de serviço, tipo de NC e equipe, filtra por tipo de NC e busca também por FV/equipe.
- [x] Botões "Baixar Excel (.xlsx)" e "Exportar CSV" exportam apenas as linhas filtradas, com as mesmas colunas.
- [x] Gráfico "Não conformidades por tipo" e KPI de tipos distintos renderizam com dados e com lista vazia.
- [x] `ReportDraft.observacoes` salvo, reaberto, duplicado e limpo em "Novo relatório".
- [x] Folha SGZ-156 imprime o bloco de Observações abaixo de DADOS DA VISTORIA, apenas na primeira página e só quando preenchido.
- [x] Folha Pós 60 imprime o bloco de Observações abaixo da tabela de 6 colunas e só quando preenchido.
- [x] Sem observação, as duas folhas permanecem idênticas aos modelos.
- [x] Tokens de vidro/malha/brilho nos temas claro e escuro, em blocos separados.
- [x] `body` com malha e gradientes radiais; `.tech-strip`, `.panel-glass`, `.panel-interactive`, `.glow-dot`, `.chip-tech`, `.ring-glow` disponíveis.
- [x] Shell, sidebar, rodapé, page-header, cards (base do shadcn), botões (`glow`/`glass`), KPIs, gráficos, tabela, slots de foto, picker de modelos, uploader e diálogo de revisão no novo visual.
- [x] Sem cor crua nova e sem emoji; ícones apenas de `lucide-react`.
- [x] Harness temporário de verificação removido.

## Verification checklist

- [x] `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- [x] Dashboard verificado com dados de exemplo: 7 KPIs (incluindo tipos de NC), barras por polo com gradiente, rosca de status, gráfico por tipo de NC e tabela com FV/OS/equipe/tipo.
- [x] Planilha verificada na estrutura: aba `Vistorias`, cabeçalho com Endereço, FV, Ordem de Serviço, Data de Vistoria, Equipe Executante e Tipo de Não Conformidade nas seis primeiras colunas, 5 registros, arquivo xlsx válido.
- [x] Folhas conferidas com observação preenchida (SGZ e Pós 60) e sem observação (layout idêntico ao modelo).
- [x] Tema escuro e claro verificados em 1440px nas duas rotas, com contraste legível e folha do relatório sempre branca.
- [x] Responsividade verificada em `mobile_390` das duas rotas, sem overflow.
- [ ] **Pendente de calibração**: extração de FV/Equipe/Tipo de Não Conformidade contra a amostra real (aguardando o anexo do usuário).
- [ ] **Verificação manual pendente do usuário**: baixar o `.xlsx` e abrir no Excel; imprimir/baixar o PDF com observação preenchida.
