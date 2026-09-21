import "./fun-first.css";

export const metadata = {
  title: "FunFirst — live show platform",
  description:
    "FunFirst is the live-show platform behind Battle Loco, Wrestle Loco, Comedy Loco, and HeadCase. Four distinct experiences. One umbrella. All built for the crowd that refuses to sit still.",
  openGraph: {
    title: "FunFirst — live show platform",
    description:
      "FunFirst is the live-show platform behind Battle Loco, Wrestle Loco, Comedy Loco, and HeadCase. Four distinct experiences. One umbrella. All built for the crowd that refuses to sit still.",
    images: [
      {
        url: "/fun-first/og.jpg",
        width: 1200,
        height: 630,
        alt: "FunFirst — live show platform",
      },
    ],
  },
};

export default function FunFirstPage() {
  const year = new Date().getFullYear();

  return (
    <div className="ff-page ff-body">
      <a href="#brands" className="skip-link">Skip to brands</a>

      <div className="noise" aria-hidden="true" />
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />

      <main id="top">
        {/* HERO */}
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/fun-first/hero.jpg"
              alt="Four FunFirst brands colliding under neon lights: wrestling ring, esports arena, comedy stage, and TV-headed comedian"
              width={1920}
              height={1080}
              fetchPriority="high"
            />
            <div className="hero__veil" aria-hidden="true" />
          </div>

          <div className="hero__content mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-16 md:justify-center md:px-8 md:pb-24 md:pt-20">
            <p className="hero__location reveal">
              <span className="pulse-dot" aria-hidden="true" />
              One platform. Four shows. Zero chill.
            </p>

            <h1 id="hero-heading" className="hero__brand reveal reveal-delay-1">
              Fun<span>First</span>
            </h1>

            <p className="hero__tagline reveal reveal-delay-2">
              Live shows built for the crowd that refuses to sit still.<br className="hidden sm:block" />
              Comedy Loco. Battle Loco. Wrestle Loco. HeadCase.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center reveal reveal-delay-3">
              <a href="#brands" className="btn btn-orange btn-lg">Explore the shows</a>
              <a href="#about" className="btn btn-ghost btn-lg">What is FunFirst?</a>
            </div>
          </div>

          <div className="hero__scroll" aria-hidden="true">
            <span>Scroll</span>
            <div className="hero__scroll-line" />
          </div>
        </section>

        {/* ABOUT FUNFIRST */}
        <section id="about" className="section section-about" aria-labelledby="about-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow eyebrow--center">The umbrella</p>
              <h2 id="about-heading" className="section-title">
                Comedy first.<br />
                Everything else second.
              </h2>
              <p className="mt-4 text-base text-white/70 md:text-lg">
                FunFirst is the live-show platform behind four distinct experiences — each with its own
                identity, audience, and chaos level. From comedy game shows to wrestling mayhem,
                esports spectacle to AI-assisted stand-up, we build nights the crowd owns.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="stat-card">
                <div className="stat-card__num">4</div>
                <div className="stat-card__label">Live shows</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__num">100%</div>
                <div className="stat-card__label">Crowd-powered</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__num">Vegas</div>
                <div className="stat-card__label">Born & built</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__num">Zero</div>
                <div className="stat-card__label">Chill allowed</div>
              </div>
            </div>
          </div>
        </section>

        {/* THE BRANDS */}
        <section id="brands" className="section section-brands" aria-labelledby="brands-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow eyebrow--center">The family</p>
              <h2 id="brands-heading" className="section-title">
                Four shows.<br />
                One umbrella.<br />
                <span style={{ color: "var(--neon-pink)" }}>Pick your chaos.</span>
              </h2>
            </div>

            <div className="brands-grid mt-12">
              {/* BATTLE LOCO */}
              <article className="brand-card brand-card--battle">
                <div className="brand-card__badge">Esports + Mayhem</div>
                <h3 className="brand-card__name">
                  Battle <span>Loco</span>
                </h3>
                <p className="brand-card__tagline">
                  Esports. Chaos. Crowd control.
                </p>
                <p className="brand-card__desc">
                  YouTubers, celebrities, and athletes go head-to-head in a live Vegas showdown — video games one round, Minute to Win It–style mayhem the next. The crowd doesn't just watch. They run the show.
                </p>
                <a href="https://battleloco.com" className="btn btn-blue btn-lg brand-card__cta" target="_blank" rel="noopener noreferrer">
                  Visit battleloco.com →
                </a>
              </article>

              {/* WRESTLE LOCO */}
              <article className="brand-card brand-card--wrestle">
                <div className="brand-card__badge">Wrestling Entertainment</div>
                <h3 className="brand-card__name">
                  Wrestle <span>Loco</span>
                </h3>
                <p className="brand-card__tagline">
                  Live wrestling. Crowd action. Fan refs.
                </p>
                <p className="brand-card__desc">
                  Five wrestlers vs five wrestlers in a night of multi-round matches scored by wins. Between rounds the crowd takes over: kids screaming matches that earn weapons, fans becoming the ref, phones lighting up the big screens.
                </p>
                <a href="https://wrestleloco.com" className="btn btn-pink btn-lg brand-card__cta" target="_blank" rel="noopener noreferrer">
                  Visit wrestleloco.com →
                </a>
              </article>

              {/* COMEDY LOCO */}
              <article className="brand-card brand-card--comedy">
                <div className="brand-card__badge">Live Comedy Night</div>
                <h3 className="brand-card__name">
                  Comedy <span>Loco</span>
                </h3>
                <p className="brand-card__tagline">
                  2 teams. Celebrity Superstars. Cheers choose the winner.
                </p>
                <p className="brand-card__desc">
                  Competitive Comedy: Whose Line Is It Anyway energy, team vs team. 2 teams face off in games — scenes, line games, singing games — while the audience shouts the suggestions and votes the winners from their phones.
                </p>
                <a href="https://comedyloco.com" className="btn btn-amber btn-lg brand-card__cta" target="_blank" rel="noopener noreferrer">
                  Visit comedyloco.com →
                </a>
              </article>

              {/* HEADCASE */}
              <article className="brand-card brand-card--headcase">
                <div className="brand-card__badge">AI-Powered Party Show</div>
                <h3 className="brand-card__name">
                  Head<span>Case</span>
                </h3>
                <p className="brand-card__tagline">
                  One comedian. One giant head. The crowd holds the remote.
                </p>
                <p className="brand-card__desc">
                  HeadCase is live comedy rebuilt for the screen age: the comedian's head is a TV, the face on it changes on cue, and every gag is scripted, timed, and fired from a show console like a lighting rig. 855 bits. Phones vote. Zero chill.
                </p>
                <a href="https://headcaseai.com" className="btn btn-violet btn-lg brand-card__cta" target="_blank" rel="noopener noreferrer">
                  Visit headcaseai.com →
                </a>
              </article>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="site-footer">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <a href="#top" className="brand-mark brand-mark--sm" aria-label="FunFirst home">
                <span className="brand-mark__fun">Fun</span>
                <span className="brand-mark__first">First</span>
              </a>
              <p className="mt-2 text-sm text-white/45">
                Comedy first. Everything else second.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-sm text-white/55">
              <a href="https://battleloco.com" className="footer-link" target="_blank" rel="noopener noreferrer">battleloco.com</a>
              <a href="https://wrestleloco.com" className="footer-link" target="_blank" rel="noopener noreferrer">wrestleloco.com</a>
              <a href="https://comedyloco.com" className="footer-link" target="_blank" rel="noopener noreferrer">comedyloco.com</a>
              <a href="https://headcaseai.com" className="footer-link" target="_blank" rel="noopener noreferrer">headcaseai.com</a>
            </div>

            <p className="text-xs text-white/35 md:text-right">
              © {year} FunFirst. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
