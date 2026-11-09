import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Contato e Canais Institucionais | Grifório",
  description: "Canais oficiais de atendimento, suporte, denúncias e encarregado de privacidade (DPO) do Grifório.",
};

export default function ContatoPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <span>Contato</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.eyebrow}>ATENDIMENTO & INSTITUCIONAL</p>
        <h1 className={styles.title}>Canais de Contato do Grifório</h1>
        <div className={styles.meta}>
          <span>Comunicação transparente e ágil</span>
        </div>
      </header>

      <div className={styles.callout}>
        <p>
          Precisa de ajuda, deseja relatar uma vulnerabilidade de segurança, denunciar uma violação de direitos autorais ou exercer seus direitos de privacidade? Utilize os canais dedicados abaixo para que sua mensagem chegue diretamente à equipe competente.
        </p>
      </div>

      <div className={styles.badgeGrid}>
        <div className={styles.contactCard}>
          <h3>Suporte e Dúvidas Gerais</h3>
          <p>Para dúvidas técnicas, problemas com acesso à conta, sugestões ou suporte à publicação no Studio:</p>
          <p>
            E-mail: <a href="mailto:suporte@griforio.com.br">suporte@griforio.com.br</a>
          </p>
        </div>

        <div className={styles.contactCard}>
          <h3>Privacidade & Encarregado (DPO)</h3>
          <p>Para exercício dos direitos do titular nos termos da LGPD, informações sobre tratamento de dados ou exclusão:</p>
          <p>
            E-mail: <a href="mailto:privacidade@griforio.com.br">privacidade@griforio.com.br</a>
          </p>
          <p><small>Prazo regulamentar de resposta: até 15 dias.</small></p>
        </div>

        <div className={styles.contactCard}>
          <h3>Denúncias e Direitos Autorais</h3>
          <p>Para reportar plágio, violações às diretrizes da comunidade ou apresentar recursos de moderação fora do sistema:</p>
          <p>
            E-mail: <a href="mailto:denuncias@griforio.com.br">denuncias@griforio.com.br</a>
          </p>
          <p><small>SLA de resposta para recursos: até 15 dias úteis.</small></p>
        </div>
      </div>

      <section className={styles.section} style={{ marginTop: '40px' }}>
        <h2>Documentos Importantes</h2>
        <ul>
          <li><Link href="/termos">Termos de Uso e Licença de Conteúdo</Link></li>
          <li><Link href="/privacidade">Política de Privacidade e Cookies</Link></li>
          <li><Link href="/diretrizes">Diretrizes da Comunidade e Moderação</Link></li>
          <li><Link href="/diretrizes/ia">Política de Uso de Inteligência Artificial</Link></li>
          <li><Link href="/diretrizes/classificacao">Classificação Etária das Obras</Link></li>
        </ul>
      </section>
    </main>
  );
}
