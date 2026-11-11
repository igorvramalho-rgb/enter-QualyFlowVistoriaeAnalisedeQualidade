import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { AUDITOR_SIGNATURE } from "@/lib/auditor";
import { pickDailyGreeting } from "@/lib/greetings";

/** Tempo mínimo na tela (leitura + foto) e fechamento automático. */
const MINIMO_MS = 12_000;
const FECHAR_MS = 20_000;

const BOOT_LINES = [
  "conexão segura estabelecida",
  "base de fiscalização sincronizada",
  "operador identificado",
];

const PARTICULAS = [
  { x: 12, y: 46, d: 0, s: 3 },
  { x: 20, y: 62, d: 1.4, s: 2 },
  { x: 28, y: 40, d: 2.1, s: 4 },
  { x: 36, y: 58, d: 0.7, s: 2 },
  { x: 46, y: 38, d: 1.9, s: 3 },
  { x: 54, y: 64, d: 2.6, s: 2 },
  { x: 63, y: 44, d: 1.2, s: 4 },
  { x: 71, y: 60, d: 0.4, s: 2 },
  { x: 79, y: 38, d: 2.3, s: 3 },
  { x: 87, y: 55, d: 1.6, s: 2 },
  { x: 8, y: 70, d: 2.8, s: 2 },
  { x: 92, y: 34, d: 0.9, s: 3 },
];

/** Onda senoidal usada como holograma (período fixo para animação contínua). */
function onda(amplitude: number, fase: number, largura = 1800, altura = 160): string {
  const passo = 12;
  const pontos: string[] = [];
  for (let x = 0; x <= largura; x += passo) {
    const y =
      altura / 2 +
      Math.sin((x / largura) * Math.PI * 8 + fase) * amplitude +
      Math.sin((x / largura) * Math.PI * 16 + fase * 1.7) * (amplitude * 0.35);
    pontos.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`);
  }
  return pontos.join(" ");
}

export function JarvisIntro({ name, onDone }: { name: string; onDone: () => void }) {
  const greeting = useMemo(() => pickDailyGreeting(), []);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [bar, setBar] = useState(0);
  const [podeFechar, setPodeFechar] = useState(false);
  const [restante, setRestante] = useState(Math.ceil(MINIMO_MS / 1000));
  const finished = useRef(false);

  useEffect(() => {
    const liberar = window.setTimeout(() => setPodeFechar(true), MINIMO_MS);
    const contagem = window.setInterval(() => {
      setRestante((valor) => Math.max(0, valor - 1));
    }, 1000);
    return () => {
      window.clearTimeout(liberar);
      window.clearInterval(contagem);
    };
  }, []);

  const close = () => {
    if (finished.current || !podeFechar) {
      return;
    }
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    const timers: number[] = [];
    BOOT_LINES.forEach((_, index) => {
      timers.push(window.setTimeout(() => setStep(index + 1), 500 + index * 420));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => {
      let index = 0;
      const timer = window.setInterval(() => {
        index += 1;
        setTyped(greeting.text.slice(0, index));
        if (index >= greeting.text.length) {
          window.clearInterval(timer);
        }
      }, 26);
    }, 1700);
    return () => window.clearTimeout(start);
  }, [greeting.text]);

  useEffect(() => {
    const inicio = Date.now();
    const timer = window.setInterval(() => {
      setBar(Math.min(100, ((Date.now() - inicio) / FECHAR_MS) * 100));
    }, 120);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const auto = window.setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        onDone();
      }
    }, FECHAR_MS);
    return () => window.clearTimeout(auto);
  }, [onDone]);

  useEffect(() => {
    const handler = () => close();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeFechar]);

  const primeiroNome = name.split(/[\s.@]+/)[0] ?? name;

  return (
    <div className="jv-stage fixed inset-0 z-[120] overflow-hidden" onClick={close} role="presentation">
      <div className="jv-grid" />
      <div className="jv-floor" />

      <div className="jv-wave hidden sm:block" aria-hidden>
        <svg viewBox="0 0 1800 160" preserveAspectRatio="none">
          <path className="jv-wave-line jv-wave-line--1" d={onda(52, 0)} />
          <path className="jv-wave-line jv-wave-line--2" d={onda(42, 0.7)} />
          <path className="jv-wave-line jv-wave-line--3" d={onda(34, 1.4)} />
          <path className="jv-wave-line jv-wave-line--4" d={onda(26, 2.1)} />
          <path className="jv-wave-line jv-wave-line--5" d={onda(18, 2.8)} />
        </svg>
      </div>

      <div className="jv-rings" aria-hidden>
        <span className="jv-ring jv-ring--1" />
        <span className="jv-ring jv-ring--2" />
        <span className="jv-ring jv-ring--3" />
      </div>

      {PARTICULAS.map((particula) => (
        <span
          key={`${particula.x}-${particula.y}`}
          className="jv-particle"
          style={{
            left: `${particula.x}%`,
            top: `${particula.y}%`,
            width: particula.s,
            height: particula.s,
            animationDelay: `${particula.d}s`,
          }}
        />
      ))}

      <span className="jv-bracket jv-bracket--tl" />
      <span className="jv-bracket jv-bracket--tr" />
      <span className="jv-bracket jv-bracket--bl" />
      <span className="jv-bracket jv-bracket--br" />

      <header className="jv-topbar">
        <span className="jv-chevron" />
        <div className="jv-title">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-100">
            Qualy Flow
          </p>
          <p className="text-[8px] uppercase tracking-[0.42em] text-cyan-300/60">
            núcleo operacional
          </p>
        </div>
        <span className="jv-chevron jv-chevron--right" />
      </header>

      <div className="jv-hud jv-hud--left">
        <p>conexão · segura</p>
        <p>base · sincronizada</p>
        <p>sessão · ativa</p>
      </div>
      <div className="jv-hud jv-hud--right">
        <p>memória 68%</p>
        <p>processamento 12%</p>
        <p>registros 500</p>
      </div>

      <div className="jv-rail jv-rail--left">qualidade · fiscalização</div>
      <div className="jv-rail jv-rail--right">vila maria · santana</div>

      <div className="relative z-10 flex h-full items-center justify-center px-5">
        <div className="w-full max-w-2xl text-center">
          <p className="jv-fade text-[9px] uppercase tracking-[0.5em] text-cyan-300/60">
            núcleo operacional
          </p>

          <div className="jv-fade mt-4 flex items-center justify-center gap-3">
            <ShieldCheck className="h-6 w-6 text-cyan-300" />
            <h1 className="text-2xl font-semibold tracking-[0.16em] text-cyan-50 sm:text-3xl">
              BEM-VINDO, {primeiroNome.toUpperCase()}
            </h1>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {BOOT_LINES.slice(0, step).map((line) => (
              <p
                key={line}
                className="jv-fade font-mono text-[9px] uppercase tracking-[0.08em] text-cyan-200/55"
              >
                <span className="text-emerald-300">✓</span> {line}
              </p>
            ))}
          </div>

          <div className="jv-panel mt-6 px-6 py-5">
            <span className="jv-panel-corner jv-panel-corner--tl" />
            <span className="jv-panel-corner jv-panel-corner--tr" />
            <span className="jv-panel-corner jv-panel-corner--bl" />
            <span className="jv-panel-corner jv-panel-corner--br" />

            <p className="text-[8px] uppercase tracking-[0.4em] text-cyan-300/70">
              {greeting.kind === "biblica" ? "palavra do dia" : "mensagem do dia"}
            </p>
            <p className="mt-2 min-h-[64px] text-[15px] leading-relaxed text-cyan-50 sm:text-lg">
              {typed}
              <span className="jv-caret">|</span>
            </p>
            {greeting.source && (
              <p className="mt-1 text-[9px] uppercase tracking-[0.25em] text-cyan-300/55">
                {greeting.source}
              </p>
            )}
          </div>

          <div className="mx-auto mt-5 h-[2px] w-64 overflow-hidden rounded-full bg-cyan-400/15">
            <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${bar}%` }} />
          </div>

          <button
            type="button"
            onClick={close}
            disabled={!podeFechar}
            className="mt-3 text-[9px] uppercase tracking-[0.28em] text-cyan-200/50 transition-colors hover:text-cyan-100 disabled:cursor-default"
          >
            {podeFechar
              ? "pressione qualquer tecla para entrar"
              : `leia com calma · liberando em ${restante}s`}
          </button>
        </div>
      </div>

      <footer className="jv-footer">
        <div className="jv-footer-block">
          <p>dados criptografados</p>
          <p>intrarede · segura</p>
        </div>
        <p className="jv-footer-sign">{AUDITOR_SIGNATURE} · Célula da Qualidade</p>
        <div className="jv-footer-block jv-footer-block--right">
          <p>sistema operacional</p>
          <p>versão 4.2 · online</p>
        </div>
      </footer>
    </div>
  );
}
