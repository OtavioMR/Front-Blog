import Link from "next/link";
import { AdminFailure, AdminShell } from "../../../_components/shell";
import { adminCsrf, adminIdentity, adminUserDetail, adminUsersRead, record } from "../../../_lib/data";
import { formatRoleName } from "@/lib/permissions";
import RoleForm from "./role-form";
import styles from "../../../admin.module.css";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function RolePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params, { cargo } = await searchParams;
  const suggested = typeof cargo === "string" && ["READER", "AUTHOR", "ADMIN"].includes(cargo) ? cargo : "";
  if (!uuid.test(id)) {
    const access = await adminUsersRead(new URLSearchParams({ page: "1", limit: "1" }));
    if (!access.ok) return <AdminFailure reason={access.reason} />;
    return <AdminFailure reason="missing" />;
  }
  const result = await adminUserDetail(id);
  if (!result.ok) return <AdminFailure reason={result.reason} />;
  const actor = await adminIdentity();
  if (!actor || actor.role !== "SUPER_ADMIN" || actor.id === id) return <AdminFailure reason="forbidden" />;
  const user = result.value, csrf = await adminCsrf();
  if (!csrf) return <AdminFailure reason="session" />;
  if (!record(user) || user.id !== id || typeof user.name !== "string" || user.name.length > 255 || !["READER", "AUTHOR", "ADMIN", "SUPER_ADMIN"].includes(String(user.role)) || typeof user.isActive !== "boolean") return <AdminFailure reason="unavailable" />;
  return <AdminShell title="Função da conta" current="users"><div className={styles.intro}><p className={styles.eyebrow}>Permissões</p><h2>{user.name}</h2><p>Função atual: <strong>{formatRoleName(String(user.role))}</strong> ({String(user.role)}). Alterações revogam as sessões da conta e são registradas na auditoria.</p></div><section className={styles.panel}>{user.isActive ? <RoleForm id={id} current={String(user.role)} csrf={csrf} suggested={suggested} /> : <p>Somente contas ativas podem ter a função alterada.</p>}</section><p><Link href="/gestao-editorial/usuarios" prefetch={false}>Voltar aos usuários</Link></p></AdminShell>;
}
