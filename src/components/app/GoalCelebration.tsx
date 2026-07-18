"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { FootballIcon } from "@hugeicons/core-free-icons";

export type CelebrationPayload = {
  side: "home" | "away" | null;
  teamName?: string;
  scoreLabel?: string;
};

const PARTICLE_COUNT = 24;

function Confetti({ side }: { side: "home" | "away" | null }) {
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      left: `${5 + Math.random() * 90}%`,
      delay: `${Math.random() * 0.4}s`,
      duration: `${1.6 + Math.random() * 1.2}s`,
      size: 4 + Math.round(Math.random() * 5),
      rotate: Math.round(Math.random() * 360),
      key: i,
    }))
  );

  const colors = side === "away" ? ["#cdfe00", "#ffffff", "#34d399"] : ["#cdfe00", "#ffffff", "#fbbf24"];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <span
          key={p.key}
          className="absolute top-[-10%] animate-confetti-fall rounded-sm"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 1.6,
            background: colors[i % colors.length],
            animationDelay: p.delay,
            animationDuration: p.duration,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function GoalCelebration({
  payload,
  onDone,
}: {
  payload: CelebrationPayload;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const alignment =
    payload.side === "home" ? "items-start text-left" : payload.side === "away" ? "items-end text-right" : "items-center text-center";

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] flex items-center justify-center overflow-hidden">
      <Confetti side={payload.side} />

      {/* Radial burst behind the text */}
      <div
        className="absolute h-[140%] w-[140%] animate-celebration-pulse rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(129,140,248,0.22) 0%, transparent 60%)",
        }}
        aria-hidden
      />

      <div className={`relative flex w-full max-w-xs flex-col px-8 ${alignment} animate-celebration-in`}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-accent-dim shadow-[0_0_30px_rgba(129,140,248,0.35)]">
          <Icon icon={FootballIcon} size={28} color="#818cf8" />
        </span>
        <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-accent drop-shadow-[0_0_18px_rgba(129,140,248,0.5)]">
          GOAL!
        </h2>
        {payload.teamName && (
          <p className="mt-1 text-base font-bold text-text">{payload.teamName}</p>
        )}
        {payload.scoreLabel && (
          <p className="mt-1 font-mono text-sm text-text-dim">{payload.scoreLabel}</p>
        )}
      </div>
    </div>
  );
}
