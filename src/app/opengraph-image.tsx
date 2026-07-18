import { ImageResponse } from "next/og";

export const alt = "VAROnChain — Every goal. Verified on-chain.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#121214",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dot grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 900px 700px at 20% 60%, rgba(129,140,248,0.10), transparent 70%)",
          }}
        />
        {/* Corner glow accent */}
        <div
          style={{
            position: "absolute",
            bottom: -80,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(129,140,248,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            padding: "56px 72px",
            height: "100%",
            justifyContent: "space-between",
          }}
        >
          {/* Top: Brand + badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Shield logo */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L4 5v6c0 5.2 3.4 9.4 8 11 4.6-1.6 8-5.8 8-11V5l-8-3z"
                stroke="#cdfe00"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M8.5 12l2.5 2.5 4.5-4.5"
                stroke="#cdfe00"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "sans-serif",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#cdfe00",
              }}
            >
              VAROnChain
            </span>
            {/* Verified badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginLeft: 8,
                border: "1px solid rgba(52,211,153,0.35)",
                borderRadius: 100,
                padding: "4px 12px",
                background: "rgba(52,211,153,0.08)",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#34d399",
                }}
              />
              <span
                style={{
                  fontFamily: "sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#34d399",
                }}
              >
                Solana-verified
              </span>
            </div>
          </div>

          {/* Main headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontFamily: "sans-serif",
                fontSize: 72,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              Every goal.{" "}
              <span style={{ color: "#cdfe00" }}>Verified</span>
              {"\n"}on-chain.
            </div>
            <div
              style={{
                fontFamily: "sans-serif",
                fontSize: 22,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.5,
                maxWidth: 680,
              }}
            >
              Real-time World Cup fan companion with cryptographic proof for
              every goal, card and sub — powered by TxODDS TxLINE on Solana.
            </div>
          </div>

          {/* Bottom: stat pills */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "Live scores", icon: "⚽" },
              { label: "On-chain proof", icon: "🔗" },
              { label: "Crowd Pulse", icon: "📈" },
              { label: "Predict & win", icon: "🎯" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 100,
                  padding: "8px 18px",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span
                  style={{
                    fontFamily: "sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.65)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
