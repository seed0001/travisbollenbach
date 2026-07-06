import Link from "next/link";

export default function Home() {
  return (
    <main className="home">
      <header className="masthead" aria-label="Site header">
        <Link className="wordmark" href="/" aria-label="Travis Bollenbach, home">
          TB<span>.</span>
        </Link>
        <p className="status">
          <span aria-hidden="true" />
          Building the house
        </p>
      </header>

      <section className="hero" aria-labelledby="intro">
        <p className="eyebrow">Hey, I&apos;m Travis.</p>
        <h1 id="intro">
          I like to build
          <br />
          cool shit<span>.</span>
        </h1>
        <p className="lede">
          This will be home to everything I make—applications, games, music,
          stories, experiments, and whatever comes next.
        </p>
      </section>

      <footer>
        <p>Something bigger is taking shape.</p>
        <p>© {new Date().getFullYear()} Travis Bollenbach</p>
      </footer>
    </main>
  );
}
