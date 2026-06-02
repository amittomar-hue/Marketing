import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DMOOP — Enterprise Marketing Intelligence",
  description: "Self-learning marketing AI fine-tuned on your brand. Real-time intelligence, multi-channel content generation, RLMO-driven optimization.",
  // Next.js auto-discovers app/icon.png + app/apple-icon.png — explicit
  // config here makes the resolved URLs predictable for OG / browser
  // tab tooling (Slack/Twitter/iMessage previews use these).
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", type: "image/png" },
    ],
    shortcut: ["/icon.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="h-full bg-[var(--dmoop-bg-app)] text-[var(--dmoop-text-primary)] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
