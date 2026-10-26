// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Root layout (dark theme)
// @created: 2026-10-27
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Hanbridge Inspector", description: "Verifiable used-car inspection in Korea for buyers in CIS / Central Asia." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en" className="dark"><body>{children}</body></html>);
}
