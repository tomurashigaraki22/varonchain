/**
 * A night-stadium scene rendered as background art behind the hero copy:
 * two floodlight towers with beams, tiered crowd-silhouette stands, and
 * a pitch strip along the bottom. Replaces the generic dot-grid pattern
 * with something that actually reads as "football" at a glance.
 */
export function StadiumBackground() {
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="stadiumSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--bg)" />
          <stop offset="100%" stopColor="var(--surface)" />
        </linearGradient>
        <linearGradient id="beamLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--chalk)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--chalk)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="beamRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--chalk)" stopOpacity="0.13" />
          <stop offset="100%" stopColor="var(--chalk)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="1200" height="700" fill="url(#stadiumSky)" />

      {/* Floodlight beams */}
      <polygon points="60,60 220,60 440,620 -80,620" fill="url(#beamLeft)" />
      <polygon points="1140,60 980,60 760,620 1280,620" fill="url(#beamRight)" />

      {/* Floodlight towers */}
      <g opacity="0.35">
        <rect x="55" y="0" width="8" height="60" fill="var(--chalk)" />
        <rect x="35" y="0" width="48" height="10" rx="2" fill="var(--chalk)" />
        <rect x="1137" y="0" width="8" height="60" fill="var(--chalk)" />
        <rect x="1117" y="0" width="48" height="10" rx="2" fill="var(--chalk)" />
      </g>

      {/* Crowd stands — two tiers, silhouette only */}
      <path
        d="M0,470 L0,400 L110,375 L250,392 L400,365 L560,388 L620,355 L680,388 L840,365 L990,392 L1130,375 L1200,400 L1200,470 Z"
        fill="var(--turf-800)"
        opacity="0.55"
      />
      <path
        d="M0,470 L0,425 L110,405 L250,418 L400,398 L560,416 L620,392 L680,416 L840,398 L990,418 L1130,405 L1200,425 L1200,470 Z"
        fill="var(--surface-2)"
        opacity="0.7"
      />

      {/* Crowd texture — faint dot scatter within the stand band */}
      <g fill="var(--chalk)" opacity="0.06">
        {Array.from({ length: 60 }).map((_, i) => {
          const x = 20 + ((i * 197) % 1160);
          const y = 405 + ((i * 53) % 55);
          return <circle key={i} cx={x} cy={y} r="2" />;
        })}
      </g>

      {/* Pitch */}
      <rect x="0" y="470" width="1200" height="230" fill="var(--turf-950)" />
      <line x1="0" y1="472" x2="1200" y2="472" stroke="var(--chalk)" strokeOpacity="0.18" strokeWidth="2" />
      <circle cx="600" cy="472" r="70" fill="none" stroke="var(--chalk)" strokeOpacity="0.1" strokeWidth="1.5" />
    </svg>
  );
}