"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  Bookmark,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  KeyRound,
  Layers,
  LayoutGrid,
  LogOut,
  Mail,
  PenLine,
  Plus,
  Rss,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  User,
} from "lucide-react";
import { getOwnProfile, logout, subscribeSession, type OwnProfile } from "@/lib/session-client";
import { canWriteArticles, canAccessAdmin, formatRoleName } from "@/lib/permissions";
import Avatar from "@/app/_components/avatar";
import TotpSettings from "./totp-settings";
import RecoveryEmailSettings from "./recovery-email-settings";
import AccountBack from "./account-back";
import account from "./account.module.css";

type AccountTab = "all" | "reading" | "writing" | "security" | "admin";

export default function Account({ section }: { section?: "totp" | "recovery-email" }) {
  const [state, setState] = useState<"loading" | "signed-in" | "signed-out" | "busy" | "uncertain" | "error">("loading");
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [activeTab, setActiveTab] = useState<AccountTab>("all");
  const [retry, setRetry] = useState(0);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    const revisionRef = revision;
    function revalidate() {
      const current = ++revisionRef.current;
      if (active) {
        setProfile(null);
        setState("loading");
      }
      getOwnProfile()
        .then((result) => {
          if (active && current === revisionRef.current) {
            setProfile(result);
            setState(result ? "signed-in" : "signed-out");
          }
        })
        .catch(() => {
          if (active && current === revisionRef.current) {
            setProfile(null);
            setState("error");
          }
        });
    }
    const unsubscribe = subscribeSession(revalidate);
    revalidate();
    return () => {
      active = false;
      revisionRef.current++;
      unsubscribe();
    };
  }, [retry]);

  async function signOut() {
    revision.current++;
    setProfile(null);
    setState("busy");
    const confirmed = await logout().catch(() => false);
    setState(confirmed ? "signed-out" : "uncertain");
  }

  const canWrite = canWriteArticles(profile?.role);
  const isAdmin = canAccessAdmin(profile?.role);
  const showWriting = profile?.role === "READER" || canWrite;

  return (
    <main className={account.page}>
      <div className={account.heading}>
        {section && <AccountBack />}
        <p className={account.eyebrow}>{section ? "SEGURANÇA DA CONTA" : "SEU ESPAÇO NO GRIFÓRIO"}</p>
        <h1 className={account.title}>
          {section === "totp"
            ? "Verificação em duas etapas."
            : section === "recovery-email"
              ? "E-mail de recuperação."
              : "Minha conta."}
        </h1>
        {!section && (
          <p className={account.heroSub}>
            Gerencie seu perfil, suas leituras, seu estúdio de escrita e a segurança da sua conta.
          </p>
        )}
      </div>

      {state === "loading" && (
        <div className={account.skeleton} role="status" aria-label="Carregando">
          <span />
          <span />
          <span />
          Verificando sua sessão…
        </div>
      )}

      {state === "busy" && <p role="status">Saindo…</p>}

      {state === "signed-in" && profile && section && (
        <section className={`${account.panel} ${account.securityDetail}`}>
          {section === "totp" ? (
            <TotpSettings userId={profile.id} initialTotpEnabled={profile.totpEnabled ?? false} />
          ) : (
            <RecoveryEmailSettings userId={profile.id} totpEnabled={profile.totpEnabled ?? false} />
          )}
        </section>
      )}

      {state === "signed-in" && profile && !section && (
        <div className={account.layout}>
          <section className={account.summary} aria-labelledby="summary-title">
            <div className={account.summaryHeader}>
              <Avatar name={profile.name} src={profile.profilePhoto} size={76} />
              <div>
                <h2 id="summary-title">{profile.name}</h2>
                <p className={account.muted} style={{ margin: 0 }}>
                  {profile.email}
                </p>
              </div>
            </div>

            <div className={account.summaryBadges}>
              <span className={account.badge}>{formatRoleName(profile.role)}</span>
              <span
                className={`${profile.emailVerified ? account.badgeOk : account.badgeWarn} ${account.badgeIcon}`}
              >
                {profile.emailVerified ? (
                  <CheckCircle2 size={12} aria-hidden="true" />
                ) : (
                  <AlertCircle size={12} aria-hidden="true" />
                )}
                <span>E-mail {profile.emailVerified ? "confirmado" : "pendente"}</span>
              </span>
              {typeof profile.totpEnabled === "boolean" && (
                <span className={`${profile.totpEnabled ? account.badgeOk : account.badge} ${account.badgeIcon}`}>
                  <ShieldCheck size={12} aria-hidden="true" />
                  <span>2FA {profile.totpEnabled ? "ativo" : "inativo"}</span>
                </span>
              )}
            </div>

            {profile.bio ? (
              <p className={account.bio}>{profile.bio}</p>
            ) : (
              <p className={account.muted}>Você ainda não escreveu uma biografia.</p>
            )}

            <div className={account.actions}>
              <Link className={account.primary} href="/conta/perfil">
                Editar perfil
              </Link>
              <Link className={account.secondary} href="/conta/foto">
                Trocar foto
              </Link>
            </div>

            <div className={account.summaryDivider} />

            <button type="button" className={account.logoutBtn} onClick={signOut}>
              <LogOut size={15} aria-hidden="true" />
              <span>Sair da conta</span>
            </button>
          </section>

          <div className={account.main}>
            <nav className={account.filterTabs} aria-label="Categorias da conta">
              <button
                type="button"
                className={`${account.filterTab} ${activeTab === "all" ? account.filterTabActive : ""}`}
                onClick={() => setActiveTab("all")}
              >
                <LayoutGrid size={15} aria-hidden="true" />
                <span>Visão geral</span>
              </button>
              <button
                type="button"
                className={`${account.filterTab} ${activeTab === "reading" ? account.filterTabActive : ""}`}
                onClick={() => setActiveTab("reading")}
              >
                <Bookmark size={15} aria-hidden="true" />
                <span>Perfil & Leituras</span>
              </button>
              {showWriting && (
                <button
                  type="button"
                  className={`${account.filterTab} ${activeTab === "writing" ? account.filterTabActive : ""}`}
                  onClick={() => setActiveTab("writing")}
                >
                  <PenLine size={15} aria-hidden="true" />
                  <span>Escrita</span>
                </button>
              )}
              <button
                type="button"
                className={`${account.filterTab} ${activeTab === "security" ? account.filterTabActive : ""}`}
                onClick={() => setActiveTab("security")}
              >
                <ShieldCheck size={15} aria-hidden="true" />
                <span>Segurança</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`${account.filterTab} ${activeTab === "admin" ? account.filterTabActive : ""}`}
                  onClick={() => setActiveTab("admin")}
                >
                  <Shield size={15} aria-hidden="true" />
                  <span>Administração</span>
                </button>
              )}
            </nav>

            {isAdmin && (activeTab === "all" || activeTab === "admin") && (
              <section className={account.panel} aria-labelledby="admin-title">
                <h2 id="admin-title">Administração</h2>
                <p className={account.panelIntro}>
                  Acesso exclusivo às ferramentas editoriais e de governança do Grifório.
                </p>
                <ul className={account.cardGrid}>
                  <li>
                    <Link href="/gestao-editorial" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Shield size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Painel Administrativo</strong>
                        <span className={account.navCardDesc}>
                          Gestão editorial, moderação de publicações e permissões
                        </span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                </ul>
              </section>
            )}

            {(activeTab === "all" || activeTab === "reading") && (
              <section className={account.panel} aria-labelledby="manage-title">
                <h2 id="manage-title">Seu perfil e suas leituras</h2>
                <p className={account.panelIntro}>
                  Cuide das informações que você compartilha e encontre seus artigos salvos.
                </p>
                <ul className={account.cardGrid}>
                  <li>
                    <Link href="/conta/perfil" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <User size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Informações pessoais</strong>
                        <span className={account.navCardDesc}>Nome, biografia e links públicos</span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/foto" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Camera size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Foto de perfil</strong>
                        <span className={account.navCardDesc}>
                          {profile.profilePhoto ? "Troque ou remova sua imagem" : "Adicione uma foto ao perfil"}
                        </span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/salvos" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Bookmark size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Artigos salvos</strong>
                        <span className={account.navCardDesc}>Suas leituras e coleções guardadas</span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/feed" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Rss size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Seu feed</strong>
                        <span className={account.navCardDesc}>Novidades dos autores que você acompanha</span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/notificacoes" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Bell size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Notificações</strong>
                        <span className={account.navCardDesc}>Interações e atualizações para você</span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/configuracoes" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Settings size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Configurações</strong>
                        <span className={account.navCardDesc}>Gerencie seus dados e a conta</span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                </ul>
              </section>
            )}

            {showWriting && (activeTab === "all" || activeTab === "writing") && (
              <section className={account.panel} aria-labelledby="writing-title">
                <h2 id="writing-title">Escrita</h2>
                <p className={account.panelIntro}>Acompanhe sua jornada de publicação no Grifório.</p>
                <ul className={account.cardGrid}>
                  {profile.role === "READER" && (
                    <li>
                      <Link href="/studio" className={account.navCard}>
                        <span className={account.navCardIcon}>
                          <PenLine size={18} aria-hidden="true" />
                        </span>
                        <span className={account.navCardBody}>
                          <strong className={account.navCardTitle}>Quero ser autor</strong>
                          <span className={account.navCardDesc}>
                            Aceite as regras de publicação e comece a escrever
                          </span>
                        </span>
                        <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                      </Link>
                    </li>
                  )}
                  {canWrite && (
                    <>
                      <li>
                        <Link href="/studio" className={account.navCard}>
                          <span className={account.navCardIcon}>
                            <PenLine size={18} aria-hidden="true" />
                          </span>
                          <span className={account.navCardBody}>
                            <strong className={account.navCardTitle}>Studio de escrita</strong>
                            <span className={account.navCardDesc}>Gerencie seus contos e rascunhos</span>
                          </span>
                          <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                        </Link>
                      </li>
                      <li>
                        <Link href="/studio/series" className={account.navCard}>
                          <span className={account.navCardIcon}>
                            <Layers size={18} aria-hidden="true" />
                          </span>
                          <span className={account.navCardBody}>
                            <strong className={account.navCardTitle}>Minhas séries</strong>
                            <span className={account.navCardDesc}>Organize seus contos em capítulos</span>
                          </span>
                          <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                        </Link>
                      </li>
                      <li>
                        <Link href="/studio/novo" className={account.navCard}>
                          <span className={account.navCardIcon}>
                            <Plus size={18} aria-hidden="true" />
                          </span>
                          <span className={account.navCardBody}>
                            <strong className={account.navCardTitle}>Novo conto</strong>
                            <span className={account.navCardDesc}>Comece um novo rascunho no editor</span>
                          </span>
                          <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                        </Link>
                      </li>
                      <li>
                        <Link href={`/autores/${encodeURIComponent(profile.id)}?origem=conta`} className={account.navCard}>
                          <span className={account.navCardIcon}>
                            <BookOpen size={18} aria-hidden="true" />
                          </span>
                          <span className={account.navCardBody}>
                            <strong className={account.navCardTitle}>Minhas publicações</strong>
                            <span className={account.navCardDesc}>Veja seu perfil público de autor</span>
                          </span>
                          <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                        </Link>
                      </li>
                    </>
                  )}
                </ul>
              </section>
            )}

            {(activeTab === "all" || activeTab === "security") && (
              <section className={account.panel} aria-labelledby="security-title">
                <h2 id="security-title">Segurança</h2>
                <p className={account.panelIntro}>
                  Gerencie sua senha, suas sessões e a verificação em duas etapas.
                </p>
                <ul className={account.cardGrid}>
                  <li>
                    <Link href="/conta/verificacao" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <ShieldCheck size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Verificação em duas etapas</strong>
                        <span className={account.navCardDesc}>
                          Proteja o acesso com um aplicativo autenticador
                        </span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/email-recuperacao" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Mail size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>E-mail de recuperação</strong>
                        <span className={account.navCardDesc}>
                          Cadastre ou altere seu endereço de recuperação
                        </span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/senha" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <KeyRound size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Alterar senha</strong>
                        <span className={account.navCardDesc}>
                          Exige a senha atual e encerra as sessões
                        </span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                  <li>
                    <Link href="/conta/sessoes" className={account.navCard}>
                      <span className={account.navCardIcon}>
                        <Smartphone size={18} aria-hidden="true" />
                      </span>
                      <span className={account.navCardBody}>
                        <strong className={account.navCardTitle}>Sessões e dispositivos</strong>
                        <span className={account.navCardDesc}>Revise onde sua conta está conectada</span>
                      </span>
                      <ChevronRight size={16} className={account.navCardChevron} aria-hidden="true" />
                    </Link>
                  </li>
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

      {state === "signed-out" && (
        <div className={account.notice}>
          <p>Entre novamente para acessar sua conta.</p>
          <Link className={account.primary} href="/entrar">
            Entrar
          </Link>
        </div>
      )}

      {state === "uncertain" && (
        <div className={account.notice}>
          <p role="alert">Não foi possível confirmar a saída no servidor. Entre novamente para usar sua conta.</p>
          <Link className={account.primary} href="/entrar">
            Ir para entrada
          </Link>
        </div>
      )}

      {state === "error" && (
        <div className={account.notice}>
          <p role="alert">
            Não foi possível carregar seu perfil agora. Tente novamente ou entre novamente se o problema persistir.
          </p>
          <button type="button" className={account.primary} onClick={() => setRetry((value) => value + 1)}>
            Tentar novamente
          </button>{" "}
          <Link className={account.secondary} href="/entrar">
            Entrar
          </Link>
        </div>
      )}
    </main>
  );
}
