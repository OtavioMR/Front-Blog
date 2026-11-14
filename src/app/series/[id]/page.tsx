import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  return <main className={styles.page}>
    <Link className={styles.back} href="/">← Voltar às leituras</Link>
    <header className={styles.hero}>
      {cover && <div className={styles.heroCover}><Image src={cover} alt="" width={960} height={640} unoptimized /></div>}
      <div><p className={styles.eyebrow}>SÉRIE {series.contentRating === "18+" && " · 18+"}</p><h1>{series.title}</h1>{series.author?.name && <p>Por {series.author.name}</p>}<p className={styles.description}>{series.description}</p><p>{series.posts.length} {series.posts.length === 1 ? "capítulo publicado" : "capítulos publicados"}</p></div>
    </header>
    <section><p className={styles.eyebrow}>CONTINUE ESTA HISTÓRIA</p><h2>Capítulos</h2><ol className={styles.chapters}>{series.posts.map((chapter, index) => {
      const image = publicCoverPath(chapter.coverImage);
      return <li key={chapter.id}><Link className={styles.chapter} href={`/posts/${encodeURIComponent(chapter.slug)}`}>{image ? <Image src={image} alt="" width={320} height={200} unoptimized /> : <span className={styles.placeholder} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}<span className={styles.chapterBody}><span className={styles.eyebrow}>CAPÍTULO {index + 1}{chapter.contentRating === "18+" && " · 18+"}</span><strong>{chapter.title}</strong>{chapter.excerpt && <span className={styles.excerpt}>{chapter.excerpt}</span>}<span className={styles.read}>Ler capítulo →</span></span></Link></li>;
    })}</ol></section>
  </main>;
}
