# QualyFlow — Emissor de Relatórios + Analista de Vistorias

## Context

O projeto hoje é apenas o template Vite + React + shadcn (uma única página `src/pages/Index.tsx` com um gradiente). Não existe nenhuma tela, rota, token de marca ou regra de negócio.

O objetivo é construir o **QualyFlow**, sistema de gestão de qualidade operacional em português (pt-BR) com dois módulos:

1. **Emissor de Relatórios** (`/emissor`) — escolher um modelo (SGZ-156, Devolutiva Pós 60 Passeio, Devolutiva Pós 60 Via), preencher os campos do cabeçalho, colar/arrastar fotos nos slots predefinidos, pré-visualizar a folha A4 e exportar PDF.
2. **Analista de Vistorias** (`/analista`) — importar PDFs de vistoria, extrair métricas com revisão manual e visualizar dashboard analítico (KPIs, gráfico por polo, tabela filtrável com exportação CSV).

Decisões confirmadas com o usuário:
- **100% frontend, sem backend/login/nuvem.** A persistência é feita em `localStorage` (contrato explícito: os dados se perdem se o navegador for limpo). Nada de mock de backend.
- **PDFs mistos** (texto pesquisável + digitalizados): extrair o que a camada de texto permitir e **permitir revisão/edição manual** de cada campo. Sem OCR.
- **Cabeçalho corporativo padrão** com placeholder de logo trocável pelo usuário.
- **Exportação dupla**: botão Imprimir (nativo, vetorial, A4 exato) + Download PDF (html2pdf.js).
- **Assistente de IA fica fora desta versão** (exigiria backend + capacidade de IA).

Regra de idioma: toda a interface, textos e mensagens em **português do Brasil**.

---

## Arquitetura

- **Frontend only**: React 19 + Vite + Tailwind v3 + shadcn/ui (já instalado) + Recharts (já instalado) + react-router-dom (já instalado).
- **Estado**: `localStorage` com chaves versionadas, via hook reutilizável. Sem chamadas de rede.
- **Sem i18n extension**: strings pt-BR diretas (o app é mono-idioma; não mexer em `i18n.config.json` nem em `src/i18n/*`).
- **Analytics**: não remover nem contornar `bootstrapGeneratedSiteAnalytics()` (`src/analytics.ts`); usar apenas botões/links/formulários semânticos.

### Dependências a adicionar
```bash
pnpm add pdfjs-dist html2pdf.js react-dropzone
```
- `pdfjs-dist` → extração de texto dos PDFs (worker via `pdfjs-dist/build/pdf.worker.min.mjs?url`).
- `html2pdf.js` → geração do arquivo PDF a partir da folha A4 + declaração de tipos própria.
- `react-dropzone` → drag & drop de PDFs e das fotos.

### Estrutura de arquivos

```
src/
  App.tsx                          # + ThemeProvider (next-themes, class, dark default)
  router.tsx                       # + rotas /emissor e /analista dentro do AppShell
  index.css                        # design tokens da marca + estilos de impressão/A4
  tailwind.config.ts               # tokens extras: success, warning, sombras, animações
  types/html2pdf.d.ts              # declaração de módulo (html2pdf.js não traz tipos)
  lib/
    report-templates.ts            # definição dos 3 modelos (campos + slots de foto)
    storage.ts                     # wrapper seguro de localStorage (get/set, versão, quota)
    pdf-extract.ts                 # pdfjs: texto por página + heurísticas de campos
    csv.ts                         # exportação CSV (BOM + ';' para Excel pt-BR)
    image.ts                       # compressão de imagem (canvas → JPEG dataURL)
  hooks/
    use-local-storage.ts           # estado persistido reutilizável
    use-theme.ts                   # atalho de next-themes + toggle
  components/
    layout/app-shell.tsx           # sidebar + header (crédito) + <Outlet/> + footer fixo
    layout/app-sidebar.tsx         # navegação Emissor / Analista BI (usa ui/sidebar ou nav simples)
    layout/theme-toggle.tsx
    layout/app-footer.tsx          # "QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade"
    emissores/photo-dropzone.tsx   # slot com Ctrl+V, drag&drop, preview, remover, legenda
    emissores/report-form.tsx      # campos dinâmicos por modelo
    emissores/report-sheet.tsx     # folha A4 imprimível (header corporativo + fotos + rodapé)
    emissores/drafts-list.tsx      # relatórios salvos/apagar/abrir
    analista/pdf-uploader.tsx      # dropzone de PDFs (limite 15 páginas/arquivo)
    analista/review-dialog.tsx     # revisão manual dos campos extraídos
    analista/kpi-cards.tsx         # total, % concluídas, reprovadas, polos
    analista/polo-chart.tsx        # barras por polo (Recharts)
    analista/status-chart.tsx      # concluído vs pendente (Recharts)
    analista/vistorias-table.tsx   # tabela filtrável + export CSV
    common/section-header.tsx      # título/descrição reutilizável
  pages/
    Emissor.tsx
    Analista.tsx
    NotFound.tsx                   # manter; ajustar para o design system
```

Reutilizar sempre que possível: `cn` de `src/lib/utils.ts`, `useIsMobile` de `src/hooks/use-mobile.tsx`, e os componentes `src/components/ui/*` (button, card, input, label, textarea, select, tabs, table, badge, dialog, sheet, separator, scroll-area, progress, tooltip, dropdown-menu, alert, sonner/`toast`).

---

## Design system (tokens da marca)

Editar **`src/index.css`** (HSL, obrigatório) e **`tailwind.config.ts`**:

- `--primary: 204 100% 28%` (azul corporativo ≈ `#005691`), `--primary-foreground` claro.
- `--accent: 160 84% 39%` (verde ≈ `#10B981`), `--accent-foreground` escuro.
- Novos tokens semânticos: `--success` (= verde) e `--warning` (âmbar, para "Em obra"/"Pendente"), ambos expostos no `tailwind.config.ts` como `success`/`warning` com `-foreground`.
- `--background`, `--card`, `--muted`, `--border` corporativos nos dois temas (claro limpo + escuro "Power BI"), com contraste AA.
- Utilidades de marca: `--gradient-primary`, `--shadow-elegant`, `--shadow-glow`, `--transition-smooth`, keyframes `fade-in` / `slide-up`.
- `neutral`/sidebar tokens ajustados para o azul da marca.
- **Sem** `text-white`/`bg-white`/cores cruas nos componentes — sempre tokens.

Tema híbrido: `next-themes` com `attribute="class"`, `defaultTheme="dark"`, `storageKey="qualyflow-theme"`, controlado pelos botões (`variant="ghost"`, ícones `Sun`/`Moon` do lucide-react). Nenhum caractere emoji em UI — apenas ícones lucide.

---

## Módulo 1 — Emissor de Relatórios (`/emissor`)

### Modelos (`src/lib/report-templates.ts`)
Três modelos tipados (`ReportTemplate`), cada um com `id`, `title`, `description`, `fields[]` (label, tipo: texto/textarea/data/select, opções) e `photoSlots[]` (id, caption/título exigido e obrigatório ou não):

| id | Título | Campos | Slots de foto |
|---|---|---|---|
| `sgz_156` | Demanda SGZ - 156 | Endereço, Data da Vistoria, Protocolo SGZ, Nº O.S., Origem da Demanda, Prazo para Conclusão, Situação Atual (select: Em Obra / Asfalto Provisório / Asfalto Definitivo / Falta Repor Sinalização) | 4: Notificação (Antes), Fachada, Visão Geral / Posição Régua, Régua / Trena |
| `pos_60_passeio` | Devolutiva Pós 60 - Passeio | Contratada, OS Nº, Nº FAC, Serviço Executado, Polo, Endereço, Data | 6: Reposição Perpendicular à Fachada, Qualidade do Pavimento Existente, Panorama da Reposição, Reposição com Régua Posicionada, Trena Indicando Desnível, Junta |
| `pos_60_via` | Devolutiva Pós 60 - Via | Contratada, OS Nº, Nº FAC, Serviço Executado, Polo, Endereço, Data | 6: mesmos slots do Passeio |

Ao trocar de modelo, os valores digitados comuns (Contratada, Endereço, Data, etc.) são preservados quando o label coincide.

### Fotos
- `photo-dropzone.tsx`: por slot, aceitar **Ctrl+V** (evento `paste` do documento direcionado ao slot focado/último ativo), **drag & drop** e clique para selecionar arquivo.
- Cada imagem é comprimida por `src/lib/image.ts` (canvas, lado maior ≤ 1600px, JPEG 0.82) antes de virar dataURL — necessário para caber no `localStorage`.
- Ações: visualizar, substituir, remover; legenda editável e opção de ocultar slot vazio na impressão.
- Aviso por `toast` quando o slot não é uma imagem válida ou quando a cota de armazenamento estoura.

### Pré-visualização e exportação
- `report-sheet.tsx` renderiza uma **folha A4 real** (`210mm × 297mm`, `@page { size: A4; margin: 0 }`), com cabeçalho corporativo (placeholder de logo `public/logo-placeholder.svg` + título do modelo + nº do relatório/data de emissão), grade de campos em duas colunas, bloco de fotos com o título exigido acima de cada imagem (2 por linha), bloco de assinatura e rodapé com o crédito "QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade".
- Quebra automática: `break-inside: avoid` nas figuras; se houver mais fotos do que cabe numa página, o conteúdo flui (folha com `min-height` em vez de altura fixa).
- **Imprimir**: `window.print()`; `@media print` em `index.css` oculta `.no-print` (sidebar, header, formulários) e mostra apenas a folha.
- **Baixar PDF**: `html2pdf.js` com `jsPDF: { unit: 'mm', format: 'a4' }` e `html2canvas: { scale: 2 }` — usar cores já resolvidas em `hsl()`/`hex`, sem `oklch`/`color-mix`, para o html2canvas renderizar corretamente; `pagebreak: { mode: ['css', 'legacy'] }`.
- Botão "Salvar rascunho" grava em `localStorage`; `drafts-list.tsx` permite reabrir, duplicar e excluir.

---

## Módulo 2 — Analista de Vistorias (`/analista`)

### Importação e extração (`src/lib/pdf-extract.ts`)
- `pdfjs-dist` lê o texto por página (`getTextContent()`), com limite de **15 páginas por arquivo** (arquivos maiores são recusados com mensagem clara).
- Heurísticas pt-BR com regex + normalização (remover acentos/ruído, unir quebras de linha), retornando `{ campo, valor, confiança }`:

| Campo | Estratégia |
|---|---|
| Nº O.S. | `/O\.?\s*S\.?\s*[:nº]*\s*([0-9][0-9./-]*)` |
| Protocolo SGZ | `/protocolo\s*(sgz)?\s*[:nº]*\s*([\w./-]+)` |
| Endereço | linha após "Endereço"/"Local" ou padrão `^(Rua|Av\.?|Avenida|Alameda|Estrada|Travessa|R\.)\s.+` |
| Data | `(\d{2}[/.-]\d{2}[/.-]\d{2,4})` (+ `date-fns` para ISO) |
| Polo | `/polo\s*[:]*\s*([A-Za-zÀ-ÿ0-9 \-]+)/` |
| Contratada | `/contratada\s*[:]*\s*([^\n]+)/` |
| Serviço Executado | `/servi[çc]o(\s+executado)?\s*[:]*\s*([^\n]+)/` |
| Status | palavras‑chave: "não conforme"/"reprovado"/"pendente" → Não Conforme/Pendente; "conforme"/"aprovado" → Conforme; "em obra"/"asfalto provisório" → Em Andamento |

- PDF digitalizado (sem camada de texto): registrar o arquivo com `extração: "sem texto"`, campos vazios e status **Pendente de revisão**, para preenchimento manual — nunca inventar dados.
- Deduplicação por nome de arquivo + hash simples do texto.

### Revisão manual (`review-dialog.tsx`)
- Dialog/sheet com todos os campos extraídos editáveis, marcação visual de baixa confiança, seleção de polo e status, e trecho de texto original ao lado para conferência.
- Salvar recalcula o registro, permitindo que dados de PDFs digitalizados entrem na base manualmente.

### Dashboard (estilo Power BI)
- `kpi-cards.tsx`: Total de Vistorias Analisadas, % Concluídas vs Pendentes, total de Não Conformidades, nº de Polos ativos e média de páginas por arquivo.
- `polo-chart.tsx`: barras por Polo/Região (Recharts `BarChart`, cores dos tokens, responsivo, tooltip temático).
- `status-chart.tsx`: Concluído vs Pendente (barras/donut).
- `vistorias-table.tsx`: filtros por Polo, Status, período (data inicial/final) e busca textual (OS/endereço), ordenação por coluna, contagem de resultados e **Exportar CSV** via `src/lib/csv.ts` (BOM `\uFEFF` + separador `;` → abre no Excel pt-BR), exportando exatamente as linhas filtradas.
- Estado vazio tratado com orientação para importar o primeiro PDF; barra de progresso durante a extração.

### Persistência (`src/lib/storage.ts` + `use-local-storage.ts`)
- Chaves versionadas: `qualyflow:drafts:v1`, `qualyflow:analyses:v1`, `qualyflow:settings:v1`.
- Leitura defensiva (JSON inválido → default, sem quebrar a tela), escrita com tratamento de `QuotaExceededError` (toast pedindo remover fotos/registros antigos).
- Banner discreto informando que os dados são locais deste navegador (coerente com a escolha de não usar nuvem).

---

## Roteamento e shell

`src/router.tsx`: adicionar antes do catch-all `*`:
- `/` → `Navigate to="/emissor"` (redirect, mantendo um único ponto de entrada).
- `/emissor` → `Emissor`, `/analista` → `Analista`, **ambos aninhados no `AppShell`** (elemento pai com `<Outlet/>`).

`AppShell`: sidebar fixa (colapsável no mobile via `Sheet`) com o nome QualyFlow e os itens **Emissor de Relatórios** (`FileText`) e **Analista BI** (`BarChart3`), indicador de rota ativa; header com breadcrumb simples, toggle de tema e crédito "Desenvolvido por Igor Ramalho"; footer fixo com o texto completo do rodapé. Todo o shell leva a classe `no-print`.

---

## Passos de implementação

1. `add_dependency`: `pdfjs-dist`, `html2pdf.js`, `react-dropzone`.
2. `src/index.css` + `tailwind.config.ts`: tokens da marca, temas claro/escuro, animações e estilos de impressão A4.
3. `App.tsx` (ThemeProvider) + `router.tsx` (rotas) + `AppShell`/sidebar/footer/theme-toggle.
4. `src/lib/*`: templates, storage, image, csv, pdf-extract, `types/html2pdf.d.ts`.
5. Módulo Emissor: formulário, slots de foto (paste/drag/compress), folha A4 por modelo, impressão + html2pdf, rascunhos.
6. Módulo Analista: uploader, extração, revisão manual, KPIs, gráficos, tabela + CSV.
7. `NotFound.tsx` alinhado ao design system; remover o conteúdo antigo de `Index.tsx` (substituído pelo redirect/AppShell).
8. Rodar `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm run build` corrigindo o que aparecer.

## Implementation checklist

- [ ] Dependências `pdfjs-dist`, `html2pdf.js`, `react-dropzone` instaladas e `src/types/html2pdf.d.ts` criado.
- [ ] `src/index.css` define `--primary` (azul #005691) e `--accent`/`--success` (#10B981) em HSL nos temas claro e escuro, mais as variáveis de gradiente/sombra.
- [ ] `tailwind.config.ts` expõe `success` e `warning` (com `-foreground`) e as animações novas.
- [ ] `App.tsx` envolve o app no `ThemeProvider` (class, dark default) e o toggle alterna o tema sem quebrar os toasts (Sonner usa `next-themes`).
- [ ] `src/router.tsx` roteia `/` → `/emissor`, `/emissor` e `/analista` dentro do `AppShell`, mantendo o catch-all `*`.
- [ ] `AppShell` renderiza sidebar (itens Emissor de Relatórios e Analista BI com rota ativa), header com crédito e footer "QualyFlow • Sistema Criado por Igor Ramalho | Célula de Qualidade".
- [ ] Sidebar vira `Sheet` no mobile usando `useIsMobile`.
- [ ] `report-templates.ts` contém os 3 modelos com exatamente os campos e slots de foto especificados.
- [ ] Trocar de modelo preserva valores de campos com label coincidente.
- [ ] `photo-dropzone` aceita colar (Ctrl+V), drag & drop e seleção por clique; comprime para JPEG dataURL e permite remover/substituir.
- [ ] `report-sheet` renderiza folha A4 com header corporativo (placeholder de logo), campos em grade, legendas exigidas por foto, bloco de assinatura e rodapé com crédito.
- [ ] Botão Imprimir usa `window.print()` com `@media print` isolando `.print-sheet` e ocultando `.no-print`.
- [ ] Botão Download PDF usa html2pdf.js em A4 (`scale: 2`) sobre a mesma folha.
- [ ] Rascunhos salvos/abertos/excluídos em `qualyflow:drafts:v1` sobrevivem ao recarregamento.
- [ ] `pdf-extract.ts` extrai OS, protocolo SGZ, endereço, data, polo, contratada, serviço e status via as heurísticas listadas.
- [ ] Arquivo com mais de 15 páginas é recusado com mensagem clara, sem gravar registro.
- [ ] PDF sem camada de texto é registrado como "Pendente de revisão" com campos vazios (nenhum dado inventado).
- [ ] `review-dialog` permite editar todos os campos e regravar o registro extraído.
- [ ] KPIs exibem total, % concluídas vs pendentes, não conformidades e polos.
- [ ] Gráficos por Polo e por Status renderizam com dados reais do `localStorage`.
- [ ] Tabela filtra por polo, status, período e busca, e "Exportar CSV" gera apenas as linhas filtradas com BOM + `;`.
- [ ] `storage.ts` trata JSON corrompido (cai no default) e `QuotaExceededError` (toast de aviso).
- [ ] Analista mostra estado vazio orientando o primeiro upload e barra de progresso durante a extração.
- [ ] Nenhuma cor crua (`bg-white`, `text-black`, `#hex` em componente) e nenhum emoji; ícones apenas de `lucide-react`.

## Verification checklist

- [ ] `pnpm lint` sem erros.
- [ ] `pnpm exec tsc --noEmit` sem erros.
- [ ] `pnpm run build` conclui com sucesso.
- [ ] `get_console_logs` sem erros de runtime nas rotas `/emissor` e `/analista`.
- [ ] Checagem visual (positiva) em `desktop_1280` de `/emissor` com o modelo SGZ-156 preenchido e ao menos 2 fotos.
- [ ] Checagem visual de responsividade em `mobile_390` de `/emissor` e `/analista` (sidebar colapsada, tabela com rolagem, gráficos sem overflow) — sem evidência nos dois viewports, a entrega é descrita como não verificada.
- [ ] Negativo: importar um arquivo não-PDF é recusado com mensagem, sem criar registro.
- [ ] Negativo: PDF com 16+ páginas é recusado e a lista permanece inalterada.
- [ ] Negativo: PDF sem texto entra como "Pendente de revisão" com campos vazios.
- [ ] Limite: com dados em `localStorage` corrompidos manualmente (`qualyflow:analyses:v1 = "{"`), a página abre com estado vazio em vez de quebrar.
- [ ] Limite: dashboard com zero vistorias mostra estado vazio e não lança erro de gráfico com array vazio.
- [ ] Padrão: primeira visita a `/` redireciona para `/emissor`; rota inexistente cai no `NotFound`.
- [ ] Tema: alternar claro/escuro mantém contraste legível em formulário, tabela, gráficos e folha A4 (que permanece clara, pois é papel).
- [ ] Fluxo fim a fim manual: preencher relatório → colar foto via Ctrl+V → Imprimir (preview A4 correto) → Download PDF → recarregar a página e reabrir o rascunho salvo.
