import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Diretrizes da Comunidade e Moderação | Grifório",
  description: "Regras de convivência, proibições de conteúdo, critérios de moderação e sistema de recursos com SLA de 15 dias no Grifório.",
};

export default function DiretrizesPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <span>Diretrizes da Comunidade</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.eyebrow}>GOVERNANÇA & SEGURANÇA</p>
        <h1 className={styles.title}>Diretrizes da Comunidade e Moderação</h1>
        <div className={styles.meta}>
          <span>Versão: 1.0.0</span>
          <span>Última atualização: Novembro de 2026</span>
          <span>SLA de Recursos: 15 dias</span>
        </div>
      </header>

      <div className={styles.callout}>
        <p>
          <strong>Nossa missão de moderação:</strong> O Grifório valoriza a liberdade de criação literária e a troca respeitosa de ideias. Atuamos com base em regras transparentes, moderação humana e garantia de contraditório. Toda decisão de moderação inclui justificativa e permite recurso formal com protocolo e prazo garantido.
        </p>
      </div>

      <section className={styles.section}>
        <h2>1. Conteúdos Proibidos (Tolerância Zero)</h2>
        <p>Determinadas condutas são estritamente vedadas na plataforma e resultarão em ocultação imediata, suspensão de conta e, quando cabível, encaminhamento às autoridades judiciais:</p>
        <ul>
          <li><strong>Exploração e abuso de crianças e adolescentes:</strong> Proibição absoluta de qualquer material que retrate, sugira ou incentive exploração, pornografia ou violência contra menores de idade (ECA e Lei Federal nº 8.069/90).</li>
          <li><strong>Pornografia e conteúdo sexualmente explícito:</strong> No lançamento (MVP), é expressamente proibida a publicação de pornografia, contos eróticos com descrições genitais explícitas ou atos sexuais gráficos.</li>
          <li><strong>Apologia a crimes graves e violência:</strong> Incitação explícita ao cometimento de homicídio, estupro, terrorismo, genocídio ou atos contra a vida.</li>
          <li><strong>Discurso de ódio e discriminação:</strong> Ataques ou degradação contra grupos ou pessoas com base em raça, cor, etnia, religião, nacionalidade, deficiência, gênero ou orientação sexual.</li>
          <li><strong>Divulgação não autorizada de dados íntimos:</strong> Compartilhamento de dados pessoais de terceiros sem autorização (doxxing) ou material íntimo não consensual.</li>
          <li><strong>Violação de direitos autorais:</strong> Cópia integral ou substancial de textos ou imagens protegidas sem autorização do titular legítimo.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>2. Classificação Indicativa e Conteúdo Maduro (18+)</h2>
        <p>
          2.1. Todo artigo deve possuir classificação indicativa adequada, conforme explicado em nossas <Link href="/diretrizes/classificacao">Diretrizes de Classificação Etária</Link>.
        </p>
        <p>
          2.2. O Grifório permite obras de ficção com temas maduros, suspense, terror psicológico, violência ficcional dramática e romances adultos, desde que respeitadas as diretrizes editoriais e a legislação. Tais obras devem obrigatoriamente receber a etiqueta <code>18+</code>.
        </p>
        <p>
          2.3. A atribuição de classificação 18+ <strong>não autoriza conteúdos ilegais ou pornografia explícita</strong>, nem dispensa os requisitos e barreiras de acesso aplicáveis para a proteção de menores e visitantes.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Procedimento de Moderação e Proteção da Equipe</h2>
        <p>
          3.1. <strong>Comunicação motivada:</strong> Quando um artigo ou comentário é ocultado, o autor recebe uma notificação detalhada contendo o motivo da decisão da moderação.
        </p>
        <p>
          3.2. <strong>Decisões institucionais:</strong> Para salvaguardar a segurança física e psicológica de nossos revisores contra perseguições e assédio online, as ações de moderação são assinadas coletivamente como <strong>"Moderação do Grifório"</strong>.
        </p>
        <p>
          3.3. <strong>Integridade do texto:</strong> Moderadores e administradores <strong>não editam o conteúdo literário</strong> do autor. Medidas editoriais limitam-se à ocultação do conteúdo, ajuste da classificação etária ou suspensão temporal/definitiva de privilégios.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Sistema de Recursos e SLA de 15 Dias</h2>
        <p>
          Acreditamos no direito de defesa e na revisão humana de possíveis equívocos editoriais.
        </p>
        <ul>
          <li><strong>Como recorrer:</strong> O autor pode interpor recurso diretamente na central de notificações do Grifório ou pela página de denúncias/recursos.</li>
          <li><strong>Protocolo exclusivo:</strong> Cada recurso gera um identificador transparente no formato <code>GRIF-REC-AAAAMMDD-XXXXXX</code>.</li>
          <li><strong>Prazo operacional (SLA):</strong> Estabelecemos a meta de até <strong>15 (quinze) dias</strong> para análise e decisão fundamentada.</li>
          <li><strong>Prevenção de conflito de interesse:</strong> O recurso será obrigatoriamente atribuído a um moderador distinto daquele que realizou a moderação original, assegurando imparcialidade na reanálise.</li>
          <li><strong>Restauração automática:</strong> Em caso de deferimento do recurso, o artigo, comentário ou perfil é imediatamente restaurado ao estado público anterior.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>5. Canal de Denúncias</h2>
        <div className={styles.contactCard}>
          <h3>Central de Denúncias e Moderação</h3>
          <p>Para reportar violações graves às diretrizes ou solicitar revisão manual fora da plataforma:</p>
          <p>
            E-mail institucional: <a href="mailto:denuncias@griforio.com.br">denuncias@griforio.com.br</a>
          </p>
        </div>
      </section>
    </main>
  );
}
