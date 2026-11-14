# Sessão administrativa em staging

## Diagnóstico

O BFF guardava a sessão exclusivamente em `globalThis.__editorialSessions`, um `Map` do processo Next.js em [admin-security.ts](../src/lib/admin-security.ts). O cookie contém somente um ID aleatório; não contém os dados da sessão. Antes da correção:

1. [POST entrar/sessao](../src/app/gestao-editorial/entrar/sessao/route.ts) autenticava no Nest, conferia o perfil, chamava `createSession`, emitia o cookie e respondia 303.
2. O [proxy](../src/proxy.ts) verificava apenas a presença do cookie e deixava a navegação passar.
3. [adminIdentity / adminCsrf / adminRead](../src/app/gestao-editorial/(painel)/_lib/data.ts) chamavam `getValidSession`, que procurava o ID no `Map` local. Outra função, instância ou processo reiniciado não possuía o registro.
4. O [layout protegido](../src/app/gestao-editorial/(painel)/layout.tsx) e [AdminFailure / AdminShell](../src/app/gestao-editorial/(painel)/_components/shell.tsx) redirecionavam para a entrada com 307.

Esse defeito explica exatamente a sequência relatada mesmo quando o navegador envia corretamente o cookie. O backlog já registrava que o BFF em memória não era adequado a serverless. O teste de regressão agora exige que o primeiro GET use outro processo Next.js.

Não foram consultados logs, configurações remotas ou credenciais de staging. A identificação da instância responsável por cada requisição e possíveis problemas adicionais de configuração precisam ser conferidos nesse ambiente.

## Integração inspecionada

- O [login do Nest](../../Backend-Blog/src/modules/auth/auth.service.ts) valida senha e TOTP/código de recuperação e aguarda a transação que grava `auth_sessions` e a auditoria antes de retornar os tokens. Não foi encontrada corrida entre essa persistência e o redirecionamento.
- A [JWT strategy](../../Backend-Blog/src/modules/auth/strategies/jwt.strategy.ts) verifica assinatura/expiração, usuário ativo, `authVersion` e sessão persistida. Os [guards de cargos](../../Backend-Blog/src/modules/auth/guard/roles.guard.ts) exigem cargo atual, 2FA e e-mails confirmados. Essas verificações foram preservadas.
- A entrada do BFF já consulta o perfil no Nest com o token recém-emitido antes de enviar o 303. Uma falha nessa consulta não chegaria ao redirecionamento de sucesso. O frontend antigo não assinava a sessão com um segredo próprio; não havia um segredo de assinatura do cookie para comparar com o JWT do Render.
- O refresh administrativo usa o protocolo V2 e guarda seus cookies no servidor. A [sessão comum](../src/lib/session-client.ts) tem outro ID, cookies e coordenação no navegador. O logout administrativo revoga a sessão correspondente no Nest, sem apagar cookies da sessão comum. Alteração de senha, revogação de sessões ou de permissões continua sendo aplicada pelo backend.
- Redis já é dependência da infraestrutura do backend. Nenhuma tabela, migration, contrato Nest, regra de autorização ou configuração remota foi alterada.

## Correção

[admin-session-store.ts](../src/lib/admin-session-store.ts) mantém o estado compartilhado no Redis, com ID indexado por SHA-256, namespace por `SITE_ORIGIN`, TTL limitado pela expiração absoluta/inatividade e cifragem autenticada AES-256-GCM. O navegador continua recebendo somente o ID opaco de 43 caracteres.

[admin-security.ts](../src/lib/admin-security.ts) aguarda a persistência antes de permitir a emissão do cookie. Não existe fallback para memória. A trava distribuída serializa a rotação V2; o ID da operação é persistido **antes** da chamada remota e os novos cookies antes da leitura do corpo, permitindo recuperar respostas perdidas em outra instância. Escritas e remoções durante o refresh verificam a propriedade da trava; uma instância com trava vencida não sobrescreve estado novo. Escritas também exigem que a sessão ainda exista, impedindo restauração após logout.

Os consumidores de `getSession`, criação e exclusão foram adaptados para operações assíncronas. Permanecem HttpOnly, Secure em produção, SameSite=Strict, Path=/, ausência de Domain, CSRF, validação do segundo fator no Nest, autorização na API e limites de duração. O logout continua sem exclusão tardia de cookie com nome fixo, para não apagar um login mais recente.

Sessões antigas em memória não são migradas: será necessário entrar novamente. Perda/evicção do Redis ou rotação da chave também encerra as sessões do BFF. Use Redis com capacidade e disponibilidade adequadas; não use uma réplica com leituras eventualmente consistentes para recuperar esse estado.

## Variáveis a conferir, sem expor valores

| Ambiente | Variáveis e requisito |
| --- | --- |
| Vercel | `ENABLE_ADMIN_BFF=true`; `API_ORIGIN` apontando ao backend de staging, sem `/api/v1`; `SITE_ORIGIN` igual à origem HTTPS canônica do frontend, sem caminho/barra final. |
| Vercel | **`REDIS_URL`**: endpoint Redis compartilhado, autenticado e alcançável de todas as funções da Vercel; usar TLS (`rediss://`) em staging. Uma URL privada acessível apenas na rede do Render não atende esse requisito. Reutilize o serviço existente se ele permitir acesso externo seguro. |
| Vercel | **`ADMIN_SESSION_ENCRYPTION_KEY`**: 32 bytes aleatórios representados por 64 caracteres hexadecimais; estável e igual em todas as funções da implantação. Exclusiva do BFF, distinta dos segredos JWT. Não usar prefixo `NEXT_PUBLIC_`. Separar staging de produção. |
| Vercel | `ADMIN_SESSION_IDLE_SECONDS`, `ADMIN_SESSION_MAX_SECONDS`: limites em segundos; mantidos os padrões de 2h de inatividade e 12h absolutas. `NODE_ENV=production` para cookies seguros. |
| Render | `FRONTEND_URL` igual a `SITE_ORIGIN`; `NODE_ENV=production`; `JWT_SECRET`, `JWT_REFRESH_SECRET`, `TOTP_ENCRYPTION_KEY` estáveis e coerentes entre instâncias; `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` coerentes com a política de sessão. Não copiar segredos JWT para o frontend. |
| Render / Neon | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` e, quando necessário, `DB_SSL_CA` apontando ao mesmo banco de staging em todas as instâncias. Nenhuma alteração de esquema é necessária. |

Defina as variáveis no escopo Vercel que realmente hospeda staging (Preview ou Production conforme o projeto). A configuração de exemplo foi atualizada em [.env.example](../.env.example); nenhum arquivo local de credenciais foi alterado.

## Validação local

É necessário Redis real local ou `TEST_REDIS_URL` apontando a Redis de teste. Os testes usam IDs e chave de cifragem sintéticos, sem limpar bancos/Redis inteiros. Os testes HTTP administrativos exigem `npm.cmd run build` antes da execução.

- `npm.cmd run test:admin`: sessão, CSRF, permissões, expiração, refresh concorrente, perda de resposta, logout durante refresh e HTTP com processos Next separados.
- [admin-session-distributed.test.mjs](../tests/admin-session-distributed.test.mjs): login com 2FA ausente/incorreto negado; criação; GET imediato em outro processo; recarga; reinício; uma rotação entre instâncias; cookie desconhecido/adulterado; estado cifrado corrompido; chave incorreta; configuração ausente; logout propagado; trava vencida sem sobrescrita/exclusão.
- `npm.cmd run test:session`: regressão da autenticação comum do blog com respostas simuladas.
- `npm.cmd run test:editorial-e2e`: navegador real com API simulada e Redis real.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`.
- Backend: `npm.cmd test -- src/modules/auth/auth.service.spec.ts src/modules/auth/auth.controller.spec.ts src/modules/auth/strategies/jwt.strategy.spec.ts src/modules/auth/guard/roles.guard.spec.ts src/modules/auth/totp.service.spec.ts src/modules/auth/refresh-recovery-v2.spec.ts`.

Esses testes não comprovam conectividade TLS entre Vercel e Redis, configuração do Render, cookies no domínio público ou execução contra Neon em staging. A suíte antiga `admin-refresh-real.test.mjs` não foi usada como prova: sua fixture administrativa não prepara os requisitos atuais completos de 2FA/e-mail de recuperação.

Resultados locais em 13/11/2026:

| Verificação | Resultado |
| --- | --- |
| `test:admin` | 11 testes passaram, sem skips; Redis real e Next em modo de produção, API simulada. |
| `test:session` | 28 testes passaram. |
| `test:editorial-e2e` | 1 teste passou no navegador; API simulada e Redis real. |
| Testes direcionados do backend acima | 69 testes passaram em 6 arquivos. |
| `typecheck` e `build` | Passaram. |
| `lint` completo do frontend | Zero erros; 5 avisos existentes em arquivos sem alteração nesta correção. |
| Staging / Neon remoto | Não executado; pendente do procedimento abaixo. |

## Procedimento em staging (após publicação pelo responsável)

1. Conferir as variáveis acima e a conectividade do Redis a partir da Vercel. Não registrar tokens, cookies, códigos de autenticação ou valores de segredos.
2. Usar conta administrativa de teste com e-mail principal e de recuperação confirmados e 2FA ativo. Confirmar que senha/código incorretos e código ausente não emitem cookie de sessão.
3. Entrar com credenciais e segundo fator válidos. Na aba Network, confirmar POST 303, `Set-Cookie: __Host-editorial-session`, atributos de segurança preservados e remoção do cookie temporário de entrada.
4. Confirmar que o GET imediato envia o cookie e retorna 200 com o painel, sem 307 para a entrada. Recarregar, navegar por páginas administrativas e repetir em abas simultâneas.
5. Repetir as leituras em execuções frias/instâncias distintas usando os identificadores de execução nos logs da Vercel (sem dados sensíveis). Uma nova execução deve recuperar o mesmo estado compartilhado.
6. Aguardar a expiração do access token e verificar que a sessão continua após refresh V2, inclusive com duas abas simultâneas. Conferir ausência de repetição indevida de geração e de loop de login.
7. Sair da administração e repetir uma requisição com o cookie antigo: deve ser negada. Confirmar que a sessão comum do blog continua funcional. Repetir após revogação administrativa, perda de cargo e expiração absoluta/inatividade.
8. Em cliente de teste separado, usar cookie desconhecido ou alterado: nenhum dado administrativo deve ser entregue. Conferir também rejeição de CSRF/origem incorretos nas ações.

Nenhum deploy, push ou commit foi realizado por esta correção.

## Arquivos modificados

- [.env.example](../.env.example)
- [BACKLOG.md](../BACKLOG.md)
- [docs/admin-session-staging.md](../docs/admin-session-staging.md)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [src/app/gestao-editorial/(painel)/artigos/[id]/moderar/route.ts](../src/app/gestao-editorial/(painel)/artigos/[id]/moderar/route.ts)
- [src/app/gestao-editorial/(painel)/artigos/[id]/revisar/route.ts](../src/app/gestao-editorial/(painel)/artigos/[id]/revisar/route.ts)
- [src/app/gestao-editorial/(painel)/atividade/route.ts](../src/app/gestao-editorial/(painel)/atividade/route.ts)
- [src/app/gestao-editorial/(painel)/categorias/acao/route.ts](../src/app/gestao-editorial/(painel)/categorias/acao/route.ts)
- [src/app/gestao-editorial/(painel)/comentarios/[id]/moderar/route.ts](../src/app/gestao-editorial/(painel)/comentarios/[id]/moderar/route.ts)
- [src/app/gestao-editorial/(painel)/denuncias/[id]/atribuir/route.ts](../src/app/gestao-editorial/(painel)/denuncias/[id]/atribuir/route.ts)
- [src/app/gestao-editorial/(painel)/denuncias/[id]/resolver/route.ts](../src/app/gestao-editorial/(painel)/denuncias/[id]/resolver/route.ts)
- [src/app/gestao-editorial/(painel)/tags/acao/route.ts](../src/app/gestao-editorial/(painel)/tags/acao/route.ts)
- [src/app/gestao-editorial/(painel)/usuarios/[id]/funcao/alterar/route.ts](../src/app/gestao-editorial/(painel)/usuarios/[id]/funcao/alterar/route.ts)
- [src/app/gestao-editorial/(painel)/usuarios/[id]/liberar-autoria/route.ts](../src/app/gestao-editorial/(painel)/usuarios/[id]/liberar-autoria/route.ts)
- [src/app/gestao-editorial/(painel)/usuarios/[id]/moderar/route.ts](../src/app/gestao-editorial/(painel)/usuarios/[id]/moderar/route.ts)
- [src/app/gestao-editorial/(painel)/usuarios/[id]/recuperar-autenticador/route.ts](../src/app/gestao-editorial/(painel)/usuarios/[id]/recuperar-autenticador/route.ts)
- [src/app/gestao-editorial/entrar/sessao/route.ts](../src/app/gestao-editorial/entrar/sessao/route.ts)
- [src/app/gestao-editorial/sair/route.ts](../src/app/gestao-editorial/sair/route.ts)
- [src/lib/admin-security.ts](../src/lib/admin-security.ts)
- [src/lib/admin-session-store.ts](../src/lib/admin-session-store.ts)
- [tests/admin-bff-http.test.mjs](../tests/admin-bff-http.test.mjs)
- [tests/admin-security.test.mjs](../tests/admin-security.test.mjs)
- [tests/admin-session-distributed.test.mjs](../tests/admin-session-distributed.test.mjs)
- [tests/editorial-e2e.test.mjs](../tests/editorial-e2e.test.mjs)
- [tests/support/admin-store.mjs](../tests/support/admin-store.mjs)
- [tsconfig.json](../tsconfig.json)
