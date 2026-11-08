import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCsrf, adminIdentity, adminSessionExpiry } from "../_lib/data";
import { type AdminTheme } from "./admin-theme-toggle";
import { AdminShellClient, type NavSectionKey } from "./shell-client";
import styles from "../admin.module.css";

const loginPath = "/gestao-editorial/entrar";

export async function AdminShell({
  title,
  current,
  actions,
  children,
}: {
  title: string;
  current: NavSectionKey;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [identity, csrf, expires, cookieJar] = await Promise.all([
    adminIdentity(),
    adminCsrf(),
    adminSessionExpiry(),
    cookies(),
  ]);
  if (!identity || !csrf) redirect(loginPath);

  const rawTheme = cookieJar.get("admin-theme")?.value;
  const initialTheme: AdminTheme =
    rawTheme === "light" || rawTheme === "dark" || rawTheme === "system" ? rawTheme : "system";

  return (
    <AdminShellClient
      title={title}
      current={current}
      identity={identity}
      csrf={csrf}
      expires={expires}
      actions={actions}
      initialTheme={initialTheme}
    >
      {children}
    </AdminShellClient>
  );
}

export function AdminFailure({ reason }: { reason: "session" | "forbidden" | "missing" | "unavailable" }) {
  // Sessão ausente, expirada ou revogada (inclusive por rebaixamento de cargo) sempre volta à entrada administrativa.
  if (reason === "session") redirect(loginPath);
  return (
    <main className={styles.failure}>
      <p className={styles.eyebrow}>Grifório · Administração</p>
      <h1>
        {reason === "forbidden" ? "Acesso negado" : reason === "missing" ? "Conteúdo indisponível" : "Serviço indisponível"}
      </h1>
      <p>
        {reason === "forbidden"
          ? "Esta conta administrativa não possui permissão para acessar esta área."
          : reason === "missing"
            ? "O recurso solicitado não foi encontrado."
            : "Não foi possível consultar a administração agora. Tente novamente mais tarde."}
      </p>
      <div className={styles.failureActions}>
        <Link href="/gestao-editorial" className={styles.btnPrimary} prefetch={false}>Voltar ao painel</Link>
      </div>
    </main>
  );
}
