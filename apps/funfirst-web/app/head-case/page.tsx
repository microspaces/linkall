import HeadCaseClient from "./HeadCaseClient";
import "./head-case.css";

export default function HeadCasePage() {
  const year = new Date().getFullYear();

  return (
    <div className="hc-page hc-body">
      <a href="#signup" className="skip-link">Skip to signup</a>

      <div className="noise" aria-hidden="true" />
      <div className="orb orb-a" aria-hidden="true" />
      <div className="orb orb-b" aria-hidden="true" />

      <main id="top">
        {/* HERO */}
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/head-case/images/hero.jpg"
              alt="Comedian with a flat-screen TV for a head performing under violet and pink club lights, two giant vertical screens glowing behind"
              width={1920}
              height={1080}
              fetchPriority="high"
            />
            <div className="hero__veil" aria-hidden="true" />
          </div>

          <div className="hero__content mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-16 md:justify-center md:px-8 md:pb-24 md:pt-20">
            <p className="hero__location reveal">
              <span className="pulse-dot" aria-hidden="true" />
              Live comedy · AI-assisted · Crowd-driven
            </p>

            <h1 id="hero-heading" className="hero__brand reveal reveal-delay-1">
              Head <span>Case</span>
            </h1>

            <p className="hero__tagline reveal reveal-delay-2">
              One comedian. A 40-inch TV where a head should be.<br className="hidden sm:block" />
              The crowd holds the remote.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center reveal reveal-delay-3">
              <a href="#signup" className="btn btn-violet btn-lg">Join the List</a>
              <a href="#what" className="btn btn-ghost btn-lg">What is HeadCase?</a>
            </div>
          </div>

          <div className="hero__scroll" aria-hidden="true">
            <span>Scroll</span>
            <div className="hero__scroll-line" />
          </div>
        </section>

        {/* WHAT IS HEADCASE */}
        <section id="what" className="section section-what" aria-labelledby="what-heading">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2 md:gap-14 md:px-8">
            <div className="order-2 md:order-1">
              <p className="eyebrow">What is HeadCase?</p>
              <h2 id="what-heading" className="section-title">
                Stand-up comedy.<br />
                With a screen for a head.<br />
                <span style={{ color: "var(--neon-pink)" }}>What could go wrong?</span>
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
                HeadCase is live comedy rebuilt for the screen age: the comedian&apos;s head is a
                TV, the face on it changes on cue, and every gag is scripted, timed, and fired
                from a show console like a lighting rig.
              </p>
              <ul className="feature-list mt-8">
                <li>
                  <span className="feature-list__icon feature-list__icon--violet" aria-hidden="true" />
                  A 40-inch TV head running live face filters, burn gags and freeze frames
                </li>
                <li>
                  <span className="feature-list__icon feature-list__icon--pink" aria-hidden="true" />
                  855 bits and sketches with scripted beats — OFFSTAGE to BUTTON, tight as a drum
                </li>
                <li>
                  <span className="feature-list__icon feature-list__icon--lime" aria-hidden="true" />
                  The audience drives: phones vote, heckle, and pick what fires next
                </li>
              </ul>
            </div>

            <div className="order-1 md:order-2">
              <figure className="media-frame media-frame--tilt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/head-case/images/hero.jpg"
                  alt="Comedian with a flat-screen TV for a head performing in front of twin vertical screens"
                  width={1600}
                  height={900}
                  loading="lazy"
                />
              </figure>
            </div>
          </div>
        </section>

        {/* THE SET LIST */}
        <section id="experience" className="section section-experience" aria-labelledby="experience-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow eyebrow--center">The Set List</p>
              <h2 id="experience-heading" className="section-title">
                Scripted chaos, one button at a time
              </h2>
              <p className="mt-4 text-base text-white/65 md:text-lg">
                Every bit is a cue stack — the comedian performs, the screens react,
                and the room loses it.
              </p>
            </div>

            <div className="experience-grid mt-12">
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">01</div>
                <h3 className="xp-item__title">Bits on Tap</h3>
                <p className="xp-item__text">
                  A catalog of 855 bits: sketches, heckler burns, commercial gags,
                  dance breaks. Cue one up. Hit the button.
                </p>
              </article>
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">02</div>
                <h3 className="xp-item__title">The Screen Sells It</h3>
                <p className="xp-item__text">
                  Face filters, burn presets, SFX stings — fired mid-sentence and
                  reset before the laugh ends.
                </p>
              </article>
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">03</div>
                <h3 className="xp-item__title">Phone = Remote</h3>
                <p className="xp-item__text">
                  The room votes and heckles; the show listens.
                  Your seat is a joystick.
                </p>
              </article>
              <article className="xp-item">
                <div className="xp-item__num" aria-hidden="true">04</div>
                <h3 className="xp-item__title">Tight Five, Every Time</h3>
                <p className="xp-item__text">
                  No meandering open-mic rambles. Each bit lands its button
                  and gets out.
                </p>
              </article>
            </div>

            <figure className="media-frame media-frame--wide mt-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/head-case/images/stage.jpg"
                alt="Comedian with a flat-screen TV head working the crowd, audience filming with glowing phones"
                width={1600}
                height={900}
                loading="lazy"
              />
              <figcaption className="media-caption">
                The crowd doesn&apos;t watch the screen. They get on it.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* SIGNUP */}
        <section id="signup" className="section section-signup" aria-labelledby="signup-heading">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="signup-panel">
              <div className="signup-panel__glow" aria-hidden="true" />

              <div className="relative z-10 mx-auto max-w-xl text-center">
                <p className="eyebrow eyebrow--center">Don&apos;t miss the first broadcast</p>
                <h2 id="signup-heading" className="section-title">
                  Dates. Drops. Signal checks.
                </h2>
                <p className="mt-4 text-base text-white/70 md:text-lg">
                  Get on the list for HeadCase show announcements, ticket drops, and
                  behind-the-screen footage.
                </p>
              </div>

              <form id="signup-form" className="signup-form relative z-10" noValidate>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="What should the crowd chant?"
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
                      placeholder="you@signalreceived.com"
                      required
                      maxLength={120}
                    />
                    <p className="field-error" id="email-error" role="alert" hidden />
                  </div>
                </div>

                <button type="submit" className="btn btn-violet btn-lg w-full sm:w-auto" id="submit-btn">
                  <span className="btn-label">Beam Me In</span>
                </button>

                <p className="form-note">
                  No spam. Just show dates, ticket drops, and the occasional stray signal.
                </p>

                <div id="form-success" className="form-success" role="status" hidden>
                  <p className="form-success__title">You&apos;re in the feed.</p>
                  <p className="form-success__text">
                    When HeadCase goes live, you hear it first. Stay tuned — literally.
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
            <a href="#top" className="brand-mark brand-mark--sm" aria-label="HeadCase home">
              <span className="brand-mark__head">Head</span>
              <span className="brand-mark__case">Case</span>
            </a>
            <p className="mt-2 text-sm text-white/45">
              HeadCase · a FunFirst comedy production
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm text-white/55">
            <a href="#signup" className="footer-link">The List</a>
            <a href="mailto:hello@headcaseai.com" className="footer-link">Contact</a>
            <a href="#" className="footer-link" aria-label="Instagram (placeholder)">Instagram</a>
            <a href="#" className="footer-link" aria-label="X / Twitter (placeholder)">X</a>
            <a href="#" className="footer-link" aria-label="TikTok (placeholder)">TikTok</a>
          </div>

          <p className="text-xs text-white/35 md:text-right">
            © {year} HeadCase. All rights reserved.
          </p>
        </div>
      </footer>

      <HeadCaseClient />
    </div>
  );
}
