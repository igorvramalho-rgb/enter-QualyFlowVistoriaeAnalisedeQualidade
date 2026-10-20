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

---

# Fase 3 — Correções de campo, logos, fotos e PDF

## Contexto

Três correções pedidas após o uso real:

1. **"Nº FAC é FV o correto"** — o campo da folha Pós 60 deve se chamar **FV**.
2. **Campo de logos com possibilidade de editar** — trocar/remover logos de forma explícita.
3. **Fotos bugadas ao inserir no relatório**, tanto ao imprimir quanto ao baixar o arquivo.

## O que foi feito

### Nº FAC → FV
- Folha Pós 60: coluna `FV:` (era `Nº FAC:`); campo `fv` no lugar de `fac` em `ANALYSIS_FIELDS` e `EXPORT_FIELDS`.
- A extração continua aceitando o rótulo antigo **"Nº FAC"** dos PDFs já emitidos, gravando no campo **FV**.
- Tabela do Analista, CSV, Excel e diálogo de revisão passam a usar apenas **FV**.

### Logos editáveis
- Card **"3. Logotipos e cabeçalho institucional"** sempre visível: cada logo tem pré-visualização, **Trocar**, **Remover** (some da folha) e **Restaurar padrão**, além de **arrastar e soltar** a imagem.
- `normalizeSettings()` garante que logos e cabeçalho sempre existam (configuração antiga/incompleta não quebra a folha).

### Fotos e PDF (causas encontradas)
- **PDF saía em branco / com páginas duplicadas**: o html2pdf clona o elemento que recebe e as minhas regras de posicionamento (`position: absolute; left: -20000px`) iam junto para o clone, deixando-o fora da área de captura; além disso o corte automático de páginas duplicava as quebras.
  - Correção: a visibilidade passou para um **host** (`#print-portal-host`), que nunca é clonado; a porta em si não tem regra de display/posição.
  - O PDF agora é montado **página a página**: cada `.print-sheet` é rasterizado com **html2canvas** e inserido com **jsPDF** (210 × 297 mm). Resultado verificado: 5 folhas → **5 páginas**, sem cortes.
  - `html2pdf.js` foi removido; ficaram `html2canvas` e `jspdf` (as mesmas bibliotecas que ele empacotava).
- **Foto do SGZ não aparecia na captura**: a moldura usava `height: 100%`, que não resolvia no DOM clonado. Correção: moldura posicionada com **`absolute inset`** (tamanho definido por insetos, sem depender de porcentagem) nas duas folhas.
- **`object-fit` não é suportado pelo html2canvas** (as fotos sairiam esticadas): cada foto tem `<img>` com `object-fit` para a **impressão** e um fundo equivalente (`background-size: contain/cover`) para a **captura do PDF**; a `<img>` é ocultada apenas durante a geração do arquivo.
- **Orientação EXIF**: a leitura da imagem passou a usar `createImageBitmap(..., { imageOrientation: "from-image" })`, evitando fotos giradas em relatórios feitos com celular.
- **Ctrl+V em campo de texto**: a colagem agora é ignorada quando o foco está em `input`, `textarea` ou `contenteditable` (antes a foto era capturada mesmo ao colar texto).
- Fotos um pouco mais leves (lado maior 1500 px, qualidade 0.8) e **contador de peso** na seção de fotos (`0/4 • 0 B`).

## Implementation checklist (fase 3)

- [x] Campo `fv` substitui `fac` em `analysis.ts`, `report-templates.ts`, tabela e exportações.
- [x] Rótulo antigo "Nº FAC" continua sendo lido dos PDFs e gravado em FV.
- [x] Card de logos sempre visível, com pré-visualização, trocar, remover, restaurar e arrastar-e-soltar.
- [x] `normalizeSettings()` protege contra configuração incompleta.
- [x] Visibilidade da porta de impressão movida para `#print-portal-host`; a porta não recebe `display`/`position` por id.
- [x] PDF montado com html2canvas + jsPDF, uma página por folha.
- [x] Molduras de foto com `absolute inset` nas duas folhas.
- [x] `<img>` para impressão + fundo equivalente para a captura, com `.exporting` ocultando apenas a imagem.
- [x] `imageOrientation: "from-image"` na compressão das fotos.
- [x] Colagem ignorada em campos de texto; contador de peso das fotos.
- [x] `html2pdf.js` removido das dependências.

## Verification checklist (fase 3)

- [x] `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- [x] **PDF verificado de ponta a ponta** (harness temporário que gera o PDF real e o reabre com pdfjs): 5 folhas → 5 páginas, fotos presentes e sem distorção na folha Pós 60 e nas 4 páginas do SGZ.
- [x] Folha Pós 60 exibe a coluna **FV** com o valor `FV-108101`.
- [x] Emissor com as seções 1 Modelo, 2 Dados, **3 Logotipos e cabeçalho**, 4 Fotos e as chips de estado.
- [x] Responsividade conferida em `mobile_390` do Analista após as mudanças.
- [x] Harness temporário e amostras removidos.
- [ ] **Verificação manual pendente do usuário**: baixar o PDF pelo botão (o caminho de download em si, com `pdf.save`, não é clicável na sandbox) e imprimir com "Gráficos de plano de fundo" desligado, confirmando que as fotos continuam saindo.

## Ajuste — observação cortada

- Removidos os limites de altura (`max-h` + `overflow-hidden`) dos blocos de observação nas duas folhas: o texto agora é impresso integralmente.
- Campo de observação ampliado: 6 linhas visíveis, redimensionável e limite de **2000** caracteres (antes 600).
- Áreas de foto com altura mínima (75 mm no SGZ, 138 mm no Pós 60) para não colapsarem quando a observação é longa.
- `.print-sheet` passou a `min-height: 296.5mm` (margem de segurança de 0,5 mm contra estouro de página).
- PDF: sobra de até 7 mm é absorvida em uma única página; acima disso a folha é **fatiada em páginas inteiras** (sem cortar texto e sem página em branco).
- Verificado com observação de ~1.450 caracteres: **5 folhas → 5 páginas**, texto completo e legível nas duas folhas, sem página extra.

## Ajuste — bloco volta a ser "Nº FAC"

- Folha Pós 60, tabela do Analista, revisão, CSV e Excel voltaram a usar **Nº FAC** (chave `fac`), com o exemplo de valor do modelo (69730).
- A extração lê **os dois rótulos** nos PDFs ("Nº FAC" e "FV"), gravando sempre em Nº FAC.
- Migração automática dos dados já salvos: registros de análise e rascunhos que ficaram com `fv` são convertidos para `fac` ao abrir a tela, sem perder valores.
- Verificado: folha com coluna **Nº FAC** e valor 69730; migração `fv → fac` em rascunho e registro; registro que já tem `fac` não é alterado.

## Blocos de importação por polo

- Polos fixos: **Vila Maria / Santana**, **Freguesia** e **Gopoúva** (`POLOS` em `src/lib/analysis.ts`).
- A tela do Analista passou a ter **um bloco de importação por polo** (grade de 3 no desktop, empilhada no mobile). O arquivo solto/clicado no bloco recebe aquele polo no registro — o polo do bloco prevalece sobre o texto do PDF e entra com confiança "Alta".
- Cada bloco mostra a contagem de vistorias do polo e o recorte por situação (conformes, em andamento, não conformes e a revisar), com progresso de leitura dentro do próprio bloco.
- O gráfico "Vistorias por Polo/Região" e o filtro de polo da tabela seguem a ordem fixa dos três polos; polos desconhecidos aparecem depois.
- O diálogo de revisão passou a oferecer **Nº polo como lista** dos três polos (mantendo valores antigos de outros polos como opção extra).
- `pdf-uploader.tsx` foi substituído por `polo-upload-grid.tsx`.
- Verificado com base de teste: 2 vistorias por polo, contagens e chips corretos, KPIs (6 vistorias, 3 polos) e gráfico na ordem Vila Maria / Santana → Freguesia → Gopoúva. Base de teste limpa ao final.

---

# Fase 4 — Persistência na nuvem (login + base compartilhada)

## Contexto

Até aqui os dados viviam só no armazenamento local do navegador. O usuário pediu para manter tudo salvo na nuvem, com acesso de outros computadores, e escolheu **e-mail e senha** com **base compartilhada** entre a equipe.

## O que foi feito

### Banco (Enter Cloud)
- Tabelas novas, sem tocar em nada existente:
  - `qualyflow_reports` — relatórios do Emissor (nome, modelo, valores, fotos em jsonb, objeto, observações, autor, datas).
  - `qualyflow_analyses` — vistorias analisadas (fingerprint, arquivo, páginas, tipo, campos, confiança, status, trecho, revisado).
  - `qualyflow_settings` — linha única `default` com cabeçalho institucional e logos.
- **RLS habilitado nas três** com políticas: leitura para `authenticated`, escrita apenas com `auth.uid()` preenchido. Base compartilhada: quem tem conta vê a mesma base; visitante sem login não vê nada.
- Trigger `qualyflow_touch_updated_at` mantém `updated_at`.
- Confirmação por `supabase_get_table_schema`: colunas, índices e políticas aplicados.

### Autenticação
- E-mail + senha com **cadastro habilitado** e **confirmação automática** (sem ida ao e-mail), sem usuários anônimos.
- `AuthProvider` com `onAuthStateChange` registrado antes da checagem inicial de sessão; sessão e usuário guardados juntos.
- `/login` (fora do shell) com abas **Entrar** e **Criar conta**, mensagens de erro traduzidas.
- `AppShell` redireciona para `/login` sem sessão, mostra o e-mail logado e o botão **Sair**.

### Dados
- `src/lib/cloud.ts`: mapeamento e CRUD das três tabelas (upsert, exclusão, contagem), com conversão de `fv` → Nº FAC na leitura.
- `src/hooks/use-cloud-data.ts`: `useCloudReports`, `useCloudAnalyses`, `useCloudSettings` (gravação das logos com debounce) e `useLegacyCloudMigration`.
- Emissor e Analista deixaram o `localStorage` e passaram a usar esses hooks; a nuvem é a fonte da verdade.
- **Migração única**: no primeiro login, se a nuvem estiver vazia, os relatórios, vistorias e configurações que estavam neste navegador são enviados para a nuvem (marcador `qualyflow:cloud-migrated:v1`).
- Avisos de tela atualizados: base compartilhada na nuvem.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Validação de ponta a ponta (harness temporário, removido): cadastro cria sessão, gravação de relatório e vistoria retorna as linhas (insert + select sob RLS), configurações gravadas, exclusão dos registros de teste e logout.
- Base final conferida: 0 relatórios, 0 vistorias e 1 linha de configurações padrão.
- Guarda de rota conferida: `/emissor` sem sessão abre a tela de login; `/login` renderiza com o design do sistema.
- Conta de teste usada na validação teve a senha invalidada.
- **Pendente de conferência do usuário**: criar a própria conta, salvar um relatório e abrir em outro computador.
