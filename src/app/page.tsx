import type { Metadata } from "next";
import PortalHub from "@/components/PortalHub";

export const metadata: Metadata = {
  title: "Travis Bollenbach - Choose",
  description:
    "Step up to the choice: take the blue pill for the professional portfolio, or the red pill to drop into an immersive 3D environment.",
};

export default function Home() {
  return (
    <main>
      <PortalHub />
    </main>
  );
}
