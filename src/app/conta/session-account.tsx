"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getOwnProfile, logout, subscribeSession, type OwnProfile } from "@/lib/session-client";
import styles from "../entrar/session.module.css";

export default function Account() {
  const [state, setState] = useState<"loading" | "signed-in" | "signed-out" | "busy" | "uncertain" | "error">("loading");
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const revisionRef = revision;
    function revalidate() {
      const current = ++revisionRef.current;
      if (active) { setProfile(null); setState("loading"); }
      getOwnProfile().then(result => { if (active && current === revisionRef.current) { setProfile(result); setState(result ? "signed-in" : "signed-out"); } }).catch(() => { if (active && current === revisionRef.current) { setProfile(null); setState("error"); } });
    }
    const unsubscribe = subscribeSession(revalidate);
    revalidate();
    return () => { active = false; revisionRef.current++; unsubscribe(); };
  }, [retry]);
  async function signOut() { revision.current++; setProfile(null); setState("busy"); const confirmed = await logout().catch(() => false); setState(confirmed ? "signed-out" : "uncertain"); }
  return <main className={styles.page}><header><Link href="/" className={styles.brand}>✳ entrelinhas.</Link></header><section className={styles.card}>
    <p className={styles.eyebrow}>SEU ESPAÇO</p><h1>Minha conta.</h1>
    {state === "loading" && <p role="status">Verificando sua sessão…</p>}
    {state === "signed-in" && profile && <><dl><dt>Nome</dt><dd>{profile.name}</dd><dt>E-mail</dt><dd>{profile.email}</dd><dt>Perfil</dt><dd>{({ READER: "Leitor", AUTHOR: "Autor", ADMIN: "Administrador" } as Record<string, string>)[profile.role] || profile.role}</dd><dt>Verificação de e-mail</dt><dd>{profile.emailVerified ? "Confirmado" : "Pendente"}</dd>{profile.bio && <><dt>Sobre</dt><dd>{profile.bio}</dd></>}</dl><p><Link className={styles.back} href="/conta/perfil">Editar perfil</Link></p><p><Link className={styles.back} href="/conta/foto">Alterar foto</Link></p><p><Link className={styles.back} href="/conta/senha">Alterar senha</Link></p><p><Link className={styles.back} href="/studio">Acessar Studio de escrita</Link></p><p><Link className={styles.back} href="/conta/salvos">Ver artigos salvos</Link></p><p><Link className={styles.back} href="/conta/sessoes">Gerenciar sessões e dispositivos</Link></p><button className={styles.button} onClick={signOut}>Sair da conta</button></>}
    {state === "busy" && <p role="status">Saindo…</p>}
    {state === "signed-out" && <><p>Entre novamente para acessar sua conta.</p><Link className={styles.back} href="/entrar">Entrar</Link></>}
    {state === "uncertain" && <><p role="alert">Não foi possível confirmar a saída no servidor. Entre novamente para usar sua conta.</p><Link className={styles.back} href="/entrar">Ir para entrada</Link></>}
    {state === "error" && <><p role="alert">Não foi possível carregar seu perfil agora. Tente novamente ou entre novamente se o problema persistir.</p><button className={styles.button} onClick={() => setRetry(value => value + 1)}>Tentar novamente</button> <Link className={styles.back} href="/entrar">Entrar</Link></>}
    <br /><Link className={styles.back} href="/">← Voltar ao início</Link>
  </section></main>;
}
