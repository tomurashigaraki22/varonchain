"use client";

import { useEffect, useRef, useState } from "react";

const COMMAND =
  '$ txline verify --event="goal" --match="BRA-ARG" --block=291847392';

const LINES = [
  { label: "Event Hash:", value: "sha256(BRA-ARG · 68:00 · GOAL · Messi)" },
  { label: "", value: "= 0x3f9a2bd8c44b..." },
  { label: "Merkle Path:", value: "[0xa1b2..., 0xc3d4..., 0xe5f6...]" },
  { label: "Anchor Block:", value: "#291847392 on Solana Mainnet" },
];

const FULL_TEXT = [COMMAND, "", ...LINES.map((l) => `  ${l.label} ${l.value}`.trim())].join(
  "\n"
);

export function TerminalProof() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      const t = setTimeout(() => setTyped(FULL_TEXT), 0);
      return () => clearTimeout(t);
    }

    let i = 0;
    const interval = setInterval(() => {
      i += 2;
      setTyped(FULL_TEXT.slice(0, i));
      if (i >= FULL_TEXT.length) clearInterval(interval);
    }, 12);
    return () => clearInterval(interval);
  }, [started]);

  const isDone = typed.length >= FULL_TEXT.length;

  return (
    <section id="proof" className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-text-dim">
          Live Demo
        </p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight text-text">
          Proof, not a promise.
        </h2>

        <div
          ref={ref}
          className="relative mt-8 overflow-hidden rounded-lg border border-border bg-surface font-mono text-[13px] leading-6"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(FULL_TEXT);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded-sm border border-border px-2.5 py-1 text-[11px] uppercase tracking-wide text-text-dim transition-colors hover:border-border-hover hover:text-accent"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="min-h-[220px] whitespace-pre-wrap px-5 py-5 text-text-dim">
            {typed}
            {!isDone && started && (
              <span className="ml-0.5 inline-block w-2 animate-pulse-dot bg-accent align-middle">
                &nbsp;
              </span>
            )}
          </pre>
          {isDone && (
            <p className="animate-fade-up border-t border-border px-5 py-3 font-mono text-[13px]">
              <span className="font-semibold text-accent">✓ VERIFIED</span>{" "}
              <span className="text-text-dim">in 143ms</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
