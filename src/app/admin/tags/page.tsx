import Link from "next/link";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminCsrf, adminTagsRead, count, record } from "../_lib/data";
import { TagCreateForm, TagRowActions } from "./_components/tag-manager";
import styles from "../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => typeof v === "string" ? v.trim() : "";

export default async function TagsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams, page = one(raw.page) || "1";
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
          <Link href="/admin/tags">Limpar filtros</Link>
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
    return `/admin/tags?${p}`;
  };

  return (
    <AdminShell title="Tags" current="tags">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Taxonomia</p>
        <h2>Tags da plataforma</h2>
        <p>Gerencie palavras-chave dos artigos. Tags sem uso podem ser excluídas; tags com artigos podem ser mescladas.</p>
      </div>

      <section className={styles.panel}>
        <h2>Nova tag</h2>
        <TagCreateForm csrf={csrf} />
      </section>

      <section className={styles.panel}>
        <h2>Tags cadastradas</h2>
        {value.data.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Endereço (slug)</th>
                  <th>Artigos associados</th>
                  <th>Identificador</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.data.map(row => (
                  <tr key={String(row.id)}>
                    <td><strong>{String(row.name)}</strong></td>
                    <td>{String(row.slug)}</td>
                    <td>{String(row.postCount)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{String(row.id)}</td>
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
          <p>Nenhuma tag encontrada.</p>
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
    </AdminShell>
  );
}
