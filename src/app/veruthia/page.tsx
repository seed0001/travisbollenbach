import type { Metadata } from "next";
import VeruthiaRoom from "@/components/VeruthiaRoom";

export const metadata: Metadata = {
  title: "Veruthia — Travis Bollenbach",
  description:
    "The Ops Floor: an interactive room showcasing Veruthia Consulting — security-first systems for local service businesses, and the firm that audited this site.",
};

export default function VeruthiaPage() {
  return (
    <main>
      <VeruthiaRoom />
    </main>
  );
}
