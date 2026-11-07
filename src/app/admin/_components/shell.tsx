import Link from "next/link";
import styles from "../admin.module.css";
/* As rotas editoriais existentes são Route Handlers que entregam documentos HTML completos. */

export function AdminShell({ title, current, children }: { title: string; current: "overview" | "newsletter" | "analytics" | "audit" | "reports" | "users" | "comments" | "posts" | "categories" | "tags"; children: React.ReactNode }) {
  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/admin" prefetch={false}>Grifório<span>Administração</span></Link>
      <nav className={styles.navigation} aria-label="Navegação administrativa">
        <Link href="/admin" prefetch={false} aria-current={current === "overview" ? "page" : undefined}>Visão geral</Link>
        <Link href="/admin/analytics" prefetch={false} aria-current={current === "analytics" ? "page" : undefined}>Atividade</Link>
        <Link href="/admin/audit-logs" prefetch={false} aria-current={current === "audit" ? "page" : undefined}>Auditoria</Link>
        <Link href="/admin/newsletter" prefetch={false} aria-current={current === "newsletter" ? "page" : undefined}>Newsletter</Link>
        <Link href="/admin/reports" prefetch={false} aria-current={current === "reports" ? "page" : undefined}>Denúncias</Link>
        <Link href="/admin/comments" prefetch={false} aria-current={current === "comments" ? "page" : undefined}>Comentários</Link>
        <Link href="/admin/posts" prefetch={false} aria-current={current === "posts" ? "page" : undefined}>Artigos</Link>
        <Link href="/admin/posts?status=pending" prefetch={false}>Revisão editorial</Link>
        <Link href="/admin/users" prefetch={false} aria-current={current === "users" ? "page" : undefined}>Usuários</Link>
        <Link href="/admin/categories" prefetch={false} aria-current={current === "categories" ? "page" : undefined}>Categorias</Link>
        <Link href="/admin/tags" prefetch={false} aria-current={current === "tags" ? "page" : undefined}>Tags</Link>
      </nav>
      <Link className={styles.returnLink} href="/">Voltar ao blog</Link>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.header}><div><p>Grifório / Administração</p><h1>{title}</h1></div><Link href="/configuracoes">Aparência</Link></header>
      <main className={styles.main}>{children}</main>
    </div>
  </div>;
}

export function AdminFailure({ reason }: { reason: "session" | "forbidden" | "missing" | "unavailable" }) {
  return <main className={styles.failure}><p className={styles.eyebrow}>Grifório</p><h1>{reason === "session" ? "Entre para continuar" : reason === "forbidden" ? "Acesso negado" : reason === "missing" ? "Conteúdo indisponível" : "Serviço indisponível"}</h1><p>{reason === "session" ? "Sua sessão administrativa não está disponível ou expirou." : reason === "forbidden" ? "Esta conta não possui permissão para acessar esta área." : reason === "missing" ? "O recurso solicitado não foi encontrado." : "Não foi possível consultar a administração agora. Tente novamente mais tarde."}</p>{reason === "session" && <a href="/gestao-editorial/entrar">Entrar</a>} <Link href="/">Voltar ao blog</Link></main>;
}
