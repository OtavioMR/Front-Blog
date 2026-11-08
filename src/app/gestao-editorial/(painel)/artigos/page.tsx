import Form from "next/form";
import Link from "next/link";
import Avatar from "@/app/_components/avatar";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminPostsRead, record } from "../_lib/data";
import { IconFilter, IconArrowUpRight, IconReview } from "../_components/icons";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
const statuses: Record<string, string> = {
  published: "Publicados",
  pending: "Em revisão",
  rejected: "Rejeitados",
  hidden: "Ocultos",
  draft: "Rascunhos",
};

function reviewStatusBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return styles.badgePending;
    case "APPROVED":
      return styles.badgeApproved;
    case "REJECTED":
      return styles.badgeRejected;
    default:
      return styles.badgeDraft;
  }
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    page = one(raw.page) || "1",
    search = one(raw.search),
    status = one(raw.status),
    authorId = one(raw.authorId);

  const invalid =
    [raw.page, raw.search, raw.status, raw.authorId].some(Array.isArray) ||
    !/^[1-9]\d{0,5}$/.test(page) ||
    search.length > 150 ||
    !!(status && !Object.hasOwn(statuses, status)) ||
    !!(authorId && !uuid.test(authorId));

  const query = new URLSearchParams({ page: invalid ? "1" : page, limit: invalid ? "1" : "20" });
  if (!invalid) {
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (authorId) query.set("authorId", authorId);
  }

  const result = await adminPostsRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;

  if (invalid) {
    return (
      <AdminShell title="Artigos" current="posts">
        <section className={styles.panel}>
          <h2>Filtros inválidos</h2>
          <p>Os parâmetros de busca informados não são válidos.</p>
          <Link href="/gestao-editorial/artigos" className={styles.btnSecondary}>
            Limpar filtros
          </Link>
        </section>
      </AdminShell>
    );
  }

  const value = result.value;
  if (
    !record(value) ||
    !Array.isArray(value.data) ||
    value.data.length > 20 ||
    !record(value.meta) ||
    value.meta.page !== Number(page) ||
    typeof value.meta.hasPreviousPage !== "boolean" ||
    typeof value.meta.hasNextPage !== "boolean" ||
    (page === "1" && value.meta.hasPreviousPage) ||
    (page === "999999" && value.meta.hasNextPage) ||
    value.data.some(
      row =>
        !record(row) ||
        typeof row.id !== "string" ||
        !uuid.test(row.id) ||
        typeof row.title !== "string" ||
        row.title.length > 255 ||
        typeof row.authorId !== "string" ||
        !uuid.test(row.authorId) ||
        typeof row.published !== "boolean" ||
        typeof row.isActive !== "boolean" ||
        typeof row.moderationHidden !== "boolean" ||
        !["DRAFT", "PENDING", "APPROVED", "REJECTED"].includes(String(row.reviewStatus)) ||
        typeof row.createdAt !== "string" ||
        !Number.isFinite(Date.parse(row.createdAt))
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const href = (n: number) => {
    const p = new URLSearchParams(query);
    p.delete("limit");
    p.set("page", String(n));
    return `/gestao-editorial/artigos?${p}`;
  };

  const statusTabHref = (s: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (search) p.set("search", search);
    if (authorId) p.set("authorId", authorId);
    return `/gestao-editorial/artigos?${p}`;
  };

  return (
    <AdminShell title="Artigos" current="posts">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Gestão editorial</p>
        <h2>Artigos da plataforma</h2>
        <p>Publicação, revisão e ocultação são estados independentes.</p>
      </div>

      {/* Tabs de Filtro Rápido */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        {[
          { key: "", label: "Todos os artigos" },
          { key: "pending", label: "Em revisão editorial" },
          { key: "published", label: "Publicados" },
          { key: "hidden", label: "Ocultados por moderação" },
          { key: "draft", label: "Rascunhos" },
          { key: "rejected", label: "Rejeitados" },
        ].map(tab => (
          <Link
            key={tab.key}
            href={statusTabHref(tab.key)}
            prefetch={false}
            className={status === tab.key ? styles.btnPrimary : styles.btnSecondary}
            style={{ padding: "0.45rem 0.9rem", fontSize: "0.82rem" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Painel de Filtros */}
      <section className={styles.panel}>
        <Form className={styles.filters} action="/gestao-editorial/artigos" prefetch={false}>
          <label>
            Buscar título
            <input
              name="search"
              defaultValue={search}
              maxLength={150}
              placeholder="Digite o título..."
            />
          </label>

          <label>
            Situação
            <select name="status" defaultValue={status}>
              <option value="">Todas</option>
              {Object.entries(statuses).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Identificador do autor
            <input
              name="authorId"
              defaultValue={authorId}
              maxLength={36}
              placeholder="UUID do autor..."
            />
          </label>

          <button type="submit">
            <IconFilter size={15} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
            Filtrar
          </button>
        </Form>
      </section>

      {/* Tabela de Artigos */}
      <section className={styles.panel}>
        {value.data.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Autor</th>
                  <th>Revisão</th>
                  <th>Visibilidade</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.data.map(row => (
                  <tr key={String(row.id)}>
                    <td>
                      <strong style={{ color: "var(--text)" }}>{String(row.title)}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.78rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                        <Avatar name={record(row.author) && typeof row.author.name === "string" ? row.author.name : "Usuário removido"} src={record(row.author) && typeof row.author.profilePhoto === "string" ? row.author.profilePhoto : null} size={24} /> {record(row.author) && typeof row.author.name === "string" ? row.author.name : "Usuário removido"}
                      </span>
                    </td>
                    <td>
                      <span className={reviewStatusBadgeClass(String(row.reviewStatus))}>
                        {String(row.reviewStatus) === "PENDING" && <IconReview size={12} />}
                        {String(row.reviewStatus)}
                      </span>
                    </td>
                    <td>
                      {row.moderationHidden ? (
                        <span className={styles.badgeHidden}>Oculto</span>
                      ) : row.published && row.isActive ? (
                        <span className={styles.badgeApproved}>Publicado</span>
                      ) : (
                        <span className={styles.badgeDismissed}>Não público</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {new Date(String(row.createdAt)).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/gestao-editorial/artigos/${row.id}`}
                        prefetch={false}
                        className={styles.btnSecondary}
                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                      >
                        <span>Ver artigo</span>
                        <IconArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-muted)" }}>
            Nenhum artigo nesta página.
          </p>
        )}

        <nav className={styles.pagination} aria-label="Paginação">
          {value.meta.hasPreviousPage && (
            <Link href={href(Number(page) - 1)} prefetch={false}>
              Anterior
            </Link>
          )}
          <span>Página {page}</span>
          {value.meta.hasNextPage && (
            <Link href={href(Number(page) + 1)} prefetch={false}>
              Próxima
            </Link>
          )}
        </nav>
      </section>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/gestao-editorial/artigos?status=pending" className={styles.btnSecondary} prefetch={false}>
          Ver primeiras publicações em revisão
        </Link>
      </p>
    </AdminShell>
  );
}
