import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../legal.module.css";

export const metadata: Metadata = {
  title: "Critérios de Classificação Etária | Grifório",
  description: "Entenda a escala de classificação indicativa de artigos no Grifório e os critérios de proteção a menores de idade.",
};

export default function DiretrizesClassificacaoPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <Link href="/diretrizes">Diretrizes</Link>
        <span aria-hidden="true">/</span>
        <span>Classificação Etária</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.eyebrow}>CRITÉRIOS EDITORIAIS</p>
        <h1 className={styles.title}>Regras e Critérios de Classificação Etária</h1>
        <div className={styles.meta}>
          <span>Versão: 1.0.0</span>
          <span>Última atualização: Novembro de 2026</span>
          <span>Modelo de Proteção: Escala Indicativa do Grifório</span>
        </div>
      </header>

      <div className={styles.callout}>
        <p>
          <strong>Importante:</strong> Toda publicação no Grifório deve possuir uma classificação indicativa atribuída obrigatoriamente pelo autor no momento de sua criação ou edição. Esta escala é uma proposta técnica e editorial de modelagem da plataforma para orientar leitores e proteger menores, não constituindo classificação pública oficial estatal.
        </p>
      </div>

      <section className={styles.section}>
        <h2>1. Escala de Classificação do Grifório</h2>
        <div className={styles.badgeGrid}>
          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: '#2E7D32', color: '#FFFFFF' }}>
              LIVRE
            </span>
            <p><strong>Livre para todos os públicos:</strong> Obras adequadas a qualquer faixa etária. Não contém violência, linguagem grosseira, drogas ou conteúdos sexuais.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: '#0288D1', color: '#FFFFFF' }}>
              10+
            </span>
            <p><strong>Não recomendado para menores de 10 anos:</strong> Pode conter conflitos leves, suspense leve ou linguagem informal simples sem teor agressivo.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: '#FBC02D', color: '#221A18' }}>
              12+
            </span>
            <p><strong>Não recomendado para menores de 12 anos:</strong> Pode incluir conflitos dramáticos moderados, violência fantasiosa ou insinuações leves.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: '#F57C00', color: '#FFFFFF' }}>
              14+
            </span>
            <p><strong>Não recomendado para menores de 14 anos:</strong> Aborda temas sensíveis, linguagem imprópria ou representações realistas de violência sem excesso.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: '#D32F2F', color: '#FFFFFF' }}>
              16+
            </span>
            <p><strong>Não recomendado para menores de 16 anos:</strong> Conteúdo denso, violência gráfica moderada, linguagem de baixo calão recorrente ou temas sexuais evidentes.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: '#212121', color: '#FFFFFF', border: '1px solid #444' }}>
              18+
            </span>
            <p><strong>Restrito a maiores de 18 anos:</strong> Terror psicológico, suspense pesado, violência ficcional dramática, temas adultos complexos e romances maduros.</p>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>2. Regras de Acesso e Proteção Técnica a Conteúdos 18+</h2>
        <p>
          2.1. <strong>Barreira de acesso:</strong> Artigos classificados como <code>18+</code> <strong>não têm seu texto integral, imagem de capa ou prévias detalhadas entregues a visitantes deslogados</strong>. O backend aplica a restrição na origem da resposta.
        </p>
        <p>
          2.2. <strong>Acesso autenticado:</strong> Apenas usuários autenticados com idade cadastrada compatível têm acesso à leitura e capa das publicações adultas.
        </p>
        <p>
          2.3. <strong>Feeds e sitemap:</strong> Conteúdos 18+ são automaticamente suprimidos de feeds públicos RSS e sitemaps para impedir exposição indiscriminada a indexadores infantis.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Distinção: 18+ Não Significa Vale-Tudo</h2>
        <p>
          A classificação 18+ serve para alertar e proteger leitores contra temas adultos legítimos (literatura madura, ficção sombria, romances com temas adultos). Ela <strong>não autoriza conteúdos ilegais nem pornografia sexualmente explícita</strong> (que é proibida no MVP), tampouco dispensa as barreiras de acesso aplicáveis.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Denúncia e Correção pela Moderação</h2>
        <p>
          4.1. Leitores podem denunciar publicações caso identifiquem classificação etária declarada incorretamente (ex.: conteúdo de terror explícito classificado como LIVRE).
        </p>
        <p>
          4.2. A moderação do Grifório possui a prerrogativa técnica de ajustar a classificação etária de um artigo, notificando o autor com a fundamentação editorial da alteração.
        </p>
      </section>
    </main>
  );
}
