import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://travisbollenbach.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Travis Bollenbach - Game Lobby",
    template: "%s",
  },
  description: "Enter the game lobby and preview the level door map.",
  authors: [{ name: "Travis Bollenbach" }],
  creator: "Travis Bollenbach",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Travis Bollenbach - Game Lobby",
    description: "Enter the game lobby and preview the level door map.",
    siteName: "Travis Bollenbach",
  },
  twitter: {
    card: "summary",
    title: "Travis Bollenbach - Game Lobby",
    description: "Enter the game lobby and preview the level door map.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
