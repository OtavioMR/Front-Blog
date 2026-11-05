# Backlog do frontend do blog

Referência: `C:/Users/otavv/Downloads/Arquitetura_Frontend_Blog.md` e backend local em `C:/Users/otavv/Documents/Backend-Blog`, commit `f89622e`. Confira os contratos novamente ao implementar. Os marcos não têm duração estimada. Marque uma tarefa apenas após sua verificação e registre evidências ou bloqueios.

O blog público, a conta, o Studio e a administração terão experiências separadas. A interface pública não divulga a administração. O backend deve negar acesso direto e chamadas de API para papéis não autorizados; ocultar o endereço não é proteção.

## Sprint 0 — decisões e provas técnicas

**Objetivo:** confirmar contratos e integração antes dos fluxos.

- [ ] S0.1 Conferir controllers, DTOs, guards e testes; registrar contratos, diferenças de Swagger e mudanças desde a revisão.
- [ ] S0.2 Definir e validar topologia, mesma origem pública para Next e `/api/v1`, proxy, `/uploads`, HTTPS, upload, IP e CORS.
- [ ] S0.3 Provar SSR de artigo e 404 real antes do streaming; distinguir indisponibilidade da API.
- [ ] S0.4 Provar cookie HttpOnly real, login, refresh rotativo, reload e duas abas; verificar `Set-Cookie` e upload de até 5 MiB no proxy.
- [ ] S0.5 Preparar PostgreSQL, Redis, API, SMTP e contas de teste isoladas; definir geração/checagem OpenAPI e registrar riscos.

**Aceite:** artigo presente no HTML, 404 verdadeiro, cookie e upload verificados na topologia escolhida; bloqueios documentados.

**Andamento:** iniciada. Em 04/11/2026, o backend estava no commit `f89622e`. Leitura inicial confirmou prefixo `/api/v1`, CORS com credenciais para a origem de `FRONTEND_URL`, `trust proxy = 1` e cookie `refreshToken` HttpOnly, SameSite Strict, caminho `/api/v1/auth` e Secure em produção. Os serviços não foram alterados. Docker Desktop indisponível e Redis local não respondeu; as provas de sessão e upload com API real seguem pendentes. Não usar credenciais ou dados existentes como fixtures. Uma base inicial Next.js e uma direção visual provisória foram criadas antecipadamente; isso não conclui S1.1 nem substitui os testes da Sprint 0.

**Verificações da base:** `npm.cmd run lint` e `npm.cmd run build` passaram; o build incluiu TypeScript. `npm.cmd audit --omit=dev` não encontrou vulnerabilidades; auditoria completa apontou 16 moderadas na cadeia de ferramentas de desenvolvimento, sem correção compatível oferecida pelo npm no momento. Reavaliar nas próximas atualizações.

**Progresso posterior:** iniciadas a listagem e busca públicas e a leitura SSR de artigos, sem concluir as sprints 0 ou 2. Com API HTTP simulada, foram verificados HTML do artigo (200), 404 real, erro upstream (500), redirecionamento de alias (308), bloqueio de rascunho e sanitização de script/URL perigosa, além de listagem, busca, vazio e indisponibilidade na home. Esses testes não substituem API, banco e cookie reais. Veja [contratos públicos](docs/contratos-publicos.md) e [infraestrutura](docs/sprint-0-infra.md); neste último estão registrados 14 testes isolados do backend aprovados. Faltam integração real, SEO completo, feeds/sitemap e as demais jornadas.

Foi preparado [Compose isolado](compose.sprint0.yml) para PostgreSQL, Redis e SMTP de teste; `docker compose -f compose.sprint0.yml config --quiet` passou. Como o daemon não estava disponível, não houve inicialização nem verificação de conectividade. Consulte [instruções locais](docs/sprint-0-local.md). O teste `npm.cmd run test:public` reproduz parte das provas HTTP com API simulada após o build.

**Atualização de ambiente:** Docker Desktop foi iniciado e o Compose isolado iniciou os três serviços. As provas com a API real em cópia isolada ainda estão em andamento; não reutilizar o banco original.

**Preferência do usuário:** usar o projeto Docker existente `backend-blog` nas próximas integrações. Em 04/11, `blog_postgres` e `backend-blog-redis-1` foram iniciados sem alterar dados; a API existente estava parada e configurada para a porta 3000, ocupada pelo frontend, e para produção com `FRONTEND_URL=http://localhost:5173`. Antes de trocar a API de teste, resolver portas, URL pública, HTTPS/cookie Secure e configuração do container existente sem descartar volumes. O Compose isolado e seus dados permanecem preservados; não recriar nem apagar ambientes sem verificar consequências.

**Topologia local atual:** conforme preferência do usuário, o frontend foi movido para `http://localhost:5173` e a API do container original está saudável em `http://localhost:3000`, com banco e Redis originais. As 43 migrations já registradas no banco coincidiram com as 43 da imagem antes do início da API. `.env.local` aponta o frontend para essa API e não é versionado. Uma consulta de leitura confirmou artigos e home HTTP 200; não foram criadas fixtures no banco original. Verificar cookie Secure no navegador e infraestrutura HTTPS para produção. O ambiente isolado e seus volumes continuam preservados.

A API temporária e os contêineres sintéticos foram parados após as provas. Na verificação posterior, os contêineres sintéticos não estavam mais presentes; o volume `front-blog-sprint0_postgres_test` permanece. O projeto `backend-blog` existente está ativo. Não foram recriados contêineres nem feitos testes de escrita no banco original.

**Provas reais parciais:** API em cópia temporária e banco sintético com 43 migrations. Via proxy local passaram cadastro/confirmação por e-mail, login, cookie HttpOnly/Strict, refresh rotativo, logout/revogação, upload de 5 MiB e rejeição de 5 MiB + 1 byte. Um autor sintético submeteu um artigo que um ADMIN sintético aprovou. O frontend retornou artigo 200 com HTML e canonical, home com título real, perfil público 200 e artigo inexistente 404. Detalhes em [infraestrutura](docs/sprint-0-infra.md). Faltam navegador com duas abas, HTTPS e encaminhamento de IP; nenhuma sprint foi concluída.

## Missão — integração e experiência (05/11/2026)

Execução sequencial; cada etapa exige contratos confirmados no código, estados e permissões tratados, testes proporcionais e evidências registradas aqui. Não marcar concluída enquanto houver critérios ou integrações reais pendentes. Preservar flags editoriais e não usar dados reais como fixtures.

- [ ] Etapa 1: exclusão de artigos/rascunhos, gestão editorial existente, edição e exclusão de comentários e feedback. Validar soft delete, troca de conta, permissões e resultados incertos.
- [ ] Etapa 2: painel da conta, configurações e temas claro/escuro/sistema; validar persistência, hidratação, contraste e responsividade.
- [ ] Etapa 3: publicação, agendamento, revisões, séries e editor, respeitando primeira revisão e bloqueios existentes.
- [ ] Etapa 4: seguidores, feed, coleções, notificações, curtidas e denúncias.
- [ ] Etapa 5: administração e integrações complementares viáveis, com autorização de servidor e API.

**Auditoria inicial:** o README do backend relata 45 integrações totais/parciais e 59 ausentes; é uma referência histórica, sujeita a confirmação por módulo. Estão ausentes a exclusão de artigo e a edição/exclusão/curtida de comentários. Publicação, agendamento e revisão inicial são parciais; conta, sessões, criação de comentários e listagem própria já existem. O Studio e a fila editorial têm flags desativadas e validação real pendente. A arquitetura planejada e o código efetivo do backend prevalecem sobre suposições do inventário.

**Etapa 1 em andamento:** Studio integra `DELETE /posts/:id` para a conta titular, com confirmação, estado de espera e reconciliação manual em resultado incerto; edição de item PENDING deixou de ser oferecida. O service confirma despublicação, cancelamento do agendamento e remoção lógica. `npm.cmd run test:studio` passou (5 testes) e `npm.cmd run build` passou com TypeScript. `npm.cmd run lint` falhou em dois erros preexistentes em `navbar.tsx` e `photo-form.tsx`, além de quatro avisos; não relacionados à alteração. Faltam testes específicos da exclusão, comentários, validação em navegador e API real. O backend permite editar comentário pelo autor ou ADMIN e desativar pelo autor do comentário, autor do artigo ou ADMIN, preservando respostas.

Edição inline e desativação de comentários e respostas foram conectadas a `PATCH/DELETE /comments/:id`, com sessão compartilhada, verificação de troca de conta e preservação copiável do texto em resultado incerto. Após 204, a interface mantém as respostas e bloqueia novas respostas à raiz desativada. `npm.cmd run test:public` passou (12 testes, incluindo contratos das novas mutações), `npm.cmd run test:studio` passou (6 testes, incluindo exclusão), e `npm.cmd run build` e lint direcionado passaram. `npm.cmd run test:editorial-e2e` passou com navegador e API simulada, incluindo cancelamento e confirmação da desativação de artigo publicado. Faltam validação em navegador das operações de comentários e integração real com dados sintéticos; a primeira execução de testes públicos paralela ao build falhou por indisponibilidade temporária do servidor de teste e passou sequencialmente.

**Atualização:** `node --test tests/comment-browser.test.mjs` passou em Chromium com API simulada: visitante, READER, edição, desativação, cancelamento e preservação da conversa. Falta validar AUTHOR/ADMIN e API real. As confirmações usam caixa da aplicação com foco e Escape; não há chamadas `alert`, `confirm` ou `prompt` em `src`. O lint geral passou com avisos. A etapa 2 começou com painel reorganizado, configurações e tema em implementação; seu aceite depende de cobertura visual, persistência e testes. O backend de e-mail atualmente envia código, não link: a confirmação deverá aceitar o código na página correspondente e avisar sobre o encerramento das sessões.

**Avanço posterior:** teste de comentários em Chromium com API simulada também cobriu AUTHOR, ADMIN e troca de conta entre abas. A migration de revisão impede desativar artigo PENDING; o Studio agora bloqueia a ação. Conta reorganizada, página de configurações e solicitação/confirmação de troca de e-mail foram implementadas; confirmação aceita código manual e mantém o tipo na URL ao remover token. Tema claro/escuro/sistema foi integrado e estilos adaptados; `test:theme` passou (3 testes), `test:session` passou (19), `test:studio` passou (7), `test:public` passou (12), build e lint passaram com avisos. Smoke em configurações a 360 px verificou tema escuro e ausência de rolagem horizontal. Falta avaliação visual abrangente, compatibilidade de `light-dark()` e integração real com contas sintéticas. A flag editorial permanece desativada; publicação direta e agendamento seguem pendentes.

O editor agora oferece envio à primeira revisão apenas ao AUTHOR titular quando `firstPostApproved` é explicitamente falso; ausência do campo deixa a elegibilidade indisponível. O container existente ainda pode usar versão anterior do backend sem esse campo, portanto exige atualização e prova isolada antes de habilitar o fluxo. `test:account-browser`, `test:comment-browser` e `test:editorial-e2e` passaram com API simulada; repetir o teste editorial após mudanças subsequentes no editor.

**Etapa 3 iniciada sem concluir etapas anteriores:** publicação, retirada do ar, agendamento, remarcação e cancelamento foram preparados no editor sob a flag, somente para titular com aprovação confirmada. Confirmações são próprias da aplicação; alterações não salvas, PENDING, troca de conta e resultado incerto bloqueiam ações. `test:studio` passou (10 testes), incluindo elegibilidade e datas; o fluxo ainda requer provas em navegador e API/agendador reais. Auditoria de contraste em home, artigo e configurações a 360 e 1440 px não encontrou rolagem horizontal; cores de texto identificadas abaixo de 4,5:1 foram ajustadas. Falta revisão de outras telas e imagens.

**API isolada:** serviços sintéticos e cópia temporária do backend iniciados sem usar o banco original. `test/comments.e2e-spec.ts` e `test/post-review.e2e-spec.ts` passaram (2 suítes, 2 testes) com PostgreSQL e Redis isolados. São provas HTTP do backend, ainda não da interface conectada à API real; ambiente preservado para essa validação.

`test:publication-browser` passou em navegador com API simulada para publicação, retirada, agendamento e cancelamento, incluindo confirmação, alterações não salvas e bloqueio PENDING. A prova não valida o agendador ou a persistência real. O teste editorial atualizado também confirma que PENDING não pode ser editado ou desativado.

`BLOG_REAL_E2E=1 node --test tests/comment-real-browser.test.mjs` passou em Chromium com frontend e API Nest reais usando apenas contas e dados sintéticos no volume isolado: visitante, edição e desativação pelo READER, persistência e preservação da resposta. AUTHOR/ADMIN e exclusão de artigo real ainda requerem prova. Desativação da própria conta foi adicionada com confirmação, validação da identidade e invalidação coordenada em sucesso ou resultado incerto; seus 2 testes de contrato passaram, faltando navegador e API real.

A mesma prova real isolada foi ampliada: AUTHOR desativou rascunho e artigo publicado próprios no Studio, com 404 público após a desativação; a API negou visitante, READER e AUTHOR não titular e aceitou ADMIN. Estes dados são sintéticos e permanecem no volume isolado. As permissões de comentários para AUTHOR/ADMIN seguem verificadas no navegador apenas com API simulada.

**Séries em andamento:** criada gestão privada sob a flag editorial com CRUD, seleção paginada e ordenação. A API substitui a lista inteira sem ETag: a pré-checagem e o aviso reduzem, mas não eliminam, sobrescrita concorrente. Falta validar jornada em navegador e API real, além da navegação pública e proteção de alterações não salvas. A desativação da própria conta passou em navegador com API simulada, inclusive troca de conta durante a confirmação.

Verificações recentes: `test:session` passou (21 testes), `test:studio` passou (11 testes), `test:theme` passou (3 testes), lint geral passou com avisos. Os testes em navegador de desativação da conta cobrem cancelamento e troca de conta; ainda falta prova com API real isolada.

A série pública agora aparece no HTML do artigo a partir do endpoint anônimo, com validação de resposta e omissão em indisponibilidade. Teste HTTP com backend simulado verificou HTML, ausência de credenciais e campos privados e continuidade da leitura em erro. `test:series-browser` passou com API simulada para criação, ordenação, confirmação, saída com alterações não salvas e exclusão preservando artigos; falta prova com API real e permanece a limitação de concorrência sem ETag.

**Bloqueio encontrado em teste real de publicação:** PATCH retornou 200 e publicou, mas o editor classificou a resposta como incerta. A divergência está sendo investigada; não habilitar a flag nem declarar publicação validada até corrigir e repetir o fluxo real.

**Correção e prova:** o PATCH real omite `isActive`; o parser de publicação/agendamento agora aceita somente essa ausência e rejeita `false`. `BLOG_REAL_E2E=1 node --test tests/publication-real-browser.test.mjs` passou com API e banco isolados para publicar, retirar, agendar, cancelar e enviar primeiro artigo à revisão com bloqueio PENDING. Salvamento normal e restauração usam o mesmo serviço e estão sendo verificados para a mesma divergência. A flag continua desativada até concluir os demais critérios editoriais e de infraestrutura.

`BLOG_REAL_E2E=1 node --test tests/series-real-browser.test.mjs` passou em navegador com API e banco isolados: série com dois artigos publicados e um rascunho manteve a ordem no gerenciamento privado; endpoint e HTML públicos exibiram somente os publicados. Dados sintéticos permanecem no volume isolado. A limitação de concorrência sem ETag continua.

Salvamento normal do editor também foi corrigido para o PATCH real sem `isActive`; a jornada isolada repetida confirmou persistência da edição, publicação, retirada, agendamento/cancelamento e 409 ao desativar PENDING. Histórico e restauração de revisões foram integrados sob a flag; testes simulados cobrem prévia, confirmação, PENDING e troca de conta, e falta prova real. O Studio identifica artigos agendados na listagem.

**Etapa 4 iniciada:** seguir/deixar de seguir e feed privado paginado foram integrados. `BLOG_REAL_E2E=1 node --test tests/follow-real-browser.test.mjs` passou com API isolada para seguir, visualizar artigo e deixar de seguir; faltam provas reais de múltiplas páginas e concorrência. O backend não oferece listagem de autores seguidos independente do feed. Coleções e notificações estão em implementação.

`BLOG_REAL_E2E=1 node --test tests/revisions-real-browser.test.mjs` passou com API isolada: edição de artigo publicado, prévia e restauração de título/conteúdo preservando publicação; visitante, READER e outro AUTHOR foram negados, e ADMIN pôde listar. Dados sintéticos permanecem no volume isolado.

A central privada de notificações lista e pagina resultados, apresenta a contagem devolvida pela API e marca uma ou todas como lidas. `BLOG_REAL_E2E=1 node --test tests/notifications-real-browser.test.mjs` passou com API isolada para leitura individual e de todas; faltam provas reais de paginação múltipla e concorrência.

Coleções privadas foram implementadas na área de salvos: criação, renomeação, exclusão, adição e remoção de artigos salvos e paginação. Os testes de contratos passaram; a jornada em navegador com API isolada está em andamento. Curtidas de comentários estão sendo integradas.

`BLOG_REAL_E2E=1 node --test tests/account-real-browser.test.mjs` passou com API e Mailpit isolados: solicitação e confirmação de troca de e-mail revogaram a sessão anterior sem afetar outra conta; cancelamento e confirmação de desativação foram verificados com contas sintéticas independentes. `BLOG_REAL_E2E=1 node --test tests/comment-like-real-browser.test.mjs` passou para curtir e remover curtida em comentário e resposta. Faltam provas em navegador de troca de conta e falha de rede para curtidas; a API só fornece contagem autenticada e não oferece consulta em lote.

`BLOG_REAL_E2E=1 node --test tests/collections-real-browser.test.mjs` passou com API isolada para criar, renomear, adicionar/remover artigo, cancelar e excluir coleção, e trocar de conta durante confirmação; o isolamento foi conferido na API. `test:collections-browser` também passou com API simulada.

**Retomada:** etapas 1–4 estão parcialmente implementadas, sem declarar sprints concluídas. Próximas prioridades: validação de erros e acessibilidade nas jornadas novas; terminar filtros, denúncias, newsletter e demais recursos viáveis da missão; depois administração sob BFF autorizado no servidor. Revisar limitações de sessão administrativa, HTTPS e revogação antes de habilitar flags; não expor OWNER inexistente. Tema precisa de revisão visual em todas as telas e compatibilidade de navegadores. Consultar os itens originais das sprints e seus critérios antes de fechar qualquer uma. Serviços isolados `front-blog-sprint0` e API temporária em `localhost:3001` permaneceram ativos; o volume contém somente fixtures sintéticas destes testes. Não apagar volumes nem usar o banco original para testes de escrita.

## Sprint 1 — fundação e autenticação

- [ ] S1.1 Inicializar Next.js App Router, React, TypeScript strict, lint, build, variáveis de exemplo e CI.
- [ ] S1.2 Criar layouts, tokens, componentes acessíveis, cliente HTTP tipado, erros, 204 e paginação; validar contratos.
- [ ] S1.3 Integrar cadastro, confirmação/reenvio de e-mail, login, recuperação e redefinição de senha.
- [ ] S1.4 Integrar access token e cookie HttpOnly, incluindo refresh coordenado entre abas, reload, logout, revogação e troca de conta.
- [ ] S1.5 Proteger rotas privadas e redirecionamentos; distinguir 401/403 e definir obtenção da identidade, pois `/users/me` é proposta.

**Aceite:** cadastro e login reais, sessão após reload, concorrência de abas, logout, revogação e acesso negado verificados; lint, tipos, testes e build passam.

**Andamento:** telas iniciais de cadastro, confirmação, reenvio, recuperação, redefinição, entrada e conta criadas. A sessão mantém access token apenas em memória e exige Web Locks/BroadcastChannel para coordenar abas; operação de resultado incerto exige nova entrada. Há validação inicial de `Origin` para métodos mutáveis em `/api/v1`, mas o backend deve permanecer privado ou ter proteção equivalente em todas as entradas. Provas em navegador, duas abas e integração completa ainda estão em andamento; não considerar a sprint concluída.

**Teste em navegador com API isolada:** cadastro, confirmação, login, recarga simultânea em duas abas, login inválido com sessão mantida, logout propagado e rejeição de formulário de outra origem passaram. Faltam repetir os cenários apropriados com o container existente e concluir os demais critérios; não usar contas ou dados reais como fixtures.

O perfil próprio já é consultado pela API com token em memória. Os testes `test:session` verificam, com respostas simuladas, falhas de login, refresh incerto, logout após expiração e identificação do titular. A cobertura de sessão em navegador após essas alterações ainda precisa ser repetida.

Foram acrescentadas telas iniciais de edição de perfil e revogação de sessões. A edição verifica a identidade sob o mesmo bloqueio da requisição para evitar alteração da conta anterior após uma troca de usuário. Contratos e proteção contra troca de conta foram testados com fixtures; validação real de edição e revogação em navegador continua pendente.

A listagem e a revogação de sessões também verificam o titular sob o bloqueio de sessão, evitando uma confirmação enganosa após troca de conta entre abas. `npm.cmd run test:session` passou com respostas simuladas; a revogação real continua pendente de dados de teste autorizados.

A alteração de senha também foi iniciada, com invalidação local coordenada após sucesso ou resultado incerto e testes de contrato simulados. Validação em navegador e com contas sintéticas segue pendente.

Nova etapa: foto do titular agora possui formulário multipart com limite e formatos do contrato, validação de identidade sob o bloqueio da sessão e tratamento de resultado incerto. Login, refresh e logout receberam timeout para não prender o bloqueio entre abas; testes simulados incluem timeout e impedem o reuso do refresh incerto. A listagem de salvos foi criada com paginação e estados privados. A integração de escrita da foto e de salvos com a API real ainda precisa de conta de teste autorizada.

O teste multipart simulado cobre campo `file`, tamanho, 401, conflito, mudança de conta e falha incerta. Após as alterações, lint, build e as quatro suítes locais passaram; não substituem validação da imagem no backend atual.

Uma verificação parcial e reproduzível de Swagger foi adicionada em [check-backend-openapi.ps1](scripts/check-backend-openapi.ps1): em 04/11/2026, os dois testes do backend passaram sem acessar banco ou serviços externos. A [documentação](docs/verificacao-openapi.md) registra por que essa verificação não exporta o contrato completo e não conclui S0.5.

## Sprint 2 — leitura e descoberta públicas

- [ ] S2.1 Criar home, listagem, busca, paginação, categorias e perfil público; não inferir autoria por nome se faltar filtro por ID.
- [ ] S2.2 Implementar artigo SSR em `/posts/[slug]`, sanitização, autor, capa, relacionados, aliases e canonical.
- [ ] S2.3 Configurar metadados, Open Graph, dados estruturados, sitemap, feeds e robots.
- [ ] S2.4 Validar acessibilidade, imagens, estados, navegação e registro de visualização somente no navegador.
- [ ] S2.5 Testar HTML sem JavaScript, 404 real e remoção de conteúdo despublicado.

**Aceite:** leitura indexável, busca funcional, canonical/sitemap coerentes, 404 real e despublicação respeitada.

**Andamento:** home com busca e paginação, leitura SSR, relacionados, perfil público de autor, categorias, metadados de artigo, `robots.txt`, sitemap, feeds, comentários e carregamento de respostas foram implementados. A visualização é registrada apenas no navegador após visibilidade, interação e espera. Lint e build passaram; `npm.cmd run test:public` valida rotas selecionadas com API simulada. Home e artigo foram consultados também no backend original, sem escrita de dados; a jornada de visualizações e demais critérios precisam de validação integrada. CI local ao repositório foi preparada, mas não foi executada em provedor remoto.

O envio de comentários autenticados foi iniciado antecipadamente, com validação de conta e resultado incerto sem repetição automática. Foi testado com respostas simuladas; falta validação de escrita com dados de teste escolhidos pelo usuário.

A home passou a retornar HTTP 500 em vez de apresentar indisponibilidade da API como página bem-sucedida; a verificação HTTP também cobre parâmetros de busca repetidos. O sitemap real foi consultado com sucesso na origem local configurada.

Também foram preparados controles de curtir e salvar, com consulta autenticada e reconciliação após resultado incerto. A verificação até agora usa mocks; testes de escrita com API real seguem pendentes.

Por solicitação do usuário, a área pública recebeu página “Sobre nós”, busca por assunto e autor com filtros preservados na paginação, destaque para a publicação mais recente e exibição de capas válidas. A navegação exibe progresso de leitura e oferece botão de retorno ao topo. Lint, build e testes públicos passaram; smoke no navegador verificou busca, página “Sobre”, progresso e retorno ao topo no artigo e na home, além de largura móvel de 360 px. O conteúdo institucional é provisório e não afirma dados específicos sobre uma equipe ou organização.

A busca também oferece filtro por categoria, sem impedir listagem se a consulta auxiliar de categorias falhar; a paginação preserva todos os filtros. A lista real de categorias e a presença do filtro no HTML foram verificadas em modo somente leitura no backend existente; teste HTTP simulado cobre encaminhamento, seleção e paginação. O retorno ao topo agora preserva destino de foco em páginas de erro e a barra não intercepta cliques.

Os links repetidos de artigos e categorias receberam nomes acessíveis que identificam seus destinos. Também foi adicionada resposta autenticada a comentários principais ativos, com validação da resposta e preservação do texto em troca de sessão. `npm.cmd run test:public` passou com API simulada; a escrita real permanece pendente.

As páginas de autor, categorias e categoria individual agora têm títulos próprios; a página da categoria informa também o número da página após a primeira. O HTML gerado foi verificado em `npm.cmd run test:public` com API simulada. Build e lint passaram, este último com um aviso preexistente no teste editorial; a sprint continua aberta até cumprir os demais critérios.

Por solicitação do usuário, a página de perfil de autor em `/autores/[id]` agora exibe a aba de artigos publicados com a listagem completa dos artigos do escritor (título, resumo, capa válida, categoria, data de publicação, tempo de leitura e link acessível), além da aba informativa “Sobre o autor”, paginação e estado vazio. O backend recebeu o filtro `authorId` em `FindPostsQueryDto` e `posts.service.ts` com Swagger e testes unitários aprovados, e o frontend prioriza esse filtro com fallback seguro. `npm.cmd run test:public`, `npm.cmd run build` e `npm.cmd run lint` passaram, e a integração com a API real em execução no container confirmou os artigos e a paginação no HTML gerado.

## Sprint 3 — conta, Studio e revisão inicial

- [ ] S3.1 Criar perfil, foto, senha e gestão de sessões segundo os contratos.
- [ ] S3.2 Implementar regras e aceite de autoria.
- [ ] S3.3 Criar Studio com artigos próprios, editor, rascunho, capa e revisão; preservar conteúdo e respeitar PENDING.
- [ ] S3.4 Entregar fila mínima de aprovação/rejeição no espaço administrativo separado e autorizado.
- [ ] S3.5 Testar primeira publicação completa, rejeição, edição e despublicação; resolver exposição de capas de rascunho.

**Aceite:** READER vira AUTHOR e publica o primeiro artigo após revisão real; visitante, READER e AUTHOR não acessam a fila diretamente.

**Andamento:** Studio inicial consulta regras de autoria, registra aceite e lista artigos próprios conforme o papel confirmado pela API. Testes de contrato simulados passam; falta validar essas telas com API real e entregar a edição junto à fila mínima administrativa protegida no servidor. Não usar dados reais como massa de teste.

O aceite das regras e a consulta dos artigos agora ficam vinculados à identidade que abriu o Studio, para impedir ações ou listagem da conta errada após troca entre abas. `npm.cmd run test:session` passou com respostas simuladas; a troca entre abas com backend real ainda precisa ser validada.

Uma primeira versão de editor e fila administrativa está em desenvolvimento, desativada por padrão. O editor exige `EDITORIAL_WORKFLOW_ENABLED=true` e a fila possui proteção e ativação separadas; não ativar antes de validar o ciclo completo, os acessos e a topologia. Capas de rascunhos continuam indisponíveis porque o armazenamento atual é público. Consulte [contratos editoriais](docs/contratos-editoriais.md) e [segurança administrativa](docs/admin-seguranca.md).

O protótipo administrativo requer `ENABLE_ADMIN_BFF=true`, permanece desativado e retornou 404 em acesso direto com a configuração atual. Usa sessão curta somente em memória de um processo Node, sem refresh, com nova autorização no backend para cada leitura e decisão. Backend simulado cobriu papéis, CSRF, sanitização, decisão e logout; faltam ciclo completo com dados sintéticos, HTTPS, acesso direto e revogação em ambiente real. Não é adequado a múltiplas instâncias nem a serverless e não está pronto para produção.

O teste reproduzível `npm.cmd run test:editorial-e2e` passou com API simulada e navegador: autor cria e envia rascunho, edição fica bloqueada em PENDING, visitante é negado e ADMIN aprova. Ele usa um projeto temporário com flags ligadas apenas no processo de teste; não altera o backend existente. A prova não substitui fluxo com Nest e banco reais, HTTPS ou revisão das limitações do BFF, portanto as flags permanecem desligadas.

O editor passou a alertar sobre alterações não salvas em seus links e ao fechar ou recarregar, e editar invalida a confirmação de envio; o teste editorial simulado cobre esses casos. O botão Voltar em navegação interna ainda não está coberto. Artigos agendados agora mostram a data e não oferecem envio para revisão; testes do editor e teste de navegador simulado passaram.

O código local do backend foi alterado para retornar `firstPostApproved` apenas ao titular, com Swagger e testes atualizados (195 testes passaram, 18 pulados, lint passou). O container em execução ainda não recebeu a alteração e o frontend ainda não usa esse campo para oferecer publicação direta. ADMIN não é elegível ao envio de primeira revisão. O fluxo permanece desativado até implementar e validar os contratos e o ciclo completo.

## Sprint 4 — administração e governança

- [ ] S4.1 Integrar fila editorial, categorias, denúncias, usuários ativos e métricas existentes.
- [ ] S4.2 Definir e verificar política de suspensão/restauração e contratos administrativos faltantes.
- [ ] S4.3 Testar autorização no frontend e na API para visitante, READER, AUTHOR e ADMIN, inclusive acesso direto e sessão revogada.
- [ ] S4.4 Planejar e implementar OWNER no backend antes da interface: migration, bootstrap, política por alvo, step-up, auditoria e testes contra escalada.

**Aceite:** operações correspondem aos contratos e o servidor nega acessos indevidos. OWNER é proposta e não deve ser liberado antes das proteções no backend.

## Sprint 5 — qualidade e publicação

- [ ] S5.1 Executar testes de contrato, componentes e E2E com API isolada, PostgreSQL, Redis e SMTP de teste.
- [ ] S5.2 Revisar acessibilidade, dispositivos móveis, desempenho e navegação.
- [ ] S5.3 Validar staging, HTTPS, proxy, cookies, mídia, workers, logs, monitoramento, backups e rollback.
- [ ] S5.4 Registrar smoke de HTML, canonical, sitemap, 404, sessão e acesso administrativo.

**Aceite:** verificações passam, evidências e riscos são documentados, recuperação e rollback exercitados. Publicação externa requer autorização do usuário.

## Sprint 6 — evolução por demanda

- [ ] S6.1 Priorizar comentários, respostas, curtidas, salvos, feed e seguidores.
- [ ] S6.2 Avaliar coleções, notificações e newsletter.
- [ ] S6.3 Avaliar OAuth, TOTP, séries, revisões e agendamento.
- [ ] S6.4 Definir contrato, permissões, estados, acessibilidade e testes para cada jornada escolhida.

**Aceite:** cada jornada escolhida tem critérios próprios e integração validada.

## Dependências de backend

- [ ] B01: validar SMTP/HTTPS e e-mails de teste.
- [ ] B02: avaliar `/users/me`, capacidades editoriais e filtro de posts por `authorId`.
- [ ] B03: projetar OWNER, política por alvo, step-up, auditoria e proteção contra escalada.
- [ ] B04: definir suspensão/restauração e visibilidade de conteúdo.
- [ ] B05: avaliar consultas de suspensos, alvos de denúncia e paginação da fila.

Esses itens são propostas ou verificações, não funcionalidades garantidas. Alterações no backend seguem suas próprias regras.
