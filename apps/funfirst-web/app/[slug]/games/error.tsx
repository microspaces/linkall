"use client";

export default function GamesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6">
      <p className="font-semibold text-red-800">Games catalog failed to load.</p>
      <p className="mt-2 text-sm text-red-700">
        {error.message || "The FunFirst game functions may not be deployed yet."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Retry
      </button>
    </div>
  );
}
