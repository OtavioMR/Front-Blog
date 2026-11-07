import Form from "next/form";
import Link from "next/link";
import Avatar from "@/app/_components/avatar";
import { AdminFailure, AdminShell } from "../_components/shell";
import { adminUsersRead, record } from "../_lib/data";
import { IconFilter, IconArrowUpRight, IconShield } from "../_components/icons";
import styles from "../admin.module.css";

/* O detalhe existente é um Route Handler que entrega um documento completo. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles = ["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"];
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

function userRoleBadgeClass(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return styles.roleBadgeSuperAdmin;
    case "ADMIN":
      return styles.roleBadgeAdmin;
    case "AUTHOR":
      return styles.roleBadgeAuthor;
    default:
      return styles.roleBadgeReader;
  }
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams,
    page = one(raw.page) || "1",
    search = one(raw.search),
    role = one(raw.role),
    status = one(raw.status),
    sort = one(raw.sort) || "createdAt",
    order = one(raw.order) || "DESC";

  const invalid =
    [raw.page, raw.search, raw.role, raw.status, raw.sort, raw.order].some(Array.isArray) ||
    !/^[1-9]\d{0,5}$/.test(page) ||
    search.length > 255 ||
    !!(role && !roles.includes(role)) ||
    !["", "active", "suspended", "inactive"].includes(status) ||
    !["createdAt", "name"].includes(sort) ||
    !["ASC", "DESC"].includes(order);

  const query = new URLSearchParams({ page: invalid ? "1" : page, limit: invalid ? "1" : "20" });
  if (!invalid) {
    if (search) query.set("search", search);
    if (role) query.set("role", role);
    if (status) query.set("status", status);
    if (sort !== "createdAt") query.set("sort", sort);
    if (order !== "DESC") query.set("order", order);
  }

  const result = await adminUsersRead(query);
  if (!result.ok) return <AdminFailure reason={result.reason} />;

  if (invalid) {
    return (
      <AdminShell title="Usuários" current="users">
        <section className={styles.panel}>
          <h2>Filtros inválidos</h2>
          <p>Os parâmetros de busca informados não são válidos.</p>
          <Link href="/gestao-editorial/usuarios" className={styles.btnSecondary}>
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
        row.name.length > 255 ||
        typeof row.email !== "string" ||
        row.email.length > 255 ||
        !roles.includes(String(row.role)) ||
        typeof row.isActive !== "boolean" ||
        typeof row.moderationSuspended !== "boolean" ||
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
    return `/gestao-editorial/usuarios?${p}`;
  };

  return (
    <AdminShell title="Usuários" current="users">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Comunidade</p>
        <h2>Contas da plataforma</h2>
        <p>Consulte contas, sua situação e o histórico administrativo.</p>
      </div>

      {/* Painel de Filtros e Busca */}
      <section className={styles.panel}>
        <Form className={styles.filters} action="/gestao-editorial/usuarios" prefetch={false}>
          <label>
            Nome, e-mail ou identificador
            <input
              name="search"
              defaultValue={search}
              maxLength={255}
              placeholder="Digite para buscar..."
            />
          </label>

          <label>
            Papel
            <select name="role" defaultValue={role}>
              <option value="">Todos</option>
              {roles.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label>
            Situação
            <select name="status" defaultValue={status}>
              <option value="">Todas</option>
              <option value="active">Ativa</option>
              <option value="suspended">Suspensa</option>
              <option value="inactive">Inativa</option>
            </select>
          </label>

          <label>
            Ordenar por
            <select name="sort" defaultValue={sort}>
              <option value="createdAt">Cadastro</option>
              <option value="name">Nome</option>
            </select>
          </label>

          <label>
            Ordem
            <select name="order" defaultValue={order}>
              <option value="DESC">Decrescente</option>
              <option value="ASC">Crescente</option>
            </select>
          </label>

          <button type="submit">
            <IconFilter size={15} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
            Filtrar
          </button>
        </Form>
      </section>

      {/* Tabela de Usuários */}
      <section className={styles.panel}>
        {value.data.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Situação</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {value.data.map(row => (
                  <tr key={String(row.id)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <Avatar name={String(row.name)} src={typeof row.profilePhoto === "string" ? row.profilePhoto : null} size={32} />
                        <div>
                          <strong style={{ display: "block", color: "var(--text)" }}>{String(row.name)}</strong>
                          <span style={{ fontSize: "0.74rem", fontFamily: "monospace", color: "var(--text-muted)" }}>
                            {String(row.id).slice(0, 8)}…{String(row.id).slice(-4)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "var(--text)" }}>{String(row.email)}</span>
                    </td>
                    <td>
                      <span className={userRoleBadgeClass(String(row.role))}>
                        {String(row.role) === "SUPER_ADMIN" && <IconShield size={11} />}
                        {String(row.role)}
                      </span>
                    </td>
                    <td>
                      {row.moderationSuspended ? (
                        <span className={styles.badgeSuspended}>Suspensa</span>
                      ) : row.isActive ? (
                        <span className={styles.badgeActive}>Ativa</span>
                      ) : (
                        <span className={styles.badgeDismissed}>Inativa</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                        {new Date(String(row.createdAt)).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/gestao-editorial/usuarios/${row.id}`}
                        prefetch={false}
                        className={styles.btnSecondary}
                        style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                      >
                        <span>Ver conta</span>
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
            Nenhuma conta nesta página.
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
    </AdminShell>
  );
}
