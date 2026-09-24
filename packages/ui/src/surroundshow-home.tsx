"use client";

import { useEffect, useState } from "react";

/**
 * Surround Show home pane, carried over from the v1 page at surroundshow.com
 * (LinkAll8 Views/Surroundshow/IndexInfo.cshtml). Pictures live in
 * surroundshow-web/public/images/surroundshow.
 */

const IMG = "/images/surroundshow";

const SLIDES = [
  {
    image: "housewithg.webp",
    kicker: "Multi Projector",
    title: "Projection Mapping",
    alt: "House wrapped in a multi-projector mapping show",
  },
  {
    image: "surroundshowtheater.webp",
    kicker: "Virtual Sets",
    title: "Surround Shows",
    alt: "Theater stage lit as a surround show",
  },
  {
    image: "strangerthings.webp",
    kicker: "Haunted Houses",
    title: "Ghostly Apparitions",
    alt: "Haunted house projection with ghostly figures",
  },
  {
    image: "beatsabre2.webp",
    kicker: "Christmas Drive Thru",
    title: "Digital Decorations",
    alt: "Christmas drive-thru digital decorations on a house",
  },
] as const;

const SHOW_TABS = [
  {
    id: "halloween",
    label: "Halloween",
    images: [
      { src: "davidpumpkins.webp", alt: "David S. Pumpkins dancing pumpkin show" },
      { src: "strangerthings.webp", alt: "Stranger Things style haunt projection" },
    ],
  },
  {
    id: "christmas",
    label: "Christmas",
    images: [
      { src: "beatsabre2.webp", alt: "Christmas light show on a house" },
      { src: "justdance2.webp", alt: "Just Dance holiday projection" },
      { src: "pentatonix.webp", alt: "Pentatonix holiday projection" },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    images: [
      { src: "scenes.webp", alt: "Marketplace scene catalog" },
      { src: "scenes.webp", alt: "Marketplace scene catalog" },
    ],
  },
  {
    id: "designer",
    label: "Show Designer",
    images: [
      { src: "surroundshowfire.webp", alt: "Fire effect across a mapped surface" },
      { src: "designerfull.webp", alt: "Show Designer laying out projector panels" },
    ],
  },
] as const;

const SETS = [
  {
    src: "surroundshowwestport.webp",
    alt: "Westport virtual set projected across a stage",
    caption: "Sets come to life",
  },
  {
    src: "surroundshowtheater.webp",
    alt: "Audience facing a fully projected theater set",
    caption: "Immersive audience experience",
  },
  {
    src: "surroundshowfireworks.webp",
    alt: "Fireworks projected as part of a surround show",
    caption: "Complete screen control with the Show Designer",
  },
] as const;

const FAQS = [
  {
    q: "Do I need After Effects ?",
    a: "No.  Mapping is done by laying out panels.  Panels are given assets like images, videos, colors, or gifs.  The panels are lined up using a phone when the projector is out side and on.  No computers or cables are needed.",
  },
  {
    q: "No computers, No cables. Really?",
    a: "Yes.  It works by putting a Google TV stick in the HDMI port and connect to wifi.",
  },
  {
    q: "How many projectors can be used ?",
    a: "As many as needed.  All are connected thru wifi and synchronized.",
  },
  {
    q: "Do you sell projectors ?",
    a: "Surround Show is a software service product, but we do sell certain projectors for some setups, and recommend others.",
  },
  {
    q: "Can I buy and sell shows ?",
    a: "Yes.  There is a marketplace where creators can sell their created shows.",
  },
] as const;

const GALLERY = [
  { src: "davidpumpkins.webp", alt: "David S. Pumpkins show still" },
  { src: "beatsabre2.webp", alt: "Christmas projection still" },
  { src: "strangerthings.webp", alt: "Haunt projection still" },
  { src: "pentatonix.webp", alt: "Pentatonix show still" },
  { src: "lineupandplay2.webp", alt: "Phone lineup and play calibration" },
  { src: "surroundshowfire.webp", alt: "Fire effect still" },
] as const;

function SectionTitle({
  children,
  light,
}: {
  children: string;
  light?: boolean;
}) {
  return (
    <div className="mb-8 text-center sm:mb-12">
      <h2 className={"ss-title" + (light ? " ss-title-light" : "")}>{children}</h2>
    </div>
  );
}

function Picture({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${IMG}/${src}`} alt={alt} className={className} />
  );
}

export function SurroundShowHome() {
  const [slide, setSlide] = useState(0);
  const [showTab, setShowTab] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((n) => (n + 1) % SLIDES.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  const current = SLIDES[slide];
  const tab = SHOW_TABS[showTab];

  return (
    <div className="ss-home -mx-2 md:-mx-4">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Raleway:wght@700;900&display=swap"
      />
      <style>{`
        .ss-home { font-family: Lato, "Segoe UI", sans-serif; color: #e0e0e0; }
        .social-shell.light .ss-home { color: #555555; background: #ffffff; }
        .social-shell.light .ss-home .ss-title { color: #272727; }
        .social-shell.light .ss-home .ss-title-light { color: #ffffff; }
        .ss-home .ss-title {
          display: inline-block;
          position: relative;
          margin: 0;
          padding: 0 8px;
          color: #f4f4f5;
          font-family: Raleway, "Arial Narrow", sans-serif;
          font-size: clamp(26px, 5vw, 48px);
          font-weight: 900;
          letter-spacing: 0.08em;
          line-height: 1;
          text-transform: uppercase;
        }
        .ss-home .ss-title::before,
        .ss-home .ss-title::after {
          content: "";
          position: absolute;
          top: 50%;
          width: 56px;
          margin-top: -2px;
          border-top: 4px double #f7412e;
        }
        .ss-home .ss-title::before { right: 100%; }
        .ss-home .ss-title::after { left: 100%; }
        .ss-home .ss-title-light { color: #fff; }
        .ss-home .ss-title-light::before,
        .ss-home .ss-title-light::after { border-top-color: #212121; }
        @media (max-width: 640px) {
          .ss-home .ss-title::before,
          .ss-home .ss-title::after { display: none; }
        }
        .ss-home .ss-kicker,
        .ss-home .ss-hero-title {
          font-family: Raleway, "Arial Narrow", sans-serif;
          font-weight: 900;
          text-transform: uppercase;
          text-shadow: 0 2px 16px rgba(0,0,0,0.45);
        }
      `}</style>

      <section
        className="relative h-[350px] overflow-hidden sm:h-[500px]"
        aria-roledescription="carousel"
        aria-label="Surround Show highlights"
      >
        {SLIDES.map((item, i) => (
          <div
            key={item.image + item.title}
            className={
              "absolute inset-0 bg-cover bg-center transition-opacity duration-700 " +
              (i === slide ? "opacity-100" : "opacity-0")
            }
            style={{ backgroundImage: `url(${IMG}/${item.image})` }}
            aria-hidden={i !== slide}
          >
            <div className="absolute inset-0 bg-black/70" />
          </div>
        ))}
        <div className="relative flex h-full flex-col items-center justify-center px-16 text-center text-white sm:px-24">
          <p className="ss-kicker text-sm tracking-[0.16em] sm:text-3xl sm:tracking-[0.12em]">
            {current.kicker}
          </p>
          <h1 className="ss-hero-title mt-2 text-2xl leading-tight tracking-[0.08em] sm:text-5xl sm:tracking-[0.16em]">
            {current.title}
          </h1>
        </div>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {SLIDES.map((item, i) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Show ${item.title}`}
              onClick={() => setSlide(i)}
              className={
                "h-2.5 w-2.5 rounded-full border border-white " +
                (i === slide ? "bg-white" : "bg-white/30")
              }
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSlide((n) => (n - 1 + SLIDES.length) % SLIDES.length)}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-white/70 px-3 py-1 text-xs font-semibold tracking-[0.35em] text-white/80 hover:text-white sm:left-4 sm:px-4 sm:text-sm"
          aria-label="Previous slide"
        >
          PREV
        </button>
        <button
          type="button"
          onClick={() => setSlide((n) => (n + 1) % SLIDES.length)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-white/70 px-3 py-1 text-xs font-semibold tracking-[0.35em] text-white/80 hover:text-white sm:right-4 sm:px-4 sm:text-sm"
          aria-label="Next slide"
        >
          NEXT
        </button>
      </section>

      <section id="about" className="px-4 py-10 sm:px-8 sm:py-14">
        <SectionTitle>Surround Show</SectionTitle>
        <div className="mx-auto max-w-3xl text-center">
          <h3 className="text-lg font-bold leading-relaxed sm:text-xl">
            Projection Mapping for Multi-Projector Shows
          </h3>
          <h3 className="mt-4 text-lg font-bold leading-relaxed sm:text-xl">
            No &apos;After Effects&apos;, No Computers, No Cables
          </h3>
          <p className="mt-6 text-base font-bold leading-relaxed">
            Digital decorate your haunted house, Christmas attraction, theme park,
            whole house, or entire cul-de-sac.
          </p>
          <p className="mt-4 text-base font-bold leading-relaxed">
            Create engaging digital sets for you theater company&apos;s productions,
            or energize your wedding or music venue.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl">
          <h4 className="text-sm font-bold tracking-wide">
            IMMERSIVE SURROUND SHOWS
          </h4>
          <p className="mt-4 leading-relaxed">
            Surround Show is projection mapping using videos, audio, gifs, and
            images. Shows can be displayed across multiple projectors, with no
            need for computers and cables.
          </p>
          <p className="mt-4 leading-relaxed">
            Put a Google TV stick in the HDMI port, and do the whole cul de sac,
            entire haunted house, or full theater stage.
          </p>
          <Picture
            src="beatsabre2.webp"
            alt={SLIDES[3].alt}
            className="mx-auto mt-8 max-h-[300px] w-auto"
          />
        </div>
      </section>

      <section id="shows" className="bg-[#d64332] px-4 py-10 text-white sm:px-8 sm:py-14">
        <SectionTitle light>Shows</SectionTitle>
        <div className="mx-auto max-w-3xl text-center">
          <h3 className="text-lg font-bold sm:text-xl">Your show will be the highlight</h3>
          <p className="mt-4 font-bold leading-relaxed">
            Whether its your haunted house, or Christmas decorating, Surround Show
            and you will make the celebration amazing.
          </p>
          <p className="mt-4 font-bold leading-relaxed">
            What a great way to make great memories with family and friends!
          </p>
        </div>
        <div
          className="mt-8 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Show categories"
        >
          {SHOW_TABS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === showTab}
              onClick={() => setShowTab(i)}
              className={
                "border-2 px-3 py-1 text-sm font-bold uppercase tracking-[0.12em] " +
                (i === showTab
                  ? "border-[#272727] text-[#272727]"
                  : "border-white text-white hover:text-[#272727]")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-6" role="tabpanel">
          {tab.images.map((image, i) => (
            <Picture
              key={tab.id + image.src + i}
              src={image.src}
              alt={image.alt}
              className="max-h-[300px] w-auto"
            />
          ))}
        </div>
      </section>

      <section id="sets" className="px-4 py-10 sm:px-8 sm:py-14">
        <SectionTitle>Virtual Sets</SectionTitle>
        <div className="mx-auto max-w-3xl text-center">
          <h3 className="text-lg font-bold sm:text-xl">
            Your show will be the talk of the town
          </h3>
          <p className="mt-4 font-bold leading-relaxed">
            You can make your production shine.
          </p>
          <p className="mt-4 font-bold leading-relaxed">
            No need to construct extravagant sets, when you&apos;ll be able to make
            amazing panoramas!
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-3xl space-y-12">
          {SETS.map((set) => (
            <figure key={set.caption} className="text-center">
              <Picture src={set.src} alt={set.alt} className="mx-auto max-h-[300px] w-auto" />
              <figcaption className="mt-6 text-lg font-black uppercase tracking-wide text-[#d64332]">
                {set.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="blog" className="px-4 py-10 sm:px-8 sm:py-14">
        <SectionTitle>Blog</SectionTitle>
        <article className="mx-auto max-w-3xl text-center">
          <Picture
            src="hauntedhouse.webp"
            alt="Haunted house ready for projection mapping"
            className="mx-auto w-full"
          />
          <h3 className="mt-6 text-lg font-black uppercase tracking-wide text-[#d64332]">
            Surround Show for your haunted house
          </h3>
          <div className="mt-4 space-y-4 text-left leading-relaxed">
            <p>
              Using a projector in a haunted house can be a great way to create
              spooky and immersive visual effects. Here are three possible ways to
              use a projector in a haunted house:
            </p>
            <p>
              Create Ghostly Apparitions: You can use a projector to project
              ghostly images onto a wall, a sheet, or even a smoke screen. There
              are many pre-made digital projections available for purchase online
              that you can use, or you can create your own using a photo or video
              editing software.
            </p>
            <p>
              Add Ambient Lighting: Another great way to use a projector in a
              haunted house is to use it to project eerie lighting effects onto
              the walls or floors. This can be done by using a colored gel or
              slide to cover the projector lens or by using a video file that has
              been specifically designed for this purpose.
            </p>
            <p>
              Create a Horror Movie Experience: You can also use a projector to
              play horror movies or short clips on a large screen or wall. This
              can add an extra layer of suspense and fright to your haunted house
              experience. Make sure to choose movies or clips that are appropriate
              for your audience and that fit the theme of your haunted house.
            </p>
          </div>
        </article>
        <article className="mx-auto mt-14 max-w-3xl text-center">
          <Picture
            src="lineupandplay.webp"
            alt="Lining up a projector panel with a phone"
            className="mx-auto w-full"
          />
          <h3 className="mt-6 text-lg font-black uppercase tracking-wide text-[#d64332]">
            What is the Surround Show Tech ?
          </h3>
          <div className="mt-4 space-y-4 text-left leading-relaxed">
            <p>
              You put an Google TV stick into the projector HDMI port. It is
              connected to wifi. You download the Homeshow Screen app.
            </p>
            <p>
              Multiple projectors can be snyced, so that the entire culdesac, or
              haunt, or Christmas drive thru can participate in the show.
            </p>
            <p>
              Images and videos are defined as effects for a panel(garage door,
              window, column, etc), and Panels can be lined up by standing in
              front and moving/calibrating them with your phone.
            </p>
            <p>
              One person can make a scene,and another customer can line it up on
              their house and play it.
            </p>
            <p>
              The scenes uses images, gifs, and streamed YouTube videos coming
              over wifi.
            </p>
            <p>
              People can make multi/single projector scenes and put them in the
              marketplace for others to purchase.
            </p>
          </div>
        </article>
      </section>

      <section id="faqs" className="bg-[#d64332] px-4 py-10 sm:px-8 sm:py-14">
        <SectionTitle light>Faqs</SectionTitle>
        <div className="mx-auto max-w-3xl space-y-4">
          {FAQS.map((faq, i) => {
            const open = openFaq === i;
            return (
              <div
                key={faq.q}
                className="shadow-[0_0_20px_rgba(0,0,0,0.25)]"
                style={{ backgroundColor: "#ffffff", color: "#272727" }}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    className={
                      "flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-bold uppercase tracking-wide sm:text-base " +
                      (open ? "bg-[#272727] text-white" : "bg-[#ffffff] text-[#272727]")
                    }
                  >
                    {faq.q}
                    <span aria-hidden className={open ? "rotate-180" : ""}>
                      ▾
                    </span>
                  </button>
                </h3>
                {open && <p className="px-4 py-4 text-sm leading-relaxed sm:text-base">{faq.a}</p>}
              </div>
            );
          })}
        </div>
        <Picture
          src="surroundshowfire.webp"
          alt="Fire effect across a mapped surface"
          className="mx-auto mt-8 max-h-[360px] w-auto"
        />
      </section>

      <section id="gallery" className="px-4 py-10 sm:px-8 sm:py-12">
        <SectionTitle>Gallery</SectionTitle>
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
          {GALLERY.map((item) => (
            <a
              key={item.src + item.alt}
              href={`${IMG}/${item.src}`}
              className="flex items-center justify-center border border-[#ddd] p-3 transition hover:bg-[#d64332] hover:shadow-[0_0_20px_rgba(0,0,0,0.25)]"
            >
              <Picture src={item.src} alt={item.alt} className="max-h-[170px] w-auto" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
