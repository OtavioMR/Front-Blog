"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authenticatedFetch, subscribeSession } from "@/lib/session-client";
import { loadSavedPage, type SavedPage } from "./data";
import BackButton from "@/app/_components/back-button";
import styles from "../sessoes/sessions.module.css";

type State = "loading" | "ready" | "signed-out" | "forbidden" | "error";
export default function SavedPosts() {
  const [state, setState] = useState<State>("loading");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SavedPage | null>(null);
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    const currentRevision = revision;
    function load() {
      const request = ++currentRevision.current;
      setResult(null); setState("loading");
      loadSavedPage(page, authenticatedFetch).then(outcome => {
        if (active && request === currentRevision.current) {
          setResult(outcome.result ?? null); setState(outcome.state);
        }
      }).catch(() => { if (active && request === currentRevision.current) setState("error"); });
    }
    const unsubscribe = subscribeSession(load);
    load();
    return () => { active = false; currentRevision.current++; unsubscribe(); };
  }, [page, retry]);

  return <main className={styles.page}><section className={styles.content}>
    <BackButton fallback="/conta" /><p className={styles.eyebrow}>SUA CONTA</p><h1>Artigos salvos.</h1><p>Retome suas leituras quando quiser.</p>
    {state === "loading" && <p role="status">Carregando artigos salvos…</p>}
    {state === "signed-out" && <p role="status">Sua sessão terminou. <Link href="/entrar">Entre novamente</Link>.</p>}
    {state === "forbidden" && <p role="alert">Sua conta não tem acesso a esta lista.</p>}
    {state === "error" && <><p role="alert">Não foi possível carregar seus artigos salvos agora.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></>}
    {state === "ready" && result && <>{result.data.length === 0 ? <p>{page === 1 ? "Você ainda não salvou nenhum artigo." : "Nenhum artigo encontrado nesta página."}</p> : <ul className={styles.list}>{result.data.map(post => <li className={styles.item} key={post.id}><article><h2><Link prefetch={false} href={`/posts/${post.id}`}>{post.title}</Link></h2><p>{post.excerpt}</p><p>{post.author.name}</p></article></li>)}</ul>}
      {(result.meta.hasPreviousPage || result.meta.hasNextPage) && <nav aria-label="Paginação dos artigos salvos"><button type="button" disabled={!result.meta.hasPreviousPage} onClick={() => setPage(value => value - 1)}>← Anteriores</button> <span>Página {page} de {result.meta.totalPages || 1}</span> <button type="button" disabled={!result.meta.hasNextPage} onClick={() => setPage(value => value + 1)}>Próximos →</button></nav>}
    </>}
    
  </section></main>;
}
