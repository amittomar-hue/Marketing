import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "Marketing LLM",
  description: "Real-Time Intelligence & Self-Learning Marketing Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full bg-[#f9f9f8] text-[#1a1a1a] antialiased">
        {children}
      </body>
    </html>
  );
}
