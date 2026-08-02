import WrestleLocoClient from "./WrestleLocoClient";
import "./wrestle-loco.css";

export default function WrestleLocoPage() {
  const year = new Date().getFullYear();

  return (
    <div className="wl-page wl-body">
      <a href="#waitlist" className="skip-link">Skip to waitlist</a>

      <div className="noise" aria-hidden="true" />
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />

      <main id="top">
        {/* HERO */}
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/wrestle-loco/images/hero.jpg"
              alt="Neon-lit wrestling ring under electric blue and hot pink lights with a roaring Las Vegas crowd"
              width={1920}
              height={1080}
              fetchPriority="high"
            />
            <div className="hero__veil" aria-hidden="true" />
          </div>

          <div className="hero__content mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-16 md:justify-center md:px-8 md:pb-24 md:pt-20">
            <p className="hero__location reveal">
              <span className="pulse-dot" aria-hidden="true" />
              Hyperex Arena · Luxor, Las Vegas
            </p>

            <h1 id="hero-heading" className="hero__brand reveal reveal-delay-1">
              Wrestle <span>Loco</span>
            </h1>

            <p className="hero__tagline reveal reveal-delay-2">
              Live wrestling. Crowd action. Fan refs.<br className="hidden sm:block" />
              Loco energy with body slams.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center reveal reveal-delay-3">
              <a href="#waitlist" className="btn btn-pink btn-lg">Join the Waitlist</a>
              <a href="#what" className="btn btn-ghost btn-lg">What&apos;s the madness?</a>
            </div>
          </div>

          <div className="hero__scroll" aria-hidden="true">
            <span>Scroll</span>
            <div className="hero__scroll-line" />
          </div>
        </section>

        {/* WHAT IS WRESTLE LOCO */}
        <section id="what" className="section section-what" aria-labelledby="what-heading">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2 md:gap-14 md:px-8">
            <div className="order-2 md:order-1">
              <p className="eyebrow">What is Wrestle Loco?</p>
              <h2 id="what-heading" className="section-title">
                Two teams.<br />
                One arena.<br />
                <span style={{ color: "var(--neon-pink)" }}>Total chaos.</span>
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
                Five wrestlers vs five wrestlers in a night of multi-round matches — scored by wins. Between rounds the crowd
                takes over: kids screaming matches that earn weapons, fans becoming
                the ref, phones lighting up the big screens. Then the finale hits —
                a multi-pin free-for-all where every pin is a point.
              </p>
              <ul className="feature-list mt-8">
                <li>
                  <span className="feature-list__icon feature-list__icon--pink" aria-hidden="true" />
                  Team scoring, round-based mayhem, multi-pin final match
                </li>
                <li>
                  <span className="feature-list__icon feature-list__icon--green" aria-hidden="true" />
                  Crowd bits, weapons, fan refs — Loco–level silliness
                </li>
                <li>
                  <span className="feature-list__icon feature-list__icon--blue" aria-hidden="true" />
                  Phone + screen interactivity that actually changes the show
                </li>
              </ul>
            </div>

            <div className="order-1 md:order-2">
              <figure className="media-frame media-frame--tilt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/wrestle-loco/images/ring.jpg"
                  alt="Stylized neon wrestling ring with spotlights and electric pink ropes"
                  width={1600}
                  height={900}
                  loading="lazy"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* THE EXPERIENCE */}
        <section id="experience" className="section section-experience" aria-labelledby="experience-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow eyebrow--center">The Experience</p>
              <h2 id="experience-heading" className="section-title">
                Loud. Chaotic. Deliberately unhinged.
              </h2>
              <p className="mt-4 text-base text-white/65 md:text-lg">
                Pro wrestling heat meets fan energy —
                and your phone is part of the cast.
              </p>
            </div>

            <div className="experience-grid mt-12">
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">01</div>
                <h3 className="xp-item__title">Live Wrestling Chaos</h3>
                <p className="xp-item__text">
                  Real athletes. Real bumps. Matches that flip from 1-on-1
                  to tag-team havoc before you finish your popcorn.
                </p>
              </article>
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">02</div>
                <h3 className="xp-item__title">Phone = Power</h3>
                <p className="xp-item__text">
                  Interact with the big screens. Swing the vibe mid-match.
                  Your seat is a remote for the ring.
                </p>
              </article>
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">03</div>
                <h3 className="xp-item__title">Loco Energy</h3>
                <p className="xp-item__text">
                  Screaming contests. Fan referees. Weapons awarded by kids
                  who just out-yelled the other side. Peak loco energy.
                </p>
              </article>
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">04</div>
                <h3 className="xp-item__title">Vegas Setting</h3>
                <p className="xp-item__text">
                  Hyperex Arena at the Luxor. Neon. Noise. The kind of night
                  you&apos;ll swear you invented when you tell the story later.
                </p>
              </article>
            </div>

            <figure className="media-frame media-frame--wide mt-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/wrestle-loco/images/crowd.jpg"
                alt="Arena crowd holding glowing phones toward a massive neon LED screen above the ring"
                width={1600}
                height={900}
                loading="lazy"
              />
              <figcaption className="media-caption">
                The crowd doesn&apos;t just cheer. They arm the wrestlers.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* WAITLIST */}
        <section id="waitlist" className="section section-waitlist" aria-labelledby="waitlist-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="waitlist-panel">
              <div className="waitlist-panel__glow" aria-hidden="true" />

              <div className="relative z-10 mx-auto max-w-xl text-center">
                <p className="eyebrow eyebrow--center">Don&apos;t miss the drop</p>
                <h2 id="waitlist-heading" className="section-title">
                  Tickets. Dates. Chaos alerts.
                </h2>
                <p className="mt-4 text-base text-white/70 md:text-lg">
                  Jump the list for Wrestle Loco updates, ticket drops, and early access
                  before the arena sells out of seats — and eardrums.
                </p>
              </div>

              <form id="waitlist-form" className="waitlist-form relative z-10" noValidate>
                <div className="form-row">
                  <div className="field">
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
                    <p className="field-error" id="name-error" role="alert" hidden />
                  </div>
                  <div className="field">
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
                    <p className="field-error" id="email-error" role="alert" hidden />
                  </div>
                </div>

                <button type="submit" className="btn btn-pink btn-lg w-full sm:w-auto" id="submit-btn">
                  <span className="btn-label">Lock Me In</span>
                </button>

                <p className="form-note">
                  No spam. Just the good stuff — show news, ticket info, and announcements.
                </p>

                <div id="form-success" className="form-success" role="status" hidden>
                  <p className="form-success__title">You&apos;re on the list.</p>
                  <p className="form-success__text">
                    When Wrestle Loco drops dates and tickets, you&apos;ll hear it first.
                    Stay loco.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <a href="#top" className="brand-mark brand-mark--sm" aria-label="Wrestle Loco home">
              <span className="brand-mark__wrestle">Wrestle</span>
              <span className="brand-mark__loco">Loco</span>
            </a>
            <p className="mt-2 text-sm text-white/45">
              Hyperex Arena · Luxor Hotel &amp; Casino · Las Vegas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-white/55">
            <a href="#waitlist" className="footer-link">Waitlist</a>
            <a href="mailto:hello@wrestleloco.com" className="footer-link">Contact</a>
            <a href="#" className="footer-link" aria-label="Instagram (placeholder)">Instagram</a>
            <a href="#" className="footer-link" aria-label="X / Twitter (placeholder)">X</a>
            <a href="#" className="footer-link" aria-label="TikTok (placeholder)">TikTok</a>
          </div>

          <p className="text-xs text-white/35 md:text-right">
            © {year} Wrestle Loco. All rights reserved.
          </p>
        </div>
      </footer>

      <WrestleLocoClient />
    </div>
  );
}
