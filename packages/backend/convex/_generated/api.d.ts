/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as christmasMikeData from "../christmasMikeData.js";
import type * as designer from "../designer.js";
import type * as events from "../events.js";
import type * as game from "../game.js";
import type * as groups from "../groups.js";
import type * as importLegacy from "../importLegacy.js";
import type * as locos from "../locos.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as products from "../products.js";
import type * as resources from "../resources.js";
import type * as seed from "../seed.js";
import type * as shows from "../shows.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  christmasMikeData: typeof christmasMikeData;
  designer: typeof designer;
  events: typeof events;
  game: typeof game;
  groups: typeof groups;
  importLegacy: typeof importLegacy;
  locos: typeof locos;
  notifications: typeof notifications;
  posts: typeof posts;
  products: typeof products;
  resources: typeof resources;
  seed: typeof seed;
  shows: typeof shows;
  users: typeof users;
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
