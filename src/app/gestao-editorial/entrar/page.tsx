import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LoginForm } from "./login-form";
import styles from "./entrar.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrada administrativa | Grifório", robots: { index: false, follow: false } };

// Entrada oficial da administração. O token CSRF é emitido pelo proxy junto com o cookie de entrada.
export default async function AdminLoginPage() {
  if (process.env.ENABLE_ADMIN_BFF !== "true") notFound();
  const csrf = (await headers()).get("x-admin-login-csrf") ?? "";
  return (
    <main className={styles.screen}>
      <section className={styles.panel} aria-labelledby="admin-login-title">
        <div className={styles.brand} aria-hidden="true">
          <span className={styles.mark}>G</span>
          <span className={styles.brandText}>Grifório<span className={styles.brandSub}>Administração</span></span>
        </div>
        <p className={styles.eyebrow}>Acesso restrito</p>
        <h1 id="admin-login-title" className={styles.title}>Entrada administrativa</h1>
        <p className={styles.lead}>Somente contas com cargo administrativo podem entrar. Use as mesmas credenciais do Grifório.</p>
        <LoginForm csrf={csrf} />
        <p className={styles.note}>Esta área é independente do blog. Leitores e autores não têm acesso.</p>
      </section>
    </main>
  );
}
