import type { Metadata } from "next";
import Descent from "@/components/Descent";

export const metadata: Metadata = {
  title: "The Descent — Travis Bollenbach",
  description:
    "Three depths below the construct. Each one is awake. The deeper you go, the more is thinking about your words.",
};

export default function DescentPage() {
  return <Descent />;
}
