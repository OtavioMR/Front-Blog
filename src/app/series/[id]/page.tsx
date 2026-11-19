import Link from "next/link";
import { notFound } from "next/navigation";
import CoverImage from "@/app/_components/cover-image";
import BackButton from "@/app/_components/back-button";
import { publicCoverPath } from "@/lib/public-post";
import styles from "./series.module.css";

type Chapter = { id: string; slug: string; title: string; excerpt: string; coverImage: string | null; position: number; contentRating: string };
type Series = { title: string; description: string; coverImage: string | null; contentRating: string; posts: Chapter[]; author?: { name: string } };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const response = await fetch(`${process.env.API_ORIGIN || "http://localhost:3001"}/api/v1/series/${id}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("Não foi possível carregar a série.");
  const value: unknown = await response.json();
  if (!record(value) || typeof value.title !== "string" || typeof value.description !== "string" || !(value.coverImage === null || typeof value.coverImage === "string") || !Array.isArray(value.posts) || !value.posts.every((p: unknown) => record(p) && typeof p.id === "string" && uuid.test(p.id) && typeof p.slug === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug) && typeof p.title === "string" && typeof p.excerpt === "string" && (p.coverImage === null || typeof p.coverImage === "string") && Number.isInteger(p.position))) throw new Error("Resposta de série inválida.");
  const series = value as Series;
  const cover = publicCoverPath(series.coverImage) ?? series.posts.map(post => publicCoverPath(post.coverImage)).find(Boolean) ?? null;
  const synopsis = series.description.trim();

  return (
    <main className={styles.page}>
      <BackButton fallback="/" />

      <div className={cover ? `${styles.overview} ${styles.withCover}` : styles.overview}>
        {cover && <CoverImage src={cover} className={styles.seriesCover} blurredBackdrop />}
        <header className={styles.heading}>
          <p className={styles.eyebrow}>Série{series.contentRating === "18+" && " · 18+"}</p>
          <h1 className={styles.title}>{series.title}</h1>
          {series.author?.name && <p className={styles.byline}>Por {series.author.name}</p>}
          <p className={styles.chapterCount}>
            {series.posts.length} {series.posts.length === 1 ? "capítulo publicado" : "capítulos publicados"}
          </p>
        </header>

        {synopsis && (
          <section className={styles.synopsis} aria-labelledby="sinopse">
            <h2 className={styles.synopsisHeading} id="sinopse">Sinopse</h2>
            {synopsis.split(/\r?\n(?:[ \t]*\r?\n)+/).map((paragraph, index) => (
              <p className={styles.description} key={index}>{paragraph}</p>
            ))}
          </section>
        )}
      </div>

      <section className={styles.chapterSection} aria-labelledby="capitulos">
        <h2 className={styles.chapterHeading} id="capitulos">Capítulos</h2>
        <ol className={styles.chapters} role="list">
          {series.posts.map((chapter, index) => (
            <li key={chapter.id}>
              <Link className={styles.chapter} href={`/posts/${encodeURIComponent(chapter.slug)}`}>
                <CoverImage src={chapter.coverImage} className={styles.chapterCover} blurredBackdrop />
                <span className={styles.chapterBody}>
                  <span className={styles.eyebrow}>Capítulo {index + 1}{chapter.contentRating === "18+" && " · 18+"}</span>
                  <strong className={styles.chapterTitle}>{chapter.title}</strong>
                  {chapter.excerpt && <span className={styles.excerpt}>{chapter.excerpt}</span>}
                  <span className={styles.read}>Ler capítulo</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
