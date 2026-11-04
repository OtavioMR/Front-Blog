import type { Metadata } from "next";
import Link from "next/link";
import SessionNav from "@/app/_components/session-nav";
import styles from "./sobre.module.css";

export const metadata: Metadata = {
  title: "Sobre nós | Entrelinhas",
  description: "Conheça o Entrelinhas, um espaço para compartilhar histórias e descobrir novas ideias.",
};

export default function SobrePage() {
  return (
    <main className={styles.page}>
      <section className={styles.intro} aria-labelledby="sobre-titulo">
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>SOBRE O ENTRELINHAS</p>
          <h1 id="sobre-titulo">Boas ideias merecem <em>ser compartilhadas.</em></h1>
          <p>O Entrelinhas é um espaço para quem gosta de descobrir, aprender e enxergar o mundo por outras perspectivas.</p>
          <Link className={styles.primaryLink} href="/#artigos">Explore os artigos <span aria-hidden="true">↗</span></Link>
        </div>
        <div className={styles.art} aria-hidden="true">
          <div className={styles.artCircle} />
          <div className={styles.artPaper}><span>✳</span><p>IDEIAS QUE<br />ENCONTRAM<br /><em>VOCÊ.</em></p></div>
          <div className={styles.artCaption}>LEIA. DESCUBRA. COMPARTILHE.</div>
        </div>
      </section>

      <section className={styles.manifesto} aria-labelledby="manifesto">
        <p className={styles.eyebrow}>NOSSO PROPÓSITO</p>
        <div><h2 id="manifesto">Um lugar para ler com curiosidade.</h2>
          <p>Acreditamos no valor de uma boa leitura: aquela que abre uma conversa, apresenta uma ideia nova ou simplesmente convida a olhar com mais atenção.</p>
          <p>Por aqui, leitores encontram histórias e autores encontram espaço para compartilhar o que sabem. Cada publicação é uma oportunidade de aprender algo novo.</p>
        </div>
      </section>

      <section className={styles.values} aria-labelledby="valores">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>O QUE NOS MOVE</p><h2 id="valores">Um espaço feito de encontros.</h2></div><span aria-hidden="true">✳</span></div>
        <div className={styles.valueGrid}>
          <article><span>01 / DESCOBRIR</span><h3>Curiosidade em movimento.</h3><p>Novos assuntos, perguntas e perspectivas para acompanhar você em cada leitura.</p></article>
          <article><span>02 / COMPARTILHAR</span><h3>Histórias que aproximam.</h3><p>Um lugar para autores dividirem conhecimento e para leitores encontrarem suas próximas ideias.</p></article>
          <article><span>03 / CONVERSAR</span><h3>Trocas que acrescentam.</h3><p>A leitura pode continuar na conversa, com respeito pelas pessoas e pelas diferentes experiências.</p></article>
        </div>
      </section>
      <section className={styles.invitation}>
        <div><p className={styles.eyebrow}>A PRÓXIMA HISTÓRIA ESPERA POR VOCÊ</p><h2>Vamos descobrir juntos?</h2></div>
        <Link className={styles.primaryLink} href="/#artigos">Encontrar uma leitura <span aria-hidden="true">↗</span></Link>
      </section>
      <footer className={styles.footer}><Link href="/">entrelinhas.</Link><span>UM BLOG PARA LER E SENTIR.</span></footer>
    </main>
  );
}
