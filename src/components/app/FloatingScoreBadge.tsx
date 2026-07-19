"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A small draggable score pill that appears once the real MatchHeader has
 * scrolled out of view (see the IntersectionObserver in the play layout),
 * so the score stays glanceable without needing to scroll back up. Portaled
 * to document.body for the same reason GateModal is — a `fixed` element
 * nested under any ancestor with a transform/animation loses viewport-
 * relative positioning otherwise.
 */
export function FloatingScoreBadge({
  home,
  away,
  homeScore,
  awayScore,
  live,
}: {
  home: string;
  away: string;
  homeScore?: number;
  awayScore?: number;
  live: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    Promise.resolve().then(() => {
      setMounted(true);
      setPos((p) => p ?? { x: window.innerWidth - 96, y: 76 });
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pos) return;
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = { x: pos.x, y: pos.y, px: e.clientX, py: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    const nx = Math.min(Math.max(8, startRef.current.x + dx), window.innerWidth - 88);
    const ny = Math.min(Math.max(8, startRef.current.y + dy), window.innerHeight - 88);
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = () => {
    draggingRef.current = false;
    // A drag that never really moved is a tap — jump back to the top so the
    // full MatchHeader (and the badge's reason to exist) is visible again.
    if (!movedRef.current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!mounted || !pos) return null;

  return createPortal(
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[90] flex w-20 cursor-grab select-none touch-none flex-col items-center gap-1 rounded-2xl border border-accent/30 bg-surface/95 px-2 py-2.5 shadow-2xl shadow-black/60 backdrop-blur transition-shadow active:cursor-grabbing active:shadow-accent/20 animate-fade-up"
      role="button"
      aria-label={`${home} ${homeScore ?? "–"} - ${awayScore ?? "–"} ${away}. Drag to move, tap to scroll to the score.`}
    >
      <span className="relative flex h-4 w-4 items-center justify-center text-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 6.2 15.4 8.7 14.1 12.7H9.9L8.6 8.7 12 6.2Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
          />
          <path
            d="M12 6.2V3.4M14.1 12.7l2.4 1.9M9.9 12.7l-2.4 1.9M8.6 8.7 5.9 7.9M15.4 8.7l2.7-.8"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
          />
        </svg>
        {live && (
          <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
        )}
      </span>
      <div className="flex items-center gap-1 font-mono text-sm font-extrabold tabular-nums text-text">
        <span>{homeScore ?? "–"}</span>
        <span className="text-text-dimmer">:</span>
        <span>{awayScore ?? "–"}</span>
      </div>
      <p className="max-w-full truncate font-mono text-[7px] uppercase tracking-widest text-text-dimmer">
        {home.slice(0, 3)} v {away.slice(0, 3)}
      </p>
    </div>,
    document.body
  );
}
