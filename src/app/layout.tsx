import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { SolanaProviders } from "@/components/SolanaProviders";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#080808",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "VAROnChain — Every goal. Verified on-chain.",
    template: "%s · VAROnChain",
  },
  description:
    "Real-time World Cup fan companion with cryptographic on-chain proof for every goal, card and substitution — powered by TxODDS TxLINE on Solana.",
  keywords: [
    "World Cup",
    "Solana",
    "TxODDS",
    "TxLINE",
    "blockchain",
    "sports",
    "verified",
    "live scores",
    "fan experience",
  ],
  authors: [{ name: "VAROnChain" }],
  openGraph: {
    title: "VAROnChain — Every goal. Verified on-chain.",
    description:
      "Real-time World Cup fan companion with cryptographic on-chain proof for every goal, card and substitution — powered by TxODDS TxLINE on Solana.",
    type: "website",
    locale: "en_US",
    siteName: "VAROnChain",
  },
  twitter: {
    card: "summary_large_image",
    title: "VAROnChain — Every goal. Verified on-chain.",
    description:
      "Real-time World Cup fan companion with cryptographic on-chain proof for every goal, card and sub — powered by Solana.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="flex min-h-full flex-col bg-bg text-text">
        <SolanaProviders>{children}</SolanaProviders>
      </body>
    </html>
  );
}
