/**
 * Banco de frases do Qualy Flow — 200 frases famosas (100 bíblicas e 100
 * motivacionais). Uma por dia, sem repetir até o banco inteiro ser percorrido.
 * A ordem é embaralhada por operador e guardada no próprio navegador.
 */

export interface Greeting {
  text: string;
  kind: "motivacional" | "biblica";
  source?: string;
}

const MOTIVACIONAL: [string, string][] = [
  ["Somos o que repetidamente fazemos. A excelência, portanto, não é um ato, mas um hábito.", "Aristóteles"],
  ["Conhece-te a ti mesmo.", "Sócrates"],
  ["A sabedoria começa na admiração.", "Sócrates"],
  ["Nada é permanente, exceto a mudança.", "Heráclito"],
  ["Nenhum homem entra duas vezes no mesmo rio.", "Heráclito"],
  ["A jornada de mil milhas começa com um único passo.", "Lao Tsé"],
  ["Conhecer os outros é inteligência; conhecer a si mesmo é sabedoria.", "Lao Tsé"],
  ["Quando eu solto o que sou, torno-me o que poderia ser.", "Lao Tsé"],
  ["Não importa a velocidade com que você avança, desde que não pare.", "Confúcio"],
  ["O homem que move uma montanha começa carregando pequenas pedras.", "Confúcio"],
  ["Aprender sem pensar é inútil; pensar sem aprender é perigoso.", "Confúcio"],
  ["Escolha um trabalho que você ame e não terá de trabalhar um único dia.", "Confúcio"],
  ["Enquanto adiamos, a vida passa.", "Sêneca"],
  ["Nenhum vento é favorável para quem não sabe a que porto se dirige.", "Sêneca"],
  ["Você tem poder sobre a sua mente, não sobre os acontecimentos.", "Marco Aurélio"],
  ["A melhor vingança é não ser como aquele que te feriu.", "Marco Aurélio"],
  ["Não são as coisas que nos perturbam, mas a opinião que temos delas.", "Epicteto"],
  ["A suprema arte da guerra é vencer sem lutar.", "Sun Tzu"],
  ["Conheça o inimigo e conheça a si mesmo; em cem batalhas não correrá perigo.", "Sun Tzu"],
  ["A simplicidade é o último grau de sofisticação.", "Leonardo da Vinci"],
  ["Aprender nunca esgota a mente.", "Leonardo da Vinci"],
  ["Eu vi o anjo no mármore e esculpi até libertá-lo.", "Michelangelo"],
  ["Se vi mais longe, foi porque estava sobre os ombros de gigantes.", "Isaac Newton"],
  ["Não posso ensinar nada a ninguém; só posso fazê-los pensar.", "Galileu Galilei"],
  ["A imaginação é mais importante que o conhecimento.", "Albert Einstein"],
  ["Não podemos resolver um problema com o mesmo pensamento que o criou.", "Albert Einstein"],
  ["No meio da dificuldade encontra-se a oportunidade.", "Albert Einstein"],
  ["O gênio é um por cento de inspiração e noventa e nove por cento de transpiração.", "Thomas Edison"],
  ["Não falhei. Apenas encontrei dez mil maneiras que não funcionam.", "Thomas Edison"],
  ["Nada na vida deve ser temido, apenas compreendido.", "Marie Curie"],
  ["A perseverança e a confiança em si mesmo são essenciais para o sucesso.", "Marie Curie"],
  ["A sorte favorece a mente preparada.", "Louis Pasteur"],
  ["O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.", "Winston Churchill"],
  ["Nunca, nunca, nunca desista.", "Winston Churchill"],
  ["Parece sempre impossível até que seja feito.", "Nelson Mandela"],
  ["A educação é a arma mais poderosa que você pode usar para mudar o mundo.", "Nelson Mandela"],
  ["O que me preocupa não é o grito dos maus, mas o silêncio dos bons.", "Martin Luther King Jr."],
  ["Seja a mudança que você quer ver no mundo.", "Mahatma Gandhi"],
  ["A força não provém da capacidade física, mas da vontade indomável.", "Mahatma Gandhi"],
  ["Um grama de prática vale mais que toneladas de pregação.", "Mahatma Gandhi"],
  ["Faça o que pode, com o que tem, onde está.", "Theodore Roosevelt"],
  ["Acredite que você pode e já estará no meio do caminho.", "Theodore Roosevelt"],
  ["A melhor maneira de prever o futuro é criá-lo.", "Peter Drucker"],
  ["O que não pode ser medido não pode ser gerenciado.", "Peter Drucker"],
  ["Eficiência é fazer as coisas bem; eficácia é fazer as coisas certas.", "Peter Drucker"],
  ["O único modo de fazer um excelente trabalho é amar o que você faz.", "Steve Jobs"],
  ["A inovação distingue um líder de um seguidor.", "Steve Jobs"],
  ["O simples pode ser mais difícil do que o complexo.", "Steve Jobs"],
  ["Reunir-se é um começo, manter-se juntos é um progresso, trabalhar juntos é o sucesso.", "Henry Ford"],
  ["Fracassar é apenas a oportunidade de recomeçar de forma mais inteligente.", "Henry Ford"],
  ["Quer você acredite que pode, quer acredite que não, você está certo.", "Henry Ford"],
  ["A melhor maneira de começar é parar de falar e começar a fazer.", "Walt Disney"],
  ["Se você pode sonhar, você pode realizar.", "Walt Disney"],
  ["Investir em conhecimento rende sempre os melhores juros.", "Benjamin Franklin"],
  ["Bem feito é melhor do que bem dito.", "Benjamin Franklin"],
  ["Não deixes para amanhã o que podes fazer hoje.", "Benjamin Franklin"],
  ["O segredo de avançar é começar.", "Mark Twain"],
  ["Coragem é resistir ao medo e dominá-lo, não a ausência de medo.", "Mark Twain"],
  ["Daqui a vinte anos você estará mais decepcionado com o que não fez.", "Mark Twain"],
  ["Nada de grande se realiza sem entusiasmo.", "Ralph Waldo Emerson"],
  ["Avance confiantemente na direção dos seus sonhos.", "Henry David Thoreau"],
  ["Nada é mais poderoso do que uma ideia cujo tempo chegou.", "Victor Hugo"],
  ["O futuro pertence àqueles que acreditam na beleza dos seus sonhos.", "Victor Hugo"],
  ["O essencial é invisível aos olhos.", "Antoine de Saint-Exupéry"],
  ["Um objetivo sem plano é apenas um desejo.", "Antoine de Saint-Exupéry"],
  ["Fazer da vida um sonho e do sonho uma realidade.", "Antoine de Saint-Exupéry"],
  ["Tudo vale a pena se a alma não é pequena.", "Fernando Pessoa"],
  ["O que vale na vida não é o ponto de partida, e sim a caminhada.", "Cora Coralina"],
  ["O que a vida quer da gente é coragem.", "Guimarães Rosa"],
  ["Não existe meio termo: ou você se dedica de corpo e alma ou não vale a pena.", "Ayrton Senna"],
  ["Você nunca sabe quais resultados virão, mas se não fizer nada, não existirão.", "Ayrton Senna"],
  ["O sucesso não é acidente: é trabalho, perseverança, estudo e amor pelo que faz.", "Pelé"],
  ["A mudança não virá se esperarmos por outra pessoa ou por outro momento.", "Barack Obama"],
  ["Sim, nós podemos.", "Barack Obama"],
  ["O trabalho afasta de nós três grandes males: o tédio, o vício e a necessidade.", "Voltaire"],
  ["A mente que se abre a uma nova ideia jamais volta ao seu tamanho original.", "Oliver Wendell Holmes"],
  ["A melhor maneira de ter uma boa ideia é ter muitas ideias.", "Linus Pauling"],
  ["O sucesso não é a chave da felicidade. A felicidade é a chave do sucesso.", "Albert Schweitzer"],
  ["Quem tem fé e esperança nunca está sozinho.", "Anne Frank"],
  ["Comece com o objetivo em mente.", "Stephen Covey"],
  ["Primeiro o mais importante.", "Stephen Covey"],
  ["A disciplina é a ponte entre metas e conquistas.", "Jim Rohn"],
  ["Trabalhe mais em você do que no seu trabalho.", "Jim Rohn"],
  ["Você não precisa ser ótimo para começar, mas precisa começar para ser ótimo.", "Zig Ziglar"],
  ["Comece pelo porquê.", "Simon Sinek"],
  ["O preço da grandeza é a responsabilidade.", "Vince Lombardi"],
  ["O começo é a parte mais importante do trabalho.", "Platão"],
  ["A medida do homem é o que ele faz com o poder.", "Platão"],
  ["A coragem é a primeira das qualidades humanas.", "Aristóteles"],
  ["A esperança é o sonho do homem acordado.", "Aristóteles"],
  ["A dúvida é o princípio da sabedoria.", "Aristóteles"],
  ["A prática é a melhor mestra.", "Publilius Syrus"],
  ["Quem tem um porquê enfrenta qualquer como.", "Friedrich Nietzsche"],
  ["O que não me mata me fortalece.", "Friedrich Nietzsche"],
  ["A gota cava a pedra pela constância, não pela força.", "Provérbio latino"],
  ["Onde há união há vitória.", "Provérbio latino"],
  ["A palavra convence; o exemplo arrasta.", "Provérbio"],
  ["Devagar se vai ao longe.", "Provérbio"],
  ["É melhor prevenir do que remediar.", "Provérbio"],
  ["A união faz a força.", "Provérbio"],
];

const BIBLICAS: [string, string][] = [
  ["O Senhor é o meu pastor; nada me faltará.", "Salmos 23:1"],
  ["Tudo posso naquele que me fortalece.", "Filipenses 4:13"],
  ["O Senhor é a minha luz e a minha salvação; a quem temerei?", "Salmos 27:1"],
  ["Confia no Senhor de todo o teu coração.", "Provérbios 3:5"],
  ["Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.", "Provérbios 3:6"],
  ["Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", "Salmos 37:5"],
  ["Os que esperam no Senhor renovarão as suas forças.", "Isaías 40:31"],
  ["Não temas, porque eu sou contigo.", "Isaías 41:10"],
  ["Sê forte e corajoso; não temas, nem te espantes.", "Josué 1:9"],
  ["Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.", "Salmos 46:1"],
  ["A alegria do Senhor é a vossa força.", "Neemias 8:10"],
  ["O coração do homem planeja o seu caminho, mas o Senhor lhe dirige os passos.", "Provérbios 16:9"],
  ["Tudo tem o seu tempo determinado.", "Eclesiastes 3:1"],
  ["O Senhor é bom, um refúgio no dia da angústia.", "Naum 1:7"],
  ["Buscai primeiro o reino de Deus e a sua justiça.", "Mateus 6:33"],
  ["Pedi, e dar-se-vos-á; buscai, e encontrareis.", "Mateus 7:7"],
  ["O que é impossível aos homens é possível a Deus.", "Lucas 18:27"],
  ["A fé é o firme fundamento das coisas que se esperam.", "Hebreus 11:1"],
  ["O justo viverá pela fé.", "Romanos 1:17"],
  ["A esperança não traz confusão.", "Romanos 5:5"],
  ["Todas as coisas cooperam para o bem daqueles que amam a Deus.", "Romanos 8:28"],
  ["Se Deus é por nós, quem será contra nós?", "Romanos 8:31"],
  ["Não vos conformeis com este mundo, mas transformai-vos.", "Romanos 12:2"],
  ["Vence o mal com o bem.", "Romanos 12:21"],
  ["O amor é paciente, o amor é benigno.", "1 Coríntios 13:4"],
  ["Tudo suporta, tudo crê, tudo espera, tudo sofre.", "1 Coríntios 13:7"],
  ["Permanecei firmes e constantes na obra do Senhor.", "1 Coríntios 15:58"],
  ["O fruto do Espírito é amor, alegria, paz e paciência.", "Gálatas 5:22"],
  ["Não nos cansemos de fazer o bem.", "Gálatas 6:9"],
  ["Sede fortes no Senhor e na força do seu poder.", "Efésios 6:10"],
  ["A paz de Deus excede todo o entendimento.", "Filipenses 4:7"],
  ["O que é verdadeiro, honesto e justo, nisso pensai.", "Filipenses 4:8"],
  ["Alegrai-vos sempre no Senhor.", "Filipenses 4:4"],
  ["O Senhor é a minha força e o meu escudo.", "Salmos 28:7"],
  ["O Senhor é misericordioso e compassivo.", "Salmos 103:8"],
  ["Lâmpada para os meus pés é a tua palavra.", "Salmos 119:105"],
  ["A pedra que os construtores rejeitaram tornou-se a pedra angular.", "Salmos 118:22"],
  ["O Senhor está perto dos que têm o coração quebrantado.", "Salmos 34:18"],
  ["Provai e vede que o Senhor é bom.", "Salmos 34:8"],
  ["Em paz me deito e durmo, porque só tu me fazes repousar.", "Salmos 4:8"],
  ["O Senhor é a força do seu povo.", "Salmos 28:8"],
  ["Deleita-te no Senhor, e ele satisfará os desejos do teu coração.", "Salmos 37:4"],
  ["O Senhor sustenta o justo.", "Salmos 37:17"],
  ["A boca do justo fala sabedoria.", "Salmos 37:30"],
  ["O Senhor é a minha rocha e a minha salvação.", "Salmos 62:2"],
  ["Confiai nele em todo o tempo.", "Salmos 62:8"],
  ["O Senhor é bom para todos.", "Salmos 145:9"],
  ["O Senhor ampara todos os que caem.", "Salmos 145:14"],
  ["O Senhor está perto de todos os que o invocam.", "Salmos 145:18"],
  ["Grande é o nosso Senhor e de muito poder.", "Salmos 147:5"],
  ["O temor do Senhor é o princípio da sabedoria.", "Provérbios 9:10"],
  ["A sabedoria é o principal; adquire, pois, a sabedoria.", "Provérbios 4:7"],
  ["O justo anda na sua integridade.", "Provérbios 20:7"],
  ["A língua branda quebranta o osso.", "Provérbios 25:15"],
  ["Como o ferro afia o ferro, assim o homem afia o seu amigo.", "Provérbios 27:17"],
  ["O que confia no Senhor será prosperado.", "Provérbios 28:25"],
  ["Melhor é o pouco com justiça do que grandes rendas com injustiça.", "Provérbios 16:8"],
  ["A soberba precede a queda.", "Provérbios 16:18"],
  ["A integridade dos retos os guiará.", "Provérbios 11:3"],
  ["Não negues o bem a quem o merece.", "Provérbios 3:27"],
  ["A bênção do Senhor enriquece.", "Provérbios 10:22"],
  ["O que anda em integridade anda seguro.", "Provérbios 10:9"],
  ["A esperança dos justos é alegria.", "Provérbios 10:28"],
  ["O que guarda a sua boca preserva a sua alma.", "Provérbios 13:3"],
  ["A resposta branda desvia o furor.", "Provérbios 15:1"],
  ["O coração alegre aformoseia o rosto.", "Provérbios 15:13"],
  ["O que segue a justiça e a bondade achará vida.", "Provérbios 21:21"],
  ["O Senhor pesa os corações.", "Provérbios 21:2"],
  ["Instrui o menino no caminho em que deve andar.", "Provérbios 22:6"],
  ["Como é bom e agradável viverem os irmãos em união.", "Salmos 133:1"],
  ["O Senhor te abençoe e te guarde.", "Números 6:24"],
  ["O Senhor levante sobre ti o seu rosto e te dê a paz.", "Números 6:26"],
  ["Alegrai-vos com os que se alegram.", "Romanos 12:15"],
  ["Nada façais por contenda ou por vanglória.", "Filipenses 2:3"],
  ["Buscai o bem da cidade onde estais.", "Jeremias 29:7"],
  ["Eu sei os pensamentos que tenho a vosso respeito: pensamentos de paz.", "Jeremias 29:11"],
  ["Invocai-me e eu vos responderei.", "Jeremias 33:3"],
  ["A justiça exalta as nações.", "Provérbios 14:34"],
  ["Aquele que começou boa obra em vós há de completá-la.", "Filipenses 1:6"],
  ["A palavra do Senhor permanece para sempre.", "1 Pedro 1:25"],
  ["Lançai sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.", "1 Pedro 5:7"],
  ["O Deus da esperança vos encha de toda alegria e paz.", "Romanos 15:13"],
  ["Fortalece-te na graça que há em Cristo Jesus.", "2 Timóteo 2:1"],
  ["Combati o bom combate, terminei a corrida, guardei a fé.", "2 Timóteo 4:7"],
  ["Tu conservarás em paz aquele cuja mente está firme em ti.", "Isaías 26:3"],
  ["Eis que faço uma coisa nova.", "Isaías 43:19"],
  ["O choro pode durar uma noite, mas a alegria vem pela manhã.", "Salmos 30:5"],
  ["Lança o teu cuidado sobre o Senhor, e ele te susterá.", "Salmos 55:22"],
  ["Aquele que habita no esconderijo do Altíssimo descansará.", "Salmos 91:1"],
  ["Elevo os meus olhos para os montes: de onde me vem o socorro?", "Salmos 121:1"],
  ["O meu socorro vem do Senhor, que fez o céu e a terra.", "Salmos 121:2"],
  ["Os que semeiam em lágrimas segarão com alegria.", "Salmos 126:5"],
  ["Eu te louvarei, porque de modo assombroso fui feito.", "Salmos 139:14"],
  ["O coração alegre é um bom remédio.", "Provérbios 17:22"],
  ["Tudo quanto te vier à mão para fazer, faze-o conforme as tuas forças.", "Eclesiastes 9:10"],
  ["Tudo o que fizerdes, fazei-o de todo o coração, como ao Senhor.", "Colossenses 3:23"],
  ["Consolai-vos uns aos outros e edificai-vos mutuamente.", "1 Tessalonicenses 5:11"],
  ["Corramos com paciência a carreira que nos está proposta.", "Hebreus 12:1"],
  ["Bem-aventurado o homem que suporta a tentação.", "Tiago 1:12"],
  ["Que pratiques a justiça, ames a misericórdia e andes humildemente com o teu Deus.", "Miqueias 6:8"],
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
  /** Momento em que a frase atual foi escolhida. Renova a cada 24 horas. */
  pickedAt: number;
  index: number;
  order: number[];
  pointer: number;
}

const VINTE_QUATRO_HORAS = 24 * 60 * 60 * 1000;

/**
 * Escolhe a frase do dia: embaralha o banco uma vez, avança um por dia e só
 * volta ao início quando todas as 200 forem usadas.
 */
export function pickDailyGreeting(now = Date.now()): Greeting {
  const hoje = now;
  let state: GreetingState | null = null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? (JSON.parse(raw) as GreetingState) : null;
  } catch {
    state = null;
  }

  // Mantém a mesma frase por 24 horas; depois disso, escolhe outra.
  if (
    state &&
    typeof state.pickedAt === "number" &&
    hoje - state.pickedAt < VINTE_QUATRO_HORAS &&
    Number.isInteger(state.index) &&
    GREETINGS[state.index]
  ) {
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
      JSON.stringify({ pickedAt: hoje, index, order, pointer: pointer + 1 } satisfies GreetingState),
    );
  } catch {
    /* sem armazenamento: usa a frase sorteada apenas nesta sessão */
  }

  return GREETINGS[index] ?? GREETINGS[0];
}
