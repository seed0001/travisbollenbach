import type { Metadata } from "next";
import PortfolioWalk from "@/components/PortfolioWalk";

export const metadata: Metadata = {
  title: "Portfolio - Travis Bollenbach",
  description:
    "Walk a 3D boulevard of software, product, design, and launch work by Travis Bollenbach — read each project on either side of the road.",
};

export default function Storefront() {
  return (
    <main>
      <PortfolioWalk />
    </main>
  );
}
