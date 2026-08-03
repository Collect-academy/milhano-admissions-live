"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="error-page">
      <div className="error-card">
        <p className="eyebrow">Milhano Dashboard</p>
        <h1>Unable to load the information</h1>
        <p>{error.message}</p>
        <button type="button" onClick={reset}>
          Try Again
        </button>
      </div>
    </main>
  );
}
