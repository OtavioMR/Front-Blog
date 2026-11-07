import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminCsrf, adminTagsRead, count, record } from "../_lib/data";
import { TagCreateForm, TagRowActions } from "./_components/tag-manager";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    page = one(raw.page) || "1";
  const invalid = Array.isArray(raw.page) || !/^[1-9]\d{0,5}$/.test(page);
  const query = new URLSearchParams({ page: invalid ? "1" : page, limit: invalid ? "1" : "20" });

  const [result, csrf] = await Promise.all([adminTagsRead(query), adminCsrf()]);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  if (!csrf) return <AdminFailure reason="session" />;

  if (invalid) {
    return (
      <AdminShell title="Tags" current="tags">
        <section className={styles.panel}>
          <h2>Filtros inválidos</h2>
          <p>Os parâmetros de página informados são inválidos.</p>
          <Link href="/gestao-editorial/tags" className={styles.btnSecondary}>
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
        typeof row.name !== "string" ||
        row.name.length > 50 ||
        typeof row.slug !== "string" ||
        row.slug.length > 60 ||
        !count(row.postCount)
    )
  ) {
    return <AdminFailure reason="unavailable" />;
  }

  const href = (n: number) => {
    const p = new URLSearchParams({ page: String(n) });
    return `/gestao-editorial/tags?${p}`;
  };

  return (
    <AdminShell title="Tags" current="tags">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Taxonomia</p>
        <h2>Tags da plataforma</h2>
        <p>Gerencie termos e etiquetas para indexação temática. Tags sem artigos podem ser excluídas; tags duplicadas podem ser mescladas.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 26rem), 1fr))", gap: "1.5rem" }}>
        {/* Painel: Nova Tag */}
        <section className={styles.panel} style={{ margin: 0, height: "fit-content" }}>
          <h2>Nova tag</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
            Adicione uma nova palavra-chave para indexação de artigos.
          </p>
          <TagCreateForm csrf={csrf} />
        </section>

        {/* Painel: Tags Cadastradas */}
        <section className={styles.panel} style={{ margin: 0 }}>
          <h2>Tags cadastradas</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.88rem" }}>
            {value.meta.total ? `${value.meta.total} tags cadastradas.` : "Palavras-chave em uso no Grifório."}
          </p>

          {value.data.length ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Slug</th>
                    <th>Artigos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {value.data.map(row => (
                    <tr key={String(row.id)}>
                      <td>
                        <strong style={{ color: "var(--text)" }}>#{String(row.name)}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{String(row.slug)}</code>
                      </td>
                      <td>
                        <span className={styles.badgeInReview} style={{ fontSize: "0.75rem" }}>
                          {String(row.postCount)} {Number(row.postCount) === 1 ? "artigo" : "artigos"}
                        </span>
                      </td>
                      <td>
                        <TagRowActions
                          id={String(row.id)}
                          currentName={String(row.name)}
                          postCount={Number(row.postCount)}
                          csrf={csrf}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ padding: "1.5rem 0", textAlign: "center", color: "var(--text-muted)" }}>
              Nenhuma tag encontrada.
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
      </div>
    </AdminShell>
  );
}
