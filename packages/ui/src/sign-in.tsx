"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useBrand } from "./brand-context";
import { useCurrentUser } from "./current-user";

type Step = "email" | "check-email" | "verify";

export function SignInPage({ mode = "signin" }: { mode?: "signin" | "verify" }) {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInPageInner mode={mode} />
    </Suspense>
  );
}

function humanizeAuthError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : "";
  if (/fetch failed|Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "Could not reach the auth service. Make sure this brand's Convex backend is running with Convex Auth configured.";
  }
  return message || fallback;
}

function SignInFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
      Loading…
    </div>
  );
}

function SignInPageInner({ mode = "signin" }: { mode?: "signin" | "verify" }) {
  const brand = useBrand();
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { user } = useCurrentUser();

  const token = params.get("token") ?? params.get("code") ?? "";
  const emailFromUrl = params.get("email") ?? "";
  const sentEmail = params.get("sent") ?? "";

  const initialStep: Step = useMemo(() => {
    if (mode === "verify" || token) return "verify";
    if (sentEmail) return "check-email";
    return "email";
  }, [mode, token, sentEmail]);

  const [step, setStep] = useState<Step>(initialStep);
  const [email, setEmail] = useState(emailFromUrl || sentEmail);
  const [code, setCode] = useState(token);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuthActions();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace("/");
    }
  }, [isAuthenticated, isLoading, user, router]);

  const sendLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await signIn("email", {
        email: trimmed,
        redirectTo: "/signin/verify",
      });
      setEmail(trimmed);
      setStep("check-email");
      router.replace(`/signin?sent=${encodeURIComponent(trimmed)}`);
    } catch (err) {
      setError(humanizeAuthError(err, "Could not send a sign-in link."));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();
    if (!trimmedEmail || !trimmedCode) {
      setError("Email and code are both required.");
      return;
    }
    setBusy(true);
    try {
      const result = await signIn("email", {
        email: trimmedEmail,
        code: trimmedCode,
      });
      if (!result.signingIn) {
        setError("That code did not work. Request a new link and try again.");
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(humanizeAuthError(err, "Could not verify that code."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              {brand.name[0]}
            </span>
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              {brand.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {step === "email" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
              <p className="mt-2 text-sm text-gray-500">
                We&apos;ll email you a magic link. No password needed.
              </p>
              <form onSubmit={sendLink} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Email
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    placeholder="you@example.com"
                  />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send magic link"}
                </button>
              </form>
            </>
          )}

          {step === "check-email" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
              <p className="mt-2 text-sm text-gray-500">
                We sent a magic link to{" "}
                <span className="font-medium text-gray-800">{email}</span>. Open
                it on this device, or enter the 8-digit code from the email.
              </p>
              <form onSubmit={verifyCode} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  One-time code
                  <input
                    type="text"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 tracking-[0.3em] text-gray-900"
                    placeholder="12345678"
                  />
                </label>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {busy ? "Signing in…" : "Sign in with code"}
                </button>
                <button
                  type="button"
                  className="w-full text-sm text-gray-500 hover:text-gray-800"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    router.replace("/signin");
                  }}
                >
                  Use a different email
                </button>
              </form>
            </>
          )}

          {step === "verify" && (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Confirm sign-in</h1>
              <p className="mt-2 text-sm text-gray-500">
                Continue as{" "}
                <span className="font-medium text-gray-800">
                  {email || "this email"}
                </span>
                ? Confirming signs you in on this device.
              </p>
              <form onSubmit={verifyCode} className="mt-6 space-y-4">
                {!emailFromUrl && (
                  <label className="block text-sm font-medium text-gray-700">
                    Email
                    <input
                      type="email"
                      name="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                    />
                  </label>
                )}
                {!token && (
                  <label className="block text-sm font-medium text-gray-700">
                    One-time code
                    <input
                      type="text"
                      name="code"
                      inputMode="numeric"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 tracking-[0.3em] text-gray-900"
                    />
                  </label>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={busy || !email || !code}
                  className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {busy ? "Signing in…" : "Continue"}
                </button>
                <Link
                  href="/signin"
                  className="block text-center text-sm text-gray-500 hover:text-gray-800"
                >
                  Request a new link
                </Link>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
