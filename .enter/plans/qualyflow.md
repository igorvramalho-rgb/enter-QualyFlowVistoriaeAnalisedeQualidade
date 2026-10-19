# QualyFlow — Emissor de Relatórios + Analista de Vistorias

## Context

O projeto hoje é apenas o template Vite + React + shadcn (uma única página `src/pages/Index.tsx` com um gradiente). Não existe tela, rota, token de marca ou regra de negócio.

O objetivo é construir o **QualyFlow**, sistema de gestão de qualidade operacional em português (pt-BR) com dois módulos:

1. **Emissor de Relatórios** (`/emissor`) — escolher um modelo, preencher o cabeçalho, colar/arrastar fotos nos slots predefinidos, pré-visualizar a folha A4 e exportar PDF.
2. **Analista de Vistorias** (`/analista`) — importar PDFs de vistoria, extrair métricas com revisão manual e visualizar dashboard analítico (KPIs, gráfico por polo, tabela filtrável com exportação CSV).

**Decisões confirmadas com o usuário:**
- **100% frontend, sem backend/login/nuvem.** Persistência em `localStorage` (contrato explícito: os dados se perdem se o navegador for limpo). Nada de mock de backend.
- **PDFs mistos** (texto + digitalizados): extrair o que a camada de texto permitir e **permitir revisão/edição manual**. Sem OCR.
- **Fotos reais dos modelos**: os três PDFs enviados foram lidos e o layout deve ser **fiel** a eles (ver seção *Fidelidade aos modelos*).
- **Exportação dupla**: botão Imprimir (nativo, vetorial, A4 exato) + Download PDF (html2pdf.js).
- **Assistente de IA fora desta versão** (exigiria backend + capacidade de IA).

Regra de idioma: toda a interface e textos em **português do Brasil**.

---

## Fidelidade aos modelos (fonte da verdade)

Os três PDFs foram lidos por `pdf-convert` (texto + páginas renderizadas). Resumo do que deve ser reproduzido:

### 1. DEMANDA SGZ - 156 (4 páginas = 1 foto por página)
- **Moldura**: retângulo de borda fina preta envolvendo todo o conteúdo da folha.
- **Cabeçalho** (tabela de 2 colunas, com bordas):
  - Esquerda: caixa com a **logo Sabesp** (azul, com barra verde à direita).
  - Direita: 3 faixas empilhadas com borda — (1) **negrito** "Companhia de Saneamento Básico do Estado de São Paulo"; (2) "Divisão de Manutenção e Serviços Operacionais Santana - ONMS"; (3) "Rua Antônio Pereira de Sousa, 110 Santana | 02404-060 | São Paulo - SP" / "Tel. (11) 2971-8015 | Cel. (11) 93443-9339 - andreamartins@sabesp.com.br" / "Cel. (11) 97237-8937 - jfgois@sabesp.com.br".
- **Tabela "DADOS DA VISTORIA"**: faixa de título centralizada em negrito sobre fundo cinza-claro; 4 colunas (rótulo negrito | valor | rótulo negrito | valor):
  - `Endereço` (valor ocupa as 3 colunas restantes)
  - `Data da Vistoria` | valor | `Protocolo SGZ` | valor
  - `Nº O.S.` | valor | `Origem da Demanda` | valor (default "DEMANDA SGZ - 156")
  - `Prazo para Conclusão` | valor (ex.: FINALIZADA) | `Situação Atual` | **4 checkboxes** (Em Obra / Asfalto provisório / Asfalto definitivo / Falta Repor Sinalização), com o item selecionado marcado
- **Corpo**: caixa com borda fina contendo a foto em `object-contain` (espaço branco sobrando), ocupando a área central.
- **Legenda abaixo da caixa** (centralizada, negrito): `FOTO Nº <n>: <ENDEREÇO EM MAIÚSCULAS> - <TÍTULO DO SLOT>`
- **Sublegenda** (centralizada, pequena): `Relatório de Vistoria Fotográfica — Página <página> de <total>`
- Slots: `NOTIFICAÇÃO (ANTES)`, `FACHADA`, `VISÃO GERAL/POSIÇÃO RÉGUA`, `RÉGUA/TRENA`.
- **Não há** bloco de assinatura nem rodapé de crédito no modelo — não inventar.

### 2 e 3. DEVOLUTIVA PÓS 60 (Passeio e Via — 1 página, 6 fotos)
- **Moldura**: retângulo de borda fina preta em torno do conteúdo.
- **Cabeçalho**: logo **Sabesp** à esquerda e logo **CONSÓRCIO NOVA NORTE** à direita (ambas as logos existem dentro dos dois arquivos PDF; no modelo Via aparece explicitamente também à direita).
- Título centralizado em negrito: `RELATÓRIO FOTOGRÁFICO - DEVOLUTIVA PÓS 60`.
- Parágrafo `Objeto:` (texto fixo do modelo, editável, pré-preenchido).
- Linha `Contratada: <valor>` (rótulo em negrito).
- **Tabela de 6 colunas** (rótulo em negrito em cima, valor abaixo na mesma célula): `OS Nº:` | `Nº FAC:` | `SERVIÇO EXDA:` | `POLO:` | `ENDEREÇO:` | `DATA:`.
- **Grade de 6 fotos em 2 colunas × 3 linhas**, cada célula com moldura fina e legenda **abaixo, alinhada à esquerda, em maiúsculas**, na ordem do modelo:
  1. `REPOSIÇÃO PERPENDICULAR A FACHADA DO IMÓVEL`
  2. `QUALIDADE DO PAVIMENTO EXISTENTE`
  3. `PANORAMA DA REPOSIÇÃO`
  4. `REPOSIÇÃO COM A RÉGUA POSICIONADA`
  5. `TRENA INDICANDO DESNÍVEL`
  6. `JUNTA`
- Fotos preenchem a célula (`object-cover`) com proporção fixa.
- Diferença de conteúdo entre Passeio e Via: apenas `SERVIÇO EXDA` (ex.: "PASSEIO – REPOSIÇÃO DE CIMENTADO" vs "VIA – REPOSIÇÃO ASFÁLTICA") — cada modelo traz o seu valor padrão editável.

### Assets a extrair dos PDFs (cópia para o projeto)
Os PNGs já extraídos em `/workspace/inputs/**/.read-cache/export/images/` serão copiados para `public/assets/report/`:
- `sabesp.png` ← `MODELO DE DEVOLUTIVA PÓS 60 - PASSEIO.pdf-0001-00.png`
- `consorcio-nova-norte.png` ← `MODELO_DE_DEVOLUTIVA_PÓS_60_-_VIA.pdf-0001-01.png`

Os arquivos em `/workspace/inputs` são **somente leitura** (nenhuma alteração neles).

---

## Arquitetura

- **Frontend only**: React 19 + Vite + Tailwind v3 + shadcn/ui (já instalado) + Recharts + react-router-dom (já instalados).
- **Estado**: `localStorage` com chaves versionadas, via hook reutilizável. Sem chamadas de rede.
- **Sem i18n extension**: strings pt-BR diretas (não mexer em `i18n.config.json` nem em `src/i18n/*`).
- **Analytics**: não remover nem contornar `bootstrapGeneratedSiteAnalytics()` (`src/analytics.ts`); usar apenas botões/links/formulários semânticos.

### Dependências a adicionar
```bash
pnpm add pdfjs-dist html2pdf.js react-dropzone
```
- `pdfjs-dist` → extração de texto dos PDFs no Analista (worker via `pdfjs-dist/build/pdf.worker.min.mjs?url`).
- `html2pdf.js` → Download PDF a partir da folha A4 (+ declaração de tipos própria).
- `react-dropzone` → drag & drop de PDFs e de fotos.

### Estrutura de arquivos

```
public/assets/report/{sabesp.png, consorcio-nova-norte.png}
src/
  App.tsx                       # + ThemeProvider (next-themes, class, dark default)
  router.tsx                    # + /emissor e /analista dentro do AppShell
  index.css                     # tokens da marca + folha A4 + @media print
  tailwind.config.ts            # tokens extras: success, warning, sombras, animações
  types/html2pdf.d.ts           # declaração de módulo
  lib/
    report-templates.ts         # definição dos 3 modelos (campos, slots, ordem das legendas)
    report-settings.ts          # cabeçalho institucional SGZ + logos (defaults + overrides do usuário)
    storage.ts                  # wrapper seguro de localStorage (versão, JSON inválido, quota)
    pdf-extract.ts              # pdfjs + heurísticas dos campos dos dois modelos
    csv.ts                      # exportação CSV (BOM + ';' para Excel pt-BR)
    image.ts                    # compressão/normalização de imagem (canvas → JPEG dataURL)
    fields.ts                   # formatação de datas/valores dos relatórios
  hooks/use-local-storage.ts    # estado persistido reutilizável
  components/
    layout/{app-shell,app-sidebar,theme-toggle,app-footer}.tsx
    report/{report-sheet-sgz.tsx,report-sheet-pos60.tsx,report-frame.tsx,report-logos.tsx,empty-photo.tsx}
    emissores/{template-picker.tsx,report-form.tsx,photo-dropzone.tsx,photo-slot-grid.tsx,institutional-header-form.tsx,drafts-list.tsx}
    analista/{pdf-uploader.tsx,review-dialog.tsx,kpi-cards.tsx,polo-chart.tsx,status-chart.tsx,vistorias-table.tsx}
    common/section-header.tsx
  pages/{Emissor.tsx,Analista.tsx,NotFound.tsx}
```

Reutilizar: `cn` (`src/lib/utils.ts`), `useIsMobile` (`src/hooks/use-mobile.tsx`) e os componentes `src/components/ui/*` (button, card, input, label, textarea, select, tabs, table, badge, dialog, sheet, separator, scroll-area, progress, tooltip, dropdown-menu, alert, switch, checkbox, sonner/`toast`).

---

## Design system (tokens da marca)

Editar **`src/index.css`** (HSL) e **`tailwind.config.ts`**:
- `--primary: 204 100% 28%` (azul corporativo ≈ `#005691`); `--accent: 160 84% 39%` (verde ≈ `#10B981`).
- Novos tokens: `--success` (verde) e `--warning` (âmbar, "Em obra"/"Pendente"), expostos como `success`/`warning` + `-foreground`.
- Temas claro e escuro corporativos com contraste AA; sidebar em azul da marca.
- Utilidades: `--gradient-primary`, `--shadow-elegant`, `--shadow-glow`, `--transition-smooth`, keyframes `fade-in`/`slide-up`.
- Classe utilitária `.print-sheet` para a folha A4 e `@media print` ocultando `.no-print` (sidebar, header, formulários) com `@page { size: A4; margin: 0 }`.
- **A folha do relatório é sempre clara** (é papel), independentemente do tema do app — usar cores de papel em tokens dedicados (`--sheet-*`) para não depender do tema.
- **Sem** `text-white`/`bg-white`/hex cru nos componentes de UI; sem emojis (ícones apenas `lucide-react`).

Tema híbrido com `next-themes` (`attribute="class"`, `defaultTheme="dark"`, `storageKey="qualyflow-theme"`), botão `ghost` com ícones `Sun`/`Moon`.

---

## Módulo 1 — Emissor de Relatórios (`/emissor`)

- `report-templates.ts`: 3 modelos tipados com `fields[]` (label, tipo, default, opções) e `slots[]` (id, legenda exata, `includeByDefault`), na **ordem exata dos modelos**.
- `template-picker.tsx`: cards de seleção; ao trocar de modelo, valores de campos com o mesmo label são preservados.
- `report-form.tsx`: campos dinâmicos por modelo (texto, data com máscara `dd/mm/aaaa`, select de `Situação Atual`).
- `institutional-header-form.tsx`: bloco recolhível para editar o cabeçalho institucional SGZ (título, divisão, endereço, telefones/e-mails) e trocar as logos (upload opcional), com os valores do modelo como default em `qualyflow:settings:v1`.
- `photo-dropzone.tsx`: por slot — **Ctrl+V** (paste do documento no slot ativo), **drag & drop**, clique para selecionar arquivo; pré-visualização, substituir, remover, e toggle "incluir na impressão".
- `image.ts`: redimensiona para lado maior ≤ 1600px e converte em JPEG (qualidade 0.82) antes de gravar — necessário para caber no `localStorage`; aviso por `toast` em `QuotaExceededError`.
- `report-sheet-sgz.tsx` e `report-sheet-pos60.tsx`: implementam exatamente os layouts da seção *Fidelidade aos modelos* (moldura, cabeçalho, tabela, caixa de foto, legendas, sublegenda com paginação). Fontes Arial/Helvetica, tamanhos e pesos conforme o modelo; fotos `object-contain` (SGZ) e `object-cover` (Pós 60).
- Slots vazios imprimem moldura com placeholder discreto ("Imagem não inserida") para servir de checklist de campo; cada slot pode ser omitido pelo toggle.
- **Imprimir** (`window.print()`) e **Baixar PDF** (`html2pdf.js`: `jsPDF { unit:'mm', format:'a4' }`, `html2canvas { scale: 2 }`, `pagebreak: { mode:['css','legacy'] }`, `break-inside: avoid` nas figuras). Cores da folha em hex/hsl resolvidos (sem `oklch`/`color-mix`) para o html2canvas.
- `drafts-list.tsx`: salvar/reabrir/duplicar/excluir rascunhos em `qualyflow:drafts:v1`.
- **O crédito "QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade" fica no rodapé do app**, não dentro da folha, para não alterar os modelos.

---

## Módulo 2 — Analista de Vistorias (`/analista`)

### Importação e extração (`src/lib/pdf-extract.ts`)
- `pdfjs-dist` lê o texto por página; arquivos com **mais de 15 páginas** são recusados com mensagem clara.
- Classificação do tipo de documento: `DEMANDA SGZ - 156` | `DEVOLUTIVA PÓS 60 - PASSEIO` | `DEVOLUTIVA PÓS 60 - VIA` | `Indefinido`, por palavras-chave do texto e, como reforço, pelo nome do arquivo.
- Heurísticas pt-BR (regex + normalização sem acentos, unindo quebras de linha), retornando `{ campo, valor, confiança }`:

| Campo (rótulos dos modelos) | Estratégia |
|---|---|
| Nº O.S. / OS Nº | `/o\.?\s*s\.?\s*n?[º°.]*\s*[:]?\s*([0-9][0-9./-]{5,})/i` |
| Nº FAC | `/n[º°.]?\s*fac\s*[:]?\s*([0-9][0-9./-]*)/i` |
| Protocolo SGZ | `/protocolo\s*sgz\s*[:]?\s*([0-9][0-9./-]*)/i` |
| Endereço | `/endere[çc]o\s*[:]?\s*([^\n]{5,})/i` ou padrão `^(R\.|Rua|Av\.?|Avenida|Alameda|Estrada|Travessa)\s.+` |
| Data da Vistoria / Data | `(\d{2}[/.-]\d{2}[/.-]\d{2,4})` (+ `date-fns` para ISO) |
| Polo | `/polo\s*[:]?\s*([A-Za-zÀ-ÿ0-9 \-]{3,})/i` |
| Contratada | `/contratada\s*[:]?\s*([^\n]{2,})/i` |
| Serviço EXDA | `/servi[çc]o\s*(exda)?\s*[:]?\s*([^\n]{3,})/i` |
| Prazo para Conclusão | `/prazo\s*para\s*conclus[ãa]o\s*[:]?\s*([^\n]{2,})/i` |
| Situação Atual | uma das 4 opções do SGZ presente no texto (Em Obra / Asfalto Provisório / Asfalto Definitivo / Falta Repor Sinalização) |
| Origem da Demanda | `/origem\s*da\s*demanda\s*[:]?\s*([^\n]{2,})/i` |
| Status de qualidade (`Conforme` / `Não Conforme` / `Em Andamento` / `Pendente`) | palavras-chave: "não conforme"/"reprovado" → Não Conforme; "conforme"/"aprovado"/FINALIZADA → Conforme; "em obra"/"asfalto provisório" → Em Andamento; ausência → Pendente de revisão |

- **Reforço por nome do arquivo** (os PDFs reais de vistoria costumam ser digitalizados): extrair OS/número, endereço e data do próprio nome quando o texto não fornecer.
- PDF sem camada de texto: registrar como `Pendente de revisão`, campos vazios — **nunca inventar dados**.
- Deduplicação por nome do arquivo + trecho inicial do texto extraído.

### Revisão manual (`review-dialog.tsx`)
Dialog/sheet com todos os campos editáveis (OS, FAC, protocolo, contratada, serviço, polo, endereço, data, situação/prazo, status), marcação visual de baixa confiança e o trecho de texto original ao lado para conferência; salvar regrava o registro e alimenta o dashboard.

### Dashboard (estilo Power BI)
- `kpi-cards.tsx`: Total de Vistorias Analisadas, % Concluídas vs Pendentes, Não Conformidades, Polos ativos, média de páginas por arquivo.
- `polo-chart.tsx`: barras por Polo/Região (Recharts, cores dos tokens, responsivo).
- `status-chart.tsx`: Concluído vs Pendente (barras/donut).
- `vistorias-table.tsx`: filtros por Polo, Status, período e busca (OS/endereço), ordenação por coluna, contagem de resultados e **Exportar CSV** via `src/lib/csv.ts` (BOM `\uFEFF` + `;`) exportando apenas as linhas filtradas.
- Estados vazios orientando o primeiro upload; barra de progresso durante a extração; recusa de arquivos que não sejam PDF.

### Persistência (`src/lib/storage.ts` + `use-local-storage.ts`)
- Chaves: `qualyflow:drafts:v1`, `qualyflow:analyses:v1`, `qualyflow:settings:v1`.
- Leitura defensiva (JSON inválido → default) e escrita com tratamento de `QuotaExceededError`.
- Banner discreto informando que os dados são locais deste navegador (coerente com a decisão de não usar nuvem).

---

## Roteamento e shell

`src/router.tsx`: antes do catch-all `*` — `/` → `Navigate to="/emissor"`; `/emissor` e `/analista` aninhados no `AppShell` (pai com `<Outlet/>`); `*` → `NotFound` redesenhado.

`AppShell`: sidebar fixa (colapsável no mobile via `Sheet`, usando `useIsMobile`) com nome QualyFlow e itens **Emissor de Relatórios** (`FileText`) e **Analista BI** (`BarChart3`), indicador de rota ativa; header com toggle de tema e crédito "Desenvolvido por Igor Ramalho"; rodapé fixo "QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade". Todo o shell leva `no-print`.

---

## Passos de implementação

1. `add_dependency`: `pdfjs-dist`, `html2pdf.js`, `react-dropzone`.
2. Copiar as logos extraídas para `public/assets/report/` e criar `src/types/html2pdf.d.ts`.
3. `src/index.css` + `tailwind.config.ts`: tokens da marca, temas, animações, folha A4 e `@media print`.
4. `App.tsx` (ThemeProvider) + `router.tsx` + `AppShell`/sidebar/footer/theme-toggle.
5. `src/lib/*`: templates (fiéis aos modelos), settings, storage, image, csv, pdf-extract, fields.
6. Emissor: picker, formulário, cabeçalho institucional, slots de foto (paste/drop/compressão), folha SGZ e folha Pós 60, impressão + html2pdf, rascunhos.
7. Analista: uploader, extração, revisão manual, KPIs, gráficos, tabela + CSV.
8. `NotFound` alinhado ao design system; remover o conteúdo antigo de `Index.tsx`.
9. Rodar `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build`, corrigindo o que aparecer.

## Notas de implementação (desvios do plano original)

- `html2pdf.js` **já traz tipos próprios**, então `src/types/html2pdf.d.ts` não foi criado.
- A folha A4 é renderizada em **dois lugares**: a pré-visualização (escalada na tela) e a porta de impressão `#print-portal` (tamanho real, oculta). Imprimir usa a porta; o Download PDF captura a porta temporariamente com a classe `.exporting` — nunca a pré-visualização escalada, que produziria captura torta.
- `#root` só é ocultado na impressão quando há folhas prontas (`html.has-print-sheets`), para que Ctrl+P em outras telas continue funcionando.
- A extração do Analista evoluiu para **leitura por colunas** (localiza a linha de rótulos `OS Nº | Nº FAC | SERVIÇO EXDA | POLO | ENDEREÇO | DATA`, distribui os valores das linhas seguintes pela posição horizontal e recupera a quebra de célula, ex. `VIA - REPOSICAO` + `ASFALTICA`), com rótulos inline como segunda estratégia e o nome do arquivo como terceira. Valores são recortados antes do próximo rótulo e a grafia original do documento é preservada.
- `pdfjs-dist` v6: a liberação do worker é feita pela *loading task* (`loadingTask.destroy()`), já que `PDFDocumentProxy.destroy()` não existe mais.

## Implementation checklist

- [x] Dependências `pdfjs-dist`, `html2pdf.js`, `react-dropzone` instaladas.
- [x] `public/assets/report/sabesp.png` e `consorcio-nova-norte.png` extraídos dos PDFs modelo (inputs intactos).
- [x] `src/index.css` com `--primary` azul #005691, `--accent`/`--success` #10B981, `--warning`, tokens de papel (`--sheet-*`) nos temas claro e escuro.
- [x] `tailwind.config.ts` expõe `success`, `warning`, `brand`, `sheet`, `chart` e as animações novas.
- [x] `App.tsx` no `ThemeProvider` (class, dark default, `storageKey` do projeto) e toggle de tema funcional.
- [x] `src/router.tsx` com `/` → `/emissor`, `/emissor` e `/analista` no `AppShell` e catch-all `*`.
- [x] `AppShell` com sidebar (rota ativa), header com crédito e rodapé "QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade".
- [x] Sidebar em `Sheet` no mobile (`useIsMobile`), verificado em 390px.
- [x] `report-templates.ts` com os 3 modelos, campos e legendas exatamente na ordem dos PDFs.
- [x] Folha SGZ-156: moldura, cabeçalho de 2 colunas (logo + 3 faixas), tabela DADOS DA VISTORIA com faixa de título e 4 checkboxes de Situação Atual, caixa de foto e legenda `FOTO Nº n: <ENDEREÇO> - <TÍTULO>` — conferida contra `DEMANDA SGZ - 156.pdf`.
- [x] Folha SGZ com 1 página por slot e sublegenda "Página X de Y" correta (4 páginas por padrão).
- [x] Folha Pós 60: logos Sabesp + Consórcio Nova Norte, título centralizado, Objeto, Contratada, tabela de 6 colunas e grade 2×3 com as 6 legendas — conferida contra `MODELO DE DEVOLUTIVA PÓS 60 - VIA.pdf`.
- [x] Folhas sem assinatura/crédito inventados e sempre claras, independentes do tema.
- [x] Fotos preenchem a moldura (SGZ `object-contain`, Pós 60 `object-cover`).
- [x] Slot vazio imprime moldura com placeholder e o switch remove o slot da folha.
- [x] Imprimir usa `window.print()` com porte de impressão isolando as folhas e ocultando `.no-print`.
- [x] Download PDF via html2pdf em A4 a partir da porta de impressão.
- [x] Rascunhos salvos/abertos/duplicados/excluídos em `qualyflow:drafts:v1`.
- [x] Cabeçalho institucional e logos persistidos em `qualyflow:settings:v1` e refletidos na folha.
- [x] `pdf-extract.ts` classifica o tipo e extrai OS, FAC, protocolo SGZ, contratada, serviço, polo, endereço, data, prazo e situação.
- [x] Extração por nome do arquivo como reforço de baixa confiança.
- [x] Arquivo com mais de 15 páginas é recusado com mensagem clara, sem gravar registro.
- [x] PDF sem camada de texto entra como "Pendente de revisão" com campos vazios.
- [x] `review-dialog` edita todos os campos, tipo, status e mostra o texto lido.
- [x] KPIs de total, % concluídas, não conformidades, em andamento, pendentes e polos.
- [x] Gráficos por Polo (barras empilhadas) e por Status (rosca) com dados reais.
- [x] Tabela com filtros de polo/status/período/busca, ordenação e "Exportar CSV" das linhas filtradas (BOM + `;`).
- [x] `storage.ts` com leitura defensiva (JSON inválido → default) e aviso de cota excedida.
- [x] Estado vazio do Analista orientando o primeiro upload e progresso por página durante a extração.
- [x] Sem cores cruas nos componentes de UI e sem emojis; ícones apenas de `lucide-react`.

## Verification checklist

- [x] `pnpm lint` sem erros nem warnings.
- [x] `pnpm exec tsc --noEmit` sem erros.
- [x] `pnpm run build` conclui com sucesso (chunks: html2pdf e pdfjs carregados sob demanda).
- [x] Checagem visual (positiva) da folha SGZ-156 preenchida e com foto contra o modelo, em 1280px.
- [x] Checagem visual (positiva) da folha Pós 60 Via com as 6 fotos contra o modelo.
- [x] Checagem visual do dashboard com dados de exemplo (KPIs, barras por polo, rosca de status e tabela ordenável).
- [x] Responsividade em `mobile_390` de `/emissor` e `/analista` (sidebar colapsada, sem overflow; tabela de 6 fotos do modelo conferida na folha).
- [x] Extração validada contra os PDFs reais por harness temporário: Pós 60 Via (OS, FAC, serviço, polo, endereço, data, contratada), Pós 60 Passeio (idem) e SGZ digitalizado (sem texto → pendente, sem dados inventados); caso SGZ com texto verificado por texto sintético.
- [x] Harness temporário removido (`DevAnalise`, `DevFolhas`, `DevDash`, `public/samples`, rotas de teste).
- [x] Tema claro conferido em 1280px com contraste legível; folha do relatório permanece clara.
- [ ] **Verificação manual pendente do usuário**: clicar em Imprimir (pré-visualização A4) e em Baixar PDF — exigem interação de clique, indisponível na sandbox.
- [ ] **Verificação manual pendente do usuário**: colar foto com Ctrl+V / arrastar arquivo em um campo de foto.
- [ ] **Verificação manual pendente do usuário**: importar um PDF pelo navegador, revisar os campos no diálogo e conferir o reflexo nos indicadores.
- [ ] **Verificação manual pendente do usuário**: trocar de modelo com dados preenchidos e conferir a preservação dos campos em comum e a gravação de rascunho após recarregar a página.
