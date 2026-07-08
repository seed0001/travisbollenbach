import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://travisbollenbach.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Travis Bollenbach - Under Construction",
    template: "%s",
  },
  description: "Webpage is currently under construction, features to come.",
  authors: [{ name: "Travis Bollenbach" }],
  creator: "Travis Bollenbach",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Travis Bollenbach - Under Construction",
    description: "Webpage is currently under construction, features to come.",
    siteName: "Travis Bollenbach",
  },
  twitter: {
    card: "summary",
    title: "Travis Bollenbach - Under Construction",
    description: "Webpage is currently under construction, features to come.",
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
