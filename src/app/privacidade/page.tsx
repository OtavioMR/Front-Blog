import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Política de Privacidade e Cookies | Grifório",
  description: "Tratamento de dados pessoais, direitos dos titulares nos termos da LGPD e política de encerramento de conta do Grifório.",
};

export default function PrivacidadePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <span>Política de Privacidade</span>
      </nav>

      <header className={styles.header}>
        <p className={styles.eyebrow}>LGPD & PROTEÇÃO DE DADOS</p>
        <h1 className={styles.title}>Política de Privacidade e Cookies</h1>
        <div className={styles.meta}>
          <span>Versão: 1.0.0</span>
          <span>Última atualização: Novembro de 2026</span>
          <span>Legislação: Lei Geral de Proteção de Dados (Lei nº 13.709/2018)</span>
        </div>
      </header>

      <div className={styles.callout}>
        <p>
          <strong>Compromisso de privacidade:</strong> O Grifório respeita sua privacidade. Nós coletamos apenas os dados essenciais para o funcionamento da plataforma e verificação de maioridade legal (18+). <strong>Não usamos cookies de rastreamento de publicidade</strong> e não comercializamos dados pessoais de usuários.
        </p>
      </div>

      <section className={styles.section}>
        <h2>1. Dados Coletados e Finalidades</h2>
        <p>Em conformidade com o princípio da necessidade e minimização de dados (Art. 6º, III, LGPD), coletamos apenas:</p>
        <ul>
          <li><strong>Dados de cadastro:</strong> Nome público, endereço de e-mail e data de nascimento. A data de nascimento é utilizada exclusivamente para aferição da elegibilidade etária (maioridade legal de 18 anos) e proteção contra acesso indevido a conteúdos 18+.</li>
          <li><strong>Credenciais de segurança:</strong> Senha de acesso armazenada em formato hash criptográfico (bcrypt com salt individualizado) e códigos de autenticação em dois fatores (TOTP), quando ativados pelo usuário.</li>
          <li><strong>Dados de perfil (opcionais):</strong> Foto de perfil, biografia e links de redes sociais inseridos voluntariamente pelo usuário.</li>
          <li><strong>Registros técnicos de conexão:</strong> Registros técnicos e operacionais de acesso (como data, hora e endereço IP nos logs de infraestrutura), tratados para segurança da informação e prevenção a fraudes (Art. 7º, IX da LGPD) e, quando aplicável, mantidos conforme os prazos legais pertinentes (Art. 15 da Lei nº 12.965/2014).</li>
        </ul>
        <p>
          <strong>O que não coletamos:</strong> O Grifório não coleta documentos civis (RG, CPF, CNH), dados biométricos, dados de geolocalização precisa nem dados bancários ou financeiros.
        </p>
      </section>

      <section className={styles.section}>
        <h2>2. Cookies e Tecnologias de Armazenamento</h2>
        <p>
          2.1. O Grifório utiliza exclusivamente <strong>cookies estritamente técnicos e de sessão</strong>, necessários para autenticação segura e proteção contra ataques de falsificação de solicitação entre sites (CSRF).
        </p>
        <p>
          2.2. Preferências estéticas (como tema claro/escuro e tonalidade de fundo) são gravadas localmente no navegador do usuário (LocalStorage), sem envio para servidores de terceiros.
        </p>
        <p>
          2.3. Não utilizamos pixels de rastreamento, scripts de terceiros para publicidade comportamental ou ferramentas analíticas invasivas.
        </p>
      </section>

      <section className={styles.section}>
        <h2>3. Encerramento de Conta e Anonimização</h2>
        <p>
          3.1. <strong>Direito de eliminação:</strong> O usuário titular pode solicitar o encerramento de sua conta a qualquer momento na área de configurações (com confirmação de identidade por senha).
        </p>
        <p>
          3.2. <strong>Meta operacional da plataforma:</strong> Estabelecemos a meta operacional de até <strong>30 (trinta) dias</strong> para concluir internamente os procedimentos técnicos de anonimização e expurgo dos dados cadastrais elegíveis (ressalvadas as obrigações legais de conservação).
        </p>
        <p>
          3.3. <strong>Protocolo de solicitação:</strong> Ao solicitar o encerramento, o sistema gera um protocolo identificador exclusivo no padrão <code>GRIF-DEL-AAAAMMDD-XXXXXX</code> para acompanhamento do titular.
        </p>
        <p>
          3.4. <strong>Tratamento de conteúdos e comentários:</strong>
        </p>
        <ul>
          <li><strong>Artigos e imagens:</strong> O titular pode despublicar previamente suas obras pelo Studio. As opções definitivas de preservação ou despublicação de artigos no encerramento de conta seguem a política informada no momento da confirmação;</li>
          <li><strong>Comentários:</strong> Permanecem nos tópicos para preservar o encadeamento das discussões comunitárias, porém são <strong>efetivamente anonimizados</strong>. O nome do autor é desvinculado e substituído pelo marcador neutro <em>&quot;Usuário desativado&quot;</em>, e foto e links para o perfil são permanentemente removidos.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>4. Direitos do Titular de Dados</h2>
        <p>Conforme previsto no Artigo 18 da LGPD, você possui o direito de solicitar a qualquer momento:</p>
        <ul>
          <li>Confirmação da existência de tratamento e acesso aos seus dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>Portabilidade dos seus dados para outro fornecedor de serviço;</li>
          <li>Revogação do consentimento, quando esta for a base legal aplicável.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>5. Canal do Encarregado de Dados (DPO)</h2>
        <div className={styles.contactCard}>
          <h3>Encarregado pelo Tratamento de Dados Pessoais</h3>
          <p>Para dúvidas sobre esta política ou para exercer qualquer dos direitos previstos na LGPD, envie uma mensagem para:</p>
          <p>
            E-mail institucional: <a href="mailto:privacidade@griforio.com.br">privacidade@griforio.com.br</a>
          </p>
          <p>Prazo regulamentar de resposta: até 15 dias para respostas completas nos termos do art. 19, II da LGPD.</p>
        </div>
      </section>
    </main>
  );
}
