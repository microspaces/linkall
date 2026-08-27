"use client";

import Link from "next/link";
import { locoPaths, LOCOS } from "@linkall/backend/convex/locos";
import { useBrand } from "./brand-context";
import { useCurrentUser } from "./current-user";

export function Landing() {
  const brand = useBrand();
  const { user } = useCurrentUser();

  const featureCards = [
    brand.features.shows && {
      href: "/shows",
      title: "Live Shows",
      body: "Design shows scene by scene, go live, and every connected screen follows in real time.",
    },
    LOCOS.some((l) => l.brand === brand.id) && {
      href: "/locos",
      title:
        brand.id === "surroundshow"
          ? "HomeShow, Ceremony, Reception & Bar Loco"
          : "Locos",
      body:
        brand.id === "surroundshow"
          ? "Holiday house bits, a chapel ceremony set list, a DJ reception set list, and the pop-up bar night."
          : "Competitions and set lists — open a format to run its performances.",
    },
    brand.features.marketplace && {
      href: "/market",
      title: "Marketplace",
      body: "Shop ready-made scenes, loops and effect packs from other creators.",
    },
    brand.features.events && {
      href: "/events",
      title: "Events & Tickets",
      body: "Grab tickets to live nights before they sell out.",
    },
    brand.features.venueService && {
      href: "/venue",
      title: "Venue service",
      body: "Seats and booths, phones and tablets, tickets on the bar iPad. Toggle each device class per night.",
    },
    brand.features.resources && {
      href: "/resources",
      title: "Resource Library",
      body: "Playbooks, guides and scorecards, organized so your team can act on them.",
    },
    brand.features.states && {
      href: "/states",
      title: "State & County Groups",
      body: "Find your state and county hub and plug into local organizing.",
    },
    {
      href: "/groups",
      title: "Groups",
      body: "Join communities, post to the wall and keep up with members.",
    },
    {
      href: "/feed",
      title: "Community Feed",
      body: "The whole community in one stream — post, reply and upvote.",
    },
  ].filter(Boolean) as { href: string; title: string; body: string }[];

  return (
    <div>
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark px-8 py-16 text-white">
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          {brand.tagline}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-white/80">{brand.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={brand.nav[0].href}
            className="rounded-lg bg-[#fff] px-5 py-2.5 font-semibold text-brand-dark hover:bg-[#f4f4f5]"
          >
            Explore {brand.nav[0].label}
          </Link>
          <Link
            href="/groups"
            className="rounded-lg border border-white/40 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
          >
            Browse Groups
          </Link>
          {!user && (
            <Link
              href="/signin"
              className="rounded-lg border border-white/40 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
            >
              Sign in
            </Link>
          )}
        </div>
      </section>

      {brand.showTags.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {brand.features.shows ? "Our stages" : "Categories"}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {brand.showTags.map((t, i) => {
              const loco = LOCOS.find((l) => l.tag === t.tag);
              return (
                <Link
                  key={`${t.tag}-${i}`}
                  href={loco ? locoPaths(loco.slug).home : `/shows?tag=${t.tag}`}
                  className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <h3 className="font-semibold text-brand-dark">{t.label}</h3>
                  <p className="mt-1 text-sm text-gray-500">{t.blurb}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Everything here</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <Link
              key={card.href + card.title}
              href={card.href}
              className="rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <h3 className="font-semibold text-gray-900">{card.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{card.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
