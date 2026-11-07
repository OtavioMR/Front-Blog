import Link from "next/link";
import { redirect } from "next/navigation";
import { adminCsrf, adminIdentity } from "../_lib/data";
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
  const [identity, csrf] = await Promise.all([adminIdentity(), adminCsrf()]);
  if (!identity || !csrf) redirect(loginPath);

  return (
    <AdminShellClient title={title} current={current} identity={identity} csrf={csrf} actions={actions}>
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
