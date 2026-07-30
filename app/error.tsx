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
        <h1>No se pudo cargar la información</h1>
        <p>{error.message}</p>
        <button type="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
