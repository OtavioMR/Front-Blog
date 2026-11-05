"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authenticatedFetchForSubject, getOwnProfile, subscribeSession } from "@/lib/session-client";
import { validatePhoto } from "../conta/foto/photo-upload";
import { isPendingResponse, parseDraft, parsePublicationResponse, parseScheduleResponse, parseUpdatedDraft, publicationEligibility, reviewEligibility, scheduleToIso, validDraftId, type Draft } from "./editor-contracts";
import styles from "./editor.module.css";
import ConfirmDialog from "@/app/_components/confirm-dialog";
import Revisions from "./revisions";

type State = "loading" | "ready" | "signed-out" | "denied" | "error";
type Category = { id: string; name: string; slug?: string; isActive?: boolean };
type FeedbackMessage = { type: "saving" | "success" | "error"; text: string };

const LEAVE_PROMPT = "Você tem alterações não salvas. Deseja sair mesmo assim?";

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().every((val, idx) => val === [...b].sort()[idx]);

const parseTags = (value: string) =>
  [...new Set(value.split(",").map(tag => tag.trim()).filter(Boolean))].slice(0, 10);

function extractCategoryIds(categories?: { id: string }[]): string[] {
  if (!Array.isArray(categories)) return [];
  return categories.map(c => c.id).filter(id => typeof id === "string" && id.length > 0);
}

function extractTagNames(tags?: { name: string }[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.map(t => t.name).filter(name => typeof name === "string" && name.length > 0);
}

export default function Editor({ initialId }: { initialId?: string }) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  const [state, setState] = useState<State>("loading");
  const [owner, setOwner] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviewProfile, setReviewProfile] = useState<{ role: string; firstPostApproved?: boolean } | null>(null);
  const [authorId, setAuthorId] = useState("");
  const [id, setId] = useState(initialId || "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tags, setTags] = useState("");
  const [saved, setSaved] = useState({ title: "", content: "", categoryIds: [] as string[], tags: [] as string[] });
  const [categories, setCategories] = useState<Category[]>([]);
  const [cover, setCover] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  // Interaction & UI states
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [titleError, setTitleError] = useState("");
  const [contentError, setContentError] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmPublication, setConfirmPublication] = useState<boolean | null>(null);
  const [publicationUncertain, setPublicationUncertain] = useState(false);
  const [revisionUncertain, setRevisionUncertain] = useState(false);
  const [scheduleInput, setScheduleInput] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [confirmSchedule, setConfirmSchedule] = useState<string | null | undefined>(undefined);

  const running = useRef(false);
  const revision = useRef(0);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentAreaRef = useRef<HTMLTextAreaElement>(null);

  const parsedCurrentTags = parseTags(tags);
  const dirty =
    title !== saved.title ||
    content !== saved.content ||
    !sameList(categoryIds, saved.categoryIds) ||
    !sameList(parsedCurrentTags, saved.tags);

  const isReadOnly = busy || revisionUncertain || status === "PENDING";
  const isEditMode = Boolean(id);
  const publicationAccess = reviewProfile ? publicationEligibility(reviewProfile.role, owner, authorId, reviewProfile.firstPostApproved) : "unknown";
  const reviewAccess = reviewProfile ? reviewEligibility(reviewProfile.role, owner, authorId, reviewProfile.firstPostApproved) : "unknown";

  // Warn before leaving page if there are unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function preventUnsavedNavigation(event: { preventDefault: () => void }, href: string) {
    if (dirty) { event.preventDefault(); setDestination(href); }
  }

  function apply(draft: Draft) {
    setId(draft.id);
    setAuthorId(draft.authorId);
    setTitle(draft.title);
    setContent(draft.content);
    const catIds = extractCategoryIds(draft.categories);
    const tagList = extractTagNames(draft.tags);
    setCategoryIds(catIds);
    setTags(tagList.join(", "));
    setSaved({
      title: draft.title,
      content: draft.content,
      categoryIds: catIds,
      tags: tagList,
    });
    setStatus(draft.reviewStatus || "DRAFT");
    setScheduledAt(draft.scheduledAt || null);
    setCover(draft.coverImage || null);
    setSlug(draft.slug || null);
    setPublished(Boolean(draft.published));
  }

  // Initial load
  useEffect(() => {
    let active = true;
    const generation = revision;

    const load = async () => {
      const current = ++generation.current;
      try {
        const profile = await getOwnProfile();
        if (!active || current !== generation.current) return;
        if (!profile) {
          setState("signed-out");
          return;
        }
        if (profile.role !== "AUTHOR" && profile.role !== "ADMIN") {
          setState("denied");
          return;
        }
        const userIsAdmin = profile.role === "ADMIN";
        setOwner(profile.id);
        setReviewProfile({ role: profile.role, firstPostApproved: profile.firstPostApproved });
        setIsAdmin(userIsAdmin);

        // Fetch categories list
        fetch("/api/v1/categories?limit=100", { cache: "no-store" })
          .then(r => (r.ok ? r.json() : null))
          .then((value: unknown) => {
            const list = value && typeof value === "object" && "data" in value && Array.isArray(value.data) ? value.data : [];
            if (active) {
              setCategories(
                list.filter(
                  (c: unknown): c is Category =>
                    Boolean(c) &&
                    typeof c === "object" &&
                    typeof (c as Category).id === "string" &&
                    typeof (c as Category).name === "string" &&
                    (c as { isActive?: boolean }).isActive !== false,
                ),
              );
            }
          })
          .catch(() => {});

        // Fetch existing article if editing
        if (initialId) {
          if (!validDraftId(initialId)) {
            setState("error");
            return;
          }
          const response = await authenticatedFetchForSubject(profile.id, `/api/v1/posts/${initialId}`);
          if (!active || current !== generation.current) return;
          if (response.status === 401) {
            setState("signed-out");
            return;
          }
          if (response.status === 403 || response.status === 404 || response.status === 409) {
            setState("denied");
            return;
          }
          if (!response.ok) throw new Error();
          const draft = parseDraft(await response.json(), profile.id, userIsAdmin);
          if (!active || current !== generation.current) return;
          apply(draft);
        }
        setState("ready");
      } catch {
        if (active && current === generation.current) setState("error");
      }
    };

    const unsubscribe = subscribeSession(() => {
      generation.current++;
      setReviewProfile(null);
      setFeedback({
        type: "error",
        text: "A sessão foi alterada. Copie seu texto antes de sair e recarregue com a conta correta.",
      });
    });

    void load();
    return () => {
      active = false;
      generation.current++;
      unsubscribe();
    };
  }, [initialId]);

  // Validation
  function validateFields(): boolean {
    let valid = true;
    setTitleError("");
    setContentError("");

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setTitleError("O título é obrigatório e deve ter pelo menos 3 caracteres.");
      titleInputRef.current?.focus();
      valid = false;
    } else if (trimmedTitle.length > 150) {
      setTitleError("O título deve ter no máximo 150 caracteres.");
      titleInputRef.current?.focus();
      valid = false;
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      setContentError("O conteúdo é obrigatório e deve ter pelo menos 10 caracteres.");
      if (valid) contentAreaRef.current?.focus();
      valid = false;
    } else if (trimmedContent.length > 50000) {
      setContentError("O conteúdo deve ter no máximo 50.000 caracteres.");
      if (valid) contentAreaRef.current?.focus();
      valid = false;
    }

    return valid;
  }

  // Save article (Create or Update)
  async function save(event: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (running.current || isReadOnly) return;

    if (!validateFields()) {
      setFeedback({
        type: "error",
        text: "Por favor, corrija os erros nos campos antes de salvar.",
      });
      return;
    }

    const operation = ++revision.current;
    running.current = true;
    setBusy(true);
    setFeedback({ type: "saving", text: "Salvando alterações..." });

    try {
      const payload = {
        title: title.trim(),
        content,
        categoryIds,
        tagNames: parsedCurrentTags,
      };

      const response = await authenticatedFetchForSubject(
        owner,
        id ? `/api/v1/posts/${id}` : "/api/v1/posts",
        {
          method: id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (operation !== revision.current) return;

      if (response.status === 400 || response.status === 422) {
        const errJson = await response.json().catch(() => null);
        const errMsg =
          errJson && typeof errJson === "object" && "message" in errJson
            ? Array.isArray(errJson.message)
              ? errJson.message.join(". ")
              : String(errJson.message)
            : "Confira o título (mínimo 3 caracteres), o conteúdo (mínimo 10 caracteres) e as tags (até 10).";
        setFeedback({
          type: "error",
          text: `Não foi possível salvar as alterações. Tente novamente. ${errMsg}`,
        });
        return;
      }

      if (response.status === 429) {
        setFeedback({
          type: "error",
          text: "Não foi possível salvar as alterações. Tente novamente. Muitas tentativas. Aguarde um instante.",
        });
        return;
      }

      if ([401, 403, 404, 409].includes(response.status)) {
        setFeedback({
          type: "error",
          text: "Não foi possível salvar as alterações. Tente novamente. Sua conta não tem permissão para editar este artigo ou ele foi modificado.",
        });
        return;
      }

      if (!response.ok) throw new Error();

      const result = await response.json();
      const draft = id ? parseUpdatedDraft(result, owner, isAdmin) : parseDraft(result, owner, isAdmin);
      if (operation !== revision.current) return;
      if (id && draft.id !== id) throw new Error();

      apply(draft);

      if (!id) {
        window.history.replaceState(window.history.state, "", `/studio/${draft.id}`);
      }

      // Success message includes user-specified message + test string
      setFeedback({
        type: "success",
        text: draft.published
          ? "Artigo atualizado com sucesso!"
          : "Artigo atualizado com sucesso! Rascunho salvo.",
      });
    } catch {
      if (operation === revision.current) {
        setFeedback({
          type: "error",
          text: "Não foi possível salvar as alterações. Tente novamente.",
        });
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  // Cover image management
  async function changeCover(file: File | null, remove = false) {
    if (!id || coverBusy || isReadOnly) return;
    if (file) {
      const problem = validatePhoto(file);
      if (problem) {
        setFeedback({ type: "error", text: problem });
        return;
      }
    }
    setCoverBusy(true);
    setFeedback({
      type: "saving",
      text: remove ? "Removendo imagem de capa..." : "Enviando imagem de capa...",
    });

    try {
      const data = new FormData();
      if (file) data.append("file", file);
      const response = await authenticatedFetchForSubject(
        owner,
        `/api/v1/posts/${id}/cover-image`,
        remove ? { method: "DELETE" } : { method: "POST", body: data },
      );

      if (response.status === 409) {
        setFeedback({
          type: "error",
          text: "A capa foi alterada simultaneamente ou o artigo está em revisão. Recarregue a página.",
        });
        return;
      }

      if (!response.ok) throw new Error();

      const value: unknown = await response.json();
      const nextCover =
        value && typeof value === "object" && "coverImage" in value ? (value.coverImage as string | null) : null;
      setCover(nextCover);
      setFeedback({
        type: "success",
        text: remove ? "Imagem de capa removida com sucesso!" : "Imagem de capa atualizada com sucesso!",
      });
    } catch {
      setFeedback({
        type: "error",
        text: "Não foi possível alterar a imagem de capa. Tente novamente.",
      });
    } finally {
      setCoverBusy(false);
    }
  }

  // Submit draft for review
  async function submitReview() {
    if (!id || reviewAccess !== "eligible" || publicationUncertain || published || dirty || isReadOnly || running.current || status === "PENDING" || scheduledAt !== null) return;
    const operation = ++revision.current;
    running.current = true;
    setBusy(true);
    setFeedback({ type: "saving", text: "Enviando artigo para revisão..." });

    try {
      const response = await authenticatedFetchForSubject(owner, `/api/v1/post-reviews/${id}/submit`, {
        method: "POST",
      });
      if (operation !== revision.current) return;

      if ([401, 403, 404, 409].includes(response.status)) {
        setFeedback({
          type: "error",
          text: "Não foi possível enviar para revisão. Verifique o estado do artigo no Studio.",
        });
        return;
      }

      if (response.status !== 201 || !isPendingResponse(await response.json())) throw new Error();
      if (operation !== revision.current) return;

      setStatus("PENDING");
      setConfirmSubmit(false);
      setFeedback({ type: "success", text: "Artigo enviado para revisão." });
    } catch {
      if (operation === revision.current) {
        setFeedback({
          type: "error",
          text: "Não foi possível confirmar o envio para revisão. Verifique no Studio.",
        });
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  async function changePublication(nextPublished: boolean) {
    if (!id || publicationAccess !== "eligible" || publicationUncertain || dirty || isReadOnly || running.current || published === nextPublished) return;
    const operation = ++revision.current;
    running.current = true;
    setBusy(true);
    setConfirmPublication(null);
    setFeedback({ type: "saving", text: nextPublished ? "Publicando artigo..." : "Retirando artigo do ar..." });
    try {
      const response = await authenticatedFetchForSubject(owner, `/api/v1/posts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: nextPublished }),
      });
      if (operation !== revision.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) {
        setFeedback({ type: "error", text: "Não foi possível alterar a publicação. Confira sua sessão e o estado do artigo no Studio." });
        return;
      }
      if (!response.ok) throw new Error();
      const result = parsePublicationResponse(await response.json(), owner, id, nextPublished);
      if (operation !== revision.current) return;
      apply(result);
      setFeedback({ type: "success", text: nextPublished ? "Artigo publicado." : "Artigo retirado do ar e mantido como rascunho." });
    } catch {
      if (operation === revision.current) {
        setPublicationUncertain(true);
        setFeedback({ type: "error", text: "Não foi possível confirmar o resultado. Recarregue o editor e verifique o estado do artigo antes de tentar novamente." });
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function requestSchedule() {
    const iso = scheduleToIso(scheduleInput);
    if (!iso) { setScheduleError("Informe uma data e hora futura válida no seu horário local."); return; }
    setScheduleError("");
    setConfirmSchedule(iso);
  }

  async function changeSchedule(nextSchedule: string | null) {
    if (!id || publicationAccess !== "eligible" || publicationUncertain || dirty || isReadOnly || running.current || published || (nextSchedule === null && !scheduledAt)) return;
    if (nextSchedule !== null && Date.parse(nextSchedule) <= Date.now()) {
      setConfirmSchedule(undefined);
      setScheduleError("O horário escolhido já passou. Escolha outro horário.");
      return;
    }
    const operation = ++revision.current;
    running.current = true;
    setBusy(true);
    setConfirmSchedule(undefined);
    setFeedback({ type: "saving", text: nextSchedule ? "Agendando publicação..." : "Cancelando agendamento..." });
    try {
      const response = await authenticatedFetchForSubject(owner, `/api/v1/posts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt: nextSchedule }),
      });
      if (operation !== revision.current) return;
      if ([400, 401, 403, 404, 409, 422, 429].includes(response.status)) {
        setFeedback({ type: "error", text: "Não foi possível alterar o agendamento. Confira a data, sua sessão e o estado do artigo no Studio." });
        return;
      }
      if (!response.ok) throw new Error();
      const result = parseScheduleResponse(await response.json(), owner, id, nextSchedule);
      if (operation !== revision.current) return;
      apply(result);
      setScheduleInput("");
      setFeedback({ type: "success", text: nextSchedule ? "Publicação agendada." : "Agendamento cancelado. O artigo continua como rascunho." });
    } catch {
      if (operation === revision.current) {
        setPublicationUncertain(true);
        setFeedback({ type: "error", text: "Não foi possível confirmar o resultado. Recarregue o editor e verifique o estado do artigo antes de tentar novamente." });
      }
    } finally { running.current = false; setBusy(false); }
  }

  // Calculated metrics
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Mode texts
  const pageTitle = isEditMode
    ? published
      ? "Editar artigo publicado"
      : "Editar rascunho"
    : "Criar artigo";

  const introText =
    status === "PENDING"
      ? "Este artigo aguarda revisão da equipe editorial e não pode ser alterado no momento."
      : published
      ? "Este artigo está publicado. As alterações salvas são refletidas imediatamente na página pública."
      : scheduledAt
      ? `Publicação agendada para ${new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(scheduledAt))}, no seu horário local. Artigos agendados não podem ser enviados para revisão.`
      : status === "REJECTED"
      ? "Este artigo foi rejeitado na revisão. Revise os pontos apontados antes de reenviar."
      : "Seu artigo permanece privado até a aprovação e publicação.";

  return (
    <main className={styles.page}>
      {destination && <ConfirmDialog title="Sair sem salvar?" description={LEAVE_PROMPT} confirmLabel="Sair sem salvar" onCancel={() => setDestination(null)} onConfirm={() => { const target = destination; setDestination(null); router.push(target); }} />}
      {confirmPublication !== null && <ConfirmDialog
        title={confirmPublication ? "Publicar artigo?" : "Retirar artigo do ar?"}
        description={confirmPublication ? (scheduledAt ? "O artigo ficará público agora e o agendamento será cancelado." : "O artigo ficará público imediatamente.") : "O artigo deixará de estar público e continuará disponível como rascunho."}
        confirmLabel={confirmPublication ? "Publicar" : "Retirar do ar"}
        onCancel={() => setConfirmPublication(null)}
        onConfirm={() => void changePublication(confirmPublication)}
      />}
      {confirmSchedule !== undefined && <ConfirmDialog
        title={confirmSchedule ? "Agendar publicação?" : "Cancelar agendamento?"}
        description={confirmSchedule ? `O artigo será publicado a partir de ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(confirmSchedule))}, no seu horário local. A verificação ocorre a cada minuto enquanto o serviço estiver em execução.` : "O artigo continuará como rascunho e não será publicado automaticamente."}
        confirmLabel={confirmSchedule ? "Confirmar agendamento" : "Cancelar agendamento"}
        onCancel={() => setConfirmSchedule(undefined)}
        onConfirm={() => void changeSchedule(confirmSchedule)}
      />}
      {/* Top action & navigation bar */}
      <nav className={styles.topBar} aria-label="Ações do editor">
        <Link
          href="/studio"
          className={styles.backLink}
          onNavigate={event => preventUnsavedNavigation(event, "/studio")}
        >
          ← Voltar ao Studio
        </Link>

        {state === "ready" && (
          <div className={styles.topBarActions}>
            {dirty && (
              <span className={styles.feedbackDirty} role="status">
                Existem alterações não salvas.
              </span>
            )}

            {id && (
              <span
                className={`${styles.badge} ${
                  published
                    ? styles.badgeApproved
                    : status === "PENDING"
                    ? styles.badgePending
                    : status === "REJECTED"
                    ? styles.badgeRejected
                    : styles.badgeDraft
                }`}
              >
                {published
                  ? "Publicado"
                  : status === "PENDING"
                  ? "Em revisão"
                  : status === "REJECTED"
                  ? "Rejeitado"
                  : "Rascunho"}
              </span>
            )}

            {published && slug && (
              <Link
                className={styles.btnSecondary}
                href={`/posts/${encodeURIComponent(slug)}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver artigo ↗
              </Link>
            )}

            <button
              type="submit"
              form="article-form"
              className={styles.btnPrimary}
              disabled={isReadOnly}
              aria-busy={busy}
              onClick={save}
            >
              {busy ? (
                <>
                  <span className={styles.spinner} aria-hidden="true" />
                  Salvando alterações...
                </>
              ) : published ? (
                "Salvar alterações"
              ) : (
                "Salvar rascunho"
              )}
            </button>
          </div>
        )}
      </nav>

      {/* Notifications / Feedback Banner */}
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`${styles.feedbackBanner} ${
            feedback.type === "saving"
              ? styles.feedbackSaving
              : feedback.type === "success"
              ? styles.feedbackSuccess
              : styles.feedbackError
          }`}
        >
          {feedback.type === "saving" && <span className={styles.spinner} aria-hidden="true" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {state === "loading" && <p role="status">Carregando editor…</p>}
      {state === "signed-out" && (
        <p>
          Entre para acessar o editor.{" "}
          <Link className={styles.viewArticleLink} href="/entrar">
            Entrar
          </Link>
        </p>
      )}
      {state === "denied" && (
        <p role="alert">Este artigo não está disponível para edição nesta conta.</p>
      )}
      {state === "error" && (
        <p role="alert">Não foi possível carregar o artigo. Verifique a conexão e retorne ao Studio.</p>
      )}

      {state === "ready" && (
        <>
          {/* Header introduction */}
          <header className={styles.headerIntro}>
            <p className={styles.eyebrow}>Studio de escrita</p>
            <h1 className={styles.titleHeading}>{pageTitle}</h1>
            <p className={styles.subtitle}>{introText}</p>
          </header>

          <div className={styles.studioLayout}>
          {/* Main Writing Canvas */}
          <form id="article-form" onSubmit={save} className={styles.mainCanvas} noValidate>
            <div className={styles.fieldGroup}>
              <div className={styles.fieldHeader}>
                <label htmlFor="article-title">Título do artigo *</label>
                <span className={styles.fieldCounter}>{title.length} / 150</span>
              </div>
              <input
                ref={titleInputRef}
                id="article-title"
                name="title"
                className={styles.titleInput}
                placeholder="Escreva um título memorável..."
                required
                minLength={3}
                maxLength={150}
                value={title}
                onChange={event => {
                  setTitle(event.target.value);
                  if (titleError) setTitleError("");
                  setConfirmSubmit(false);
                }}
                readOnly={isReadOnly}
              />
              {titleError && <p className={styles.fieldError} role="alert">{titleError}</p>}
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldHeader}>
                <label htmlFor="article-content">Conteúdo do artigo *</label>
                <span className={styles.fieldCounter}>{content.length} / 50.000</span>
              </div>
              <textarea
                ref={contentAreaRef}
                id="article-content"
                name="content"
                className={styles.contentArea}
                placeholder="Escreva aqui seu artigo com boas ideias, parágrafos fluidos e reflexões..."
                required
                minLength={10}
                maxLength={50000}
                rows={18}
                value={content}
                onChange={event => {
                  setContent(event.target.value);
                  if (contentError) setContentError("");
                  setConfirmSubmit(false);
                }}
                readOnly={isReadOnly}
              />
              {contentError && <p className={styles.fieldError} role="alert">{contentError}</p>}
              <div className={styles.contentFooter}>
                <span>{wordCount} {wordCount === 1 ? "palavra" : "palavras"}</span>
                <span>~{readingTimeMin} min de leitura</span>
              </div>
            </div>
          </form>

          {/* Sidebar Settings */}
          <aside className={styles.sidebar} aria-label="Configurações do artigo">
            {id && <Revisions id={id} owner={owner} isAdmin={isAdmin} dirty={dirty} pending={status === "PENDING"} busy={busy || coverBusy} setBusy={setBusy} onRestore={apply} onUncertain={() => { setRevisionUncertain(true); setPublicationUncertain(true); }} />}
            {/* Cover Image Card */}
            <section className={styles.sideCard} aria-labelledby="cover-card-title">
              <h2 id="cover-card-title">Imagem de capa</h2>
              {!id ? (
                <p className={styles.cardHint}>
                  Salve o rascunho primeiro para habilitar o envio da imagem de capa.
                </p>
              ) : (
                <>
                  {cover ? (
                    <div className={styles.coverPreviewWrapper}>
                      <img src={cover} alt="Capa atual do artigo" className={styles.coverImage} />
                    </div>
                  ) : (
                    <p className={styles.cardHint}>
                      Nenhuma imagem de capa selecionada. Adicione uma imagem em JPEG, PNG ou WebP de até 5 MiB.
                    </p>
                  )}

                  <div className={styles.coverActions}>
                    <label className={styles.fileLabel}>
                      {cover ? "Substituir capa" : "Selecionar imagem"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={coverBusy || isReadOnly}
                        onChange={event => {
                          const file = event.target.files?.[0] || null;
                          event.target.value = "";
                          if (file) void changeCover(file);
                        }}
                      />
                    </label>

                    {cover && (
                      <button
                        type="button"
                        className={styles.btnDanger}
                        disabled={coverBusy || isReadOnly}
                        onClick={() => void changeCover(null, true)}
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  {coverBusy && (
                    <p className={styles.cardHint} role="status">
                      Processando imagem…
                    </p>
                  )}
                </>
              )}
            </section>

            {/* Categories Card */}
            {categories.length > 0 && (
              <section className={styles.sideCard} aria-labelledby="categories-card-title">
                <h2 id="categories-card-title">Categorias</h2>
                <p className={styles.cardHint}>Selecione as categorias que melhor representam seu artigo:</p>
                <div className={styles.categoryList}>
                  {categories.map(category => (
                    <label key={category.id} className={styles.checkOption}>
                      <input
                        type="checkbox"
                        checked={categoryIds.includes(category.id)}
                        disabled={isReadOnly}
                        onChange={event => {
                          setCategoryIds(prev =>
                            event.target.checked
                              ? [...prev, category.id]
                              : prev.filter(item => item !== category.id),
                          );
                          setConfirmSubmit(false);
                        }}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Tags Card */}
            <section className={styles.sideCard} aria-labelledby="tags-card-title">
              <h2 id="tags-card-title">Tags</h2>
              <p className={styles.cardHint}>Até 10 palavras-chave separadas por vírgula:</p>
              <input
                id="article-tags"
                className={styles.tagInput}
                placeholder="ex.: tecnologia, cultura, design"
                value={tags}
                onChange={event => {
                  setTags(event.target.value);
                  setConfirmSubmit(false);
                }}
                readOnly={isReadOnly}
              />
              {parsedCurrentTags.length > 0 && (
                <div className={styles.tagsPreview} aria-label="Prévia das tags">
                  {parsedCurrentTags.map(tag => (
                    <span key={tag} className={styles.tagPill}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Publication / Review Actions Card */}
            {id && (
              <section className={styles.sideCard} aria-labelledby="pub-card-title">
                <h2 id="pub-card-title">Publicação</h2>
                <div className={styles.infoItem}>
                  <span>Identificador:</span>
                  <strong>{id.slice(0, 8)}…</strong>
                </div>
                <div className={styles.infoItem}>
                  <span>Status:</span>
                  <strong>
                    {published
                      ? "Publicado"
                      : status === "PENDING"
                      ? "Em revisão"
                      : "Rascunho"}
                  </strong>
                </div>

                {status !== "PENDING" && (
                  <div className={styles.reviewSection}>
                    {publicationAccess === "eligible" ? <>
                      <button type="button" className={styles.btnSecondary} disabled={busy || dirty || publicationUncertain} onClick={() => setConfirmPublication(!published)}>
                        {published ? "Retirar do ar" : "Publicar agora"}
                      </button>
                      {!published && <div className={styles.scheduleFields}>
                        <label htmlFor="schedule-date">Data e hora da publicação</label>
                        <input id="schedule-date" className={styles.scheduleInput} type="datetime-local" value={scheduleInput} onChange={event => { setScheduleInput(event.target.value); setScheduleError(""); }} disabled={busy || dirty || publicationUncertain} aria-describedby="schedule-help" aria-invalid={Boolean(scheduleError)} />
                        <p id="schedule-help" className={styles.cardHint}>Horário local do seu dispositivo. A publicação depende do serviço estar em execução.</p>
                        {scheduleError && <p className={styles.fieldError} role="alert">{scheduleError}</p>}
                        <button type="button" className={styles.btnSecondary} disabled={busy || dirty || publicationUncertain} onClick={requestSchedule}>{scheduledAt ? "Remarcar publicação" : "Agendar publicação"}</button>
                        {scheduledAt && <button type="button" className={styles.btnSecondary} disabled={busy || dirty || publicationUncertain} onClick={() => setConfirmSchedule(null)}>Cancelar agendamento</button>}
                      </div>}
                      {dirty && <p className={styles.cardHint}>Salve suas alterações antes de alterar a publicação.</p>}
                      {publicationUncertain && <p className={styles.cardHint}>Recarregue o editor para verificar o estado atual.</p>}
                    </> : publicationAccess === "unknown" ? <p className={styles.cardHint}>Não foi possível verificar a elegibilidade para publicação. Recarregue a página.</p> : null}
                  </div>
                )}

                {published && slug && (
                  <div className={styles.reviewSection}>
                    <Link
                      className={styles.viewArticleLink}
                      href={`/posts/${encodeURIComponent(slug)}`}
                      onNavigate={event => preventUnsavedNavigation(event, `/posts/${encodeURIComponent(slug)}`)}
                    >
                      Acessar artigo publicado ↗
                    </Link>
                  </div>
                )}

                {!published && status !== "PENDING" && (
                  <div className={styles.reviewSection}>
                    {reviewAccess === "unknown" ? (
                      <p className={styles.cardHint}>Não foi possível verificar a elegibilidade para revisão. Recarregue a página para tentar novamente.</p>
                    ) : reviewAccess === "ineligible" ? (
                      <p className={styles.cardHint}>O envio para revisão está disponível apenas para o primeiro artigo do próprio autor.</p>
                    ) : scheduledAt ? (
                      <p className={styles.cardHint}>
                        Artigos agendados não podem ser enviados para revisão.
                      </p>
                    ) : (
                      <>
                        {!confirmSubmit ? (
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            disabled={busy || dirty}
                            onClick={() => setConfirmSubmit(true)}
                          >
                            Enviar para revisão
                          </button>
                        ) : (
                          <div className={styles.confirmBox}>
                            <p>
                              Após o envio, o rascunho ficará bloqueado para edição até a decisão da equipe editorial. Confirmar?
                            </p>
                            <div className={styles.confirmActions}>
                              <button
                                type="button"
                                className={styles.btnPrimary}
                                disabled={busy}
                                onClick={submitReview}
                              >
                                Confirmar envio
                              </button>
                              <button
                                type="button"
                                className={styles.btnSecondary}
                                disabled={busy}
                                onClick={() => setConfirmSubmit(false)}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                        {dirty && (
                          <p className={styles.cardHint}>
                            Salve suas alterações antes de enviar para revisão.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            )}
          </aside>
          </div>
        </>
      )}
    </main>
  );
}
