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

---

# Fase 5 — Perfil de gestor e liberação de usuários

## Contexto

O usuário pediu um perfil **gestor** que controla quem entra no sistema: só ele cadastra e autoriza novos acessos, em uma aba específica de usuários. Credencial definida por ele: usuário `ramalhoigor`, senha `805099`.

## Banco

- Nova tabela `qualyflow_profiles` (user_id → auth.users, username único, display_name, role `gestor`/`vistoriador`, status `ativo`/`pendente`/`bloqueado`).
- `public.qualyflow_is_manager()` (security definer, stable) evita recursão de RLS: responde se o usuário logado é gestor ativo.
- RLS: cada usuário lê o próprio perfil; **somente gestor** lê todos, altera (aprovar/bloquear) e exclui. Nenhum cliente cria perfil — a criação passa pela backend function com service role.
- Gestor semeado: `ramalhoigor` / `Igor Ramalho` / gestor / ativo.

## Backend function `qualyflow-users`

- Valida o JWT do chamador, lê o perfil com service role e **exige role gestor + status ativo** antes de qualquer ação.
- Ações: `create` (usuário, senha, nome, status inicial), `set-status` (liberar/bloquear), `reset-password`, `delete` (remove também o perfil).
- Bloqueia auto-bloqueio e auto-exclusão. CORS tratado; erros traduzidos.
- Login por usuário curto: o front converte `ramalhoigor` em `ramalhoigor@qualyflow.local` antes de autenticar.

## Aplicação

- **Cadastro público desativado**: só o gestor cria contas. A tela de login perdeu a aba "Criar conta" e passou a aceitar **usuário ou e-mail**.
- `AuthProvider` carrega o perfil junto da sessão; `AuthContext` expõe `profile`, `profileLoading` e `refreshProfile`.
- Portão de acesso (`AccessGate`): sem perfil, `pendente` ou `bloqueado` o usuário não entra no app e vê a orientação para falar com o gestor.
- Item **Usuários** na sidebar apenas para gestor; rota `/usuarios` protegida.
- Página Usuários: cartões de contagem (total/ativos/aguardando), formulário de cadastro (nome, usuário, senha com gerador, switch "liberar imediatamente"), lista com papel, status, data e ações **Liberar / Bloquear / Nova senha / Remover** (com confirmação em dois cliques).
- Cabeçalho mostra `@usuario` e o papel (Gestor/Vistoriador); sidebar mostra o usuário logado.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Fluxo validado com harness temporário (removido): login do gestor por usuário curto, leitura do perfil, **backend function criando usuário**, listagem com 2 perfis, bloqueio e exclusão do usuário de teste.
- Aba Usuários conferida visualmente com sessão de gestor: sidebar com o item, contadores, formulário e lista.
- Base final: apenas o perfil `ramalhoigor` (gestor/ativo); nenhum usuário de teste remanescente.
- **Pendente do usuário**: entrar com `ramalhoigor` / `805099`, cadastrar a equipe e conferir o acesso de um vistoriador.

---

# Fase 6 — Status "Não avaliado", OS de 10 dígitos e limpeza do endereço

## Contexto

Três correções pedidas após uso real:

1. Documento com status **N/A** estava caindo em "Não Conforme"; deve existir a categoria **Não avaliado**.
2. A **Ordem de Serviço** costuma vir junto do número do PDF, com ~10 dígitos (ex.: `2618864709`), e precisa entrar no bloco de OS.
3. Ao exportar, o **endereço** saía bagunçado, com quebras/valores de campos vizinhos.

## O que foi feito

### Status "Não avaliado"
- Novo status `nao_avaliado` (rótulo **Não avaliado**) em `QualityStatus` e `STATUS_LABELS`.
- Leitura do veredito em **campos rotulados** (STATUS / SITUAÇÃO / RESULTADO / PARECER / AVALIAÇÃO) antes da varredura de palavras-chave: `N/A`, `não avaliado`, `não se aplica` → Não avaliado; `não conforme`/`reprovado` → Não Conforme; `conforme`/`aprovado` → Conforme.
- Também conta como Não avaliado quando o **Tipo de Não Conformidade** é `N/A` ou quando existe uma **célula isolada** com "N/A".
- Efeito prático: um checklist que contém a opção "NÃO CONFORME" não classifica mais o documento como não conforme quando o status real é N/A.
- UI: novo status no gráfico de status (cor `--chart-5`), na tabela (badge/ponto), no filtro, no diálogo de revisão, no CSV/Excel e novo KPI **Não avaliados**.

### Ordem de Serviço (10 dígitos)
- Sem rótulo explícito, o extrator assume o primeiro número de **9 a 11 dígitos** do texto (preferindo 10) como OS.
- O mesmo critério é aplicado ao **nome do arquivo**, então arquivos nomeados só com o número já preenchem a OS.

### Endereço e planilha
- `cleanAddress()` mantém o endereço em **uma linha** e corta resíduos de campos vizinhos (data, OS de 9–11 dígitos, protocolo, origem, prazo, contratada, serviço, equipe, polo).
- Toda célula exportada passa por `sanitizeCell()` (sem `\n`/`\t`, sem espaços duplicados), garantindo **uma informação por célula** no CSV e no `.xlsx`.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Casos validados com harness temporário (removido):
  - `STATUS: N/A` + checklist "Nao conforme" → **nao_avaliado**.
  - `STATUS: NAO CONFORME` → **nao_conforme**.
  - `STATUS: conforme` + endereço colado em data/OS → **conforme**, endereço `RUA SERVILHA, 108`, OS `2618864709`.
  - OS apenas no nome do arquivo → OS `2618864711`.
  - Matriz do Excel: cabeçalho com as colunas na ordem, linha única sem quebras e status "Não avaliado".

---

# Fase 7 — Data de avaliação (FV), não avaliados ampliados e agrupamento

## Contexto

Com a imagem do formulário **FV / FCR - Pós 60**, o usuário pediu:
1. os arquivos separados por **Data avaliação** (campo do PDF);
2. que **inspeção impossibilitada**, **não executado** e **não localizado** também entrem em **Não avaliados**.

## O que foi feito

### Leitura do formulário FV
- `Data avaliação` (e variações "data de avaliação"/"data da vistoria") passou a ser extraída como **primeira opção** da data; rótulo do campo agora é **"Data de avaliação"**.
- Novos padrões: `OS nº`, `Contratada auditada`, `Serviço executado`, `Polo` sem dois-pontos.
- Palavras de corte para não vazar campos vizinhos: coordenadas, categoria, auditor, conceito, líder, unidade/área, serviço acatado.
- Resultado no FV de exemplo: Nº FAC 8319, data 01/07/2026, OS 2617577299, Polo Santana, endereço "Rua capitão nascimento 309", contratada "Consórcio Nova Norte - 01.005/21", serviço "Pós 60 - Passeio cimentado".

### Não avaliados (ampliado)
- Entram em **Não avaliado**: `N/A`, `não avaliado`, `sem avaliação`, `não se aplica`, **`inspeção impossibilitada`**, **`não executado(a)`**, **`não localizado(a)`** e `não realizado(a)` — tanto em campo rotulado (status/situação/resultado/parecer) quanto em célula isolada e no Tipo de Não Conformidade.

### Agrupamento por data de avaliação
- Na tabela do Analista, quando ordenada por data (padrão), as linhas são **separadas por faixa de data**: "DATA DE AVALIAÇÃO 01/07/2026 • 3 vistoria(s)" antes de cada grupo.
- Coluna renomeada para **Data avaliação**; CSV/Excel seguem a mesma ordem.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Harness temporário (removido) com o texto do FV: campos acima conferidos e status `conforme`.
- `Inspeção impossibilitada`, `Não executado` e `Não localizado` classificados como `nao_avaliado`.
- Tabela com 4 registros em 2 datas: dois grupos com contagem correta e badge "Não avaliado" visível.

---

# Fase 8 — OS pelo nome do arquivo, endereço limpo, motivo de NC e login moderno

## Contexto

Com o print "FV-46384 2618864709.pdf": a coluna **Ordem de serviço** ficava vazia embora o número esteja no nome do arquivo; o endereço exportado arrastava "Categoria Serviço Completo"; e o usuário pediu para mapear o **motivo da não conformidade** no Excel e no BI, além de um login mais tecnológico.

## O que foi feito

### OS e FAC a partir do nome do arquivo
- Novo helper `deriveNumbersFromFileName()` (em `src/lib/fields.ts`): `FV-<fac>` fornece o Nº FAC e o número longo de 9–11 dígitos fornece a OS.
- Usado na extração de PDFs novos **e na leitura dos registros já salvos** (`toAnalysis`), então a linha antiga do print passa a mostrar `2618864709` sem reimportar.
- `recordFromFileName()` passou a usar o helper (mesmo critério para FAC e OS).

### Endereço apenas com o endereço
- `sanitizeAddress()` (compartilhado entre extração, leitura da nuvem e exportação) corta termos vizinhos do formulário — `categoria`, `coordenadas`, `auditor`, `conceito`, `líder`, `serviço acatado/executado`, `unidade/área`, `município`, `região` — e remove "Serviço Completo" no fim.
- Resultado no FV de exemplo: célula do Excel fica só com `Rua capitão nascimento 309`.

### Motivo da não conformidade
- Extração ampliada: além de "Tipo de Não Conformidade", lê **"Motivo"**, **"Descrição"** e **"Apontamento"** da não conformidade (com ou sem dois-pontos).
- O motivo aparece na tabela, no diálogo de revisão, no **Excel/CSV** (coluna "Tipo de Não Conformidade") e no BI, cujo gráfico passou a se chamar **"Motivos de não conformidade"**.

### Login
- Tela refeita em duas colunas: painel institucional escuro com malha, brilhos, faixa animada, destaque "Acesso corporativo" e três pilares do sistema; formulário em painel de vidro com faixa luminosa, campos com ícone, botão **mostrar/ocultar senha**, CTA em gradiente e nota de acesso controlado.
- Mesmo desenho empilhado no mobile.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Regras conferidas por script: `FV-46384 2618864709.pdf` → FAC `46384`, OS `2618864709`; `Rua capitão nascimento 309 Categoria Serviço Completo` → `Rua capitão nascimento 309`; "motivo da nao conformidade: desnivel de 18 mm..." → capturado inteiro.
- Login conferido em 1360px e em `mobile_390`.

---

# Fase 9 — Legendas das fotos editáveis no Emissor

## Contexto

O usuário pediu que a **descrição (legenda) das fotos** também seja editável no Emissor, mantendo o texto do modelo como padrão, nos três modelos de relatório.

## O que foi feito

- `PhotoEntry` ganhou `caption?: string` e o helper `resolveCaption()` (legenda editada ou a padrão do modelo).
- Cada campo de foto agora tem um input **"Legenda da foto"** já preenchido com o texto padrão do modelo (ex.: `REPOSIÇÃO PERPENDICULAR A FACHADA DO IMÓVEL`), com:
  - link **"padrão do modelo"** por campo quando a legenda foi alterada;
  - botão **"Restaurar legendas padrão"** na seção, que volta todos os campos de uma vez;
  - limite de 70 caracteres e texto exibido em maiúsculas na folha.
- A legenda editada vale para as folhas SGZ-156 e Pós 60 (Passeio e Via): no SGZ ela entra na linha `FOTO Nº n: ENDEREÇO - LEGENDA`; no Pós 60 substitui a legenda abaixo da foto.
- Remover a foto **mantém** a legenda editada; incluir/excluir da impressão também preserva o texto.
- A legenda viaja no rascunho e no registro salvo na nuvem (mesmo objeto `photos`).

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Harness temporário (removido) com os três papéis: campos com legenda alterada mostraram "REPOSIÇÃO NA ESQUINA, VISTA FRONTAL" e "PANORAMA APÓS COMPACTAÇÃO" nas folhas, e no SGZ `FOTO Nº 1: R. SEMYON KIRLIAN 85 - NOTIFICAÇÃO ENTREGUE AO MORADOR`, mantendo as demais no padrão do modelo.

---

# Fase 10 — Marca QualyFlow no compartilhamento e na interface

## Contexto

O usuário enviou a logo oficial (símbolo circular com seta/check + "QUALY FLOW | GESTÃO DE QUALIDADE & ANÁLISE" + crédito) e pediu para usá-la ao **compartilhar o link** do sistema.

## O que foi feito

### Arquivos de marca (`public/brand/`)
- `qualyflow-logo.png` — logo completa com fundo transparente (recortada dos espaços vazios).
- `qualyflow-icon.png` — ícone 512×512 com cantos arredondados e a marca centralizada, usado como favicon e `apple-touch-icon`.

### Compartilhamento do link (`index.html`)
- `og:image` / `twitter:image` com a **logo da marca** (URL absoluta), `og:site_name` QualyFlow, título "QualyFlow — Gestão de Qualidade & Análise", descrição com o crédito "Sistema criado por Igor Ramalho | Célula de Qualidade", `og:locale` pt_BR e `twitter:card` grande.
- Título da página atualizado, `theme-color` azul corporativo e favicon/apple-touch-icon apontando para o ícone da marca.

### Interface
- Barra lateral e painel institucional do login passaram a exibir a **logo real** sobre um "plate" claro (token novo `--logo-plate`), garantindo leitura nos temas escuro e claro — antes havia um ícone genérico e o nome em texto.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Logo conferida em recorte próprio e na tela de login (1360px).
- Assets finais: `public/brand/qualyflow-logo.png` (604×185) e `public/brand/qualyflow-icon.png` (512×512).

---

# Fase 11 — Base sem teto de linhas e não conformidades especificadas

## Contexto

Dois problemas relatados com a base real de PDFs:

1. Os arquivos importados "paravam" de aparecer por volta de 510 registros.
2. As não conformidades precisavam ser **especificadas** na análise (motivo, polo, data e arquivo), lembrando que **N/A é não avaliado**.

## Causa do teto de registros

A leitura da base usava uma única consulta (`select *`), que o servidor limita a uma página de linhas — os PDFs continuavam sendo gravados, mas a tela só mostrava os primeiros. A gravação também enviava todos os registros em uma única requisição, o que fica frágil com lotes grandes.

## O que foi feito

- **Leitura paginada** de vistorias e relatórios (páginas de 500 linhas até esgotar, com salvaguarda de 50.000) — a base inteira passa a ser carregada, em qualquer tamanho.
- **Gravação em blocos de 200** registros por requisição, evitando falha silenciosa em lotes grandes.
- Reimportar um arquivo já existente agora **atualiza** o registro (inclusive o polo do bloco) em vez de ser descartado, e o aviso informa "N atualizado(s) na base".
- Cabeçalho do Analista mostra **"carregadas"** e o **total na nuvem**, sinalizando "sincronizando" se houver diferença — dá para conferir que nada ficou de fora.
- Extração de motivo ampliada: além de tipo/motivo/descrição/apontamento, lê **"itens não conformes"** e **"pendência"**.
- Novo painel **"Não conformidades identificadas"**: agrupa por polo (Vila Maria / Santana, Freguesia, Gopoúva) e lista motivo, OS, endereço e data de cada não conformidade, com botão **Especificar** que abre a revisão para completar o motivo quando o PDF não traz. Vistorias **não avaliadas (N/A)**, "inspeção impossibilitada", "não executado" e "não localizado" **não** entram nesse painel.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Painel conferido com base de teste: 3 não conformidades em 2 polos (Freguesia 2, Gopoúva 1, Vila Maria / Santana 0), com contagem de "sem motivo informado", exclusão correta de conforme e não avaliado, e o gráfico "Motivos de não conformidade" acima.
- Paginação e blocos conferidos por leitura de código + tipos; a conferência de volume real depende da base do usuário (chip "na base").

---

# Fase 12 — Correção do erro na tela do Analista e motivos lidos da tabela ITENS AVALIADOS

## Erro relatado

`ReferenceError: countAnalyses is not defined` ao abrir o Analista: o `useEffect` que lê o total da base usava a função sem o import (`import { countAnalyses } from "@/lib/cloud"`). Corrigido; `tsc`, lint e build limpos e a tela do Analista abriu com a base real (510 vistorias carregadas / 510 na base).

## Descoberta com a base real

Consultando os registros, os 416 "Não Conforme" **não são erro de leitura**: o formulário FV traz a tabela **"ITENS AVALIADOS"** com um veredito por item (`Conforme`, `Não Conforme`, `N/A`). O campo de motivo, porém, vinha vazio em todos os registros.

## O que foi feito

- Novo `extractNonConformityItems()`: varre a seção **ITENS AVALIADOS** e monta o motivo a partir de cada item marcado como **"Não Conforme"**, no formato `1.3 REPOSIÇÃO EXECUTADA ATENDE ÀS NORMAS MUNICIPAIS? | 1.5 CONFORMIDADE COM A LEGISLAÇÃO MUNICIPAL?` (até 3 itens, 120 caracteres).
- O motivo da tabela tem prioridade sobre rótulos genéricos ("tipo:", "pendência:"), e vai para a tabela, o diálogo de revisão, o **Excel/CSV** e o painel **"Não conformidades identificadas"** do BI.
- Como o banco não guarda o PDF, os registros antigos entram com motivo ao **reimportar os arquivos** — e a reimportação agora **atualiza** o registro existente em vez de descartá-lo.

## Verificação

- `extractNonConformityItems()` conferido com o trecho real de um FV da base: retornou `1.3 REPOSIÇÃO EXECUTADA ATENDE ÀS NORMAS MUNICIPAIS? | 1.5 CONFORMIDADE COM A LEGISLAÇÃO MUNICIPAL?`.
- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Tela do Analista com a base real: 510 carregadas / 510 na base, 37 conformes, 416 não conformes, 17 não avaliados, 40 em andamento.

---

# Fase 13 — Painel removido, tabela paginada e importação sem limite

## Contexto

O painel "Não conformidades identificadas" deixou a tela pesada (416 cartões renderizados) e a importação por polo parou de aceitar arquivos.

## O que foi feito

- **Painel de não conformidades removido** do Analista (`src/components/analista/nc-panel.tsx` excluído). O motivo da NC continua visível na tabela, na revisão e no Excel.
- **Tabela paginada**: 50/100/200 registros por página, com "Mostrando X–Y de Z", botões Anterior/Próxima e exportação sempre com **todas** as linhas filtradas. Base de 510+ registros deixa de renderizar tudo de uma vez.
- **Limite de páginas removido**: `MAX_PAGES` passou de 15 para 2000 (apenas guarda contra arquivo corrompido gigante). O bloco de importação avisa "Sem limite de páginas ou de arquivos".
- **Paginação do banco com ordenação estável** (`analyzed_at desc`, `id asc`): lotes com o mesmo timestamp não repetem nem perdem linhas entre páginas.
- **Falhas visíveis**: o resumo da importação agora traz o **motivo da primeira falha** e, quando nada entra, um aviso explícito "Nenhum arquivo foi importado".
- Reimportar arquivos existentes continua **atualizando** o registro (polo e dados), sem duplicar.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Analista conferido com a base real (510 carregadas / 510 na base), sem o painel removido e com o aviso de importação sem limites.

---

# Fase 14 — Relatório Gerencial BI do Analista

## Contexto

O usuário pediu um relatório no estilo BI, apenas do módulo Analista, alimentado por tudo que é importado (lotes de 1 a 500 arquivos).

## O que foi feito

- Novo componente `src/components/analista/bi-report.tsx` gera **2 folhas A4** no padrão dos relatórios (papel claro, molduras, logos oficiais):
  - **Página 1:** cabeçalho com logos, título "RELATÓRIO GERENCIAL — ANALISTA BI", data de geração, responsável e tamanho da base; grade de **6 indicadores** (vistorias, % concluídas, não conformidades, em andamento, não avaliados N/A, polos); **Resumo por polo** (Vila Maria / Santana, Freguesia, Gopoúva + total) com conformidade e % de conclusão; **Distribuição por status** com barras e percentuais.
  - **Página 2:** **Motivos de não conformidade** (top 12, com quantidade e % das NC), **Vistorias por data de avaliação** (10 datas mais recentes), legenda do critério de classificação e crédito no rodapé.
- Nova página `src/pages/RelatorioBi.tsx` em `/relatorio-bi`, com pré-visualização A4 escalada, botões **Voltar**, **Imprimir** e **Baixar PDF** (reaproveita `PrintPortal` + `downloadReportPdf`, o mesmo mecanismo validado do Emissor).
- Botão **Relatório BI** no cabeçalho do Analista (aparece quando há base carregada).
- Importação comunicada como **1 a 500 arquivos por envio, sem limite de páginas**; lotes maiores continuam sendo processados na ordem.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Página conferida com a base real (510 vistorias): cabeçalho, indicadores 510 / 7% / 416 / 40 / 17 / 1, resumo por polo com totais e barras de distribuição por status.

---

# Fase 15 — Marca de data e local (GPS) nas fotos

## Contexto

O usuário pediu a marca de campo vista nas fotos (data/hora, coordenadas, endereço, bairro e cidade), **100% editável** e com **botão para habilitar/desabilitar** quando quiser.

## O que foi feito

- `src/lib/geotag.ts`: leitura do **GPS do EXIF** das fotos (JPEG, melhor esforço), formatação `23,4932S 46,5915W` (vírgula decimal + hemisfério) e carimbo de data/hora.
- `PhotoEntry` ganhou `geotag` (as cinco linhas) e `showGeotag` (liga/desliga por foto); o rascunho guarda a configuração (`geotag: { enabled, defaults }`).
- **Painel na seção de fotos**: botão **ligar/desligar** a marca, cinco campos padrão editáveis (data e hora, coordenadas, endereço, bairro, cidade), atalho "Usar data e hora de agora" e "Aplicar às fotos inseridas". O endereço padrão já vem do próprio relatório, e a cidade padrão é São Paulo.
- **Por foto**: bloco recolhível "Data e local desta foto" com os cinco campos e um interruptor "Mostrar na folha", então cada foto pode ter sua própria informação.
- Ao inserir uma foto com a marca ligada, o sistema tenta ler o GPS do arquivo e preenche as coordenadas automaticamente.
- Na folha (SGZ e Pós 60) a marca é desenhada no canto inferior direito da foto, em branco com sombra, na mesma disposição das fotos de campo.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Harness temporário (removido): painel com os cinco campos, contador de fotos marcadas, marca editável por foto e folha Pós 60 com o carimbo completo (data/hora, coordenadas, endereço, bairro, cidade) — e sem marca na foto com "Mostrar na folha" desligado.

## Ajuste de padrão da marca (fonte e escrita)

- Marca refeita no padrão da referência do usuário: **Arial/Helvetica**, branco, peso semibold, `11,5 px` com entrelinha 1,32, alinhada à direita no canto inferior direito da foto (margens de 2,5 mm) e sombra suave (`0 1px 2px` + `0 0 7px`) para leitura sobre qualquer imagem.
- Cinco linhas na ordem da referência: data/hora, coordenadas, endereço, bairro e cidade.
- Miniatura no formulário segue o mesmo estilo, com corpo proporcional.
- Conferido em folha Pós 60: bloco de texto com a mesma proporção e posição da foto de campo enviada.

---

# Fase 16 — Relatório em andamento não se perde ao sair da tela

## Contexto

Ao navegar para o Analista e voltar, o Emissor recomeçava vazio: o formulário vivia só em memória. O usuário pediu que o relatório em andamento permaneça até a emissão ou até ele excluir.

## O que foi feito

- **Salvamento automático**: enquanto há conteúdo no formulário, o rascunho é gravado na nuvem 700 ms após a última alteração (valores, fotos, legendas, observação e configuração da marca de local). A assinatura do conteúdo evita gravações repetidas.
- **Gravação ao sair**: o que estiver pendente é enviado no desmonte da tela, então trocar de aba/módulo não perde a última alteração.
- **Restauração**: o id do relatório em andamento fica em `qualyflow:current-draft:v1`; ao voltar, a tela retoma modelo, dados, fotos, legendas, observação e marca de local, com o aviso "Relatório em andamento restaurado".
- **Controle do operador**: "Novo relatório" limpa o ponteiro (não restaura o anterior) e excluir o rascunho na lista também limpa — a base não fica com lixo.
- **Correção**: a configuração da marca de local não era gravada no rascunho (faltava a coluna). Foi criada a coluna `geotag jsonb` em `qualyflow_reports` (aditiva, sem tocar em dados) e o mapeamento passou a incluí-la.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Teste ponta a ponta com harness (removido): rascunho gravado, Emissor aberto com **Pós 60 Via**, contratada/OS/FAC/endereço/data, observação e **"Marca de local ativa"** restaurados, botão em "Atualizar rascunho" e aviso de restauração.
- Rascunhos de teste removidos do banco após a validação.

---

# Fase 17 — Data do relatório: entrada dd/mm/aaaa e botão "Hoje"

## Contexto

O usuário relatou que a data escolhida não aparecia no relatório e pediu a opção de usar a data atual.

## Causa

O campo usava `<input type="date">`, que segue o idioma do navegador: em máquina configurada em inglês o campo espera **mm/dd/aaaa** e descarta uma digitação em **dd/mm/aaaa** — o valor ficava vazio e a folha saía sem data.

## O que foi feito

- Campo de data passou a ser **texto com máscara dd/mm/aaaa** (até 8 dígitos, barras automáticas) — igual ao padrão dos relatórios.
- Botão **"Hoje"** ao lado de cada campo de data (Data da Vistoria no SGZ-156 e DATA no Pós 60) para usar a data atual com um clique.
- Datas antigas gravadas em ISO (aaaa-mm-dd) são convertidas para exibição; a folha continua formatando qualquer um dos dois formatos via `formatDateBR`.
- Vale para os três modelos e para os rascunhos restaurados.

## Verificação

- `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` sem erros.
- Harness temporário (removido): campo exibindo `31/07/2026` com o botão **Hoje** e a folha Pós 60 imprimindo `31/07/2026` na coluna DATA.
