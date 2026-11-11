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

/**
 * Abertura futurista no estilo do assistente Jarvis, exibida após o login.
 * Mostra o nome do operador e a frase do dia (banco de 300, sem repetir).
 */
export function JarvisIntro({ name, onDone }: { name: string; onDone: () => void }) {
  const greeting = useMemo(() => pickDailyGreeting(), []);
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState("");
  const [bar, setBar] = useState(0);
  const [podeFechar, setPodeFechar] = useState(false);
  const [restante, setRestante] = useState(Math.ceil(MINIMO_MS / 1000));
  const finished = useRef(false);

  // Só libera a saída depois do tempo mínimo de leitura.
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
      timers.push(window.setTimeout(() => setStep(index + 1), 450 + index * 420));
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
    <div
      className="jarvis-stage fixed inset-0 z-[120] flex items-center justify-center overflow-hidden"
      onClick={close}
      role="presentation"
    >
      <div className="jarvis-grid absolute inset-0" />
      <div className="jarvis-glow absolute inset-0" />

      <div className="jarvis-ring jarvis-ring--slow absolute h-[520px] w-[520px] rounded-full" />
      <div className="jarvis-ring jarvis-ring--fast absolute h-[380px] w-[380px] rounded-full" />
      <div className="jarvis-ring absolute h-[240px] w-[240px] rounded-full opacity-40" />

      <div className="relative z-10 w-full max-w-xl px-6 text-center">
        <p className="jarvis-fade text-[10px] uppercase tracking-[0.38em] text-cyan-300/70">
          Qualy Flow · Núcleo Operacional
        </p>

        <div className="jarvis-fade mt-5 flex items-center justify-center gap-3">
          <ShieldCheck className="h-6 w-6 text-cyan-300" />
          <h1 className="text-2xl font-semibold tracking-[0.18em] text-cyan-50 sm:text-3xl">
            BEM-VINDO, {primeiroNome.toUpperCase()}
          </h1>
        </div>

        <div className="mt-4 space-y-1">
          {BOOT_LINES.slice(0, step).map((line) => (
            <p
              key={line}
              className="jarvis-fade font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200/60"
            >
              <span className="text-emerald-300">✓</span> {line}
            </p>
          ))}
        </div>

        <div className="jarvis-panel mt-7 px-5 py-4">
          <p className="text-[9px] uppercase tracking-[0.35em] text-cyan-300/70">
            {greeting.kind === "biblica" ? "Palavra do dia" : "Mensagem do dia"}
          </p>
          <p className="mt-2 min-h-[72px] text-sm leading-relaxed text-cyan-50 sm:text-base">
            {typed}
            <span className="jarvis-caret">|</span>
          </p>
          {greeting.source && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-cyan-300/60">
              {greeting.source}
            </p>
          )}
        </div>

        <div className="mx-auto mt-6 h-[2px] w-56 overflow-hidden rounded-full bg-cyan-400/15">
          <div
            className="h-full rounded-full bg-cyan-300/80 transition-all"
            style={{ width: `${bar}%` }}
          />
        </div>

        <button
          type="button"
          onClick={close}
          disabled={!podeFechar}
          className="mt-4 text-[10px] uppercase tracking-[0.18em] text-cyan-200/55 transition-colors hover:text-cyan-100 disabled:cursor-default disabled:opacity-70"
        >
          {podeFechar
            ? "pressione qualquer tecla para entrar"
            : `leia com calma · liberando em ${restante}s`}
        </button>

        <p className="mt-8 text-[9px] uppercase tracking-[0.25em] text-cyan-200/25">
          {AUDITOR_SIGNATURE}
        </p>
      </div>
    </div>
  );
}
