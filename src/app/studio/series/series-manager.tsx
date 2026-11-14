"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ImagePlus,
  Layers,
  ListOrdered,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { canManageSeries } from "@/lib/permissions";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import CoverImage from "@/app/_components/cover-image";
import StudioHeader from "../studio-header";
import { parseOwnArticles, type OwnArticles } from "../contracts";
import {
  confirmedItems,
  parseDetail,
  parseSeries,
  parseSeriesList,
  type Detail,
  type Item,
  type Series,
} from "./contracts";
import styles from "./series.module.css";

type View = "loading" | "ready" | "signed-out" | "denied" | "error";
type Screen = "list" | "create" | "detail";
type DetailTab = "chapters" | "add" | "settings";
type Confirmation = "delete" | "items" | null;

export default function SeriesManager() {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [screen, setScreen] = useState<Screen>("list");
  const [detailTab, setDetailTab] = useState<DetailTab>("chapters");
  const [owner, setOwner] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [articles, setArticles] = useState<OwnArticles | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [pendingLeave, setPendingLeave] = useState<{ type: "route"; href: string } | { type: "list" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const running = useRef(false);

  const changedItems =
    !!detail && JSON.stringify(items.map((i) => i.id)) !== JSON.stringify(detail.posts.map((i) => i.id));
  const changedInfo = !!detail && (title !== detail.title || description !== detail.description);
  const dirty = changedItems || changedInfo || (screen === "create" && Boolean(title || description));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const load = useCallback(async () => {
    const current = ++revision.current;
    setView("loading");
    setOwner("");
    setDetail(null);
    setArticles(null);
    setScreen("list");
    setDetailTab("chapters");
    setConfirmation(null);
    setUncertain(false);
    setMessage("");
    try {
      const profile = await getOwnProfile();
      if (current !== revision.current) return;
      if (!profile) {
        setView("signed-out");
        return;
      }
      if (!canManageSeries(profile.role)) {
        setView("denied");
        return;
      }
      const response = await authenticatedFetchForSubject(profile.id, "/api/v1/series/me", { cache: "no-store" });
      if (current !== revision.current) return;
      if (response.status === 401) {
        setView("signed-out");
        return;
      }
      if (response.status === 403) {
        setView("denied");
        return;
      }
      if (!response.ok) throw new Error();
      const list = parseSeriesList(await response.json(), profile.id);
      if (current !== revision.current) return;
      setOwner(profile.id);
      setSeries(list);
      setTitle("");
      setDescription("");
      setView("ready");
    } catch {
      if (current === revision.current) setView("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = revision;
    const unsubscribe = subscribeSession(() => {
      revision.current++;
      setOwner("");
      setDetail(null);
      setArticles(null);
      setView("signed-out");
      setConfirmation(null);
    });
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      generation.current++;
      unsubscribe();
    };
  }, [load]);

  async function fetchDetail(id: string, subject = owner) {
    const response = await authenticatedFetchForSubject(subject, `/api/v1/series/${id}/manage`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return parseDetail(await response.json(), subject, id);
  }

  async function loadArticles(page: number, subject = owner) {
    const response = await authenticatedFetchForSubject(subject, `/api/v1/posts/me?page=${page}&limit=10`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const result = parseOwnArticles(await response.json());
    if (result.meta.page !== page) throw new Error();
    return result;
  }

  async function openSeries(item: Series) {
    if (running.current) return;
    if (dirty) {
      setMessage("Salve ou descarte as alterações antes de trocar de série.");
      return;
    }
    const current = revision.current;
    setBusy(true);
    running.current = true;
    setMessage("");
    try {
      const [data, page] = await Promise.all([fetchDetail(item.id), loadArticles(1)]);
      if (current !== revision.current) return;
      setDetail(data);
      setItems(data.posts);
      setTitle(data.title);
      setDescription(data.description);
      setArticles(page);
      setDetailTab("chapters");
      setScreen("detail");
    } catch {
      if (current === revision.current) setMessage("Não foi possível carregar esta série. Tente novamente.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function startCreate() {
    if (busy || uncertain) return;
    setDetail(null);
    setItems([]);
    setTitle("");
    setDescription("");
    setMessage("");
    setScreen("create");
  }

  function discardAndReturnToList() {
    setDetail(null);
    setItems([]);
    setTitle("");
    setDescription("");
    setMessage("");
    setScreen("list");
    setDetailTab("chapters");
  }

  function requestBackToList() {
    if (dirty) {
      setPendingLeave({ type: "list" });
      return;
    }
    discardAndReturnToList();
  }

  function handleHeaderNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (dirty) {
      event.preventDefault();
      setPendingLeave({ type: "route", href });
    }
  }

  async function changePage(page: number) {
    if (running.current) return;
    const current = revision.current;
    setBusy(true);
    running.current = true;
    try {
      const result = await loadArticles(page);
      if (current === revision.current) setArticles(result);
    } catch {
      if (current === revision.current) setMessage("Não foi possível carregar os artigos desta página.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function uploadCover(file: File) {
    if (!detail || !owner || busy || uncertain || dirty) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.");
      return;
    }
    const current = revision.current;
    const id = detail.id;
    setBusy(true);
    running.current = true;
    setMessage("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await authenticatedFetchForSubject(owner, `/api/v1/series/${id}/cover-image`, {
        method: "POST",
        body: form,
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const refreshed = await fetchDetail(id);
      if (current !== revision.current) return;
      setDetail(refreshed);
      setItems(refreshed.posts);
      setSeries((previous) => previous.map((item) => (item.id === id ? { ...item, ...refreshed } : item)));
      setMessage("Capa atualizada com sucesso.");
    } catch {
      if (current === revision.current) {
        setUncertain(true);
        setMessage("Não foi possível confirmar a capa. Atualize os dados antes de continuar.");
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function saveInfo(event: FormEvent) {
    event.preventDefault();
    if (!owner || running.current || uncertain || !title.trim() || title.length > 150 || description.length > 1000) {
      return;
    }
    const current = revision.current;
    const id = detail?.id;
    setBusy(true);
    running.current = true;
    setMessage("");
    try {
      if (detail) {
        const latest = await fetchDetail(detail.id);
        if (current !== revision.current) return;
        if (latest.updatedAt !== detail.updatedAt) {
          setUncertain(true);
          setMessage("A série mudou em outra sessão. Atualize antes de continuar.");
          return;
        }
      }
      const response = await authenticatedFetchForSubject(owner, id ? `/api/v1/series/${id}` : "/api/v1/series", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description }),
        cache: "no-store",
      });
      if (current !== revision.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) {
        setMessage("Não foi possível salvar. Verifique os dados, sua sessão e o estado da série.");
        return;
      }
      if (!response.ok) throw new Error();
      const saved = parseSeries(await response.json(), owner);
      if (id && saved.id !== id) throw new Error();
      if (current !== revision.current) return;

      setSeries((previous) =>
        id ? previous.map((item) => (item.id === id ? { ...item, ...saved } : item)) : [saved, ...previous].slice(0, 100),
      );

      if (detail) {
        setDetail({ ...saved, posts: detail.posts });
        setTitle(saved.title);
        setDescription(saved.description);
        setMessage("Informações da série atualizadas.");
      } else {
        // Newly created: open its dedicated workspace right away
        const [createdDetail, page] = await Promise.all([fetchDetail(saved.id), loadArticles(1)]);
        if (current !== revision.current) return;
        setDetail(createdDetail);
        setItems(createdDetail.posts);
        setTitle(createdDetail.title);
        setDescription(createdDetail.description);
        setArticles(page);
        setDetailTab("chapters");
        setScreen("detail");
        setMessage("Série criada! Agora você pode adicionar capítulos ou personalizar a capa.");
      }
    } catch {
      if (current === revision.current) {
        setUncertain(true);
        setMessage("Não foi possível confirmar o resultado. Atualize antes de tentar novamente.");
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function confirmAction() {
    const action = confirmation;
    setConfirmation(null);
    if (!detail || !owner || !action || running.current || uncertain || changedInfo) return;
    const current = revision.current;
    const id = detail.id;
    const ids = items.map((item) => item.id);
    setBusy(true);
    running.current = true;
    setMessage("");
    try {
      const latest = await fetchDetail(id);
      if (current !== revision.current) return;
      if (
        latest.updatedAt !== detail.updatedAt ||
        JSON.stringify(latest.posts.map((p) => p.id)) !== JSON.stringify(detail.posts.map((p) => p.id))
      ) {
        setUncertain(true);
        setMessage("A série mudou em outra sessão. Atualize antes de continuar.");
        return;
      }
      const response = await authenticatedFetchForSubject(
        owner,
        action === "delete" ? `/api/v1/series/${id}` : `/api/v1/series/${id}/items`,
        action === "delete"
          ? { method: "DELETE", cache: "no-store" }
          : {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postIds: ids }),
              cache: "no-store",
            },
      );
      if (current !== revision.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) {
        setUncertain(true);
        setMessage("Não foi possível alterar a série. Atualize os dados; um artigo pode pertencer a outra série.");
        return;
      }
      if (action === "delete") {
        if (response.status !== 204) throw new Error();
        setDetail(null);
        setItems([]);
        setSeries((previous) => previous.filter((item) => item.id !== id));
        setTitle("");
        setDescription("");
        setScreen("list");
        setMessage("Série excluída. Seus artigos foram preservados.");
      } else {
        if (!response.ok || !confirmedItems(await response.json(), ids)) throw new Error();
        const refreshed = await fetchDetail(id);
        if (current !== revision.current) return;
        if (JSON.stringify(refreshed.posts.map((p) => p.id)) !== JSON.stringify(ids)) throw new Error();
        setDetail(refreshed);
        setItems(refreshed.posts);
        setSeries((previous) => previous.map((item) => (item.id === id ? { ...item, ...refreshed } : item)));
        setMessage("Ordem dos artigos salva com sucesso.");
      }
    } catch {
      if (current === revision.current) {
        setUncertain(true);
        setMessage("Não foi possível confirmar o resultado. Atualize antes de tentar novamente.");
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function move(index: number, direction: number) {
    setItems((previous) => {
      const next = [...previous];
      const target = index + direction;
      if (target < 0 || target >= next.length) return previous;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function discardChanges() {
    setTitle(detail?.title ?? "");
    setDescription(detail?.description ?? "");
    setItems(detail?.posts ?? []);
    setMessage("Alterações descartadas.");
  }

  return (
    <main className={styles.page}>
      <StudioHeader
        activeTab="series"
        editorialEnabled={view === "ready"}
        onLeaveNavigate={handleHeaderNavigate}
      />

      {view === "loading" && (
        <div className={styles.skeletonGrid} role="status" aria-label="Carregando séries">
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      )}

      {view === "signed-out" && (
        <div className={styles.panel}>
          <p>Entre novamente para acessar suas séries.</p>
          <Link className={styles.primaryBtn} href="/entrar">
            Entrar
          </Link>
        </div>
      )}

      {view === "denied" && (
        <div className={styles.panel}>
          <p role="alert">Este espaço é disponível para autores.</p>
        </div>
      )}

      {view === "error" && (
        <div className={styles.panel}>
          <p role="alert">Não foi possível carregar as séries.</p>
          <button type="button" className={styles.primaryBtn} onClick={() => void load()}>
            Tentar novamente
          </button>
        </div>
      )}

      {view === "ready" && (
        <>
          {message && (
            <div role="status" className={styles.noticeBanner}>
              <span>{message}</span>
              {uncertain && (
                <button type="button" className={styles.secondaryBtn} onClick={() => void load()}>
                  Atualizar dados
                </button>
              )}
            </div>
          )}

          {/* SCREEN 1: SERIES LIST */}
          {screen === "list" && (
            <section aria-labelledby="series-list-title">
              <div className={styles.screenHeader}>
                <div>
                  <p className={styles.eyebrow}>SUAS COLEÇÕES</p>
                  <h2 id="series-list-title">Minhas séries</h2>
                  <p>Organize seus contos em sequências ordenadas de capítulos.</p>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={startCreate}
                  disabled={busy || uncertain}
                >
                  <Plus size={16} aria-hidden="true" />
                  <span>Nova série</span>
                </button>
              </div>

              {series.length === 100 && (
                <p className={styles.noticeBanner}>São exibidas até 100 séries mais recentes.</p>
              )}

              {!series.length ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon} aria-hidden="true">
                    <Layers size={24} strokeWidth={1.8} />
                  </span>
                  <h3>Você ainda não criou uma série</h3>
                  <p>
                    Agrupe contos conectados em capítulos sequenciais para que os leitores acompanhem sua história do
                    início ao fim.
                  </p>
                  <button type="button" className={styles.primaryBtn} onClick={startCreate}>
                    <Plus size={16} aria-hidden="true" />
                    <span>Criar primeira série</span>
                  </button>
                </div>
              ) : (
                <ul className={styles.seriesGrid}>
                  {series.map((item) => (
                    <li className={styles.seriesCard} key={item.id}>
                      <button
                        type="button"
                        className={styles.cardButton}
                        disabled={busy || uncertain}
                        onClick={() => void openSeries(item)}
                      >
                        <CoverImage
                          src={item.coverImage ?? item.fallbackCoverImage}
                          className={styles.seriesCover}
                          fallbackLabel="Sem capa"
                          iconSize={24}
                        />
                        <div className={styles.cardContent}>
                          <h3 className={styles.cardTitle}>{item.title}</h3>
                          <p className={styles.cardDesc}>
                            {item.description || "Adicione uma descrição para apresentar esta série aos leitores."}
                          </p>
                          <div className={styles.cardFooter}>
                            <span className={styles.chapterCountPill}>
                              <BookOpen size={13} aria-hidden="true" />
                              <span>
                                {item.chapterCount ?? 0} {(item.chapterCount ?? 0) === 1 ? "capítulo" : "capítulos"}
                              </span>
                            </span>
                            <span className={styles.cardManageLink}>
                              <span>Gerenciar</span>
                              <ArrowRight size={14} aria-hidden="true" />
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* SCREEN 2: CREATE SERIES */}
          {screen === "create" && (
            <section aria-labelledby="create-series-title">
              <button type="button" className={styles.backStepBtn} onClick={requestBackToList} disabled={busy}>
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Voltar para minhas séries</span>
              </button>

              <div className={styles.formCard}>
                <p className={styles.eyebrow}>NOVA COLEÇÃO</p>
                <h2 id="create-series-title">Criar nova série</h2>
                <p className={styles.formIntro}>
                  Defina o título e a sinopse da sua série. Na próxima etapa você poderá enviar a capa e organizar os
                  capítulos.
                </p>

                <form className={styles.form} onSubmit={saveInfo}>
                  <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                      <label htmlFor="create-series-name">Título</label>
                      <span className={styles.charCount}>{title.length}/150</span>
                    </div>
                    <input
                      id="create-series-name"
                      required
                      maxLength={150}
                      placeholder="Ex.: Crônicas de Terracota"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      disabled={busy || uncertain}
                    />
                  </div>

                  <div className={styles.field}>
                    <div className={styles.fieldHeader}>
                      <label htmlFor="create-series-desc">Descrição</label>
                      <span className={styles.charCount}>{description.length}/1000</span>
                    </div>
                    <textarea
                      id="create-series-desc"
                      maxLength={1000}
                      placeholder="Conte brevemente sobre o que trata esta série…"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      disabled={busy || uncertain}
                    />
                  </div>

                  <div className={styles.formActions}>
                    <button
                      type="submit"
                      className={styles.primaryBtn}
                      disabled={busy || uncertain || !title.trim()}
                    >
                      {busy ? "Criando…" : "Criar série"}
                    </button>
                    <button type="button" className={styles.secondaryBtn} onClick={requestBackToList} disabled={busy}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          {/* SCREEN 3: SELECTED SERIES WORKSPACE */}
          {screen === "detail" && detail && (
            <section aria-labelledby="detail-series-title">
              <button type="button" className={styles.backStepBtn} onClick={requestBackToList} disabled={busy}>
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Voltar para minhas séries</span>
              </button>

              <div className={styles.detailBanner}>
                <CoverImage
                  src={detail.coverImage ?? detail.fallbackCoverImage}
                  className={styles.detailCover}
                  iconSize={20}
                />
                <div className={styles.detailInfo}>
                  <div className={styles.detailTitleRow}>
                    <h2 id="detail-series-title" className={styles.detailTitle}>
                      {detail.title}
                    </h2>
                    <span className={styles.chapterCountPill}>
                      {items.length} {items.length === 1 ? "capítulo" : "capítulos"}
                    </span>
                    {dirty && <span className={styles.dirtyBadge}>Alterações não salvas</span>}
                  </div>
                  {detail.description && <p className={styles.detailDesc}>{detail.description}</p>}
                </div>
              </div>

              <div className={styles.subTabs} role="tablist" aria-label="Opções da série">
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "chapters"}
                  className={`${styles.subTab} ${detailTab === "chapters" ? styles.subTabActive : ""}`}
                  onClick={() => setDetailTab("chapters")}
                >
                  <ListOrdered size={16} aria-hidden="true" />
                  <span>Capítulos ({items.length})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "add"}
                  className={`${styles.subTab} ${detailTab === "add" ? styles.subTabActive : ""}`}
                  onClick={() => setDetailTab("add")}
                >
                  <Plus size={16} aria-hidden="true" />
                  <span>Adicionar artigos</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={detailTab === "settings"}
                  className={`${styles.subTab} ${detailTab === "settings" ? styles.subTabActive : ""}`}
                  onClick={() => setDetailTab("settings")}
                >
                  <Settings size={16} aria-hidden="true" />
                  <span>Configurações</span>
                </button>
              </div>

              {/* SUB-SCREEN 3A: CHAPTERS ORDER */}
              {detailTab === "chapters" && (
                <div role="tabpanel">
                  <div className={styles.screenHeader}>
                    <div>
                      <h2>Capítulos da série</h2>
                      <p>Até 100 artigos. Reordene ou remova capítulos e salve quando terminar.</p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setDetailTab("add")}
                      disabled={busy || uncertain}
                    >
                      <Plus size={15} aria-hidden="true" />
                      <span>Adicionar artigos</span>
                    </button>
                  </div>

                  {changedItems && (
                    <div className={styles.unsavedBar}>
                      <span>Você alterou a lista ou a ordem dos capítulos.</span>
                      <div className={styles.unsavedActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={busy || uncertain}
                          onClick={discardChanges}
                        >
                          Descartar alterações
                        </button>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={busy || uncertain || changedInfo}
                          onClick={() => setConfirmation("items")}
                        >
                          Salvar ordem e artigos
                        </button>
                      </div>
                    </div>
                  )}

                  {!items.length ? (
                    <div className={styles.empty}>
                      <span className={styles.emptyIcon} aria-hidden="true">
                        <BookOpen size={24} strokeWidth={1.8} />
                      </span>
                      <h3>Nenhum capítulo nesta série</h3>
                      <p>Adicione seus contos publicados ou rascunhos para começar a montar a sequência.</p>
                      <button type="button" className={styles.primaryBtn} onClick={() => setDetailTab("add")}>
                        <Plus size={16} aria-hidden="true" />
                        <span>Adicionar artigos</span>
                      </button>
                    </div>
                  ) : (
                    <ol className={styles.chapterList}>
                      {items.map((item, index) => (
                        <li className={styles.chapterRow} key={item.id}>
                          <CoverImage src={item.coverImage} className={styles.chapterCover} iconSize={18} />
                          <div className={styles.chapterMeta}>
                            <p className={styles.chapterNumber}>CAPÍTULO {index + 1}</p>
                            <h3 className={styles.chapterTitle}>{item.title}</h3>
                            <span className={`${styles.statusPill} ${item.published ? styles.statusPublished : ""}`}>
                              {item.published ? "Publicado" : "Rascunho"}
                              {!item.isActive && " · inativo"}
                            </span>
                          </div>
                          <div className={styles.chapterActions}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              disabled={busy || uncertain || index === 0}
                              onClick={() => move(index, -1)}
                              aria-label={`Subir ${item.title}`}
                            >
                              <ArrowUp size={14} aria-hidden="true" />
                              <span>Subir</span>
                            </button>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              disabled={busy || uncertain || index === items.length - 1}
                              onClick={() => move(index, 1)}
                              aria-label={`Descer ${item.title}`}
                            >
                              <ArrowDown size={14} aria-hidden="true" />
                              <span>Descer</span>
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              disabled={busy || uncertain}
                              onClick={() => setItems((old) => old.filter((i) => i.id !== item.id))}
                              aria-label={`Remover ${item.title} da série`}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              <span>Remover</span>
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {/* SUB-SCREEN 3B: ADD ARTICLES */}
              {detailTab === "add" && (
                <div role="tabpanel">
                  <div className={styles.screenHeader}>
                    <div>
                      <h2>Adicionar artigos à série</h2>
                      <p>Escolha quais dos seus contos farão parte desta série.</p>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => setDetailTab("chapters")}
                    >
                      <ArrowLeft size={15} aria-hidden="true" />
                      <span>Ver capítulos ({items.length})</span>
                    </button>
                  </div>

                  {changedItems && (
                    <div className={styles.unsavedBar}>
                      <span>Novos capítulos aguardando confirmação para serem salvos.</span>
                      <div className={styles.unsavedActions}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={busy || uncertain}
                          onClick={discardChanges}
                        >
                          Descartar alterações
                        </button>
                        <button
                          type="button"
                          className={styles.primaryBtn}
                          disabled={busy || uncertain || changedInfo}
                          onClick={() => setConfirmation("items")}
                        >
                          Salvar ordem e artigos
                        </button>
                      </div>
                    </div>
                  )}

                  {articles && (
                    <>
                      {!articles.data.length ? (
                        <div className={styles.empty}>
                          <h3>Você ainda não tem artigos</h3>
                          <p>Crie um conto primeiro para poder adicioná-lo a esta série.</p>
                          <Link href="/studio/novo" className={styles.primaryBtn}>
                            Novo conto
                          </Link>
                        </div>
                      ) : (
                        <ul className={styles.articlePickerList}>
                          {articles.data.map((article) => {
                            const alreadyAdded = items.some((item) => item.id === article.id);
                            return (
                              <li key={article.id} className={styles.articlePickerRow}>
                                <div className={styles.articlePickerInfo}>
                                  <CoverImage src={article.coverImage} className={styles.pickerCover} iconSize={16} />
                                  <div className={styles.pickerText}>
                                    <strong>{article.title}</strong>
                                    <span
                                      className={`${styles.statusPill} ${
                                        article.published ? styles.statusPublished : ""
                                      }`}
                                    >
                                      {article.published ? "Publicado" : "Rascunho"}
                                    </span>
                                  </div>
                                </div>

                                {alreadyAdded ? (
                                  <span className={styles.addedTag}>
                                    <Check size={14} aria-hidden="true" />
                                    <span>Já na série</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className={styles.primaryBtn}
                                    disabled={busy || uncertain || items.length >= 100}
                                    onClick={() => {
                                      setItems((old) => [
                                        ...old,
                                        {
                                          id: article.id,
                                          title: article.title,
                                          slug: article.slug,
                                          coverImage: article.coverImage,
                                          published: article.published,
                                          isActive: true,
                                          position: old.length + 1,
                                        },
                                      ]);
                                      setMessage(`“${article.title}” adicionado. Salve a ordem para confirmar.`);
                                    }}
                                    aria-label={`Adicionar ${article.title} à série`}
                                  >
                                    <Plus size={14} aria-hidden="true" />
                                    <span>Adicionar</span>
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {(articles.meta.hasPreviousPage || articles.meta.hasNextPage) && (
                        <nav className={styles.pagination} aria-label="Paginação dos artigos">
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy || !articles.meta.hasPreviousPage}
                            onClick={() => void changePage(articles.meta.page - 1)}
                          >
                            Anterior
                          </button>
                          <span>Página {articles.meta.page}</span>
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy || !articles.meta.hasNextPage}
                            onClick={() => void changePage(articles.meta.page + 1)}
                          >
                            Próxima
                          </button>
                        </nav>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* SUB-SCREEN 3C: SETTINGS & DANGER ZONE */}
              {detailTab === "settings" && (
                <div role="tabpanel" className={styles.settingsStack}>
                  <div className={styles.settingsCard}>
                    <h3>Capa da série</h3>
                    <p className={styles.settingsDesc}>
                      JPEG, PNG ou WebP de até 5 MB. Salve alterações de texto antes de trocar a capa.
                    </p>
                    <div className={styles.coverUploadRow}>
                      <CoverImage
                        src={detail.coverImage ?? detail.fallbackCoverImage}
                        className={styles.coverPreview}
                        fallbackLabel="Sem capa"
                        iconSize={26}
                      />
                      <div className={styles.coverControls}>
                        <input
                          ref={fileInputRef}
                          id="series-cover"
                          type="file"
                          className={styles.fileInputHidden}
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busy || uncertain || dirty}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadCover(file);
                          }}
                        />
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          disabled={busy || uncertain || dirty}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImagePlus size={16} aria-hidden="true" />
                          <span>{detail.coverImage ? "Trocar capa" : "Enviar capa"}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={styles.settingsCard}>
                    <h3>Informações da série</h3>
                    <p className={styles.settingsDesc}>Atualize o título e a descrição exibidos na página da série.</p>
                    <form className={styles.form} onSubmit={saveInfo}>
                      <div className={styles.field}>
                        <div className={styles.fieldHeader}>
                          <label htmlFor="edit-series-name">Título</label>
                          <span className={styles.charCount}>{title.length}/150</span>
                        </div>
                        <input
                          id="edit-series-name"
                          required
                          maxLength={150}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          disabled={busy || uncertain}
                        />
                      </div>

                      <div className={styles.field}>
                        <div className={styles.fieldHeader}>
                          <label htmlFor="edit-series-desc">Descrição</label>
                          <span className={styles.charCount}>{description.length}/1000</span>
                        </div>
                        <textarea
                          id="edit-series-desc"
                          maxLength={1000}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          disabled={busy || uncertain}
                        />
                      </div>

                      <div className={styles.formActions}>
                        <button
                          type="submit"
                          className={styles.primaryBtn}
                          disabled={busy || uncertain || !title.trim() || !changedInfo}
                        >
                          {busy ? "Salvando…" : "Salvar informações"}
                        </button>
                        {changedInfo && (
                          <button
                            type="button"
                            className={styles.secondaryBtn}
                            disabled={busy || uncertain}
                            onClick={discardChanges}
                          >
                            Descartar alterações
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className={styles.dangerCard}>
                    <h3>Excluir série</h3>
                    <p>
                      A série será removida permanentemente, mas todos os seus contos e rascunhos serão preservados na
                      sua biblioteca.
                    </p>
                    <button
                      type="button"
                      className={styles.dangerBtn}
                      disabled={busy || uncertain || changedInfo || changedItems}
                      onClick={() => setConfirmation("delete")}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      <span>Excluir série</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {confirmation && (
        <ConfirmDialog
          title={confirmation === "delete" ? "Excluir série?" : "Salvar artigos e ordem?"}
          description={
            confirmation === "delete"
              ? "A série será excluída. Seus artigos serão preservados."
              : "A lista completa e a ordem atuais substituirão as que estiverem salvas."
          }
          confirmLabel={confirmation === "delete" ? "Excluir série" : "Salvar ordem"}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
        />
      )}

      {pendingLeave && (
        <ConfirmDialog
          title="Sair sem salvar?"
          description="Suas alterações na série serão descartadas."
          confirmLabel="Sair sem salvar"
          onCancel={() => setPendingLeave(null)}
          onConfirm={() => {
            const target = pendingLeave;
            setPendingLeave(null);
            if (target.type === "list") {
              discardAndReturnToList();
            } else {
              router.push(target.href);
            }
          }}
        />
      )}
    </main>
  );
}
