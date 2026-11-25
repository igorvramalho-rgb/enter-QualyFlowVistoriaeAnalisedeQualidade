/**
 * Gráficos do Painel BI — desenhados em canvas no próprio navegador.
 * Nenhuma API, nenhuma nuvem, nenhum token: o PNG entra direto no .xlsx.
 */

const FONTE = "Segoe UI, Inter, Arial, sans-serif";

const NAVY = "#0B1F3A";
const INK = "#1E293B";
const SLATE = "#64748B";
const LINE = "#E2E8F0";
const GRID = "#EEF2F7";
const CYAN = "#22D3EE";
const BLUE = "#1D4ED8";
const RED = "#DC2626";
const GREEN = "#059669";
const VIOLET = "#7C3AED";
const TEAL = "#0E7490";
const ORANGE = "#EA580C";
const STEEL = "#94A3B8";

/** Cores por célula operacional (mesma leitura do PDF do BI). */
export const CORES_CELULA: Record<string, string> = {
  fiscalizacao: BLUE,
  refazer: RED,
  respondidos: GREEN,
  rpa: VIOLET,
  sae: TEAL,
  nao_avaliado: STEEL,
  nao_executado: ORANGE,
};

export interface SerieGrafico {
  label: string;
  valor: number;
  cor?: string;
}

export interface GraficoBarraPayload {
  titulo: string;
  subtitulo?: string;
  series: SerieGrafico[];
  rodape?: string;
}

interface Tela {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function criarTela(largura: number, altura: number): Tela {
  const canvas = document.createElement("canvas");
  const escala = 2;
  canvas.width = Math.round(largura * escala);
  canvas.height = Math.round(altura * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Seu navegador não permitiu desenhar os gráficos do painel.");
  }
  ctx.scale(escala, escala);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, largura, altura);
  return { canvas, ctx };
}

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const raio = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.lineTo(x + w - raio, y);
  ctx.arcTo(x + w, y, x + w, y + raio, raio);
  ctx.lineTo(x + w, y + h - raio);
  ctx.arcTo(x + w, y + h, x + w - raio, y + h, raio);
  ctx.lineTo(x + raio, y + h);
  ctx.arcTo(x, y + h, x, y + h - raio, raio);
  ctx.lineTo(x, y + raio);
  ctx.arcTo(x, y, x + raio, y, raio);
  ctx.closePath();
}

function cartao(ctx: CanvasRenderingContext2D, largura: number, altura: number) {
  arredondado(ctx, 0.5, 0.5, largura - 1, altura - 1, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Fio de luz no topo, como nos painéis do sistema.
  const gradiente = ctx.createLinearGradient(18, 0, largura - 18, 0);
  gradiente.addColorStop(0, "rgba(34, 211, 238, 0.9)");
  gradiente.addColorStop(0.55, "rgba(29, 78, 216, 0.85)");
  gradiente.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = gradiente;
  arredondado(ctx, 18, 0.5, largura - 36, 2, 1);
  ctx.fill();
}

function escrever(
  ctx: CanvasRenderingContext2D,
  valor: string,
  x: number,
  y: number,
  opcoes: { fonte?: string; cor?: string; alinhamento?: CanvasTextAlign; base?: CanvasTextBaseline },
) {
  ctx.font = opcoes.fonte ?? `12px ${FONTE}`;
  ctx.fillStyle = opcoes.cor ?? INK;
  ctx.textAlign = opcoes.alinhamento ?? "left";
  ctx.textBaseline = opcoes.base ?? "alphabetic";
  ctx.fillText(valor, x, y);
}

function truncar(ctx: CanvasRenderingContext2D, valor: string, largura: number, fonte: string): string {
  ctx.font = fonte;
  if (ctx.measureText(valor).width <= largura) {
    return valor;
  }
  let texto = valor;
  while (texto.length > 1 && ctx.measureText(`${texto}…`).width > largura) {
    texto = texto.slice(0, -1);
  }
  return `${texto.trimEnd()}…`;
}

function numero(valor: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(valor));
}

function cabecalho(ctx: CanvasRenderingContext2D, largura: number, titulo: string, subtitulo?: string) {
  escrever(ctx, titulo, 24, 34, { fonte: `700 16px ${FONTE}`, cor: NAVY });
  if (subtitulo) {
    escrever(ctx, subtitulo, 24, 54, { fonte: `11px ${FONTE}`, cor: SLATE });
  }
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, subtitulo ? 66 : 48);
  ctx.lineTo(largura - 24, subtitulo ? 66 : 48);
  ctx.stroke();
}

function rodape(ctx: CanvasRenderingContext2D, largura: number, altura: number, texto?: string) {
  if (!texto) {
    return;
  }
  escrever(ctx, texto, 24, altura - 16, { fonte: `10px ${FONTE}`, cor: SLATE });
  escrever(ctx, "Qualy Auditor · gerado localmente", largura - 24, altura - 16, {
    fonte: `10px ${FONTE}`,
    cor: SLATE,
    alinhamento: "right",
  });
}

/**
 * Barras horizontais por célula — o gráfico principal da apresentação.
 */
export function graficoBarrasCelulas(payload: GraficoBarraPayload, largura = 700, altura = 360): string {
  const { canvas, ctx } = criarTela(largura, altura);
  cartao(ctx, largura, altura);
  cabecalho(ctx, largura, payload.titulo, payload.subtitulo);

  const total = payload.series.reduce((soma, serie) => soma + Math.max(0, serie.valor), 0);
  const topo = payload.subtitulo ? 86 : 66;
  const base = altura - (payload.rodape ? 42 : 26);
  const areaAltura = base - topo;

  if (payload.series.length === 0 || total === 0) {
    escrever(ctx, "Sem registros no período selecionado.", largura / 2, topo + areaAltura / 2, {
      fonte: `12px ${FONTE}`,
      cor: SLATE,
      alinhamento: "center",
    });
    rodape(ctx, largura, altura, payload.rodape);
    return canvas.toDataURL("image/png");
  }

  const maior = Math.max(...payload.series.map((serie) => Math.max(0, serie.valor)), 1);
  const rotuloLargura = Math.min(210, largura * 0.34);
  const barraX = 26 + rotuloLargura;
  const barraLargura = largura - barraX - 104;
  const passo = areaAltura / payload.series.length;
  const barraAltura = Math.min(22, Math.max(12, passo - 14));

  payload.series.forEach((serie, indice) => {
    const y = topo + passo * indice + (passo - barraAltura) / 2;
    const cor = serie.cor ?? CORES_CELULA[serie.label] ?? BLUE;

    escrever(ctx, truncar(ctx, serie.label, rotuloLargura - 12, `600 11px ${FONTE}`), 26, y + barraAltura / 2 + 4, {
      fonte: `600 11px ${FONTE}`,
      cor: INK,
    });

    arredondado(ctx, barraX, y, barraLargura, barraAltura, barraAltura / 2);
    ctx.fillStyle = GRID;
    ctx.fill();

    const proporcao = Math.max(0, serie.valor) / maior;
    const comprimento = Math.max(serie.valor > 0 ? 8 : 0, barraLargura * proporcao);
    if (comprimento > 0) {
      arredondado(ctx, barraX, y, comprimento, barraAltura, barraAltura / 2);
      ctx.fillStyle = cor;
      ctx.fill();

      const brilho = ctx.createLinearGradient(barraX, y, barraX + comprimento, y + barraAltura);
      brilho.addColorStop(0, "rgba(255,255,255,0.22)");
      brilho.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = brilho;
      ctx.fill();
    }

    const percentual = total > 0 ? Math.round((serie.valor / total) * 100) : 0;
    escrever(ctx, numero(serie.valor), largura - 66, y + barraAltura / 2 + 4, {
      fonte: `700 12px ${FONTE}`,
      cor: NAVY,
      alinhamento: "right",
    });
    escrever(ctx, `${percentual}%`, largura - 24, y + barraAltura / 2 + 4, {
      fonte: `11px ${FONTE}`,
      cor: SLATE,
      alinhamento: "right",
    });
  });

  rodape(ctx, largura, altura, payload.rodape);
  return canvas.toDataURL("image/png");
}

/**
 * Rosca de resultado — conformes, não conformes e o que segue em tratativa.
 */
export function graficoRoscaResultado(
  payload: GraficoBarraPayload,
  largura = 480,
  altura = 360,
): string {
  const { canvas, ctx } = criarTela(largura, altura);
  cartao(ctx, largura, altura);
  cabecalho(ctx, largura, payload.titulo, payload.subtitulo);

  const total = payload.series.reduce((soma, serie) => soma + Math.max(0, serie.valor), 0);
  const centroX = Math.min(largura * 0.33, 150);
  const centroY = altura / 2 + 22;
  const raioExterno = Math.min(96, altura * 0.28);
  const raioInterno = raioExterno * 0.62;

  if (total === 0) {
    escrever(ctx, "Sem registros", centroX, centroY, {
      fonte: `12px ${FONTE}`,
      cor: SLATE,
      alinhamento: "center",
      base: "middle",
    });
    rodape(ctx, largura, altura, payload.rodape);
    return canvas.toDataURL("image/png");
  }

  let angulo = -Math.PI / 2;
  payload.series.forEach((serie) => {
    const fatia = (Math.max(0, serie.valor) / total) * Math.PI * 2;
    if (fatia <= 0) {
      return;
    }
    ctx.beginPath();
    ctx.moveTo(centroX, centroY);
    ctx.arc(centroX, centroY, raioExterno, angulo, angulo + fatia);
    ctx.closePath();
    ctx.fillStyle = serie.cor ?? BLUE;
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    angulo += fatia;
  });

  ctx.beginPath();
  ctx.arc(centroX, centroY, raioInterno, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  escrever(ctx, numero(total), centroX, centroY - 2, {
    fonte: `700 26px ${FONTE}`,
    cor: NAVY,
    alinhamento: "center",
    base: "middle",
  });
  escrever(ctx, "FV/OS", centroX, centroY + 20, {
    fonte: `10px ${FONTE}`,
    cor: SLATE,
    alinhamento: "center",
    base: "middle",
  });

  const legendaX = centroX + raioExterno + 28;
  const legendaLargura = largura - legendaX - 24;
  const passo = 34;
  const topo = centroY - (payload.series.length * passo) / 2 + 6;

  payload.series.forEach((serie, indice) => {
    const y = topo + indice * passo;
    arredondado(ctx, legendaX, y - 7, 10, 10, 3);
    ctx.fillStyle = serie.cor ?? BLUE;
    ctx.fill();

    escrever(ctx, truncar(ctx, serie.label, legendaLargura - 60, `600 11px ${FONTE}`), legendaX + 18, y + 2, {
      fonte: `600 11px ${FONTE}`,
      cor: INK,
    });
    const percentual = total > 0 ? Math.round((serie.valor / total) * 100) : 0;
    escrever(ctx, `${numero(serie.valor)} · ${percentual}%`, largura - 24, y + 2, {
      fonte: `11px ${FONTE}`,
      cor: SLATE,
      alinhamento: "right",
    });
  });

  rodape(ctx, largura, altura, payload.rodape);
  return canvas.toDataURL("image/png");
}

export interface CicloComparativo {
  nome: string;
  casos: number;
  conformes: number;
  pctConforme: number;
}

/**
 * Colunas por ciclo — casos tratados e conformes, com o % no topo.
 */
export function graficoComparativoCiclos(
  ciclos: CicloComparativo[],
  payload: { titulo: string; subtitulo?: string; rodape?: string },
  largura = 700,
  altura = 340,
): string {
  const { canvas, ctx } = criarTela(largura, altura);
  cartao(ctx, largura, altura);
  cabecalho(ctx, largura, payload.titulo, payload.subtitulo);

  if (ciclos.length === 0) {
    escrever(ctx, "Sem ciclos para comparar.", largura / 2, altura / 2, {
      fonte: `12px ${FONTE}`,
      cor: SLATE,
      alinhamento: "center",
    });
    return canvas.toDataURL("image/png");
  }

  const topo = 112;
  const base = altura - 78;
  const areaAltura = Math.max(60, base - topo);
  const maior = Math.max(...ciclos.map((ciclo) => Math.max(ciclo.casos, ciclo.conformes)), 1);
  const areaX = 34;
  const areaLargura = largura - areaX - 30;
  const passo = areaLargura / ciclos.length;
  const larguraBarra = Math.min(46, Math.max(14, passo / 4));

  // Linhas de grade horizontais.
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let linha = 0; linha <= 3; linha += 1) {
    const y = topo + (areaAltura / 3) * linha;
    ctx.beginPath();
    ctx.moveTo(areaX, y);
    ctx.lineTo(areaX + areaLargura, y);
    ctx.stroke();
  }

  // Legenda.
  const legenda = [
    { label: "FV/OS", cor: NAVY },
    { label: "Conformes", cor: GREEN },
  ];
  legenda.forEach((item, indice) => {
    const x = 26 + indice * 120;
    arredondado(ctx, x, 80, 10, 10, 3);
    ctx.fillStyle = item.cor;
    ctx.fill();
    escrever(ctx, item.label, x + 16, 89, { fonte: `11px ${FONTE}`, cor: SLATE });
  });

  ciclos.forEach((ciclo, indice) => {
    const centro = areaX + passo * indice + passo / 2;
    const barras = [
      { valor: ciclo.casos, cor: NAVY, x: centro - larguraBarra - 3 },
      { valor: ciclo.conformes, cor: GREEN, x: centro + 3 },
    ];

    barras.forEach((barra) => {
      const alturaBarra = Math.max(barra.valor > 0 ? 4 : 0, (Math.max(0, barra.valor) / maior) * areaAltura);
      const y = base - alturaBarra;
      if (alturaBarra > 0) {
        arredondado(ctx, barra.x, y, larguraBarra, alturaBarra, 6);
        ctx.fillStyle = barra.cor;
        ctx.fill();
      }
      escrever(ctx, numero(barra.valor), barra.x + larguraBarra / 2, y - 6, {
        fonte: `700 10px ${FONTE}`,
        cor: INK,
        alinhamento: "center",
      });
    });

    escrever(ctx, truncar(ctx, ciclo.nome, passo - 8, `600 10px ${FONTE}`), centro, base + 16, {
      fonte: `600 10px ${FONTE}`,
      cor: INK,
      alinhamento: "center",
    });
    escrever(ctx, `${ciclo.pctConforme}% conforme`, centro, base + 31, {
      fonte: `10px ${FONTE}`,
      cor: GREEN,
      alinhamento: "center",
    });
  });

  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(areaX, base);
  ctx.lineTo(areaX + areaLargura, base);
  ctx.stroke();

  rodape(ctx, largura, altura, payload.rodape);
  return canvas.toDataURL("image/png");
}

/** Nome usado na legenda do painel quando a célula não tem cor própria. */
export const CORES_PADRAO = [BLUE, RED, GREEN, VIOLET, TEAL, STEEL, ORANGE];

export function corDaSerie(indice: number, chave?: string): string {
  if (chave && CORES_CELULA[chave]) {
    return CORES_CELULA[chave];
  }
  return CORES_PADRAO[indice % CORES_PADRAO.length];
}
