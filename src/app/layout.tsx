import type { Metadata } from "next";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import "./globals.css";

const SITE_URL = "https://travisbollenbach.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Travis Bollenbach",
    template: "%s",
  },
  description:
    "Professional portfolio and immersive 3D environment by Travis Bollenbach.",
  authors: [{ name: "Travis Bollenbach" }],
  creator: "Travis Bollenbach",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Travis Bollenbach",
    description:
      "Choose the professional portfolio or enter an immersive 3D environment.",
    siteName: "Travis Bollenbach",
  },
  twitter: {
    card: "summary",
    title: "Travis Bollenbach",
    description:
      "Choose the professional portfolio or enter an immersive 3D environment.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsBeacon />
      </body>
    </html>
  );
}
