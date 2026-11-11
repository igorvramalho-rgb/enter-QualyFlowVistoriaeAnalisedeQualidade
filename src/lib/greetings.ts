/**
 * Banco de saudações do Qualy Flow — 300 frases (motivacionais e bíblicas).
 * Uma por dia, sem repetir até o banco inteiro ser percorrido.
 * A ordem é embaralhada por operador e guardada no próprio navegador.
 */

export interface Greeting {
  text: string;
  kind: "motivacional" | "biblica";
  source?: string;
}

const MOTIVACIONAL: [string, string][] = [
  ["Qualidade não é um ato isolado, é um hábito diário.", "Aristóteles"],
  ["O que é feito com atenção resiste ao tempo.", ""],
  ["Comece onde você está, use o que você tem, faça o que pode.", "Arthur Ashe"],
  ["A disciplina vence o talento quando o talento não se esforça.", ""],
  ["Cada vistoria bem feita é uma promessa cumprida com a cidade.", ""],
  ["Detalhe é onde a qualidade aparece.", ""],
  ["Fazer bem uma vez economiza dez repetições.", ""],
  ["O trabalho bem feito fala por quem o fez.", ""],
  ["A pressa é inimiga da precisão.", ""],
  ["Quem mede, melhora; quem melhora, permanece.", ""],
  ["A excelência é uma decisão repetida todos os dias.", ""],
  ["Não existe serviço pequeno quando o propósito é grande.", ""],
  ["O olhar atento do fiscal evita o problema do cidadão.", ""],
  ["Constância vale mais que intensidade.", ""],
  ["Termine o que começou, mesmo que em passos pequenos.", ""],
  ["Seu padrão de hoje é o resultado de amanhã.", ""],
  ["Quem cuida do detalhe protege o todo.", ""],
  ["Faça simples, faça certo, faça completo.", ""],
  ["A confiança se constrói em cada registro correto.", ""],
  ["O que você documenta hoje protege o amanhã.", ""],
  ["Foco no que depende de você.", ""],
  ["A melhor defesa técnica é um registro bem feito.", ""],
  ["Nenhum esforço bem direcionado se perde.", ""],
  ["Aprender é o único trabalho que nunca cansa.", ""],
  ["Organização é produtividade silenciosa.", ""],
  ["Quem planeja o dia conduz o dia.", ""],
  ["A calma resolve o que a pressa complica.", ""],
  ["Compare com ontem, não com os outros.", ""],
  ["Cada arquivo organizado é tempo devolvido a você.", ""],
  ["Feito é melhor que perfeito, desde que feito com critério.", ""],
  ["A repetição consciente constrói maestria.", ""],
  ["Trabalhe com o que existe, entregue o que importa.", ""],
  ["A boa execução começa antes do primeiro clique.", ""],
  ["Um problema bem descrito já está meio resolvido.", ""],
  ["Não deixe a urgência apagar o importante.", ""],
  ["A técnica protege o profissional.", ""],
  ["Registrar é um ato de responsabilidade.", ""],
  ["O campo ensina o que o papel nunca dirá.", ""],
  ["Você não precisa ser rápido, precisa ser correto.", ""],
  ["Construa hoje a referência que faltou ontem.", ""],
  ["O padrão que você aceita é o padrão que você entrega.", ""],
  ["Pequenas correções diárias evitam grandes refações.", ""],
  ["A clareza economiza discussões.", ""],
  ["Seja a pessoa que resolve, não a que aponta.", ""],
  ["Quem conhece o processo não teme a auditoria.", ""],
  ["O saber técnico é um bem que ninguém pode tirar.", ""],
  ["Ambiente organizado, cabeça tranquila.", ""],
  ["Toda pendência registrada é uma pendência resolvível.", ""],
  ["A confiabilidade nasce da constância.", ""],
  ["Não confunda movimento com progresso.", ""],
  ["O primeiro passo de um dia bom é começar.", ""],
  ["Respeite o seu ritmo, cumpra o seu compromisso.", ""],
  ["A qualidade ama o detalhe e detesta o improviso.", ""],
  ["A excelência não é sorte, é rotina.", ""],
  ["Investigue antes de concluir.", ""],
  ["Registro completo, defesa tranquila.", ""],
  ["A pressa nunca foi sinal de competência.", ""],
  ["O hábito correto liberta o talento.", ""],
  ["Nada substitui a leitura atenta de um documento.", ""],
  ["Trabalho discreto bem feito é o mais respeitado.", ""],
  ["Reputação é o acúmulo dos dias bem vividos.", ""],
  ["Reveja, confira, confirme.", ""],
  ["O que parece detalhe é o que garante o resultado.", ""],
  ["Escolha o trabalho bem feito todos os dias.", ""],
  ["Não existe eficiência sem método.", ""],
  ["A organização é a forma mais simples de inteligência.", ""],
  ["Cada dado correto é um voto de confiança.", ""],
  ["O esforço certo, na hora certa, muda tudo.", ""],
  ["Aprenda com o erro, não com o arrependimento.", ""],
  ["A clareza da informação evita o retrabalho.", ""],
  ["Método vence inspiração.", ""],
  ["Toda cidade bem cuidada começa em uma boa vistoria.", ""],
  ["A competência silenciosa transforma o ambiente.", ""],
  ["Seu trabalho protege pessoas que você nunca verá.", ""],
  ["Olhe o mapa antes de acelerar.", ""],
  ["Refaça com paciência; ninguém acerta de primeira sempre.", ""],
  ["Fazer o básico bem feito já é vantagem competitiva.", ""],
  ["A atenção é o melhor filtro de erros.", ""],
  ["Confira duas vezes e explique uma.", ""],
  ["O tempo bem usado se multiplica.", ""],
  ["O importante é ser confiável, não ser perfeito.", ""],
  ["O padrão do primeiro documento deve ser o mesmo do último.", ""],
  ["Quem domina o assunto responde com elegância.", ""],
  ["A consistência é a assinatura dos grandes profissionais.", ""],
  ["Comece pelo que destrava o resto.", ""],
  ["A boa informação chegou para ficar.", ""],
  ["Seu critério é a garantia do resultado.", ""],
  ["Não delegue o que você precisa entender.", ""],
  ["Toda decisão técnica pede evidência.", ""],
  ["O foco é uma escolha, não um talento.", ""],
  ["A qualidade do serviço aparece onde ninguém vê.", ""],
  ["O pacote de hoje é a estatística de amanhã.", ""],
  ["Nada supera um relatório claro.", ""],
  ["O detalhe bem documentado vira prova.", ""],
  ["A melhor rotina é a que você consegue repetir.", ""],
  ["O técnico que estuda sempre tem a última palavra.", ""],
  ["Trabalhe de forma que seu trabalho fale por você.", ""],
  ["Concluir é mais valioso que começar.", ""],
  ["O ambiente muda quando alguém decide fazer certo.", ""],
  ["Disciplina é liberdade com prazo.", ""],
  ["A pressa custa mais caro que a calma.", ""],
  ["Um dia comum bem feito não é comum.", ""],
  ["Escolha a verdade antes do atalho.", ""],
  ["A análise honesta é a base da boa decisão.", ""],
  ["Atenção aos detalhes é atenção às pessoas.", ""],
  ["Seu nome está em cada documento que você entrega.", ""],
  ["A revisão é o que separa o bom do confiável.", ""],
  ["O caminho mais curto é o caminho bem entendido.", ""],
  ["A rotina bem organizada libera a mente.", ""],
  ["A defesa de hoje depende do registro de ontem.", ""],
  ["Esforce-se pelo claro, não pelo bonito.", ""],
  ["Nada é mais produtivo que fazer o correto.", ""],
  ["Quem resolve problemas aprende mais rápido.", ""],
  ["A confiança é construída em silêncio, com consistência.", ""],
  ["Cada FV tratada é uma resposta à sociedade.", ""],
  ["A organização vence a ansiedade.", ""],
  ["Faça o que pode, com o que tem, onde está.", ""],
  ["O especialista é o iniciante que continuou.", ""],
  ["A qualidade é uma decisão repetida, não um dom.", ""],
  ["O técnico atento antecipa o problema do outro.", ""],
  ["O detalhe tem memória longa.", ""],
  ["Um erro corrigido cedo é uma vitória discreta.", ""],
  ["Escolha o critério certo, mesmo quando ninguém vê.", ""],
  ["Palavra dada, prazo cumprido.", ""],
  ["O cuidado evita o retrabalho e protege o time.", ""],
  ["A eficiência mora nos detalhes bem resolvidos.", ""],
  ["Sua rotina é o seu legado técnico.", ""],
  ["Seja rigoroso com o que entrega.", ""],
  ["Quem respeita o processo é respeitado no resultado.", ""],
  ["A imaginação planeja; a disciplina executa.", ""],
  ["Nenhuma tarefa é pequena quando é bem feita.", ""],
  ["A boa prática é a melhor ferramenta.", ""],
  ["Comece cedo, revise no fim.", ""],
  ["A dúvida bem investigada vira segurança.", ""],
  ["Pense devagar, execute com firmeza.", ""],
  ["A qualidade não é acidente, é engenharia.", ""],
  ["O profissional que registra nunca perde a discussão.", ""],
  ["Faça a próxima tarefa bem, e as próximas também.", ""],
  ["Ninguém melhora o que não mede.", ""],
  ["A competência se prova na repetição.", ""],
  ["O seu padrão de trabalho educa o ambiente.", ""],
  ["Seja a referência que você gostaria de ter tido.", ""],
  ["Trabalho bem feito não precisa de desculpa.", ""],
  ["A experiência é um arquivo bem cuidado.", ""],
  ["Foco no essencial: o resto é consequência.", ""],
  ["Clareza no registro, tranquilidade na defesa.", ""],
  ["O domínio do processo é a melhor segurança.", ""],
  ["Trabalhe com método e o resultado aparece.", ""],
  ["A qualidade do detalhe é a marca de quem respeita o serviço.", ""],
  ["Um dia produtivo começa com um plano simples.", ""],
];

const BIBLICAS: [string, string][] = [
  ["Tudo posso naquele que me fortalece.", "Filipenses 4:13"],
  ["O Senhor é meu pastor; nada me faltará.", "Salmos 23:1"],
  ["Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", "Provérbios 3:5"],
  ["Tudo o que fizerdes, fazei-o de todo o coração, como ao Senhor.", "Colossenses 3:23"],
  ["Bom é o Senhor, refúgio no dia da angústia; conhece os que nele confiam.", "Naum 1:7"],
  ["O choro pode durar uma noite, mas a alegria vem pela manhã.", "Salmos 30:5"],
  ["Buscai primeiro o reino de Deus e a sua justiça, e todas as coisas vos serão acrescentadas.", "Mateus 6:33"],
  ["Não temas, porque eu estou contigo; não te assombres, porque eu sou teu Deus.", "Isaías 41:10"],
  ["O Senhor te abençoe e te guarde.", "Números 6:24"],
  ["Entrega o teu caminho ao Senhor, confia nele, e ele fará, e tudo farás prosperar.", "Salmos 37:5"],
  ["A alegria do Senhor é a vossa força.", "Neemias 8:10"],
  ["O Senhor é a minha luz e a minha salvação; a quem temerei?", "Salmos 27:1"],
  ["Sê fiel no pouco, e sobre o muito te colocarei.", "Lucas 16:10"],
  ["Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu.", "Eclesiastes 3:1"],
  ["A palavra suave acalma o coração e gera confiança.", "Provérbios 16:24"],
  ["Não nos cansemos de fazer o bem, pois no seu tempo colheremos.", "Gálatas 6:9"],
  ["O que caminha com os sábios torna-se sábio.", "Provérbios 13:20"],
  ["A humildade precede a honra.", "Provérbios 15:33"],
  ["O Senhor fortalece o seu povo e abençoa.", "Salmos 29:11"],
  ["Se Deus é por nós, quem será contra nós?", "Romanos 8:31"],
  ["Bem-aventurados os que têm fome e sede de justiça.", "Mateus 5:6"],
  ["Aquele que é fiel nas pequenas coisas também é fiel nas grandes.", "Lucas 16:10"],
  ["Em tudo dai graças.", "1 Tessalonicenses 5:18"],
  ["Lâmpada para os meus pés é a tua palavra e luz para o meu caminho.", "Salmos 119:105"],
  ["Os que esperam no Senhor renovam as suas forças.", "Isaías 40:31"],
  ["Derramarei sobre vós a minha paz, e ninguém a tirará.", "João 14:27"],
  ["O Senhor é bom, é fortaleza no dia da angústia.", "Naum 1:7"],
  ["Não vos prendais à ansiedade, mas em tudo fazei oração.", "Filipenses 4:6"],
  ["O Senhor sustenta todos os que caem e levanta os abatidos.", "Salmos 145:14"],
  ["Todo trabalho honesto é digno e honrado.", "Provérbios 12:11"],
  ["O coração do homem planeja o seu caminho, mas o Senhor lhe dirige os passos.", "Provérbios 16:9"],
  ["A sabedoria é mais preciosa que o ouro.", "Provérbios 16:16"],
  ["O teu ouvido ouvirá a palavra que te diz: este é o caminho, andai por ele.", "Isaías 30:21"],
  ["O Senhor pelejará por vós, e vós estareis tranquilos.", "Êxodo 14:14"],
  ["Alegrai-vos na esperança, sede pacientes na tribulação, perseverai na oração.", "Romanos 12:12"],
  ["O justo vive pela sua fé.", "Habacuque 2:4"],
  ["Não julgueis pelo que aparece, mas julgai com justiça.", "João 7:24"],
  ["Fala a verdade, e a tua paz será duradoura.", "Zacarias 8:16"],
  ["Se o Senhor não edificar a casa, em vão trabalham os que a edificam.", "Salmos 127:1"],
  ["A mansidão e o autocontrole são fruto do Espírito.", "Gálatas 5:22"],
  ["O amor é paciente e é bondoso.", "1 Coríntios 13:4"],
  ["Nada façais por contenda e por vaidade, mas com humildade.", "Filipenses 2:3"],
  ["O Senhor guardará a tua saída e a tua entrada.", "Salmos 121:8"],
  ["Bendize, ó minha alma, ao Senhor, e não te esqueças de nenhum dos seus benefícios.", "Salmos 103:2"],
  ["Grandes coisas fez o Senhor por nós, e por isso estamos alegres.", "Salmos 126:3"],
  ["O Senhor é o meu refúgio e fortaleza, socorro bem presente na angústia.", "Salmos 46:1"],
  ["Não desprezes a correção, ela é o caminho da vida.", "Provérbios 6:23"],
  ["Melhor é o pouco com justiça que a abundância com injustiça.", "Provérbios 16:8"],
  ["Quem anda na integridade anda seguro.", "Provérbios 10:9"],
  ["O prudente vê o mal e esconde-se; o simples passa adiante e sofre.", "Provérbios 22:3"],
  ["O Senhor é a força do seu povo e a salvação do seu ungido.", "Salmos 28:8"],
  ["Todo aquele que pede, recebe; quem busca, acha.", "Mateus 7:8"],
  ["Aprendei a fazer o bem; buscai a justiça.", "Isaías 1:17"],
  ["Seja o vosso falar: sim, sim; não, não.", "Mateus 5:37"],
  ["O Senhor dá sabedoria; da sua boca vem o conhecimento e o entendimento.", "Provérbios 2:6"],
  ["Quem guarda a sua boca e a sua língua no mundo.", "Provérbios 21:23"],
  ["O Senhor levantará sobre ti a sua face e te dará a paz.", "Números 6:26"],
  ["Sede fortes e corajosos; não temais, porque o Senhor teu Deus é contigo.", "Josué 1:9"],
  ["A oração do justo pode muito em seus efeitos.", "Tiago 5:16"],
  ["O Senhor conhece os dias dos íntegros.", "Salmos 37:18"],
  ["Não é por força nem por violência, mas pelo meu Espírito.", "Zacarias 4:6"],
  ["Em Deus faremos proezas.", "Salmos 60:12"],
  ["O Senhor é a minha força e o meu escudo.", "Salmos 28:7"],
  ["A tua palavra é a verdade.", "João 17:17"],
  ["Melhor é o fim das coisas do que o princípio delas.", "Eclesiastes 7:8"],
  ["Quem procura o bem alcança favor.", "Provérbios 11:27"],
  ["O Senhor é justo em todos os seus caminhos.", "Salmos 145:17"],
  ["Cantai ao Senhor, porque fez coisas grandiosas.", "Isaías 12:5"],
  ["O Senhor está perto dos que têm o coração quebrantado.", "Salmos 34:18"],
  ["Nada é impossível a Deus.", "Lucas 1:37"],
  ["Confessai as vossas culpas e orai uns pelos outros.", "Tiago 5:16"],
  ["A esperança que se adia faz adoecer o coração, mas o desejo cumprido é árvore de vida.", "Provérbios 13:12"],
  ["O Senhor firma os passos do homem bom.", "Salmos 37:23"],
  ["Guardai-vos de toda avareza.", "Lucas 12:15"],
  ["Servi uns aos outros conforme o dom que cada um recebeu.", "1 Pedro 4:10"],
  ["O temor do Senhor é o princípio da sabedoria.", "Provérbios 9:10"],
  ["A paz deixo convosco, a minha paz vos dou.", "João 14:27"],
  ["Não se turbe o vosso coração, credes em Deus.", "João 14:1"],
  ["O Senhor te sustentará e nunca deixará vacilar o justo.", "Salmos 55:22"],
  ["A luz resplandece nas trevas.", "João 1:5"],
  ["Bem-aventurado o homem que acha sabedoria.", "Provérbios 3:13"],
  ["A mansidão acalma grandes contendas.", "Provérbios 15:18"],
  ["Tudo o que é verdadeiro, nisso pensai.", "Filipenses 4:8"],
  ["Não toqueis no mal, aprendei a fazer o bem.", "Isaías 1:16"],
  ["O Senhor ouve a oração dos justos.", "Provérbios 15:29"],
  ["A esperança dos justos é alegria.", "Provérbios 10:28"],
  ["Deus resiste aos soberbos e dá graça aos humildes.", "Tiago 4:6"],
  ["Vós sois a luz do mundo.", "Mateus 5:14"],
  ["O Senhor reinará para sempre.", "Salmos 146:10"],
  ["Em tudo seja sábio e prudente.", "Provérbios 14:15"],
  ["Não se canse a tua alma de fazer o bem.", "Provérbios 3:27"],
  ["A alegria do coração adorna o rosto.", "Provérbios 15:13"],
  ["O Senhor é a rocha da minha justiça.", "Salmos 92:15"],
  ["Seja feita a vossa vontade.", "Mateus 6:10"],
  ["A graça vos foi dada em Cristo Jesus.", "1 Coríntios 1:4"],
  ["O Senhor guarda a verdade para sempre.", "Salmos 146:6"],
  ["O servo fiel não se cansa de servir.", "Provérbios 11:24"],
  ["A tua justiça é um abismo profundo.", "Salmos 36:6"],
  ["O Senhor abençoa o que teme o seu nome.", "Salmos 115:13"],
  ["O fruto do Espírito é o amor e a bondade.", "Gálatas 5:22"],
  ["A palavra do Senhor é reta.", "Salmos 33:4"],
  ["O Senhor é justo e ama a justiça.", "Salmos 11:7"],
  ["Sê forte e não temas.", "Isaías 35:4"],
  ["A obediência é melhor que o sacrifício.", "1 Samuel 15:22"],
  ["O Senhor te guardará de todo o mal.", "Salmos 121:7"],
  ["Ninguém acende uma candeia e a coloca debaixo do cesto.", "Mateus 5:15"],
  ["O que não trabalha não coma; o trabalho dignifica.", "2 Tessalonicenses 3:10"],
  ["A mansidão afasta a ira.", "Provérbios 15:1"],
  ["O Senhor é bom para os que esperam nele.", "Lamentações 3:25"],
  ["A confiança no Senhor traz prosperidade.", "Provérbios 28:25"],
  ["O Senhor me levantou para fazer o bem.", "Efésios 2:10"],
  ["O Senhor é o meu auxílio e não temerei.", "Hebreus 13:6"],
  ["A paz excede todo entendimento.", "Filipenses 4:7"],
  ["O Senhor conhece o seu povo pelo nome.", "João 10:3"],
  ["Bem-aventurados os pacificadores.", "Mateus 5:9"],
  ["O amor cobre uma multidão de faltas.", "1 Pedro 4:8"],
  ["O que semeia com lágrimas colherá com alegria.", "Salmos 126:5"],
  ["A justiça exalta as nações.", "Provérbios 14:34"],
  ["O Senhor é grande em conselho e poderoso em obras.", "Jeremias 32:19"],
  ["A tua mercê nos alcançou.", "Salmos 136:1"],
  ["Tudo tem o seu tempo; espera com paciência.", "Eclesiastes 3:11"],
  ["O Senhor é refúgio em tempos difíceis; o justo encontra nele amparo.", "Salmos 9:9"],
  ["A fidelidade do Senhor dura para sempre.", "Salmos 117:2"],
  ["Faze o bem e viverás.", "Provérbios 4:4"],
  ["O sábio ouve e aumenta o saber.", "Provérbios 1:5"],
  ["A coragem é o escudo do justo.", "Salmos 112:7"],
  ["Não cobices o que não podes repartir.", "Êxodo 20:17"],
  ["O Senhor firmou os montes com a sua força.", "Salmos 65:6"],
  ["A esperança não envergonha.", "Romanos 5:5"],
  ["O Senhor ouve o clamor dos humildes.", "Salmos 34:6"],
  ["Buscai o bem da cidade onde estais.", "Jeremias 29:7"],
  ["O teu testemunho é a minha alegria.", "Salmos 119:14"],
  ["A providência do Senhor não falha.", "Filipenses 4:19"],
  ["O que guarda a ordem é sábio.", "Provérbios 12:8"],
  ["O Senhor é a minha herança e a minha porção.", "Salmos 16:5"],
  ["A mansidão é mais forte que a violência.", "Provérbios 16:32"],
  ["Vigiai e orai.", "Mateus 26:41"],
  ["O Senhor é o nosso juiz e rei.", "Isaías 33:22"],
  ["A palavra do sábio edifica.", "Provérbios 15:2"],
  ["A paz seja nesta casa.", "Lucas 10:5"],
  ["O Senhor fez maravilhas aos nossos olhos.", "Salmos 118:23"],
  ["Sê um obreiro aprovado, não te envergonhes.", "2 Timóteo 2:15"],
  ["A discrição guarda o homem prudente.", "Provérbios 2:11"],
  ["O Senhor é o meu cântico e a minha força.", "Êxodo 15:2"],
  ["A ti levanto os meus olhos, ó Senhor.", "Salmos 123:1"],
  ["O Senhor ordena os passos do homem e se agrada no seu caminho.", "Salmos 37:23"],
  ["O Senhor está comigo como poderoso valente.", "Jeremias 20:11"],
  ["Tudo suporta, tudo crê, tudo espera, tudo sofre o amor.", "1 Coríntios 13:7"],
  ["A fidelidade do Senhor é a nossa segurança.", "Salmos 89:2"],
  ["O Senhor recompensa a cada um segundo as suas obras.", "Romanos 2:6"],
];

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[random]] = [copy[random], copy[index]];
  }
  return copy;
}

function buildPool(): Greeting[] {
  const motivacionais: Greeting[] = MOTIVACIONAL.map(([text, source]) => ({
    text,
    kind: "motivacional",
    source: source || undefined,
  }));
  const biblicas: Greeting[] = BIBLICAS.map(([text, source]) => ({
    text,
    kind: "biblica",
    source,
  }));
  return [...motivacionais, ...biblicas];
}

export const GREETINGS: Greeting[] = buildPool();

const STORAGE_KEY = "qualyflow:greeting-state";

interface GreetingState {
  day: string;
  index: number;
  order: number[];
  pointer: number;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Escolhe a frase do dia: embaralha o banco uma vez, avança um por dia e só
 * volta ao início quando todas as 300 forem usadas.
 */
export function pickDailyGreeting(date = new Date()): Greeting {
  const today = dayKey(date);
  let state: GreetingState | null = null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? (JSON.parse(raw) as GreetingState) : null;
  } catch {
    state = null;
  }

  if (state && state.day === today && Number.isInteger(state.index) && GREETINGS[state.index]) {
    return GREETINGS[state.index];
  }

  const ordemValida =
    state && Array.isArray(state.order) && state.order.length === GREETINGS.length;

  const order = ordemValida ? state!.order : shuffle(Array.from(GREETINGS.keys()));
  const pointer = ordemValida && state!.pointer < order.length ? state!.pointer : 0;
  const index = order[pointer];

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: today, index, order, pointer: pointer + 1 } satisfies GreetingState),
    );
  } catch {
    /* sem armazenamento: usa a frase sorteada apenas nesta sessão */
  }

  return GREETINGS[index] ?? GREETINGS[0];
}
