"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getOwnProfile, logout, subscribeSession, type OwnProfile } from "@/lib/session-client";
import Avatar from "@/app/_components/avatar";
import TotpSettings from "./totp-settings";
import account from "./account.module.css";

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
  const roles: Record<string, string> = { READER: "Leitor", AUTHOR: "Autor", ADMIN: "Administrador" };
  const canWrite = profile?.role === "AUTHOR" || profile?.role === "ADMIN";
  return <main className={account.page}>
    <p className={account.eyebrow}>SEU ESPAÇO</p><h1 className={account.title}>Minha conta.</h1>
    {state === "loading" && <div className={account.skeleton} role="status" aria-label="Carregando"><span /><span /><span />Verificando sua sessão…</div>}
    {state === "busy" && <p role="status">Saindo…</p>}
    {state === "signed-in" && profile && <div className={account.layout}>
      <section className={account.summary} aria-labelledby="summary-title">
        <Avatar name={profile.name} src={profile.profilePhoto} size={72} />
        <h2 id="summary-title">{profile.name}</h2><p className={account.muted}>{profile.email}</p>
        <p><span className={account.badge}>{roles[profile.role] || profile.role}</span> <span className={profile.emailVerified ? account.badgeOk : account.badgeWarn}>E-mail {profile.emailVerified ? "confirmado" : "pendente"}</span></p>
        {profile.bio ? <p className={account.bio}>{profile.bio}</p> : <p className={account.muted}>Você ainda não escreveu uma biografia.</p>}
        <div className={account.actions}><Link className={account.primary} href="/conta/perfil">Editar perfil</Link><button className={account.secondary} onClick={signOut}>Sair da conta</button></div>
      </section>
      <div className={account.main}>
        <section className={account.panel} aria-labelledby="manage-title"><h2 id="manage-title">Gerenciar conta</h2>
          <ul className={account.links}>
            <li><Link href="/conta/perfil"><strong>Informações pessoais</strong><span>Nome, biografia e links públicos</span></Link></li>
            <li><Link href="/conta/foto"><strong>Foto de perfil</strong><span>{profile.profilePhoto ? "Troque sua imagem" : "Adicione uma foto"}</span></Link></li>
            <li><Link href="/conta/salvos"><strong>Artigos salvos</strong><span>Suas leituras guardadas</span></Link></li>
            {profile.role === "READER" && <li><Link href="/studio"><strong>Quero ser autor</strong><span>Aceite as regras de publicação e comece a escrever</span></Link></li>}
            {canWrite && <li><Link href="/studio"><strong>Studio de escrita</strong><span>Crie e edite suas publicações</span></Link></li>}
            {canWrite && <li><Link href={`/autores/${encodeURIComponent(profile.id)}`}><strong>Minhas publicações</strong><span>Veja seu perfil público de autor</span></Link></li>}
          </ul></section>
        <section className={account.panel} aria-labelledby="security-title"><h2 id="security-title">Segurança</h2>
          <ul className={account.links}>
            <li><Link href="/conta/senha"><strong>Alterar senha</strong><span>Exige a senha atual e encerra as sessões</span></Link></li>
            <li><Link href="/conta/sessoes"><strong>Sessões e dispositivos</strong><span>Revise onde sua conta está conectada</span></Link></li>
          </ul>
          <h3>Verificação em duas etapas</h3><TotpSettings userId={profile.id} /></section>
      </div>
    </div>}
    {state === "signed-out" && <div className={account.notice}><p>Entre novamente para acessar sua conta.</p><Link className={account.primary} href="/entrar">Entrar</Link></div>}
    {state === "uncertain" && <div className={account.notice}><p role="alert">Não foi possível confirmar a saída no servidor. Entre novamente para usar sua conta.</p><Link className={account.primary} href="/entrar">Ir para entrada</Link></div>}
    {state === "error" && <div className={account.notice}><p role="alert">Não foi possível carregar seu perfil agora. Tente novamente ou entre novamente se o problema persistir.</p><button className={account.primary} onClick={() => setRetry(value => value + 1)}>Tentar novamente</button> <Link className={account.secondary} href="/entrar">Entrar</Link></div>}
  </main>;
}