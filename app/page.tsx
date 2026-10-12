import type { Metadata } from "next";
import AiHero from "@/app/components/ai-hero";
import SiteHeader from "@/app/components/site-header";

export const metadata: Metadata = {
  title: "Aether IT — Parlons de votre vision",
  description:
    "Échangez avec l’assistant Aether IT et transformez votre idée en projet numérique concret.",
};

export default function Home() {
  return (
    <main className="landing-page">
      <SiteHeader />
      <AiHero />
    </main>
  );
}
