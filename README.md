# LinkAll Platform

Modern rebuild of the LinkAll8 multi-tenant ASP.NET application as a **hybrid monorepo**: shared libraries/packages + one application per brand, instead of a single multitenant codebase or three fully separate ones.

| Brand | Legacy identity | Web app | Port |
|---|---|---|---|
| **SurroundShow** | SiteId 1 — holiday shows + marketplace | `apps/surroundshow-web` | 3001 |
| **FunFirst** | SiteId 2 — Laffupalunga/Laffup + Comedy Loco, HeadCase, WWCCE, Clubtrotters | `apps/funfirst-web` | 3002 |

Plus one Expo mobile app (`apps/mobile`) that serves any brand via an env var. RedWave web now lives in its own repo (`microspaces/redwave`).

## Architecture

```
linkall-platform/
├── packages/
│   ├── backend/    @linkall/backend  – ONE shared Convex schema + functions.
│   │                                   Each brand gets its OWN deployment.
│   ├── brands/     @linkall/brands   – Brand registry: names, colors, nav,
│   │                                   feature flags. Single source of truth.
│   └── ui/         @linkall/ui       – Shared React (web) feature components:
│                                       feed, groups, shows, market, events,
│                                       resources, people, app shell.
└── apps/
    ├── surroundshow-web/   Next.js 15 (thin: pages wire up shared components)
    ├── funfirst-web/       Next.js 15
    └── mobile/             Expo (expo-router), brand chosen by EXPO_PUBLIC_BRAND
```

### How the hybrid model replaces the old multitenancy

| Legacy mechanism | Replacement |
|---|---|
| `SiteId` column + domain→site resolution middleware | Each brand = its own Convex deployment. No tenant filtering anywhere in code. |
| Site groups (sites 1+2 shared users, site 3 isolated) | Deployments are isolated by default. If SurroundShow+FunFirst should share users again, point both apps at one deployment. |
| Per-site cookie schemes (`LinkAuth_Site1/2/3`) | Auth is per-deployment by construction (see Auth below). |
| SignalR `DisplayHub` scene sync (player/screen/designer) | Convex reactive queries — `shows.setScene` mutation updates every subscribed player/screen instantly. Try one show page in two tabs. |
| Comment table (group chat, profile chat, feed) | `posts` table with replies + upvotes, live-updating. |
| Ω-prefixed state/county groups | `groups.kind = "state" | "county"` with proper `state`/`county` fields. |
| Layout JSON engine (`designer.json`, `player.json`, …) | Typed schema (`shows`/`scenes`) + real React components. |
| Views/{Tenant} + per-tenant CSS | `@linkall/brands` config + per-app Tailwind `@theme` tokens; shared components read the brand from context. |

## Prerequisites

- Node 20+ ([nodejs.org](https://nodejs.org))
- pnpm 9+ (`corepack enable` or `npm i -g pnpm`)
- A free [Convex](https://convex.dev) account (for the SurroundShow and FunFirst deployments)

## Setup

```powershell
cd linkall-platform
pnpm install
```

### Option A: Run fully locally, no Convex account (fastest)

`packages/backend/deployments/<brand>/` are thin wrapper projects that share the
same `convex/` schema and functions but each own an **anonymous local Convex
deployment** (data stored in that folder's `.convex/`, no login needed).

Start one backend per brand (each is a long-running watcher):

```powershell
# from packages/backend/deployments/<brand>, one terminal each:
$env:CONVEX_AGENT_MODE='anonymous'; npx convex dev
# surroundshow → http://127.0.0.1:3212
# funfirst     → http://127.0.0.1:3214
```

Seed each one (also from its wrapper folder):

```powershell
npx convex run seed:surroundshow   # in deployments/surroundshow
npx convex run seed:funfirst       # in deployments/funfirst
```

Each web app's `.env.local` points `NEXT_PUBLIC_CONVEX_URL` at the matching
port above. Then run the web apps (step 4 below). To later move a local
deployment into a real Convex project, run `npx convex login` in the wrapper
folder and follow the link prompts.

### Option B: Cloud deployments (Convex account)

### 1. Create the Convex deployments

Each brand gets its own Convex project. From `packages/backend`, run once per brand (each command walks you through creating/selecting a project, pushes the schema and functions, runs codegen, and writes the deployment name into the env file):

```powershell
cd packages/backend
npx convex dev --env-file .env.surroundshow --once
npx convex dev --env-file .env.funfirst --once
```

> If your Convex CLI version doesn't support `--env-file`, copy the relevant
> `.env.<brand>` to `.env.local` before each command instead.

During development, keep a watcher running for whichever brand you're working on:

```powershell
pnpm dev:funfirst   # from packages/backend → convex dev --env-file .env.funfirst
```

### 2. Seed mock data

```powershell
pnpm --filter @linkall/backend seed:surroundshow
pnpm --filter @linkall/backend seed:funfirst
# Additive (does not wipe): copy Battle Loco + HyperX screens into FunFirst
pnpm --filter @linkall/backend seed:battleLoco
```

Seeding clears the deployment and inserts brand-appropriate users, groups, posts, and shows/products/events/resources. When you're ready to import real data (your groups export), replace the arrays in `packages/backend/convex/seed.ts` or write an import script against the same mutations.

### 3. Point each web app at its deployment

Copy each app's `.env.local.example` to `.env.local` and set the deployment URL (shown by `convex dev`, looks like `https://<name>.convex.cloud`):

```
apps/surroundshow-web/.env.local → NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
apps/funfirst-web/.env.local     → NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
```

### 4. Run the web apps

```powershell
pnpm dev                 # both web apps via turbo
pnpm dev:funfirst        # or just one
```

- SurroundShow → http://localhost:3001
- FunFirst → http://localhost:3002

### 5. Run the mobile app

```powershell
cd apps/mobile
copy .env.example .env    # set EXPO_PUBLIC_BRAND and EXPO_PUBLIC_CONVEX_URL
npx expo install --fix    # aligns native package versions with your SDK
pnpm start                # then press a / i / w, or scan with Expo Go
```

Change `EXPO_PUBLIC_BRAND` (and the matching URL) and restart to run the app as a different brand — theme, nav and home content follow the brand registry.

## What's implemented

- **All brands**: landing page, groups (join/leave, member list, group wall), community feed (posts, replies, upvotes — all real-time), people directory, demo-user switcher.
- **SurroundShow**: show list + live show player (scene engine), marketplace with cart, and the **show designer** (`/designer`): Shows tab with Show | Scene | Effect drill-down grids, multi-screen preview with Play, and a per-panel timeline; Screens tab with Layout | Screen | Panel grids and a drag-the-corners polygon panel editor; **Profiles** tab for display profiles (logical→physical panel mapping, defaults, non-destructive apply). Panel-based scenes render in the live player with effects appearing at their start times (legacy Show → Scene → Effect(Panel) + Layout → Screen → Panel + DisplayProfile → PanelMapping model).
- **Player + Screen output** (legacy mobile Player page + projector Screen page): `/player` is the compact operator console — tap a scene on the Shows tab to push it live to every output; tap a panel on the Screens tab to put the physical output into calibration mode (flat colors + numbered corners) and nudge the whole panel / a corner / a side with arrow controls. `/screens/<id>` is the chrome-less page a projector or LED wall displays; it follows scene taps, panel nudges and alignment toggles through one reactive Convex query (this replaces the SignalR DisplayHub messages).
- **FunFirst**: shows filtered by stage (Comedy Loco / HeadCase / WWCCE / LaffUp / Battle Loco), live player with scoreboard scenes, HyperX Arena three-LED Battle Loco show, events with ticket purchase.
- **RedWave**: hierarchical resource library with breadcrumbs, state hub pages, state/county groups. Flag any post or reply as a solution and filter the feed to those threads.
- **Live show sync demo**: open a live show in two windows and use the operator controls — every viewer follows instantly (this replaces the SignalR DisplayHub).

## Auth (deliberate placeholder)

The legacy system's most complex feature — same email with different passwords per site — dissolves under this architecture: each brand's deployment has its own user table, period. For now the apps use a **demo-user switcher** (`useCurrentUser()`), which is exactly what you want while testing with mock data. When ready, swap in [Convex Auth](https://labs.convex.dev/auth) or Clerk inside `packages/ui/src/current-user.tsx` and `apps/mobile/src/current-user.tsx`; consumers only use the `useCurrentUser()` hook, so nothing else changes.

## Not yet ported (roadmap)

- Media upload for effects (currently effects reference image/video URLs).
- Notifications UI (table + queries exist), WebRTC video calls, direct messages.
- Payments/checkout (cart is demo-only), affiliates/referrals, admin back-office.
- Vetting surveys and precinct blueprint/committee tools (RedWave) — model these as `resources` or a new table when priorities are set.
- ZIP-code auto-join to state/county groups on registration (needs auth first).
