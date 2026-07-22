import { brands, getBrand, type Brand } from "@linkall/brands";

/**
 * One Expo codebase serves all three brands. The brand is chosen at start
 * time via EXPO_PUBLIC_BRAND (surroundshow | funfirst | redwave); pair it
 * with that brand's EXPO_PUBLIC_CONVEX_URL.
 */
export const brand: Brand = (() => {
  const id = process.env.EXPO_PUBLIC_BRAND;
  try {
    return getBrand(id);
  } catch {
    return brands.funfirst;
  }
})();
