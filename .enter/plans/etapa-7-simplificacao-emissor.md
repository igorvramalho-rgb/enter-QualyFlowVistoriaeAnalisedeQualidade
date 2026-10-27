# Etapa 7 — Simplificação do Emissor e preservação do Analista

> **Somente análise e planejamento.** Nenhum código, tabela, permissão, arquivo ou dado foi alterado. Todos os números vêm de leitura do repositório e de consultas somente leitura ao banco/armazenamento.

## 1. Diagnóstico da arquitetura atual

### Emissor de Relatórios (`/emissor`)
1. Foto colada/arrastada → comprimida para 2200 px / JPEG 0,90 → **enviada ao bucket imediatamente**, antes de qualquer salvamento (`photo-slot-grid.tsx:109`).
2. Autosave a cada **700 ms** grava a linha inteira em `qualyflow_reports` (`Emissor.tsx:178-213`). O relatório guarda **apenas caminhos** de foto (`compactPhotos`), nunca base64.
3. Recorte → **novo arquivo** no bucket, `originalPath` preservado (`:690`). Filtros PRO → **novo arquivo** e a versão anterior vai para `history` (`:647`).
4. "Gerar PDF" → `html2canvas` (escala 3 ≈ 290 dpi) + `jsPDF`, **100% no navegador**. `showSaveFilePicker` devolve `saved` / `cancelled` / `unconfirmed`.
5. Retenção dos 2 mais recentes só roda quando o resultado é `saved`, e apaga **somente linhas** (`cloud.ts:413-441`).
6. **Não existe nenhuma exclusão de arquivo no código** (0 ocorrências de `storage.remove`).

### Analista BI (`/analista`)
- PDFs e planilhas são lidos **no navegador**; o arquivo original **nunca é enviado**.
- Persiste só linhas em `qualyflow_analyses`: campos extraídos, trecho de até 1.200 caracteres, confiança, páginas, origem do texto, revisão e `fingerprint` (reimportação atualiza em vez de duplicar).
- **Não usa o armazenamento de arquivos** (0 uploads).

### Volumes medidos
| Item | Número |
|---|---|
| Relatórios | **5** linhas · 5,2 MB físicos (conteúdo lógico ~1 KB/linha) |
| Análises | **1.115** linhas · 3,4 MB |
| Bucket privado | **541 arquivos · 281 MB** (média 531 KB, maior 1,29 MB) |
| Caminhos de foto citados nos relatórios | **26** (≈13 fotos × atual + original) |
| Arquivos órfãos | **~515** (~270 MB estimados) |
| Usuários / perfis / funções de backend | 4 / 2 / **1** |
| Logos | base64 **dentro do banco** (`qualyflow_settings`, 144 kB) — não ocupam o bucket |

**Conclusão do diagnóstico:** a parte "permanente" (Analista) ocupa 3,4 MB; a parte "temporária" (fotos do Emissor) ocupa **281 MB — ~80× mais** — e cresce sem teto, porque nada é apagado.

## 2. Plano simplificado para o Emissor

| # | Medida | Efeito | Reversível |
|---|---|---|---|
| P1 | Foto de rascunho ficar **local** (memória/IndexedDB) e ir para a nuvem só ao salvar um dos 2 relatórios recentes | corta o maior vetor de crescimento | sim |
| P2 | Guardar **original + versão atual**, no máximo **1 versão anterior** (hoje `history` é ilimitado) | -2 a -4 arquivos por foto editada | sim |
| P3 | Reduzir a foto final para **1600 px / 0,85** (hoje 2200 px / 0,90) | ~**-47% de bytes** por arquivo (≈280 KB), ainda ≈450 dpi no quadro impresso | sim (só novas fotos) |
| P4 | "Novo relatório"/"Limpar" já zeram o estado em tela; falta garantir que **nenhum upload de rascunho descartado** fique para trás | evita órfãos novos | sim |
| P5 | Manter o PDF **no navegador** (já é o caso) e não gerar PDF a cada alteração | nada muda no custo de nuvem | — |
| P6 | Autosave mais espaçado (ex.: 1,5 s) ou ao sair do campo | menos escritas, mesma segurança | sim |

**Decisão necessária (D1):** P1 contraria a regra anterior "tudo sempre salvo na nuvem". Alternativa conservadora: manter o upload imediato e obter a economia só com P2 + P3 + limpeza. **Sua escolha define o plano.**

## 3. Plano de preservação do Analista

Garantias a formalizar:
1. A retenção **nunca** toca `qualyflow_analyses` — hoje já é assim; passa a ser regra explícita e testada.
2. `fingerprint` + upsert preservam o histórico sem duplicar reimportações.
3. Backup já inclui as análises; a restauração precisa ser comprovada antes de qualquer exclusão.
4. RLS permanece: leitura para autenticados, permissões por linha mantidas.
5. **Risco atual identificado:** o botão "Limpar base" apaga **todas** as análises com apenas dois cliques e sem exportação prévia. Recomendo exigir exportação antes de limpar (medida separada, não incluída nesta etapa).

## 4. Tabelas e arquivos compartilhados

| Recurso | Emissor | Analista | Observação |
|---|---|---|---|
| `qualyflow_reports` | **dono** | não usa | alvo da retenção de 2 |
| `qualyflow_analyses` | não usa | **dono** | **nunca** entra na retenção |
| `qualyflow_settings` (logos base64) | usa | não usa | compartilhada, 144 kB |
| `qualyflow_user_settings` | usa | não usa | logo individual |
| `qualyflow_profiles` | usa (acesso) | usa (acesso) | gestor/vistoriador |
| Bucket `qualyflow-fotos` | **único usuário** | não usa | privado, links de 12 h |
| Auth | ambos | ambos | login por usuário |
| Backup (`/backup`) | ambos | ambos | gestor |

Fatos que afetam a limpeza:
- A política de leitura de `qualyflow_reports` é `USING true` para autenticados → **todos leem todos**; a poda apaga só os próprios (`created_by`).
- "Duplicar relatório" **reutiliza os mesmos caminhos de foto** → um arquivo pode pertencer a dois relatórios.

## 5. Política proposta para os dois relatórios recentes

- Escopo: **2 mais recentes por usuário** (como hoje), medidos por `updated_at`.
- Condição de disparo: somente após `saved` (gravação confirmada pelo navegador).
- `cancelled` e `unconfirmed` → **não poda nada**.
- A poda remove **linhas de relatório**, nunca arquivos de foto.
- Não poda: análises, configurações, perfis, fotos.
- **Limite honesto:** o navegador não garante que o PDF ficou no disco; por isso a confirmação só existe em navegadores com seletor de arquivos. Nos demais, nada é podado (comportamento seguro, porém o armazenamento cresce).

## 6. Estratégia de limpeza segura de fotos

Classificação de cada arquivo:
1. **Referenciado** — aparece em `path`, `originalPath` ou `history` de qualquer relatório → **nunca apagar**.
2. **Versão superada** — está só em `history` → apagar apenas se a política permitir e a versão atual estiver íntegra.
3. **Órfão** — não aparece em nenhum relatório → candidato, sujeito às regras abaixo.

Regras obrigatórias:
- **Nunca** apagar por ter removido uma linha de relatório.
- **Nunca** apagar foto dos 2 relatórios mais recentes de qualquer usuário.
- **Nunca** apagar arquivo citado por relatório duplicado ou por outro usuário.
- **Duas fases:** (1) relatório de candidatos em modo leitura (CSV, sem apagar nada); (2) execução por função de backend com verificação de referências, limite por lote e registro do que foi apagado.
- **Carência** de 30 dias antes de considerar órfão definitivo.
- **Reversibilidade:** antes de executar, baixar um pacote (ZIP/manifesto com links de 12 h) dos candidatos, para o gestor. Sem esse pacote, a exclusão é irreversível — e por isso não deve ser automatizada.
- Hoje o bucket **não tem política de exclusão**: a limpeza exige uma nova função de backend (hoje existe apenas uma).

## 7. Riscos, custos e dependências

| Risco | Impacto | Mitigação |
|---|---|---|
| Apagar foto ainda necessária para reconstruir um relatório | perda de prova de fiscalização | verificação de referências + carência + pacote prévio |
| `history` ilimitado | crescimento contínuo | P2 (máx. 1 versão anterior) |
| Navegadores sem confirmação de gravação | poda nunca ocorre; storage cresce | informar e oferecer limpeza manual revisada |
| Restauração do backup não comprovada | recuperação incerta | teste em ambiente isolado antes de qualquer exclusão |
| Limpeza exige função com privilégio de serviço | nova superfície de risco | função restrita ao gestor, com verificação e log |
| "Limpar base" do Analista sem exportação | perda de 1.115 análises | exigir exportação prévia (medida separada) |

**Economia estimada (premissas explícitas):** foto a 1600 px ≈ 280 KB → 13 fotos ≈ **3,6 MB/relatório** contra 6,9 MB hoje (~-47%). Somando P2, a projeção de ~2,5 GB/ano cai para ~**0,9–1,2 GB/ano**. Limpeza dos órfãos atual: libera **~270 MB** uma vez.

## 8. Plano de implementação em etapas pequenas e reversíveis

| Etapa | Conteúdo | Verificação | Reversão |
|---|---|---|---|
| **E1** | Relatório de candidatos (somente leitura) + exportação CSV | nenhum arquivo alterado | nenhuma ação destrutiva |
| **E2** | Limitar `history` a 1 versão anterior (frontend) | relatório abre, desfazer funciona | volta o comportamento anterior |
| **E3** | Reduzir foto final para 1600 px / 0,85 | comparar PDF impresso e tamanho do arquivo | reverter constantes |
| **E4** | Função de backend de limpeza (gestor, verificação + log, lote) | dry-run com contagem igual à E1 | função desativada, nada apagado |
| **E5** | Execução da limpeza dos órfãos, com pacote prévio baixado | 26 caminhos referenciados intactos | pacote baixado permite reenvio |
| **E6** | (Opcional, depende de D1) foto de rascunho local até salvar | fluxo completo de relatório + PDF | volta ao upload imediato |

Ordem sugerida: **E1 → E2 → E3 → E4 → E5**, com E6 apenas se você aprovar D1. Cada etapa para em validação, como nas fases anteriores.
