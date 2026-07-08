import type { Metadata } from "next";
import ComingSoonPage from "@/components/ComingSoonPage";

export const metadata: Metadata = {
  title: "Travis Bollenbach - Under Construction",
  description: "Webpage is currently under construction, features to come.",
  robots: { index: false, follow: false },
};

export default function Home() {
  return <ComingSoonPage />;
}
