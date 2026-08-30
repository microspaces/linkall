import ComedyLocoClient from "./ComedyLocoClient";
import "./comedy-loco.css";

export default function ComedyLocoPage() {
  const year = new Date().getFullYear();

  return (
    <div className="cl-page cl-body">
      <a href="#waitlist" className="cl-skip-link">Skip to waitlist</a>

      <div className="cl-noise" aria-hidden="true" />
      <div className="cl-orb cl-orb-a" aria-hidden="true" />
      <div className="cl-orb cl-orb-b" aria-hidden="true" />

      <main id="top">
        {/* HERO */}
        <section className="cl-hero" aria-labelledby="hero-heading">
          <div className="cl-hero__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/comedy-loco/images/hero.jpg"
              alt="Seven Comedy Loco performers on a League of Laughs stage: yellow Bananas jerseys versus dark jerseys, with League of Laughs banners and a Bananas 7 scoreboard"
              width={2261}
              height={1085}
              fetchPriority="high"
            />
            <div className="cl-hero__veil" aria-hidden="true" />
          </div>

          <div className="cl-hero__content mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-16 md:justify-center md:px-8 md:pb-24 md:pt-20">
            <p className="cl-hero__location cl-reveal">
              <span className="cl-pulse-dot" aria-hidden="true" />
              Location TBA, Las Vegas
            </p>

            <h1 id="hero-heading" className="cl-hero__brand cl-reveal cl-reveal-delay-1">
              Comedy <span>Loco</span>
            </h1>

            <p className="cl-hero__tagline cl-reveal cl-reveal-delay-2">
              Two improv teams. Crowd picks the winner.<br className="hidden sm:block" />
              Whose Line energy with a scoreboard.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center cl-reveal cl-reveal-delay-3">
              <a href="#waitlist" className="cl-btn cl-btn-amber cl-btn-lg">Join the Waitlist</a>
              <a href="#what" className="cl-btn cl-btn-ghost cl-btn-lg">What&apos;s Comedy Loco?</a>
            </div>
          </div>

          <div className="cl-hero__scroll" aria-hidden="true">
            <span>Scroll</span>
            <div className="cl-hero__scroll-line" />
          </div>
        </section>

        {/* WHAT IS COMEDY LOCO */}
        <section id="what" className="cl-section cl-section-what" aria-labelledby="what-heading">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2 md:gap-14 md:px-8">
            <div className="order-2 md:order-1">
              <p className="cl-eyebrow">What is Comedy Loco?</p>
              <h2 id="what-heading" className="cl-section-title">
                Two teams.<br />
                One stage.<br />
                <span style={{ color: "var(--banana)" }}>The crowd calls it.</span>
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
                Competitive improv: Whose Line Is It Anyway energy, ComedySportz-style
                team vs team. Two squads of improvisers face off in short-form games —
                scenes, line games, singing games — while the audience shouts the
                suggestions and votes the winners from their phones.
              </p>
              <ul className="cl-feature-list mt-8">
                <li>
                  <span className="cl-feature-list__icon cl-feature-list__icon--banana" aria-hidden="true" />
                  Short-form games — scenes, lines, music, challenges, jokes
                </li>
                <li>
                  <span className="cl-feature-list__icon cl-feature-list__icon--berry" aria-hidden="true" />
                  Audience suggestions fuel every round
                </li>
                <li>
                  <span className="cl-feature-list__icon cl-feature-list__icon--cream" aria-hidden="true" />
                  Phone-powered voting that actually crowns the winner
                </li>
              </ul>
            </div>

            <div className="order-1 md:order-2">
              <figure className="cl-media-frame cl-media-frame--tilt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/comedy-loco/images/crowd.jpg"
                  alt="Laughing audience holding up glowing phones to vote during a live comedy show"
                  width={1600}
                  height={900}
                  loading="lazy"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* HOW A SHOW WORKS */}
        <section id="how" className="cl-section cl-section-how" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="cl-eyebrow cl-eyebrow--center">How a show works</p>
              <h2 id="how-heading" className="cl-section-title">
                A referee. A stack of games. Points that are made up.
              </h2>
              <p className="mt-4 text-base text-white/65 md:text-lg">
                Short-form comedy, live scoring, and a crowd that refuses to sit quietly —
                your phone is part of the cast.
              </p>
            </div>

            <figure className="cl-media-frame cl-media-frame--wide mt-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/comedy-loco/images/how-it-works.jpg"
                alt="Balloon Battle on a League of Laughs stage: two performers at a table of red cups under LED screens showing the game and rules"
                width={2129}
                height={1469}
                loading="lazy"
              />
            </figure>

            <div className="cl-experience-grid mt-12">
              <article className="cl-xp-item">
                <div className="cl-xp-item__num" aria-hidden="true">01</div>
                <h3 className="cl-xp-item__title">The Referee</h3>
                <p className="cl-xp-item__text">
                  A host keeps time, keeps score, and keeps the teams honest.
                  The whistle is real. The rulings are theatrical.
                </p>
              </article>
              <article className="cl-xp-item">
                <div className="cl-xp-item__num" aria-hidden="true">02</div>
                <h3 className="cl-xp-item__title">Short Games</h3>
                <p className="cl-xp-item__text">
                  Scenes, line games, music games. Bucket rounds, challenges,
                  volunteers, guessing, jokes — the night never sits still.
                </p>
              </article>
              <article className="cl-xp-item">
                <div className="cl-xp-item__num" aria-hidden="true">03</div>
                <h3 className="cl-xp-item__title">You Shout It</h3>
                <p className="cl-xp-item__text">
                  A job. A hometown. A terrible first date. The room writes the
                  prompt; the teams have to make it funny — now.
                </p>
              </article>
              <article className="cl-xp-item">
                <div className="cl-xp-item__num" aria-hidden="true">04</div>
                <h3 className="cl-xp-item__title">Phones Vote</h3>
                <p className="cl-xp-item__text">
                  Vote the winner of each game from your seat. Points are made up.
                  The winning team is celebrated like they saved comedy.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* THE TEAMS */}
        <section id="teams" className="cl-section cl-section-teams" aria-labelledby="teams-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="cl-eyebrow cl-eyebrow--center">The Teams</p>
              <h2 id="teams-heading" className="cl-section-title">
                Banana Peels vs Comedy Clubtrotters.
              </h2>
              <p className="mt-4 text-base text-white/65 md:text-lg">
                Two improv teams. One scoreboard. Pick a side and yell accordingly.
              </p>
            </div>

            <figure className="cl-media-frame cl-media-frame--lineup mt-12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/comedy-loco/images/teams.jpg"
                alt="Three-panel Comedy Loco stage triptych: a performer in a yellow Bananas jersey, the same night at a table of bits under League of Laughs screens, and a performer in a black pinstripe jersey"
                width={3725}
                height={1539}
                loading="lazy"
              />
              <figcaption className="cl-media-caption">
                Bananas jersey. Table of bits. Black pinstripe. League of Laughs on the screens.
              </figcaption>
            </figure>

            <div className="cl-teams-grid mt-10">
              <article className="cl-team-card cl-team-card--bananas">
                <p className="cl-team-card__label">Team</p>
                <h3 className="cl-team-card__name">Banana Peels</h3>
                <p className="cl-team-card__text">
                  Bright. Loud. Unreasonably confident. They play yellow,
                  they play hungry, and they want the last laugh.
                </p>
              </article>
              <div className="cl-teams-vs" aria-hidden="true">VS</div>
              <article className="cl-team-card cl-team-card--clubtrotters">
                <p className="cl-team-card__label">Team</p>
                <h3 className="cl-team-card__name">Comedy Clubtrotters</h3>
                <p className="cl-team-card__text">
                  Sharp. Flashy. Road-show swagger. Dark jerseys, red-and-blue
                  trim, and a punchline that travels — no interest in losing.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* WAITLIST */}
        <section id="waitlist" className="cl-section cl-section-waitlist" aria-labelledby="waitlist-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="cl-waitlist-panel">
              <div className="cl-waitlist-panel__glow" aria-hidden="true" />

              <div className="relative z-10 mx-auto max-w-xl text-center">
                <p className="cl-eyebrow cl-eyebrow--center">Don&apos;t miss the drop</p>
                <h2 id="waitlist-heading" className="cl-section-title">
                  Tickets. Dates. Suggestion lists.
                </h2>
                <p className="mt-4 text-base text-white/70 md:text-lg">
                  Jump the list for Comedy Loco updates, ticket drops, and early access
                  before the room fills up — and the suggestions get weird.
                </p>
              </div>

              <form id="waitlist-form" className="cl-waitlist-form relative z-10" noValidate>
                <div className="cl-form-row">
                  <div className="cl-field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="What should we yell?"
                      required
                      minLength={2}
                      maxLength={80}
                    />
                    <p className="cl-field-error" id="name-error" role="alert" hidden />
                  </div>
                  <div className="cl-field">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@aregettingin.com"
                      required
                      maxLength={120}
                    />
                    <p className="cl-field-error" id="email-error" role="alert" hidden />
                  </div>
                </div>

                <button type="submit" className="cl-btn cl-btn-amber cl-btn-lg w-full sm:w-auto" id="submit-btn">
                  <span className="cl-btn-label">Lock Me In</span>
                </button>

                <p className="cl-form-note">
                  No spam. Just the good stuff — show news, ticket info, and announcements.
                </p>

                <div id="form-success" className="cl-form-success" role="status" hidden>
                  <p className="cl-form-success__title">You&apos;re on the list.</p>
                  <p className="cl-form-success__text">
                    When Comedy Loco drops dates and tickets, you&apos;ll hear it first.
                    Stay loco.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="cl-site-footer">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <a href="#top" className="cl-brand-mark cl-brand-mark--sm" aria-label="Comedy Loco home">
              <span className="cl-brand-mark__comedy">Comedy</span>
              <span className="cl-brand-mark__loco">Loco</span>
            </a>
            <p className="mt-2 text-sm text-white/45">
            Location TBA Hotel &amp; Casino · Las Vegas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-white/55">
            <a href="#waitlist" className="cl-footer-link">Waitlist</a>
            <a href="mailto:hello@comedyloco.com" className="cl-footer-link">Contact</a>
            <a href="#" className="cl-footer-link" aria-label="Instagram (placeholder)">Instagram</a>
            <a href="#" className="cl-footer-link" aria-label="X / Twitter (placeholder)">X</a>
            <a href="#" className="cl-footer-link" aria-label="TikTok (placeholder)">TikTok</a>
          </div>

          <p className="text-xs text-white/35 md:text-right">
            © {year} Comedy Loco. All rights reserved.
          </p>
        </div>
      </footer>

      <ComedyLocoClient />
    </div>
  );
}
