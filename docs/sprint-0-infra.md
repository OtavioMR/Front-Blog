# Sprint 0 — infraestrutura e contratos

Verificação local em 04/11/2026. Backend analisado no commit `f89622ec911fbe69a8f7fb2f46b179444733c04b`; a inspeção é parcial e não substitui os testes de integração da sprint.

## Estado do ambiente

- `docker info --format '{{.ServerVersion}}'` falhou: o cliente existe, mas o daemon Linux do Docker Desktop não estava acessível.
- Portas 3000 e 5432 estavam ocupadas; 5433, 6379, 1025 e 8025 não apareciam como portas em escuta. Não foi verificado o conteúdo ou a identidade do banco existente e ele não deve ser usado como fixture.
- O Compose do backend prevê PostgreSQL 16 na porta local 5433 por padrão e Redis 7 na 6379, com volumes persistentes. Não há SMTP de teste nesse Compose. O serviço da API é opcional (`app`) e usa o arquivo de ambiente do backend; não foi iniciado nem modificado.
- Nenhuma conta, credencial, banco ou volume existente foi utilizado. Sem Docker/Redis isolados, não foi possível provar login, rotação de cookie, upload ou publicação com a API real.

## Contratos e topologia a verificar

### Alterações locais desde a referência

Em 05/11/2026, o checkout do backend ainda apontava para `f89622e`, mas tinha alterações não commitadas. A comparação do código identificou `authorId` opcional como UUID v4 no filtro de `GET /api/v1/posts` e sua aplicação na consulta; também identificou `firstPostApproved` na resposta de `GET /api/v1/users/:id` somente quando o solicitante é o próprio titular. O Swagger local descreve esse campo como opcional. Essas alterações são do checkout, não prova de que a imagem da API em execução as contenha. A autorização de publicação continua no backend, e a ausência do campo não comprova elegibilidade.

No checkout atual, `npm.cmd test -- src/modules/posts/dto/find-posts-query.dto.spec.ts src/modules/posts/posts.service.spec.ts src/modules/users/users.service.spec.ts` passou (3 arquivos, 35 testes), e `powershell -ExecutionPolicy Bypass -File ./scripts/check-backend-openapi.ps1` passou (2 testes). São testes isolados e uma verificação parcial do documento em memória, não prova HTTP nem comparação completa do OpenAPI. A auditoria integral de contratos de S0.1 continua pendente.

- A API configura prefixo `/api/v1`; os arquivos são servidos fora desse prefixo em `/uploads/profile-photos/` e `/uploads/post-covers/`. A configuração HTTP aceita credenciais CORS para a origem de `FRONTEND_URL` e define `trust proxy` como 1.
- Login e refresh retornam access token no corpo e cookie `refreshToken` HttpOnly, SameSite Strict, com caminho `/api/v1/auth`; `Secure` depende de `NODE_ENV=production`. O logout exige Bearer e limpa o cookie. O proxy precisa preservar o caminho, os cabeçalhos `Set-Cookie` e o corpo multipart. HTTPS e cadeia de IPs devem ser comprovados na topologia final.
- A proposta local usa uma origem pública para Next e `/api/v1`, API em porta distinta e encaminhamento também de `/uploads`. A porta 3000 já estava ocupada na inspeção: identificar o processo antes de reutilizá-la e escolher outra porta livre para a API. O código do backend usa 3000 por padrão, portanto configurar `PORT` explicitamente.
- Swagger é disponibilizado em `/api/docs` fora de produção. O backend tem testes que geram o documento OpenAPI em memória, mas não foi identificado script no `package.json` para exportá-lo e comparar artefatos em CI. Definir geração reproduzível e verificar schemas com respostas reais antes de gerar tipos definitivos; não presumir que exemplos Swagger comprovem comportamento HTTP.
- O limite de upload e a preservação de cookies, cabeçalhos e IP precisam de prova na infraestrutura escolhida. A entrega pública de capas de rascunhos também exige decisão antes da publicação do Studio.

### Limites da cadeia de proxy

Em 05/11/2026, a configuração do frontend encaminhava `/api/v1` e `/uploads` por rewrites, e o Proxy do Next verificava a origem das mutações de `/api/v1`. A configuração do Nest mantinha `trust proxy = 1`. O teste isolado `npm.cmd test -- src/common/http-security.spec.ts` passou (4 testes) e demonstra que o rate limit distingue valores de `X-Forwarded-For` apresentados ao Nest; ele não demonstra que esses valores sejam confiáveis na implantação.

Com essa configuração, expor o Nest diretamente a clientes permite que o cabeçalho encaminhado pelo próprio cliente influencie o IP usado pelo Nest. A topologia final precisa restringir o acesso direto à API e garantir que o último proxy confiável substitua cabeçalhos de encaminhamento recebidos de clientes por valores verificados. Deve-se testar a cadeia efetiva, inclusive múltiplos proxies e tentativas de forjar cabeçalhos, antes de confiar no IP para rate limit. O BFF administrativo faz chamadas próprias ao Nest e também precisa ser considerado nessa prova.

O guia local do Next 16.4.5 informa que, quando o Proxy está em uso, o limite padrão de buffer do corpo é 10 MB e excedê-lo não implica resposta de erro automática. Isso não é um limite de upload de segurança: o gateway e o backend devem impor seus próprios limites, considerando a sobrecarga multipart. A passagem de 5 MiB e a rejeição de tamanho excedente continuam exigindo teste na cadeia final.

O manifesto do build local de 05/11/2026 registrou os destinos dos rewrites com a `API_ORIGIN` da compilação (`http://localhost:3000`). Em uma tentativa de teste, definir outra `API_ORIGIN` apenas ao iniciar `next start` não redirecionou o rewrite: uma requisição de login vazia recebeu 400 da API configurada no build, sem criação de dados. A tentativa foi removida. Prepare um build isolado com o upstream sintético configurado na compilação para testar cookie e multipart; não suponha que mudar essa variável apenas no processo de execução atualize os destinos. Isso também deve ser considerado ao promover imagens entre ambientes. Nenhum envio de e-mail ou publicação foi realizado nessa tentativa.

## Próximos passos para integração isolada

1. Disponibilizar Docker e usar o ambiente descrito em [sprint-0-local.md](./sprint-0-local.md), com PostgreSQL, Redis e SMTP de captura isolados, sem reutilizar dados existentes.
2. Aplicar migrations apenas ao banco de teste e criar contas e conteúdo sintéticos pelos fluxos suportados. Confirmar readiness da API, SMTP e filas, sem imprimir segredos ou tokens.
3. Exercitar pela origem pública escolhida: login e `Set-Cookie`, reload, refresh rotativo em duas abas, revogação, troca de conta, 401/403 e upload próximo do limite de 5 MiB. Verificar também HTTPS, caminho do cookie, preservação de multipart e IP real.
4. Testar artigo publicado no HTML, conteúdo inexistente ou despublicado com HTTP 404 antes de streaming e indisponibilidade da API como erro distinto. Validar acesso direto e autorização no backend para cada papel.

## Verificação executada

No backend: `npm.cmd test -- src/common/http-security.spec.ts src/docs/swagger.spec.ts src/modules/auth/auth.controller.spec.ts` passou: 3 arquivos, 14 testes. São testes isolados de configuração, documentação e controller; não comprovam a operação da infraestrutura ou a integração real. Os critérios de aceite da Sprint 0 continuam pendentes.

O arquivo `compose.sprint0.yml` passou em `docker compose -f compose.sprint0.yml config --quiet`. As portas 15433, 16380, 11025, 18025 e 3001 não estavam em escuta na inspeção; isso deve ser conferido novamente antes de iniciar. O daemon indisponível impediu iniciar os contêineres ou validar as imagens e conexões.

### Integração isolada posterior

Após o Docker iniciar em 04/11/2026, `docker compose -f compose.sprint0.yml ps` confirmou PostgreSQL, Redis e Mailpit saudáveis. Uma cópia temporária do backend, sem `.env`, uploads, Git ou dependências originais, recebeu `npm.cmd ci --no-audit --no-fund` e `npm.cmd run migration:run`: as 43 migrations foram aplicadas no banco de teste do Compose. `npm.cmd run start:dev` iniciou essa cópia na porta 3001; nenhum arquivo ou banco do backend original foi usado como fixture.

Um smoke HTTP com dados sintéticos, pela origem do frontend em `http://localhost:3000/api/v1`, verificou:

- Cadastro 201, captura de e-mail no Mailpit e confirmação 200.
- Login 200 e passagem do `Set-Cookie` com `HttpOnly`, `SameSite=Strict` e caminho `/api/v1/auth`; refresh 200 com cookie rotacionado; logout 200 e refresh posterior 401.
- Upload multipart de foto com exatamente 5 MiB retornou 201; com 5 MiB mais um byte retornou 413.
- Aceite de autoria, criação do rascunho, envio à revisão e aprovação retornaram sucesso; a leitura pública retornou 200. A conta administrativa sintética foi promovida por SQL exclusivamente no banco de teste, separada da conta autora. O artigo sintético usa o slug `um-artigo-de-teste-para-o-blog`.

Os testes usaram requisições HTTP automatizadas, não um navegador: reload, duas abas, concorrência real de refresh, HTTPS, encaminhamento de IP e comportamento de produção ainda precisam de prova. Os arquivos de smoke ficaram somente na cópia temporária; tokens e credenciais não foram registrados. Estes resultados não encerram os critérios da sprint.

### Navegador real

Posteriormente, no mesmo ambiente isolado e após as correções de sessão, um teste com Playwright Core e Microsoft Edge headless executou a interface real usando uma conta sintética nova. Passaram: cadastro e confirmação via Mailpit; login com cookie HttpOnly, Strict e caminho esperado; recarga simultânea em duas abas; tentativa de login inválido sem perder a sessão anterior; logout refletido na outra aba e após recarga. O cadastro enviou `Origin` da origem do frontend.

Um formulário enviado de `http://127.0.0.1:3000` para o refresh em `http://localhost:3000` recebeu 403 do filtro de origem; a sessão continuou funcional após a tentativa. Isso verifica duas origens locais específicas, não todas as combinações de subdomínios ou infraestrutura externa. O teste foi executado com `node sprint0-browser.cjs` na cópia temporária do backend, com Playwright Core instalado apenas nela; credenciais e tokens não foram registrados. HTTPS, IP e outras condições de concorrência permanecem pendentes.

### Container existente do backend

Na inspeção somente de leitura, `backend-blog-app-1` estava parado (saída 0), configurado para publicar `127.0.0.1:3000` e usar volume para uploads; `blog_postgres` estava saudável em 5433 e `backend-blog-redis-1` saudável em 6379. A porta 3000 estava ocupada pelo frontend. O banco e o volume existentes não foram examinados ou utilizados como fixtures, e não foram executadas migrations neles. A mudança de topologia para usar essa instância exige resolver a porta e validar a configuração de origem e o proxy; os resultados acima referem-se exclusivamente à API e ao banco isolados.

### Tentativa posterior de integração editor e fila

Em nova inspeção no mesmo dia, o backend principal estava saudável na porta 3000 e o frontend principal escutava na 5173. `docker compose -f compose.sprint0.yml ps -a` não listou containers de teste, e `docker ps -a` confirmou que os três containers sintéticos usados anteriormente já não estavam presentes. O volume `front-blog-sprint0_postgres_test` ainda aparecia em `docker volume ls`; sua existência não demonstra, por si só, que os serviços de teste estejam disponíveis ou que seus dados tenham sido validados.

A nova prova integrada de editor, fila, papéis, CSRF e SSR não foi executada: a solicitação limitou a execução aos containers de teste já existentes, sem criar novos ou usar o banco principal. Não foram iniciados containers, executadas migrations ou modificados volumes e dados. As evidências anteriores não comprovam o fluxo integrado da implementação atual. Para repetir a prova é necessário disponibilizar serviços isolados, com autorização para recriar os containers de teste ou fornecer outro ambiente sintético equivalente.
