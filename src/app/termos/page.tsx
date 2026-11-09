import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Termos de Uso e Licença de Conteúdo | Grifório",
  description: "Condições gerais de uso da plataforma Grifório, elegibilidade etária (18+) e licença de direitos autorais.",
};

export default function TermosPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <span>Termos de Uso</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.eyebrow}>DOCUMENTO JURÍDICO</p>
        <h1 className={styles.title}>Termos de Uso e Licença de Conteúdo</h1>
        <div className={styles.meta}>
          <span>Versão: 1.0.0</span>
          <span>Última atualização: Novembro de 2026</span>
          <span>Vigência: Imediata</span>
        </div>
      </header>

      <div className={styles.callout}>
        <p>
          <strong>Resumo essencial:</strong> O Grifório é uma plataforma brasileira de publicação de artigos, contos e histórias. No lançamento, o cadastro é exclusivo para maiores de 18 anos. Você mantém todos os direitos autorais sobre suas criações e concede ao Grifório apenas uma licença para exibi-las. Conteúdos abusivos, plágio e exploração de menores são rigorosamente proibidos.
        </p>
      </div>

      <section className={styles.section}>
        <h2>1. Elegibilidade e Cadastro</h2>
        <p>
          1.1. <strong>Idade mínima:</strong> No momento do lançamento desta plataforma, a criação de contas e a publicação de conteúdos são permitidas exclusivamente a pessoas físicas com <strong>18 (dezoito) anos completos</strong> na data do cadastro.
        </p>
        <p>
          1.2. <strong>Autodeclaração e verificação:</strong> A data de nascimento informada no cadastro deve ser verídica. A autodeclaração é conferida pelo sistema e a constatação de fornecimento de dados falsos ensejará a imediata revogação de credenciais e encerramento da conta.
        </p>
        <p>
          1.3. <strong>Vedação de anonimato:</strong> Em observância ao art. 5º, IV, da Constituição Federal Brasileira, é vedado o anonimato na plataforma. Cada usuário deve ser identificável por credenciais válidas.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Propriedade Intelectual e Licença de Conteúdo</h2>
        <p>
          2.1. <strong>Titularidade do autor:</strong> Conforme a Lei de Direitos Autorais brasileira (Lei nº 9.610/98), os direitos morais e patrimoniais sobre os textos, títulos e obras literárias publicadas pertencem integralmente a seus respectivos autores.
        </p>
        <p>
          2.2. <strong>Licença de exibição:</strong> Ao publicar um artigo ou imagem de capa no Grifório, o autor concede à plataforma uma licença mundial, não exclusiva, gratuita e temporária para hospedar, armazenar, indexar, formatar e exibir publicamente a obra no âmbito da plataforma e de seus canais correlatos (como feeds RSS e sitemap).
        </p>
        <p>
          2.3. <strong>Integridade da obra:</strong> A administração e os moderadores do Grifório <strong>não editam o texto literário</strong> nem alteram o conteúdo original de terceiros. Em caso de infração às diretrizes, a moderação pode ocultar o artigo, solicitar revisão ou ajustar a classificação etária nos termos das Diretrizes da Comunidade.
        </p>
        <p>
          2.4. <strong>Encerramento de conta e publicação:</strong> O autor pode a qualquer momento despublicar suas obras através do Studio ou solicitar o encerramento de sua conta. As condições de retenção e visibilidade de conteúdos após o encerramento seguem as opções descritas nas configurações de conta e em nossa <Link href="/privacidade">Política de Privacidade</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Transparência de Inteligência Artificial</h2>
        <p>
          3.1. É obrigatório declarar o uso substancial de ferramentas de inteligência artificial na redação de textos ou na geração de imagens de capa, em conformidade com a nossa <Link href="/diretrizes/ia">Política de Uso de Inteligência Artificial</Link>.
        </p>
        <p>
          3.2. A omissão deliberada da origem de conteúdo gerado por IA constitui violação destes Termos e enseja medidas editoriais e administrativas.
        </p>
      </section>

      <section className={styles.section}>
        <h2>4. Condutas Vedadas e Sanções</h2>
        <p>É expressamente proibido publicar ou veicular na plataforma:</p>
        <ul>
          <li>Qualquer forma de exploração sexual, abuso ou violação de direitos de crianças e adolescentes (tolerância zero, com comunicação imediata às autoridades competentes);</li>
          <li>Pornografia ou conteúdo sexualmente explícito (vedados no lançamento);</li>
          <li>Plágio ou violação de direitos autorais de terceiros;</li>
          <li>Discurso de ódio, discriminação por raça, etnia, gênero, orientação sexual, religião ou deficiência;</li>
          <li>Ameaças, assédio, invasão de privacidade e doxxing;</li>
          <li>Tentativas de contornar mecanismos de autenticação, segurança ou controle de classificação etária.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>5. Moderação, Contraditório e Recursos</h2>
        <p>
          5.1. O Grifório adota moderação humana e garante o direito de recurso a qualquer usuário que tenha conteúdo ocultado ou conta suspensa.
        </p>
        <p>
          5.2. O procedimento de recurso segue o prazo operacional de até <strong>15 (quinze) dias</strong> para decisão, com prevenção de conflito de interesses, conforme descrito nas <Link href="/diretrizes">Diretrizes da Comunidade</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>6. Contato e Foro</h2>
        <p>
          Para notificações de direitos autorais, esclarecimentos ou exercício de direitos, entre em contato através da nossa página de <Link href="/contato">Contato</Link> ou pelo e-mail <code>suporte@griforio.com.br</code>.
        </p>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil, em especial a Constituição Federal, o Marco Civil da Internet (Lei nº 12.965/2014), a LGPD (Lei nº 13.709/2018) e a Lei de Direitos Autorais (Lei nº 9.610/1998).
        </p>
      </section>
    </main>
  );
}
