import Link from "next/link";
import OceanIntro from "@/components/OceanIntro";

const environments = ["Open water", "Night shelf", "Storm wall"];

export default function Home() {
  return (
    <main className="landing">
      <OceanIntro />

      <div className="vignette" aria-hidden="true" />

      <header className="site-header" aria-label="Site header">
        <Link className="wordmark" href="/" aria-label="Travis Bollenbach, home">
          TB<span>.</span>
        </Link>
        <p className="status">
          <span aria-hidden="true" />
          Live environment 01
        </p>
      </header>

      <section className="intro-panel" aria-labelledby="intro">
        <p className="eyebrow">Travis Bollenbach</p>
        <h1 id="intro">Skimming the edge of the next build.</h1>
        <p className="lede">
          A cinematic launch deck for applications, games, music, experiments,
          and the worlds that connect them.
        </p>
      </section>

      <aside className="environment-switcher" aria-label="Environment queue">
        {environments.map((environment, index) => (
          <span
            className={index === 0 ? "environment active" : "environment"}
            key={environment}
          >
            {environment}
          </span>
        ))}
      </aside>
    </main>
  );
}
