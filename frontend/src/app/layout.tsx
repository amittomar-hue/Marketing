import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "DMOOP — Enterprise Marketing Intelligence",
  description: "Self-learning marketing AI fine-tuned on your brand. Real-time intelligence, multi-channel content generation, RLMO-driven optimization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full bg-[var(--dmoop-bg-app)] text-[var(--dmoop-text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
