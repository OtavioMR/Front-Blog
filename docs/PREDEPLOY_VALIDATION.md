# Preparação para produção — 12/11/2026

> Atualização posterior: a integração V2 foi concluída e validada com backend/HTTPS/navegador reais. Este documento registra a etapa anterior; o estado atual de sessões e seus limites estão em [SESSION_V2_VALIDATION.md](SESSION_V2_VALIDATION.md).

Trabalho local em `chore/limpeza-pre-deploy`, sem commit, push, merge ou deploy. Nenhuma funcionalidade V1, migration, teste ou dependência foi removida. Não houve alteração visual: entidades HTML preservam as mesmas aspas e o mesmo texto exibidos.

## Arquivos modificados

| Arquivos | Justificativa |
| --- | --- |
| [package.json](../package.json) | `start` respeita `PORT` e escuta em `0.0.0.0`, em vez de fixar 5173; script `typecheck` regenera tipos de rotas antes do TypeScript |
| [diretrizes/ia/page.tsx](../src/app/diretrizes/ia/page.tsx), [diretrizes/page.tsx](../src/app/diretrizes/page.tsx), [privacidade/page.tsx](../src/app/privacidade/page.tsx) | Seis erros de aspas não escapadas corrigidos com `&quot;`, sem mudar o texto renderizado |
| [admin-bff-http.test.mjs](../tests/admin-bff-http.test.mjs) | Esperar 404 para newsletter e confirmar ausência de link no painel; backend exclui NewsletterModule e o frontend não tem a página V1 |
| [studio-editor.test.mjs](../tests/studio-editor.test.mjs) | Construir fixture sem `isActive` sem criar variáveis não usadas; manter todas as expectativas |
| [admin-api-real.test.mjs](../tests/admin-api-real.test.mjs) | Remover variável de caminho não utilizada |
| [account-real-browser.test.mjs](../tests/account-real-browser.test.mjs), [comment-browser.test.mjs](../tests/comment-browser.test.mjs), [comment-like-real-browser.test.mjs](../tests/comment-like-real-browser.test.mjs), [comment-real-browser.test.mjs](../tests/comment-real-browser.test.mjs) | Substituir expressão ternária usada somente por efeitos por `if/else`, preservando resolução/rejeição de chamadas CDP |
| [editorial-e2e.test.mjs](../tests/editorial-e2e.test.mjs), [follow-real-browser.test.mjs](../tests/follow-real-browser.test.mjs), [notifications-real-browser.test.mjs](../tests/notifications-real-browser.test.mjs) | Mesma correção de lint nos handlers CDP |
| [publication-browser.test.mjs](../tests/publication-browser.test.mjs), [publication-real-browser.test.mjs](../tests/publication-real-browser.test.mjs), [recovery-email-docker-browser.test.mjs](../tests/recovery-email-docker-browser.test.mjs), [revisions-docker-browser.test.mjs](../tests/revisions-docker-browser.test.mjs), [revisions-real-browser.test.mjs](../tests/revisions-real-browser.test.mjs) | Mesma correção de lint nos handlers CDP; testes que acessam o banco existente não foram executados |
| [BACKLOG.md](../BACKLOG.md) e este documento | Evidências e pendências atuais |

## Resultados

| Comando ou verificação | Resultado |
| --- | --- |
| `npm run lint` | Exit 0; seis erros corrigidos; avisos reduzidos de 22 para 5 |
| `npm run typecheck` | Exit 0, incluindo geração de tipos de rotas; cache antigo não causa mais falso erro |
| `npm run build` | Exit 0; build de produção completo e 29 páginas estáticas geradas |
| `npm run test:public` | 17 aprovados |
| `npm run test:session` | 26 aprovados |
| `npm run test:theme` | 12 aprovados |
| `npm run test:studio` | 13 aprovados |
| `npm run test:admin` | 7 aprovados, incluindo o teste antes interrompido na newsletter |
| Oito testes de navegador com API simulada | 8 aprovados, zero falhas e zero skips; coleções, comentários, desativação, revisão editorial, confirmação de e-mail, publicação, revisões e séries |
| Inicialização de produção | `next start --hostname 0.0.0.0` respeitou `PORT` escolhido para o smoke; `/sobre` retornou 200 |
| `npm audit --omit=dev` | Zero vulnerabilidades reportadas nesta consulta |
| `git diff --check` e diagnósticos do editor | Sem erros |

Comando dos oito testes de navegador: `node --test --test-concurrency=1 tests/email-confirm-browser.test.mjs tests/deactivate-account-browser.test.mjs tests/comment-browser.test.mjs tests/editorial-e2e.test.mjs tests/publication-browser.test.mjs tests/series-browser.test.mjs tests/revisions-browser.test.mjs tests/collections-browser.test.mjs`. Esses testes criam frontend e API simulada temporários; não usam o banco existente.

Os testes com sufixo `real` ou Docker que podem alterar bancos existentes foram preservados e não executados nessa infraestrutura. As integrações reais do backend foram executadas separadamente em PostgreSQL/Redis descartáveis, com SMTP local ou mock, não no banco de desenvolvimento.

## Cinco avisos mantidos

- `<img>` em [avatar.tsx](../src/app/_components/avatar.tsx), na [página administrativa de artigo](../src/app/gestao-editorial/(painel)/artigos/[id]/page.tsx) e no [editor](../src/app/studio/editor.tsx): preservar fallback de avatar, URLs dinâmicas e preview local; trocar por otimização de imagem exigiria validação adicional de comportamento e configuração.
- Navegação completa no [login administrativo](../src/app/gestao-editorial/entrar/login-form.tsx): preservada a recarga após criação da sessão e a separação dos layouts; não trocar por navegação SPA nesta limpeza.
- Ref numérica em [restricted-post.tsx](../src/app/posts/[slug]/restricted-post.tsx): é um contador para invalidar requisições, não uma referência a nó DOM. O cleanup marca o efeito inativo, invalida a revisão e cancela a assinatura; não aplicar mecanicamente uma correção destinada a refs de elementos.

Os avisos não foram silenciados por configuração global. O aviso de execução `MODULE_TYPELESS_PACKAGE_JSON` em testes TypeScript também é conhecido; mudar todo o pacote para ESM para removê-lo não faz parte desta preparação.

## Render e segurança

Para produção, usar Node 24, build `npm ci && npm run build`, start `npm start`, `NODE_ENV=production`, `SITE_ORIGIN` HTTPS canônica e `API_ORIGIN` privada. A origem da API participa dos rewrites de build; alterá-la exige reconstrução. O dev continua na porta 5173; para executar start local nessa porta, definir `PORT=5173` no ambiente do processo. O frontend exige servidor Node, não exportação estática.

O refresh token permanece em cookie HttpOnly; access token fica em memória, e armazenamento/mensagens entre abas contêm apenas coordenação, não credenciais. As mutações encaminhadas pelo proxy exigem origem exata. O BFF verifica identidade e papel na API e utiliza CSRF nas ações administrativas; suas sessões ficam em memória de uma instância.

**Não liberar cadastro público ainda:** o cliente público e o BFF usam o refresh legado, enquanto o backend contém protocolo V2. Os testes de concorrência do backend não comprovam a integração do cliente com recuperação após falha de rede. Também faltam provas de HTTPS, cookies entre abas, revogação, ausência de caminho direto ao upstream e IP efetivo do rate limiting na topologia final. A flag administrativa e a editorial continuam sob seus critérios de habilitação; nenhum valor local de ambiente foi alterado.

PostgreSQL externo/TLS, Redis persistente, SMTP, armazenamento de imagens e backup/restauração ainda precisam ser configurados e homologados no ambiente escolhido. Ver o relatório e o guia de Render no repositório Backend-Blog. A verificação Git por nomes sensíveis e padrões de chaves conhecidos não encontrou arquivos de ambiente reais versionados; não constitui garantia de ausência de todos os segredos no histórico. Nenhum arquivo pessoal ou ambiente local foi aberto para inspeção.

Referências: [Render Web Services](https://render.com/docs/web-services) e documentação da versão Next instalada. As evidências desta data devem prevalecer sobre descrições históricas de sprints que não correspondam ao checkout atual.
