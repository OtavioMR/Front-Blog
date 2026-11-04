import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthor, photoPath, safeExternalUrl } from "./data";
import styles from "./profile.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const author = await getAuthor((await params).id);
  return author
    ? { title: `${author.name} | Entrelinhas`, description: `Conheça ${author.name} e suas publicações no Entrelinhas.` }
    : { title: "Autor não encontrado | Entrelinhas", robots: { index: false } };
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const author = await getAuthor(id);
  if (!author) notFound();
  const photo = photoPath(author.profilePhoto);
  const website = safeExternalUrl(author.websiteUrl);
  const social = safeExternalUrl(author.socialUrl);
  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/">✳ entrelinhas.</Link><Link className={styles.back} href="/">← Voltar ao início</Link></header>
    <article className={styles.profile}>
      <div className={styles.portrait}>{photo ? <Image src={photo} alt="" width={240} height={240} unoptimized /> : <span aria-hidden="true">✳</span>}</div>
      <div><p className={styles.eyebrow}>Quem escreve</p><h1>{author.name}</h1>{author.bio && <p className={styles.bio}>{author.bio}</p>}<p className={styles.count}>{author.publicationCount} {author.publicationCount === 1 ? "artigo publicado" : "artigos publicados"}</p>
        {(website || social) && <nav className={styles.links} aria-label="Links do autor">{website && <a href={website} target="_blank" rel="noopener noreferrer">Site ↗</a>}{social && <a href={social} target="_blank" rel="noopener noreferrer">Rede social ↗</a>}</nav>}
      </div>
    </article>
  </main>;
}
