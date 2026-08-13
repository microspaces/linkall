"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@linkall/backend/convex/_generated/api";
import {
  getLocoBySlug,
  locoPaths,
  locoRoundTypes,
  rowTag,
} from "@linkall/backend/convex/locos";
import { EmptyState, Loading } from "./empty-state";

/**
 * Games catalog for one loco. Performance rounds pick from here so the
 * console knows the game type, description, and how to score.
 */
export function GameCatalog({ slug = "comedy-loco" }: { slug?: string }) {
  const loco = getLocoBySlug(slug);
  const paths = locoPaths(slug);
  const all = useQuery(api.game.listCatalog, {});
  const games = all?.filter((g) => rowTag(g.tag) === loco?.tag);
  const seed = useMutation(api.game.seedCatalog);
  const create = useMutation(api.game.createCatalogGame);
  const roundTypes = loco ? locoRoundTypes(loco) : [];
  const [name, setName] = useState("");
  const [roundType, setRoundType] = useState(roundTypes[1] ?? roundTypes[0] ?? "");
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState("");

  useEffect(() => {
    if (loco && games && games.length === 0) void seed({ tag: loco.tag });
  }, [games, seed, loco]);

  useEffect(() => {
    if (roundTypes.length && !roundTypes.includes(roundType)) {
      setRoundType(roundTypes[1] ?? roundTypes[0] ?? "");
    }
  }, [roundTypes, roundType]);

  if (!loco) {
    return (
      <div>
        <EmptyState
          title="Unknown loco"
          hint="That show format isn't in the registry yet."
        />
        <Link
          href={paths.hub}
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          ← Locos
        </Link>
      </div>
    );
  }

  if (games === undefined) return <Loading />;

  const grouped = new Map<string, typeof games>();
  for (const g of games) {
    const list = grouped.get(g.roundType) ?? [];
    list.push(g);
    grouped.set(g.roundType, list);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={paths.hub}
          className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-brand"
        >
          Locos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{loco.name} games</h1>
        <Link
          href={paths.performances}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Performances
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-500">{loco.catalogHint}</p>

      <form
        className="mt-4 grid gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          void create({
            name,
            roundType,
            description: description || undefined,
            suggestions: suggestions || undefined,
            tag: loco.tag,
          });
          setName("");
          setDescription("");
          setSuggestions("");
        }}
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Name
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={loco.catalog[0]?.name ?? "Game name"}
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Round type
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            value={roundType}
            onChange={(e) => setRoundType(e.target.value)}
          >
            {roundTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:col-span-2">
          Description
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="How the game is played"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:col-span-2">
          Suggestions / ask
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
            placeholder="A job, a place"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 sm:col-span-2"
        >
          Add game
        </button>
      </form>

      {games.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No games yet"
            hint="Add a game, or wait for the default catalog to seed."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {[...grouped.entries()].map(([type, rows]) => (
            <div key={type}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {type}
              </h2>
              <div className="space-y-2">
                {rows.map((g) => (
                  <div
                    key={g._id}
                    className="rounded-xl border border-gray-200 bg-white p-4"
                  >
                    <h3 className="font-semibold text-gray-900">{g.name}</h3>
                    {g.description && (
                      <p className="mt-1 text-sm text-gray-600">{g.description}</p>
                    )}
                    {g.suggestions && (
                      <p className="mt-1 text-xs text-gray-400">
                        Ask: {g.suggestions}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
