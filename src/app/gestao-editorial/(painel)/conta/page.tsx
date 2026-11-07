import Avatar from "@/app/_components/avatar";
import { AdminShell } from "../_components/shell";
import { adminCsrf, adminIdentity, adminSessionExpiry } from "../_lib/data";
import { redirect } from "next/navigation";
import { IconShield } from "../_components/icons";
import styles from "../admin.module.css";

export default async function AdminAccountPage() {
  const [actor, expires, csrf] = await Promise.all([adminIdentity(), adminSessionExpiry(), adminCsrf()]);
  if (!actor || !csrf) redirect("/gestao-editorial/entrar");
  const superAdmin = actor.role === "SUPER_ADMIN";
  const name = actor.name || (superAdmin ? "Super Administrador" : "Administrador");
  const rows: [string, string][] = [
    ["Cargo", actor.role],
    ["E-mail", actor.email ?? "—"],
    ["Identificador", actor.id],
    ["Sessão administrativa válida até", expires ? `${new Date(expires).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)` : "—"],
    ["Permissões", superAdmin ? "Moderação, gestão de contas e gerenciamento de administradores" : "Moderação, categorias, tags, usuários e auditoria"],
  ];
  return (
    <AdminShell title="Minha sessão" current="account">
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Conta administrativa</p>
        <h2>Identificação e sessão</h2>
        <p>Estas informações valem apenas para a administração. A sessão é independente da conta de leitor no blog e é renovada com uma nova entrada.</p>
      </div>
      <section className={styles.panel}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
          <Avatar name={name} src={actor.profilePhoto} size={56} />
          <div>
            <strong style={{ display: "block", fontSize: "1.15rem" }}>{name}</strong>
            <span className={superAdmin ? styles.roleBadgeSuperAdmin : styles.roleBadgeAdmin}><IconShield size={11} /> {actor.role}</span>
          </div>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "minmax(10rem, max-content) 1fr", gap: "0.6rem 1.5rem", margin: 0 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "contents" }}>
              <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>{label}</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.panel}>
        <h2>Encerrar sessão</h2>
        <p>Sai da administração e revoga o acesso desta sessão na API.</p>
        <form method="post" action="/gestao-editorial/sair">
          <input type="hidden" name="csrf" value={csrf} />
          <button type="submit" className={styles.btnPrimary}>Sair da administração</button>
        </form>
      </section>
    </AdminShell>
  );
}
