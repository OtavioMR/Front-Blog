import Link from "next/link";
import styles from "./footer.module.css";
import CopyrightYear from "./copyright-year";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <div className={styles.identity}>
            <Link href="/" className={styles.brand} aria-label="Grifório, página inicial">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/griforio/symbol-light.svg" alt="" className={styles.logoLight} width="130" height="135" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/branding/griforio/symbol-dark.svg" alt="" className={styles.logoDark} width="130" height="135" />
              <span>Grifório</span>
            </Link>
            <p>Um espaço para histórias que despertam ideias e leituras que ficam com a gente.</p>
          </div>
          <nav className={styles.navigation} aria-label="Navegação do rodapé">
            <div>
              <p className={styles.heading}>Descubra</p>
              <Link href="/">Página inicial</Link>
              <Link href="/#artigos">Explorar artigos</Link>
              <Link href="/categorias">Categorias</Link>
            </div>
            <div>
              <p className={styles.heading}>Grifório</p>
              <Link href="/sobre">Sobre</Link>
              <Link href="/tags">Tags</Link>
              <Link href="/configuracoes">Aparência</Link>
            </div>
          </nav>
        </div>
        <div className={styles.bottom}>
          <span>© <CopyrightYear initialYear={new Date().getFullYear()} /> Grifório</span>
          <span>Um blog para ler e sentir.</span>
        </div>
      </div>
    </footer>
  );
}
