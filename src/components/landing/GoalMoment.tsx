"use client";

/**
 * A pure motion illustration — a ball arcing into a rippling net,
 * on loop. No card, no borders, no data rows. Replaces the old
 * "live feed" widget metaphor with the single image football fans
 * actually respond to: the ball hitting the net.
 */
export function GoalMoment() {
  return (
    <div
      className="relative aspect-square w-full max-w-md"
      role="img"
      aria-label="Animated illustration of a football arcing into a goal net"
    >
      <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="pitchGlow" cx="50%" cy="60%" r="60%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ballShade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d8dce2" />
          </linearGradient>
        </defs>

        {/* Ambient glow behind the net */}
        <circle cx="200" cy="230" r="180" fill="url(#pitchGlow)" />

        {/* Net frame */}
        <g stroke="var(--text-dimmer)" strokeWidth="2.5" fill="none" opacity="0.55">
          <path d="M70 120 L70 320 L330 320 L330 120" />
          <path d="M70 120 L110 150 L290 150 L330 120" />
          <path d="M110 150 L110 320" />
          <path d="M290 150 L290 320" />
        </g>

        {/* Net mesh — the part that ripples */}
        <g className="net-mesh" stroke="var(--text-dimmer)" strokeWidth="1" opacity="0.4">
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`v${i}`} x1={110 + i * 22.8} y1="150" x2={110 + i * 22.8} y2="320" />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`h${i}`} x1="110" y1={150 + i * 24.3} x2="290" y2={150 + i * 24.3} />
          ))}
        </g>

        {/* Impact burst */}
        <g className="impact-burst" opacity="0">
          <circle cx="230" cy="210" r="6" fill="var(--accent)" />
          <circle cx="230" cy="210" r="28" fill="none" stroke="var(--accent)" strokeWidth="2" />
        </g>

        {/* Ball — arcs in, then resets */}
        <g className="ball-path">
          <circle r="14" fill="url(#ballShade)" stroke="var(--bg)" strokeWidth="1" />
          <path
            d="M-7,-2 L0,-8 L7,-2 L4,7 L-4,7 Z"
            fill="var(--bg)"
            opacity="0.35"
            transform="scale(0.9)"
          />
        </g>
      </svg>

      <style>{`
        .ball-path {
          offset-path: path('M20,40 C90,90 160,130 230,210');
          animation: ball-arc 3.6s cubic-bezier(0.34, 0.02, 0.6, 1) infinite;
        }
        @keyframes ball-arc {
          0%   { offset-distance: 0%;   opacity: 1; }
          58%  { offset-distance: 100%; opacity: 1; }
          62%  { offset-distance: 100%; opacity: 0; }
          63%  { offset-distance: 0%;   opacity: 0; }
          70%  { offset-distance: 0%;   opacity: 1; }
          100% { offset-distance: 0%;   opacity: 1; }
        }

        .net-mesh {
          transform-origin: 230px 210px;
          animation: net-ripple 3.6s ease-out infinite;
        }
        @keyframes net-ripple {
          0%, 56% { transform: scale(1); }
          60% { transform: scale(0.94) translate(4px, 3px); }
          66% { transform: scale(1.03) translate(-2px, -1px); }
          72% { transform: scale(0.99); }
          78%, 100% { transform: scale(1); }
        }

        .impact-burst {
          animation: burst-flash 3.6s ease-out infinite;
        }
        @keyframes burst-flash {
          0%, 57% { opacity: 0; transform: scale(0.6); }
          60% { opacity: 1; transform: scale(1); }
          75%, 100% { opacity: 0; transform: scale(1.8); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ball-path, .net-mesh, .impact-burst {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}