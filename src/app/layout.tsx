import type { Metadata } from "next";
import AnalyticsBeacon from "@/components/AnalyticsBeacon";
import "./globals.css";

const SITE_URL = "https://travisbollenbach.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Travis Bollenbach — Choose Your Pill",
    template: "%s",
  },
  description:
    "Blue pill: tools and applications built for the real world. Red pill: character creation, AI consciousness, and a 3D world you can walk through.",
  authors: [{ name: "Travis Bollenbach" }],
  creator: "Travis Bollenbach",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Travis Bollenbach — Choose Your Pill",
    description:
      "Blue pill: the storefront. Red pill: the rabbit hole. Both were built by hand.",
    siteName: "Travis Bollenbach",
  },
  twitter: {
    card: "summary",
    title: "Travis Bollenbach — Choose Your Pill",
    description:
      "Blue pill: the storefront. Red pill: the rabbit hole. Both were built by hand.",
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
