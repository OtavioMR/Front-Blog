"use client";

import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { canWriteArticles } from "@/lib/permissions";
import Avatar from "./avatar";
import styles from "./session-nav.module.css";

// Replaces the static "Entrar" link: shows a neutral placeholder while the session is being checked.
export default function SessionNav() {
  const { status, profile } = useSession();
  if (status === "loading") return <span className={styles.placeholder} aria-hidden="true" />;
  if (status === "signed-in" && profile) {
    const canWrite = canWriteArticles(profile.role);
    return (
      <div className={styles.wrapper}>
        {canWrite && (
          <Link href="/studio" className={styles.write}>
            Escrever
          </Link>
        )}
        <Link
          href="/conta"
          className={`${styles.user} ${styles.account}`}
          aria-label={`Minha conta (${profile.name})`}
        >
          <Avatar name={profile.name} src={profile.profilePhoto} size={28} />
          <span>{profile.name.split(/\s+/)[0]}</span>
        </Link>
      </div>
    );
  }
  if (status === "error") return <Link className={styles.account} href="/conta">Minha conta</Link>;
  return <Link className={styles.account} href="/entrar">Entrar</Link>;
}
