import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-display",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const SITE_URL = "https://travisbollenbach.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Travis Bollenbach - Skimming the Next Build",
  description:
    "A cinematic launch deck for the applications, games, music, stories, experiments, and 3D worlds Travis Bollenbach builds.",
  authors: [{ name: "Travis Bollenbach" }],
  creator: "Travis Bollenbach",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Travis Bollenbach - Skimming the Next Build",
    description:
      "Applications, games, music, stories, experiments, and cinematic 3D worlds.",
    siteName: "Travis Bollenbach",
  },
  twitter: {
    card: "summary",
    title: "Travis Bollenbach - Skimming the Next Build",
    description:
      "Applications, games, music, stories, experiments, and cinematic 3D worlds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
