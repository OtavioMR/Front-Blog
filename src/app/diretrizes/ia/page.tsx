import type { Metadata } from "next";
import Link from "next/link";
import styles from "../../legal.module.css";

export const metadata: Metadata = {
  title: "Diretrizes de Inteligência Artificial | Grifório",
  description: "Regras de transparência e declaração obrigatória para textos e capas produzidos com auxílio de inteligência artificial no Grifório.",
};

export default function DiretrizesIaPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <Link href="/diretrizes">Diretrizes</Link>
        <span aria-hidden="true">/</span>
        <span>Uso de Inteligência Artificial</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.eyebrow}>TRANSPARÊNCIA EDITORIAL</p>
        <h1 className={styles.title}>Política de Uso e Transparência de Inteligência Artificial</h1>
        <div className={styles.meta}>
          <span>Versão: 1.0.0</span>
          <span>Última atualização: Novembro de 2026</span>
          <span>Regra fundamental: Transparência com o leitor</span>
        </div>
      </header>

      <div className={styles.callout}>
        <p>
          <strong>Nossa visão sobre IA:</strong> O Grifório acredita na tecnologia como ferramenta criativa e não proíbe obras geradas ou auxiliadas por IA. No entanto, exigimos <strong>honestidade e transparência</strong>: os leitores têm o direito de saber quando e como a inteligência artificial participou da criação de um texto ou de uma imagem de capa.
        </p>
      </div>

      <section className={styles.section}>
        <h2>1. Declaração da Origem do Texto</h2>
        <p>Ao criar ou editar uma publicação, o autor deve selecionar a opção que melhor reflete a produção do texto:</p>

        <div className={styles.badgeGrid}>
          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              100% Humano
            </span>
            <p><strong>Escrito integralmente por humano:</strong> O texto foi idealizado e redigido sem uso substancial de modelos generativos de IA.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              Auxílio de IA
            </span>
            <p><strong>Escrito por humano com auxílio de IA:</strong> O autor utilizou IA para pesquisa, brainstorming de ideias ou refinamento estilístico, mantendo controle autoral pleno.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              Parcialmente IA
            </span>
            <p><strong>Produzido parcialmente por IA:</strong> Seções substanciais, diálogos ou parágrafos inteiros foram gerados por modelos de linguagem e incorporados ao texto.</p>
          </div>

          <div className={styles.badgeCard}>
            <span className={styles.badgeTitle} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)' }}>
              Gerado por IA
            </span>
            <p><strong>Produzido integralmente por IA:</strong> O texto foi gerado quase que em sua totalidade a partir de comandos e prompts fornecidos a uma ferramenta de IA.</p>
          </div>
        </div>

        <p>
          <em>Diferença importante:</em> A utilização de corretores gramaticais e ortográficos simples (como os integrados em processadores de texto convencionais) <strong>não constitui uso substancial de IA</strong> e não exige declaração especial.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Declaração da Origem da Imagem de Capa</h2>
        <p>A imagem de capa possui declaração independente da do texto. O autor deve assinalar uma das seguintes categorias:</p>
        <ul>
          <li><strong>Fotografia ou arte humana:</strong> Imagem criada, fotografada ou ilustrada por humanos;</li>
          <li><strong>Imagem produzida por IA:</strong> Arte sintética gerada por ferramentas de difusão de imagens (ex.: Midjourney, DALL-E, Stable Diffusion);</li>
          <li><strong>Imagem híbrida:</strong> Composição ou colagem combinando elementos humanos e elementos sintéticos de IA;</li>
          <li><strong>Sem imagem de capa:</strong> Publicação veiculada sem imagem de destaque.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>3. Exibição Pública das Etiquetas</h2>
        <p>
          3.1. As informações sobre IA são apresentadas publicamente junto à publicação como <strong>"Declaração do autor"</strong>, evitando rotulações involuntárias ou precipitadas.
        </p>
        <p>
          3.2. A omissão intencional de uso substancial de IA para enganar o público constitui infração às diretrizes editoriais e pode ser denunciada pela comunidade.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Não Utilização de Detectores de IA Opostos</h2>
        <p>
          4.1. O Grifório <strong>não utiliza detectores automatizados de IA como prova conclusiva</strong> para aplicação de punições, em virtude das comprovadas taxas de falso-positivo de tais ferramentas na literatura técnica e do risco de prejudicar autores humanos legítimos.
        </p>
        <p>
          4.2. Havendo suspeita fundamentada de falsidade ideológica na autoria, a questão é submetida à revisão e diálogo humano com o autor.
        </p>
      </section>

      <section className={styles.section}>
        <h2>5. Direitos Autorais sobre Conteúdo Gerado por IA</h2>
        <p>
          Ao enviar qualquer conteúdo para a plataforma, o usuário declara que detém os direitos, permissões ou licenças de uso necessários para compartilhá-lo. O Grifório não assegura nem atesta que obras produzidas inteiramente por IA estejam amparadas por proteção de direitos autorais sob a legislação brasileira.
        </p>
      </section>
    </main>
  );
}
