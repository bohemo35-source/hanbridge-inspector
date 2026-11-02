// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Root layout (dark theme)
// @created: 2026-10-27
// @updated: 2026-11-02 claude-code — film v4 type system: Cormorant Garamond (titles), Inter Tight (text), JetBrains Mono (data); all with Cyrillic
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--nf-display", display: "swap" });
const text = Inter_Tight({ subsets: ["latin", "cyrillic"], weight: ["300", "400", "500", "600", "700"], variable: "--nf-text", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500"], variable: "--nf-data", display: "swap" });

export const metadata: Metadata = { title: "Hanbridge Inspector", description: "Verifiable used-car inspection in Korea for buyers in CIS / Central Asia." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className={`dark ${display.variable} ${text.variable} ${mono.variable}`}><body>{children}</body></html>);
}
