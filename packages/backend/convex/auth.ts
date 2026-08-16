import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { joinPublicAndHomeGroups } from "./importLinkAll8";
import { MagicLink } from "./emailProvider";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [MagicLink],
  callbacks: {
    async createOrUpdateUser(rawCtx, args) {
      const ctx = rawCtx as MutationCtx;
      const email = normalizeEmail(args.profile.email);
      const image =
        typeof args.profile.image === "string" ? args.profile.image : undefined;
      const profileName =
        typeof args.profile.name === "string" ? args.profile.name.trim() : "";

      if (args.existingUserId) {
        await patchAuthFields(ctx, args.existingUserId, {
          email,
          image,
          name: profileName,
        });
        return args.existingUserId;
      }

      if (email) {
        const existing = await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .first();
        if (existing) {
          await patchAuthFields(ctx, existing._id, {
            email,
            image,
            name: profileName,
          });
          await joinPublicAndHomeGroups(ctx, existing._id);
          return existing._id;
        }
      }

      const name = profileName || nameFromEmail(email);
      const handle = await uniqueHandle(ctx, handleFromEmail(email));
      const userId = await ctx.db.insert("users", {
        name,
        handle,
        email: email || undefined,
        emailVerificationTime: email ? Date.now() : undefined,
        image,
        avatarUrl: image,
        tier: "free",
      });
      await joinPublicAndHomeGroups(ctx, userId);
      return userId;
    },
  },
});

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "New member";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function handleFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return local || "user";
}

async function uniqueHandle(
  ctx: MutationCtx,
  base: string,
): Promise<string> {
  let handle = base;
  let n = 0;
  while (
    await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .unique()
  ) {
    n += 1;
    handle = `${base}${n}`;
  }
  return handle;
}

async function patchAuthFields(
  ctx: MutationCtx,
  userId: Id<"users">,
  fields: { email: string; image?: string; name: string },
) {
  const user = await ctx.db.get(userId);
  if (!user) return;
  const patch: {
    email?: string;
    emailVerificationTime?: number;
    image?: string;
    avatarUrl?: string;
  } = {};
  if (fields.email && user.email !== fields.email) {
    patch.email = fields.email;
  }
  if (fields.email) {
    patch.emailVerificationTime = Date.now();
  }
  if (fields.image && !user.avatarUrl) {
    patch.image = fields.image;
    patch.avatarUrl = fields.image;
  }
  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(userId, patch);
  }
}
