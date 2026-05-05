import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Residue — Personalized Acoustic Intelligence",
  description:
    "AI that learns your optimal acoustic environment and actively shapes it for peak cognitive performance. On-device, private, personalized.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      {/*
        suppressHydrationWarning is needed because browser extensions
        (Grammarly, LastPass, etc.) inject DOM attributes onto <body>
        after React's server-rendered HTML reaches the client but
        before hydration runs. Those injected attributes
        (`data-new-gr-c-s-check-loaded`, `data-gr-ext-installed`,
        `data-lt-installed`, …) are not present in the SSR output and
        cause a hydration mismatch warning. The mismatch is harmless —
        React still renders correctly — but Next surfaces it as a
        console error. Suppressing on this single element is the
        sanctioned fix per the Next.js docs.
      */}
      <body
        className="min-h-full flex flex-col bg-[#0a0a1a]"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
