"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  FootballIcon,
  Alert01Icon,
  UserSwitchIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";

type TickerEvent = {
  id: number;
  type: "goal" | "card" | "sub";
  label: string;
  who: string;
  minute: string;
  score?: string;
};

const SCRIPT: TickerEvent[] = [
  { id: 1, type: "goal", label: "Goal", who: "Messi", minute: "68'", score: "2–1" },
  { id: 2, type: "card", label: "Yellow card", who: "Casemiro", minute: "71'" },
  { id: 3, type: "sub",  label: "Substitution", who: "Rodrygo → Endrick", minute: "73'" },
  { id: 4, type: "card", label: "Yellow card", who: "Di María", minute: "77'" },
  { id: 5, type: "goal", label: "Goal", who: "Álvarez", minute: "81'", score: "2–2" },
];

function shortHash(seed: number) {
  const chars = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 8; i++) s += chars[(seed * (i + 7) * 13) % 16];
  return s + "…c44b";
}

function EventIcon({ type }: { type: TickerEvent["type"] }) {
  if (type === "goal")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-dim text-accent">
        <Icon icon={FootballIcon} size={13} />
      </span>
    );
  if (type === "card")
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-400">
        <Icon icon={Alert01Icon} size={13} />
      </span>
    );
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-text-dim">
      <Icon icon={UserSwitchIcon} size={13} />
    </span>
  );
}

export function LiveTickerWidget() {
  const [visible, setVisible] = useState<TickerEvent[]>(SCRIPT.slice(0, 2));
  const cursorRef = useRef(2);
  const [score, setScore] = useState("2–1");
  const [block, setBlock] = useState(291847392);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const next = SCRIPT[cursorRef.current % SCRIPT.length];
      cursorRef.current++;
      setVisible((v) => [next, ...v].slice(0, 3));
      if (next.score) setScore(next.score);
      setBlock((b) => b + Math.floor(Math.random() * 40) + 10);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass w-full max-w-sm rounded-xl p-5 shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-accent" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">Live</span>
        </div>
        <span className="font-mono text-[11px] text-text-dim">74&rsquo;</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-text">Brazil <span className="font-normal text-text-dim">vs</span> Argentina</p>
        <span className="font-display text-base font-bold tabular-nums text-text">{score}</span>
      </div>

      <div className="mt-3 h-px w-full bg-border" />

      {/* Event list */}
      <ul className="mt-3 flex flex-col gap-2.5">
        {visible.map((e, i) => (
          <li key={`${e.id}-${i}`}
            className={`flex items-center gap-2.5 ${i === 0 ? "animate-slide-in-up" : ""}`}>
            <EventIcon type={e.type} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs font-semibold ${e.type === "goal" ? "text-accent" : "text-text"}`}>
                {e.label}
              </p>
              <p className="truncate font-mono text-[10px] text-text-dim">{e.who}</p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-text-dimmer">{e.minute}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 h-px w-full bg-border" />

      {/* Proof strip */}
      <div className="mt-3 flex items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center text-verified">
          <Icon icon={CheckmarkCircle01Icon} size={14} />
        </span>
        <span className="font-mono text-[10px] text-verified">{shortHash(block)}</span>
        <span className="ml-auto font-mono text-[10px] text-text-dimmer">Block #{block.toLocaleString()}</span>
      </div>
    </div>
  );
}
