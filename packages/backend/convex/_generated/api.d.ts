/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as barlocoHolidays from "../barlocoHolidays.js";
import type * as battlelocoLuxor from "../battlelocoLuxor.js";
import type * as camera from "../camera.js";
import type * as christmasMikeData from "../christmasMikeData.js";
import type * as comedylocoLuxor from "../comedylocoLuxor.js";
import type * as designer from "../designer.js";
import type * as emailProvider from "../emailProvider.js";
import type * as events from "../events.js";
import type * as game from "../game.js";
import type * as geo from "../geo.js";
import type * as groups from "../groups.js";
import type * as headcaseBits from "../headcaseBits.js";
import type * as headcaseBitsData from "../headcaseBitsData.js";
import type * as http from "../http.js";
import type * as importLegacy from "../importLegacy.js";
import type * as importLinkAll8 from "../importLinkAll8.js";
import type * as locos from "../locos.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as products from "../products.js";
import type * as resources from "../resources.js";
import type * as rossRig from "../rossRig.js";
import type * as sceneCommands from "../sceneCommands.js";
import type * as sceneCues from "../sceneCues.js";
import type * as seed from "../seed.js";
import type * as shows from "../shows.js";
import type * as users from "../users.js";
import type * as venue from "../venue.js";
import type * as venueLogic from "../venueLogic.js";
import type * as wrestlelocoLuxor from "../wrestlelocoLuxor.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  barlocoHolidays: typeof barlocoHolidays;
  battlelocoLuxor: typeof battlelocoLuxor;
  camera: typeof camera;
  christmasMikeData: typeof christmasMikeData;
  comedylocoLuxor: typeof comedylocoLuxor;
  designer: typeof designer;
  emailProvider: typeof emailProvider;
  events: typeof events;
  game: typeof game;
  geo: typeof geo;
  groups: typeof groups;
  headcaseBits: typeof headcaseBits;
  headcaseBitsData: typeof headcaseBitsData;
  http: typeof http;
  importLegacy: typeof importLegacy;
  importLinkAll8: typeof importLinkAll8;
  locos: typeof locos;
  notifications: typeof notifications;
  posts: typeof posts;
  products: typeof products;
  resources: typeof resources;
  rossRig: typeof rossRig;
  sceneCommands: typeof sceneCommands;
  sceneCues: typeof sceneCues;
  seed: typeof seed;
  shows: typeof shows;
  users: typeof users;
  venue: typeof venue;
  venueLogic: typeof venueLogic;
  wrestlelocoLuxor: typeof wrestlelocoLuxor;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
