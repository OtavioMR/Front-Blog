"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileEdit,
  PenLine,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { canWriteArticles } from "@/lib/permissions";
import { acceptedRules, parseOwnArticles, parseRules, type OwnArticle, type OwnArticles, type Rules } from "./contracts";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import CoverImage from "@/app/_components/cover-image";
import StudioHeader from "./studio-header";
import { canConfirmRemoval, removeArticleRequest } from "./remove-article";
import styles from "./studio.module.css";

type View = "loading" | "signed-out" | "reader" | "author" | "denied" | "error";
type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT" | "PENDING" | "SCHEDULED" | "REJECTED";

function getArticleStatus(article: OwnArticle): {
  key: Exclude<StatusFilter, "ALL">;
  label: string;
  className: string;
} {
  if (article.published) {
    return { key: "PUBLISHED", label: "Publicado", className: styles.statusPublished };
  }
  if (article.scheduledAt) {
    return { key: "SCHEDULED", label: "Agendado", className: styles.statusScheduled };
  }
  if (article.reviewStatus === "PENDING") {
    return { key: "PENDING", label: "Em revisão", className: styles.statusPending };
  }
  if (article.reviewStatus === "REJECTED") {
    return { key: "REJECTED", label: "Rejeitado", className: styles.statusRejected };
  }
  if (article.reviewStatus === "APPROVED") {
    return { key: "PUBLISHED", label: "Aprovado", className: styles.statusPublished };
  }
  return { key: "DRAFT", label: "Rascunho", className: styles.statusDraft };
}

function StatusIcon({ statusKey }: { statusKey: Exclude<StatusFilter, "ALL"> }) {
  switch (statusKey) {
    case "PUBLISHED":
      return <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" />;
    case "SCHEDULED":
      return <CalendarClock size={13} strokeWidth={2.2} aria-hidden="true" />;
    case "PENDING":
      return <Clock size={13} strokeWidth={2.2} aria-hidden="true" />;
    case "REJECTED":
      return <AlertCircle size={13} strokeWidth={2.2} aria-hidden="true" />;
    default:
      return <FileEdit size={13} strokeWidth={2.2} aria-hidden="true" />;
  }
}

export default function Studio({ editorialEnabled }: { editorialEnabled: boolean }) {
  const [view, setView] = useState<View>("loading");
  const [rules, setRules] = useState<Rules | null>(null);
  const [subject, setSubject] = useState("");
  const [articles, setArticles] = useState<OwnArticles | null>(null);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [removal, setRemoval] = useState<{ id: string; title: string; subject: string } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const revision = useRef(0);

  const load = useCallback(async (requestedPage: number) => {
    const current = ++revision.current;
    setView("loading");
    setArticles(null);
    setRules(null);
    setSubject("");
    setChecked(false);
    setFeedback("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) {
        setView("signed-out");
        return;
      }
      if (profile.role === "READER") {
        const response = await fetch("/api/v1/users/author-rules", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const value = parseRules(await response.json());
        if (current === revision.current) {
          setSubject(profile.id);
          setRules(value);
          setView("reader");
        }
      } else if (canWriteArticles(profile.role)) {
        const response = await authenticatedFetchForSubject(
          profile.id,
          `/api/v1/posts/me?page=${requestedPage}&limit=10&kind=standalone`,
          { cache: "no-store" },
        );
        if (current !== revision.current) return;
        if (response.status === 409) {
          setView("error");
          return;
        }
        if (response.status === 401) {
          setView("signed-out");
          return;
        }
        if (response.status === 403) {
          setView("denied");
          return;
        }
        if (!response.ok) throw new Error();
        const value = parseOwnArticles(await response.json());
        await Promise.all(
          value.data
            .filter((article) => article.reviewStatus === "REJECTED")
            .map(async (article) => {
              try {
                const result = await authenticatedFetchForSubject(
                  profile.id,
                  `/api/v1/post-reviews/${encodeURIComponent(article.id)}`,
                  { cache: "no-store" },
                );
                if (!result.ok) return;
                const review: unknown = await result.json();
                if (
                  typeof review === "object" &&
                  review !== null &&
                  "status" in review &&
                  review.status === "REJECTED" &&
                  "reason" in review &&
                  (typeof review.reason === "string" || review.reason === null)
                ) {
                  article.reviewReason = review.reason;
                }
              } catch {
                /* A falha na justificativa não deve ocultar a lista. */
              }
            }),
        );
        if (current === revision.current) {
          setSubject(profile.id);
          setArticles(value);
          setPage(value.meta.page);
          setView("author");
        }
      } else {
        setView("denied");
      }
    } catch {
      if (current === revision.current) setView("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => {
      setRemoval(null);
      setUncertain(false);
      void load(1);
    });
    queueMicrotask(() => {
      if (active) void load(1);
    });
    return () => {
      active = false;
      generation.current++;
      unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void load(page);
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [load, page]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject || !rules || !checked || busy || uncertain) return;
    const current = revision.current;
    setBusy(true);
    setFeedback("");
    try {
      const response = await authenticatedFetchForSubject(subject, "/api/v1/users/me/author", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: rules.version, accepted: true }),
        cache: "no-store",
      });
      if (current !== revision.current) return;
      if (response.status === 409) {
        await load(1);
        return;
      }
      if (response.status === 401) {
        setView("signed-out");
        return;
      }
      if (response.status === 403) {
        setFeedback(
          "Não foi possível liberar a autoria. A conta precisa estar ativa e ter e-mail confirmado; se a autoria foi bloqueada, peça a um superadministrador para liberar uma nova solicitação.",
        );
        return;
      }
      if (response.status === 400) {
        setFeedback("As regras ou o aceite precisam ser atualizados. Recarregue as regras antes de tentar novamente.");
        setUncertain(true);
        return;
      }
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result?.requested === true) {
        setFeedback(
          "Sua solicitação de liberação foi enviada ao superadministrador. Após a liberação, volte aqui e aceite as regras para se tornar autor.",
        );
        return;
      }
      if (!acceptedRules(result, rules.version)) throw new Error();
      setUncertain(false);
      await load(1);
    } catch {
      if (current === revision.current) {
        setUncertain(true);
        setFeedback("Não foi possível confirmar o resultado. Atualize o estado antes de tentar novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeArticle(id: string, openedBy: string) {
    if (!canConfirmRemoval(openedBy, subject) || busy || uncertain) return;
    const current = revision.current;
    setBusy(true);
    setFeedback("");
    try {
      const result = await removeArticleRequest(authenticatedFetchForSubject, openedBy, id);
      if (current !== revision.current) return;
      if (result === "changed") {
        await load(1);
        return;
      }
      if (result === "unauthorized") {
        setView("signed-out");
        return;
      }
      if (result === "forbidden") {
        setFeedback("Você não tem permissão para desativar este artigo.");
        return;
      }
      if (result === "missing") {
        setFeedback("Artigo não encontrado. Atualize a lista.");
        setUncertain(true);
        return;
      }
      if (result !== "deleted") throw new Error();
      setArticles((previous) =>
        previous ? { ...previous, data: previous.data.filter((article) => article.id !== id) } : previous,
      );
      setFeedback("Artigo desativado com sucesso.");
    } catch {
      if (current === revision.current) {
        setUncertain(true);
        setFeedback("Não foi possível confirmar a desativação. Atualize a lista antes de tentar novamente.");
      }
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const items = articles?.data ?? [];
    const map: Record<StatusFilter, number> = {
      ALL: items.length,
      PUBLISHED: 0,
      DRAFT: 0,
      PENDING: 0,
      SCHEDULED: 0,
      REJECTED: 0,
    };
    for (const item of items) {
      map[getArticleStatus(item).key]++;
    }
    return map;
  }, [articles]);

  const filteredArticles = useMemo(() => {
    if (!articles) return [];
    const normalized = query.trim().toLowerCase();
    return articles.data.filter((article) => {
      if (filter !== "ALL" && getArticleStatus(article).key !== filter) return false;
      if (normalized && !article.title.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [articles, filter, query]);

  const filterOptions: { key: StatusFilter; label: string }[] = [
    { key: "ALL", label: "Todos" },
    { key: "PUBLISHED", label: "Publicados" },
    { key: "DRAFT", label: "Rascunhos" },
    { key: "PENDING", label: "Em revisão" },
    { key: "SCHEDULED", label: "Agendados" },
    { key: "REJECTED", label: "Rejeitados" },
  ];

  return (
    <main className={styles.page}>
      <section className={styles.content}>
        <StudioHeader activeTab="contos" editorialEnabled={view === "author" && editorialEnabled} />

        {view === "loading" && (
          <div className={styles.skeletonList} role="status" aria-label="Carregando seu espaço">
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
            <div className={styles.skeletonCard} />
          </div>
        )}

        {view === "signed-out" && (
          <div className={styles.panel}>
            <h2>Suas histórias começam aqui</h2>
            <p>Entre na sua conta para acessar o Studio.</p>
            <Link className={styles.primaryBtn} href="/entrar">
              Entrar na conta
            </Link>
          </div>
        )}

        {view === "denied" && (
          <div className={styles.panel}>
            <p role="alert">Sua conta não tem acesso a este espaço.</p>
          </div>
        )}

        {view === "error" && (
          <div className={styles.panel}>
            <p role="alert">Não foi possível carregar o Studio agora.</p>
            <button type="button" className={styles.primaryBtn} onClick={() => void load(page)}>
              Tentar novamente
            </button>
          </div>
        )}

        {view === "reader" && rules && (
          <div className={styles.panel}>
            <h2>Compartilhe suas histórias</h2>
            <p>Para começar, leia e aceite as regras de publicação. Seu primeiro artigo passa por revisão.</p>
            <ul className={styles.rules}>
              {rules.rules.map((rule, index) => (
                <li key={index}>{rule}</li>
              ))}
            </ul>
            <p className={styles.version}>Versão {rules.version}</p>
            <form onSubmit={accept}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                  disabled={busy || uncertain}
                  required
                />
                Li e aceito as regras de autoria.
              </label>
              <button type="submit" className={styles.primaryBtn} disabled={!checked || busy || uncertain}>
                {busy ? "Enviando…" : "Aceitar e tornar-me autor"}
              </button>
            </form>
            {feedback && (
              <p role="alert" className={styles.noticeBanner}>
                {feedback}
              </p>
            )}
            {uncertain && (
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setUncertain(false);
                  void load(1);
                }}
              >
                Atualizar estado
              </button>
            )}
          </div>
        )}

        {view === "author" && articles && (
          <>
            <div className={styles.sectionHeading} id="contos">
              <div>
                <p className={styles.eyebrow}>SUA BIBLIOTECA</p>
                <h2>Seus contos</h2>
                <p>Acompanhe suas histórias e o andamento de cada publicação.</p>
              </div>
            </div>

            {!editorialEnabled && (
              <p className={styles.noticeBanner}>A criação e a edição de artigos estarão disponíveis em breve.</p>
            )}

            {feedback && (
              <div role="status" className={styles.noticeBanner}>
                <span>{feedback}</span>
                {uncertain && (
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={() => {
                      setUncertain(false);
                      void load(page);
                    }}
                  >
                    Atualizar lista
                  </button>
                )}
              </div>
            )}

            {articles.data.length > 0 && (
              <div className={styles.toolbar}>
                <div className={styles.filterGroup} role="group" aria-label="Filtrar por status">
                  {filterOptions
                    .filter((opt) => opt.key === "ALL" || counts[opt.key] > 0)
                    .map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        className={`${styles.filterPill} ${filter === opt.key ? styles.filterPillActive : ""}`}
                        onClick={() => setFilter(opt.key)}
                        aria-pressed={filter === opt.key}
                      >
                        <span>{opt.label}</span>
                        <span className={styles.filterCount}>{counts[opt.key]}</span>
                      </button>
                    ))}
                </div>

                <div className={styles.toolbarRight}>
                  <div className={styles.searchWrap}>
                    <Search size={15} className={styles.searchIcon} aria-hidden="true" />
                    <input
                      type="search"
                      className={styles.searchInput}
                      placeholder="Buscar conto pelo título…"
                      aria-label="Buscar conto pelo título"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.refreshBtn}
                    onClick={() => void load(page)}
                    disabled={busy}
                    title="Atualizar lista"
                  >
                    <RefreshCw size={14} aria-hidden="true" />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>
            )}

            {articles.data.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon} aria-hidden="true">
                  <PenLine size={24} strokeWidth={1.8} />
                </span>
                <h3>Nenhum artigo por aqui</h3>
                <p>
                  {page === 1
                    ? "Toda boa história começa com uma ideia. Que tal dar o primeiro passo?"
                    : "Não há artigos nesta página."}
                </p>
                {editorialEnabled && page === 1 && (
                  <Link className={styles.primaryBtn} href="/studio/novo">
                    Começar a escrever
                  </Link>
                )}
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className={styles.empty}>
                <h3>Nenhum conto encontrado</h3>
                <p>Nenhum conto corresponde ao filtro ou termo de busca atual.</p>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setFilter("ALL");
                    setQuery("");
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <ul className={styles.list}>
                {filteredArticles.map((article) => {
                  const status = getArticleStatus(article);
                  return (
                    <li key={article.id} className={styles.articleCard}>
                      <CoverImage src={article.coverImage} className={styles.storyCover} iconSize={20} />

                      <div className={styles.articleMeta}>
                        <h3 className={styles.articleTitle}>{article.title}</h3>
                        <div className={styles.badgeRow}>
                          <span className={`${styles.statusBadge} ${status.className}`}>
                            <StatusIcon statusKey={status.key} />
                            <span>{status.label}</span>
                          </span>
                        </div>
                        {article.reviewStatus === "REJECTED" && (
                          <p className={styles.reviewReason}>
                            <strong>Justificativa da revisão:</strong>{" "}
                            {article.reviewReason ||
                              "Não foi possível carregar a justificativa. Atualize a lista para tentar novamente."}
                          </p>
                        )}
                      </div>

                      <div className={styles.rowActions}>
                        {article.published && (
                          <Link className={styles.actionBtn} href={`/posts/${encodeURIComponent(article.slug)}`}>
                            <Eye size={14} aria-hidden="true" />
                            <span>Ver artigo</span>
                          </Link>
                        )}
                        {editorialEnabled && article.reviewStatus !== "PENDING" && (
                          <Link className={styles.actionBtn} href={`/studio/${encodeURIComponent(article.id)}`}>
                            <Edit3 size={14} aria-hidden="true" />
                            <span>Editar</span>
                          </Link>
                        )}
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          disabled={busy || uncertain || article.reviewStatus === "PENDING"}
                          title={
                            article.reviewStatus === "PENDING"
                              ? "Artigos em revisão não podem ser desativados."
                              : undefined
                          }
                          onClick={() => setRemoval({ id: article.id, title: article.title, subject })}
                          aria-label={`Desativar artigo ${article.title}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          <span>{busy ? "Aguarde…" : "Desativar"}</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {(articles.meta.hasPreviousPage || articles.meta.hasNextPage) && (
              <nav className={styles.pagination} aria-label="Paginação dos seus artigos">
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy || !articles.meta.hasPreviousPage}
                  onClick={() => void load(page - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={busy || !articles.meta.hasNextPage}
                  onClick={() => void load(page + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {removal && (
        <ConfirmDialog
          title="Desativar artigo?"
          description={`“${removal.title}” será removido das listagens e deixará de estar publicado.`}
          confirmLabel="Desativar artigo"
          onCancel={() => setRemoval(null)}
          onConfirm={() => {
            const { id, subject: openedBy } = removal;
            setRemoval(null);
            void removeArticle(id, openedBy);
          }}
        />
      )}
    </main>
  );
}
