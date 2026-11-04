"use client";

export default function PageError({ reset }: { reset: () => void }) {
  return (
    <main className="page">
      <section className="articles" role="alert">
        <h1>Não foi possível carregar esta página.</h1>
        <p>Tente novamente em alguns instantes.</p>
        <button type="button" onClick={reset}>Tentar novamente</button>
      </section>
    </main>
  );
}
