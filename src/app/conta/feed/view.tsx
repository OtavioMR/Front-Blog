"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { parseFeed, type Feed } from "./data";
import styles from "./view.module.css";

export default function FeedView() {
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [feed, setFeed] = useState<Feed | null>(null);
  const [page, setPage] = useState(1);
  const revision = useRef(0);
  const load = useCallback(async (requestedPage: number) => {
    const current = ++revision.current;
    setFeed(null); setState("loading");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) { setState("signed-out"); return; }
      const response = await authenticatedFetchForSubject(profile.id, `/api/v1/feed?page=${requestedPage}&limit=10`, { cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401) { setState("signed-out"); return; }
      if (!response.ok) throw new Error();
      const data = parseFeed(await response.json(), requestedPage);
      if (current !== revision.current) return;
      setFeed(data); setPage(requestedPage); setState("ready");
    } catch { if (current === revision.current) setState("error"); }
  }, []);
  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => { void load(1); });
    queueMicrotask(() => { if (active) void load(1); });
    return () => { active = false; generation.current++; unsubscribe(); };
  }, [load]);
  return <main className={styles.page}>
    <Link className={styles.link} href="/conta">← Voltar à conta</Link><h1>Seu feed.</h1><p>Publicações recentes dos autores que você acompanha.</p>
    {state === "loading" && <p role="status">Carregando seu feed…</p>}
    {state === "signed-out" && <p>Entre para ver seu feed. <Link className={styles.link} href="/entrar">Entrar</Link></p>}
    {state === "error" && <><p role="alert">Não foi possível carregar seu feed agora.</p><button className={styles.button} onClick={() => void load(page)}>Tentar novamente</button></>}
    {state === "ready" && feed && <>{feed.data.length === 0 ? <p>Nenhuma publicação nesta página. Explore os artigos e acompanhe seus autores favoritos.</p> : <ul className={styles.list}>{feed.data.map(item => <li key={item.id}><article><p><Link className={styles.link} href={`/autores/${encodeURIComponent(item.author.id)}`}>{item.author.name}</Link>{item.publishedAt && <> · <time dateTime={item.publishedAt}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.publishedAt))}</time></>}</p><h2><Link className={styles.link} href={`/posts/${encodeURIComponent(item.slug)}`}>{item.title}</Link></h2><p>{item.excerpt}</p></article></li>)}</ul>}
      {(feed.meta.hasPreviousPage || feed.meta.hasNextPage) && <nav className={styles.pagination} aria-label="Paginação do feed"><button className={styles.button} disabled={!feed.meta.hasPreviousPage} onClick={() => void load(page - 1)}>Anterior</button><span>Página {page}</span><button className={styles.button} disabled={!feed.meta.hasNextPage} onClick={() => void load(page + 1)}>Próxima</button></nav>}</>}
  </main>;
}
