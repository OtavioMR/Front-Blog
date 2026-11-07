# Backlog do frontend do blog

**Painel administrativo (07/11/2026, em andamento):** iniciada a comparação com os contratos novos em `README-ADMIN.md` e `README-ENDPOINTS.md` do backend local. A rejeição editorial e a decisão de denúncia agora exigem justificativa; a fila também aceita denúncias de perfil. A imagem da API em execução foi validada com os endpoints administrativos. O painel completo em React SPA agora cobre: visão geral, indicadores, auditoria, newsletter, denúncias (com atribuição e resolução atômica), comentários, artigos (com moderação e revisão editorial), usuários (com suspensão, restauração, revogação de sessões e mudança de papel com TOTP), categorias (com criação, edição e desativação) e tags (com criação, edição, mesclagem e exclusão).

**Central de denúncias, progresso:** filtros de situação e tipo preservam paginação; detalhes consultam contexto e histórico autorizados pelo Nest, sanitizam conteúdo e distinguem 401/403/404. Decisão com eventual ocultação usa operação atômica do contrato local (`POST /reports/:id/resolve`) com justificativa e confirmação vinculada à sessão e aos dados exibidos. Adicionada a rota BFF `/admin/reports/[id]/assign` para atribuição de denúncias a moderadores (`PATCH /reports/:id/assign`), com ação de atribuição integrada no componente de moderação. Build, lint e testes HTTP (simulado e real) passaram.

**Usuários administrativos, progresso:** listagem em `/admin/users` e detalhes migrados para `/admin/users/[id]` no painel React SPA. Apresenta informações, contagens de artigos e comentários, histórico e rota de denúncias relacionadas em `/admin/users/[id]/reports`. Permite suspender e restaurar contas, bem como revogar sessões ativas (`POST /admin/users/:id/sessions/revoke`) com justificativa. A alteração de função exige confirmação, justificativa e TOTP; a opção aparece somente após consultar no Nest o papel atual de SUPER_ADMIN e não é oferecida para a própria conta. Build, lint e testes passaram.

**Categorias e Tags administrativas:** `/admin/categories` e `/admin/tags` adicionadas ao layout React e à navegação do `AdminShell`. Corrigida a validação de `description` em `/admin/categories` para aceitar `undefined` e adicionado `c.description` na consulta de moderação do backend. A listagem de categorias exibe contagem de artigos (`postCount`), permite criar, editar, desativar e reativar (`PATCH /categories/:id` com `{ isActive: true }`, limpando `deletedAt` e registrando `category.reactivated` na auditoria). A listagem de tags exibe contagem de artigos e permite criar, renomear, excluir tags sem artigos e mesclar tags (`POST /admin/tags/:id/merge`). Atualizado `/admin/comments/[id]` para usar link SPA para `/admin/reports/[id]`. Normalizada a execução dos testes reais e BFF para qualquer diretório via `fileURLToPath`. Build, lint e testes HTTP simulados e reais passaram.

As confirmações novas de denúncia e conta são consumidas uma vez por sessão, inclusive quando a resposta da API falha; os testes simulam repetição e perda de resposta. A proteção compartilha a limitação do BFF em memória de um único processo e não resolve sua implantação distribuída.

**Base React administrativa:** `/admin`, `/admin/newsletter`, `/admin/analytics`, `/admin/audit-logs`, `/admin/categories` e `/admin/tags` usam layout separado, tokens de aparência e leituras autorizadas, com navegação Next entre essas páginas. A auditoria inclui filtros por responsável, ação, recurso e período UTC, com paginação. Build, lint direcionado e `test:admin` passaram com API simulada, incluindo flag desligada, perda de papel e revogação. Faltam visualização e acessibilidade em navegador, seleção de período nos indicadores e integração real; a flag segue desabilitada.

**Comentários administrativos:** `/admin/comments` lista e filtra comentários, distingue ocultação administrativa de outras desativações e permite ocultar/restaurar com justificativa e confirmação, sem recarregar a página inteira. Detalhes incluem contexto, denúncias e histórico paginado. A mutação revalida sessão, origem, CSRF e resposta do Nest, e resultado incerto bloqueia repetição até atualizar a página. Build, lint direcionado e teste HTTP simulado passaram; testes em navegador e na API real ainda faltam.

**Artigos administrativos:** `/admin/posts` lista, filtra e apresenta detalhes e histórico, sanitiza o conteúdo e permite ocultar/restaurar conteúdo elegível com justificativa e confirmação. A fila filtrada por `pending` e os detalhes permitem aprovar ou rejeitar com justificativa no painel React. Build, lint direcionado e testes HTTP simulados passaram. `BLOG_ADMIN_REAL=1 node --test tests/admin-api-real.test.mjs` passou para criação/submissão de dois rascunhos sintéticos, rejeição e aprovação via BFF; os artigos foram desativados no encerramento. A publicação foi condicionada a zero assinantes confirmados, e não havia entregas pendentes nem outbox depois da prova. Faltam provas de navegador e concorrência.

**Ambiente real:** o banco já registrava as oito migrations administrativas mais recentes, mas a imagem anterior respondia 404 às rotas novas. Antes de atualizar o serviço, foram verificados zero entregas de newsletter pendentes, zero artigos agendados, outbox vazio e ausência de filas ativas de envio identificadas. A API foi reconstruída e reiniciada sem remover volumes; ficou saudável, e as novas rotas respondem 401 sem autenticação. `BLOG_ADMIN_REAL=1 node --test tests/admin-api-real.test.mjs` passou contra a API e o banco escolhidos: visitante, READER, AUTHOR, ADMIN e SUPER_ADMIN, sessões revogadas e leituras do painel/BFF foram exercitados com contas sintéticas desativadas ao final. O teste também suspendeu e restaurou uma conta sintética via BFF, verificando confirmação de uso único e estado posterior. Não houve envio de e-mail. HTTPS real, demais ações administrativas, concorrência, interface em navegador e outros critérios seguem pendentes.

**Ajuste de navegação:** botão de voltar ao topo compacto, exibido após 800 px e deslocado para não cobrir o rodapé; oculta-se quando não há espaço acima dele. Lint direcionado e build passaram. Validação visual em navegador e dispositivos móveis pendente.

Referência: `C:/Users/otavv/Downloads/Arquitetura_Frontend_Blog.md` e backend local em `C:/Users/otavv/Documents/Backend-Blog`, commit `f89622e`. Confira os contratos novamente ao implementar. Os marcos não têm duração estimada. Marque uma tarefa apenas após sua verificação e registre evidências ou bloqueios.

O blog público, a conta, o Studio e a administração terão experiências separadas. A interface pública não divulga a administração. O backend deve negar acesso direto e chamadas de API para papéis não autorizados; ocultar o endereço não é proteção.

## Quadro atualizado — 05/11/2026

**Entregas implementadas e verificadas parcialmente** (os itens marcados descrevem trabalho realizado, não o aceite integral das sprints):

- [x] Conta: perfil, foto, senha, sessões, troca de e-mail, desativação, configurações e tema; retorno direto à conta nas telas internas e em “Minhas publicações”. Há provas reais isoladas para troca de e-mail e desativação; demais provas de sessão e perfil seguem abaixo.
- [x] Leitura e engajamento: home, busca, categorias, perfis, artigo SSR, SEO inicial, comentários, curtidas, salvos, feed, seguidores, coleções e notificações. Cobertura real isolada é parcial; não equivale ao aceite da Sprint 2 ou 6.
- [x] Studio sob flag: edição, revisão inicial, publicação, agendamento, revisões e séries; exclusão do titular disponível no Studio. Existem provas reais isoladas parciais, com lacunas de navegação, concorrência e segurança de mídia.
- [x] Administração sob flag: fila editorial, denúncias, categorias, usuários ativos e indicadores com BFF e validação de permissões; verificações existentes são principalmente simuladas e o BFF não está pronto para produção.
- [x] Newsletter e denúncias: formulários integrados e estados de falha tratados; provas de ponta a ponta reais permanecem pendentes.
- [x] Inventário por método e rota: [104 operações do backend, 89 com uso no código do frontend e 15 sem chamada explícita](docs/inventario-endpoints.md). Dessas 89, 22 dependem de flags desligadas; presença não significa jornada completa nem validada.
- [x] Categorias administrativas: criar e editar confirmam status e resposta esperados; retorno incoerente é tratado como resultado incerto. Build, lint direcionado, `test:admin` e `test:editorial-e2e` passaram com API simulada.

**Próximas tarefas, em ordem sugerida:**

**Prioridade atual:** por orientação do usuário, deixar testes e configuração de e-mail para depois e avançar nas demais etapas. Os critérios de e-mail permanecem pendentes e não devem ser considerados concluídos.

**Estado consolidado para a próxima tarefa:** implementados parcialmente e ainda não encerrados: avatar global com fallback para ausência, URL inválida, falha após hidratação e iniciais/ícone; upload usa o caminho confirmado pela API; configurações públicas em `/configuracoes` e navbar reorganizada; botão Voltar destacado e suave; cards públicos com área de clique expandida; tags públicas; menu de comentários, autorização, diálogo de denúncia e toast global. Build, testes públicos, tema e testes focados de avatar/upload passaram em verificações anteriores. Pendências prioritárias: o banco/backend ainda contém fotos cadastradas que retornam 404 e precisam ser recuperadas ou substituídas; validar upload/avatar real e temas em navegador; adaptar/rodar a suíte de navegador de comentários e denúncia; validar login/logout e rolagem da navbar; revisar teclado/mobile das listagens. Não abrir novas frentes antes de resolver essas pendências da tarefa atual.

**Avatares:** o componente compartilhado passou a atender também perfis públicos, comentários e respostas, com iniciais ou ícone quando não há imagem e fallback após falha de carregamento. O upload usa imediatamente o caminho confirmado pela API e notifica os componentes da sessão; o backend gera um nome novo por upload. Build e quatro testes focados passaram; lint direcionado passou com aviso existente sobre `<img>`. Ainda falta provar o upload e a renderização nos diferentes temas e tamanhos em navegador com API real.

**Correção adicional de avatar:** uma imagem podia retornar 404 antes da hidratação e perder o evento `onError`. O componente agora também verifica a imagem já concluída após hidratar; três testes focados e build passaram. No navegador, a página reproduzida deixou de manter imagens de perfil quebradas. Uma foto cadastrada retornou 404 tanto diretamente no backend quanto pelo frontend: o arquivo ausente ainda precisa ser recuperado ou substituído pelo titular; o erro de rede não foi ocultado. Upload real e revisão visual nos temas continuam pendentes.

**Configurações públicas:** aparência foi movida para `/configuracoes`, acessível a visitantes e ligada na navbar antes de entrar/conta; a área privada mantém um atalho. Build, lint direcionado e `test:theme` passaram. Em navegador a 360 px, visitante acessou a página, a ordem terminou em Configurações/Entrar e o tema escuro persistiu após recarga sem rolagem horizontal. Ainda falta validar login/logout, usuário autenticado e rolagem da navbar nessa configuração.

**Navegação e cards:** botões de retorno receberam contraste e área de toque maiores; cards de artigos usam link expandido, mantendo links de autor independentes. Build, lint direcionado (um aviso existente no editor) e `test:public` passaram. Em navegador, clique no resumo abriu o artigo e Voltar retornou à home; acesso direto a categoria em 360 px usou o destino alternativo sem rolagem horizontal. Revisão abrangente de teclado, temas e demais listagens segue pendente.

**Comentários em andamento:** ações secundárias foram reunidas em menu por comentário, com comparação do titular e checagem de permissão também na mutação. O backend local já restringe edição ao autor do comentário ou ADMIN, e permite ao autor do artigo desativar comentários. Passaram build, lint direcionado, `test:public` (15 testes) e testes de serviço do backend (7 testes). A suíte de navegador existente expirou antes dos cenários de comentários, no envio sem JavaScript; seus seletores de ações também precisam ser atualizados para o menu. Faltam prova do menu em navegador e testes HTTP reais da matriz completa; não considerar a tarefa aceita.

**Denúncia de comentário:** confirmação válida agora fecha o diálogo e apresenta feedback no comentário; cancelamento descarta o formulário e falhas preservam o motivo. Build, lint direcionado e `test:public` passaram, mas esses testes não exercitam o novo diálogo. Ainda é necessário validar sucesso, falhas, duplicidade, foco e respostas aninhadas em navegador; a suíte anterior precisa de adaptação ao menu.

**Toast:** a confirmação de denúncia de comentário usa um componente global novo, com fechamento manual e automático e suporte a quatro tipos. Antes havia mensagem fixa, não um sistema de toast; mensagens inline de formulários continuam com seus próprios estados. Build e lint direcionado passaram; falta validação interativa de empilhamento e tempos no navegador.

**Descoberta por tags implementada:** listagem paginada, detalhe público e artigos filtrados por `tagSlug`, com link a partir das categorias, estados de vazio/erro e 404 para tag ausente. `npm.cmd run build`, `npm.cmd run test:public` (15 testes, API simulada) e lint direcionado passaram. A listagem da API real respondeu 200 com formato paginado; falta validar a jornada completa em navegador com dados de teste. As demais integrações ausentes continuam pendentes.

1. [ ] **Ambiente e Sprint 0:** usar a API e o banco existentes do projeto `backend-blog`, definidos pelo usuário como ambiente de testes, com dados sintéticos identificáveis; executar as integrações viáveis e verificar HTTPS, proxy, IP, cookie e upload. A API usa SMTP externo: controlar o envio antes de testar fluxos de e-mail ou publicação que dispare entregas.
2. [ ] **Sprint 1 e conta:** completar integração real de sessões, revogação, troca de conta, perfil, foto e senha; repetir cenários multiaba e acessibilidade. Confirmar os critérios completos antes de fechar a sprint.
3. [ ] **Sprint 2 e 6:** validar SEO, despublicação, visualizações, responsividade, contraste e navegação; testar paginação e concorrência de feed/notificações e falhas das interações. Avaliar, sem assumir necessidade de implementar todas, descoberta por tags, artigos em alta, página pública de série e remoção de capa.
4. [ ] **Sprint 3:** concluir primeiro ciclo editorial com aprovação e rejeição reais, acesso direto por papel, preservação do conteúdo e botão Voltar do navegador com alterações não salvas. Definir proteção de capas de rascunho e concorrência de séries. Manter flag desligada até o aceite.
5. [ ] **Sprint 4:** testar BFF contra Nest real para visitante, READER, AUTHOR e ADMIN, revogação, CSRF, concorrência e rede; resolver infraestrutura de sessão e HTTPS antes de habilitar. Projetar política de suspensão/restauração e consulta de suspensos; avaliar trilha de auditoria. OWNER depende de backend e testes próprios.
6. [ ] **Sprint 5:** executar suíte de integração e E2E completa, revisão de acessibilidade e dispositivos, staging, monitoramento, backups, rollback e smoke de publicação. Não declarar publicação pronta sem os critérios.
7. [ ] **Evoluções por demanda:** avaliar OAuth, health operacional, endpoints alternativos JSON da newsletter e páginas de descoberta; os GETs de confirmação e cancelamento da newsletter já são atendidos diretamente pelo backend, mas precisam de prova na topologia final. Ver lista completa e classificações em [inventário](docs/inventario-endpoints.md).


**Descoberta e categorias (06/11/2026):** busca movida para abaixo da hero; Home limitada a seis categorias em ordem da API, com diretório pesquisável e paginado e preservação dos filtros de artigo. `npm.cmd run build`, `npm.cmd run lint` (17 avisos preexistentes), `npm.cmd run test:public` (17 testes) e `npm.cmd run test:studio` (13 testes) passaram. O teste HTTP simula 0, 5, 20, 60 e 105 categorias, busca e contexto dos filtros; navegador com API real confirmou busca no diretório e ausência de overflow a 360, 768 e 1280 px. Pendentes: revisão visual e de teclado em todos os temas e jornadas, e seleção no Studio acima de 100 categorias. O backend reserva criação a ADMIN; seu controle de nomes não garante normalização em todos os casos com slug personalizado nem atomicidade do conflito. Antes de criar categorias no editor, definir permissão e garantir unicidade normalizada e tratamento de concorrência no backend. Documento de arquitetura indicado indisponível no caminho informado. Nenhuma sprint foi encerrada.

**Tipografia Grifório (07/11/2026):** Fraunces para marca e títulos, Lora para leitura e Inter para interface, com WOFF2 locais e display swap. O símbolo foi preservado a partir do SVG existente. Build, lint (17 avisos anteriores), test:theme e test:public passaram; navegador a 360 px verificou home, configurações e artigo sem overflow, fontes carregadas e cor da marca no escuro. Revisão visual abrangente, teclado e demais tamanhos continuam pendentes; nenhuma sprint foi encerrada.

## Sprint 0 — decisões e provas técnicas

**Diretriz atual do usuário:** o banco principal do projeto Docker `backend-blog` é o banco de testes. A API e o banco existentes devem ser usados nas integrações; não é necessário iniciar uma cópia isolada. Registros anteriores sobre não escrever no banco original ou exigir ambiente isolado são históricos e foram substituídos por esta diretriz. Usar dados sintéticos identificáveis, preservar dados e volumes existentes e controlar efeitos externos de SMTP.

**Primeira prova no ambiente escolhido:** em 05/11/2026, API, PostgreSQL e Redis do `backend-blog` estavam saudáveis. `BLOG_DEV_SESSION_E2E=1 node --test tests/development-session-real.test.mjs` passou: uma conta sintética foi criada no banco de testes, autenticada e desativada; leitura do próprio perfil, negação de acesso a denúncias, criação/edição/exclusão de coleção, logout e revogação foram verificados contra a API real. A coleção foi excluída e a conta sintética desativada; não houve cadastro por e-mail nem publicação. Faltam as demais provas e a definição do envio de e-mail de teste, HTTPS e proxy final.

**Verificação em 05/11/2026:** o Compose isolado validou a configuração e PostgreSQL, Redis e Mailpit estavam saudáveis; a porta 3001 estava livre. `npm.cmd run test:session` passou (26 testes) e `npm.cmd run lint` passou com 17 avisos. A revisão automática bloqueou a tentativa de iniciar a cópia temporária da API isolada; portanto, não foram executadas novas provas com a API real. Retomar com a API isolada disponível e verificar HTTPS, IP, cookie, upload e demais critérios na topologia escolhida. As evidências anteriores permanecem parciais e a sprint continua aberta.

**Contratos locais:** comparadas as alterações não commitadas do backend ao commit `f89622e`; o filtro `authorId` e o campo `firstPostApproved` foram registrados em [infraestrutura](docs/sprint-0-infra.md). Passaram 35 testes dos DTOs e serviços envolvidos e 2 testes parciais do Swagger. A imagem em execução e a auditoria completa de contratos ainda não foram verificadas; S0.1 e S0.5 continuam abertas.

**Leitura pública atual:** `npm.cmd run build` passou, incluindo TypeScript, e `npm.cmd run test:public` passou (15 testes). Com API simulada e servidor Next de produção, o teste verificou conteúdo no HTML, artigo ausente com HTTP 404, falha upstream com HTTP 500 e ausência do conteúdo de um rascunho retornado indevidamente. Isso atualiza a evidência de S0.3, mas não substitui a prova completa na topologia final com API real.

**Proxy e IP:** a análise da configuração atual e o teste isolado de segurança HTTP do Nest (4 testes aprovados) foram registrados em [infraestrutura](docs/sprint-0-infra.md). O teste não comprova confiança dos cabeçalhos na infraestrutura final; acesso direto à API, sanitização de encaminhamento, múltiplos proxies e limites de corpo seguem pendentes em S0.2.

**Build e rewrites:** o manifesto do build local fixou a origem upstream no momento da compilação. Uma tentativa de teste com origem sintética definida apenas no `next start` atingiu a API configurada no build (login vazio, HTTP 400); não gerou dados nem mensagens. Preparar build isolado com upstream sintético na compilação para novas provas de proxy. Detalhes em [infraestrutura](docs/sprint-0-infra.md).

**Objetivo:** confirmar contratos e integração antes dos fluxos.

- [ ] S0.1 Conferir controllers, DTOs, guards e testes; registrar contratos, diferenças de Swagger e mudanças desde a revisão.
- [ ] S0.2 Definir e validar topologia, mesma origem pública para Next e `/api/v1`, proxy, `/uploads`, HTTPS, upload, IP e CORS.
- [ ] S0.3 Provar SSR de artigo e 404 real antes do streaming; distinguir indisponibilidade da API.
- [ ] S0.4 Provar cookie HttpOnly real, login, refresh rotativo, reload e duas abas; verificar `Set-Cookie` e upload de até 5 MiB no proxy.
- [ ] S0.5 Usar PostgreSQL, Redis e API existentes e preparar contas sintéticas e SMTP adequado para os testes; definir geração/checagem OpenAPI e registrar riscos.

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

**Newsletter em andamento:** formulário público de solicitação integrado ao contrato `POST /newsletter/subscribe`, com resposta neutra, limite de tentativas e tratamento de resultado incerto. Build e lint passaram (17 avisos existentes); `test:public` passou (15 testes). Falta validar o formulário em navegador e a confirmação por e-mail com API e SMTP isolados, incluindo comportamento sem JavaScript; não considerar a jornada concluída.

**Denúncias em andamento:** formulário para artigo e comentário usa `POST /reports`, com identidade vinculada à sessão, limite de motivo, tratamento de 401/403/404/409/429 e bloqueio em resultado incerto. `test:comment-browser` passou com API simulada para envio de artigo e comentário, conflito e preservação do motivo; também cobriu solicitação da newsletter e 429. Build e lint direcionado passaram. Faltam falha de rede, troca de conta e provas com API real. Serviços isolados PostgreSQL, Redis e Mailpit foram iniciados sem apagar volumes; a execução da cópia da API foi rejeitada pela política automática, sem motivo mais detalhado. A confirmação da newsletter e as denúncias reais continuam pendentes; não usar o banco original para escrita.

**Fila administrativa de denúncias iniciada:** sob `ENABLE_ADMIN_BFF`, a fila consulta denúncias pendentes paginadas e registra decisão no Nest com validação de sessão, Origin e CSRF. A resposta informa que a decisão não altera o conteúdo e que o contrato de listagem oferece apenas o identificador do alvo. `test:admin` passou com backend simulado para visitante, ADMIN, mudança de papel, revogação, CSRF, escape de conteúdo e decisão; build e lint direcionado passaram. `test:comment-browser` também passou para falha de rede e troca de conta na denúncia. Faltam provas com backend real, paginação, concorrência e HTTPS; a flag permanece desligada e a limitação do BFF em memória continua vigente.

**Indicadores administrativos iniciados:** a rota protegida consulta `/admin/analytics/overview` e valida contagens e data antes de exibir os agregados. `test:admin` passou com API simulada para visitante, ADMIN, papel alterado, revogação e resposta inválida; o mesmo teste cobriu paginação simulada e conflito da fila de denúncias. `test:public` (15 testes), `test:comment-browser`, build e lint direcionado passaram. Falta validação real e permanecem as restrições da sessão administrativa e HTTPS. A newsletter recebeu proteção contra envio simultâneo e mensagem de resultado incerto para erro de servidor; falta prova com SMTP isolado e sem JavaScript.

**Categorias administrativas iniciadas:** listagem de categorias ativas, criação, edição e desativação com confirmação usam a sessão BFF e os contratos do Nest; a tela informa a possível reativação automática de categoria desativada. A listagem pública é precedida por consulta protegida para validar ADMIN e as mutações são autorizadas pelo próprio Nest. `test:admin` passou (4 testes) com backend simulado, incluindo criação, edição, confirmação, desativação, CSRF, troca de papel, revogação e 404 das rotas com flag desligada; build e lint direcionado passaram. A API não fornece versão/ETag para evitar sobrescrita concorrente, nem listagem de categorias inativas; faltam provas com API real, paginação, resultado incerto e acessibilidade em navegador. Não habilitar a flag antes dos critérios administrativos e de infraestrutura.

**Usuários ativos:** consulta administrativa paginada em modo de leitura integrada a `GET /users`; cada acesso revalida a sessão e o papel no Nest. `test:admin` passou com API simulada para acesso autorizado, visitante, papel alterado, revogação e flag desligada. O teste também confirmou tratamento de conflito e resposta perdida na gestão de categorias, sem repetição automática. Build e lint direcionado passaram. A API lista apenas ativos; não há consulta de suspensos. Ações de suspensão/restauração permanecem pendentes da política por alvo, localização de suspensos e provas reais. Nenhuma flag foi habilitada.

**Usabilidade:** a confirmação de desativação consulta e apresenta o nome atual da categoria, após revalidar ADMIN; `test:admin` passou com API simulada. `test:comment-browser` passou em Chromium para a home a 360 px sem rolagem horizontal e para a passagem de foco por Tab entre campo e botão da newsletter, além dos estados 429, 500 e sucesso. Build passou; lint direcionado passou com dois avisos preexistentes no teste de navegador. Isso não substitui revisão abrangente de contraste, navegação administrativa ou prova real de e-mail.

**Correção de formulários administrativos:** em Chromium, `Referrer-Policy: no-referrer` causava `Origin: null` no envio de formulários e bloqueava a entrada e as ações pela validação CSRF. A política foi alterada para `same-origin`, sem envio de referenciador a outras origens; Origin exata e CSRF continuam obrigatórios. `test:editorial-e2e` passou com API simulada para login administrativo no navegador, abertura e cancelamento da confirmação de categoria, foco por Tab e ausência de rolagem horizontal a 360 px. `test:admin` passou (4 testes), incluindo rejeição de origens externas; build e lint direcionado passaram, com um aviso preexistente no teste. HTTPS e backend reais continuam pendentes.

O mesmo teste editorial em Chromium passou também para criação, edição e desativação confirmada de categoria e para decisão de denúncia com nota, usando API simulada e largura de 360 px. Faltam provas contra a API isolada e revisão visual/acessível completa; a flag administrativa permanece desativada.

**Reverificação:** `test:session` (25 testes), `test:studio` (13), `test:theme` (3), `test:admin` (4) e `test:comment-browser` passaram novamente. As suítes de navegador e administração usam API simulada; a execução isolada real permanece bloqueada pela rejeição automática já registrada, e nenhuma sprint atende ainda a todos os critérios de aceite.

**Navbar e ambiente:** o seletor de tema foi removido da navegação principal e permanece em Configurações da conta. Build, lint direcionado e `test:theme` (3 testes) passaram. Os serviços isolados PostgreSQL, Redis e Mailpit estão saudáveis e o banco de teste registra 43 migrations; a porta da API de teste estava livre. Mesmo após autorização do usuário, a política automática rejeitou antes da execução o comando para iniciar a cópia isolada da API, informando apenas `blocked by policy`. As provas reais de newsletter, denúncias e administração continuam pendentes; nenhum dado do banco original foi usado para escrita.

**Autorização atualizada:** o usuário autorizou testes na API e no banco de desenvolvimento existentes. Em verificação sem dados pessoais ou escrita, a API em `localhost:3000` respondeu 200 no health; denúncias, notificações, coleções, revisão editorial e indicadores negaram visitante com 401; inscrição de newsletter sem dados recebeu 400. A instância usa SMTP externo e está em modo de produção; publicação e fluxos de e-mail podem produzir efeitos fora do teste. Não foram criadas contas, inscrições ou artigos nessa instância. As provas autenticadas e de envio continuam pendentes de ambiente que não envie mensagens externas, e o bloqueio automático da cópia isolada permanece.

**Navegação da conta:** as nove telas de conta agora oferecem retorno direto à página da conta, sem depender do histórico. `test:account-browser` passou com API simulada, incluindo entrada pelas configurações e retorno de cada tela; build e lint direcionado passaram.

O perfil público acessado por “Minhas publicações” também oferece retorno direto à conta, preservado ao trocar de aba ou página. Em acesso público comum, o retorno leva ao início. Build, lint direcionado e `test:public` (15 testes com API simulada) passaram; o teste HTTP confirmou os destinos e a preservação da origem na troca de aba.

**Acessibilidade e texto:** as seções do perfil público são links de navegação com `aria-current`, sem anunciar o padrão de abas que exigiria controles de teclado próprios. O texto do link “Minhas séries” no Studio foi corrigido. Build, lint direcionado e `test:public` (15 testes com API simulada) passaram; a revisão de acessibilidade abrangente segue pendente.

**Falhas em categorias administrativas:** os dados enviados em criação e edição permanecem disponíveis para consulta e cópia em erros de validação, conflito, limite de tentativas e resultado incerto; o conteúdo é escapado e nenhuma escrita é repetida automaticamente. `test:admin` passou com backend simulado para conflito, HTML potencialmente perigoso, 429 e resposta perdida; build e lint direcionado passaram. A flag continua desligada e a integração real segue pendente.

**Falhas na análise de denúncias:** notas enviadas ficam disponíveis para cópia em validação, conflito, limite de tentativas e resultado incerto, com escape de HTML e sem reenvio automático. `test:admin` passou com API simulada para conflito, resposta divergente, escape e ausência de cache; build e lint direcionado passaram. A validação real e os critérios de segurança administrativa continuam pendentes.

**Identidade em salvos e coleções:** a leitura de salvos agora usa o titular verificado sob o bloqueio de sessão; coleções só carregam para o mesmo titular da lista. `test:session` passou (26 testes, incluindo sujeito e 409 simulados), `test:collections-browser` passou com API simulada, assim como build e lint direcionado. O novo teste não reproduz a janela de troca entre abas em navegador com API real, que permanece pendente.

O teste `test:collections-browser` foi ampliado com duas contas sintéticas em abas diferentes: após trocar de conta, a primeira aba exibiu a lista e as coleções vazias da segunda, sem mostrar o artigo e a coleção da primeira. O teste passou com API simulada; não controla a troca no instante exato entre as duas consultas nem substitui a prova com API real.

**Resposta de coleções:** criação e renomeação agora exigem que o nome retornado corresponda ao solicitado, além da validação existente de identificador. Em divergência, o nome digitado é preservado e novas ações ficam bloqueadas até recarregar. `test:collections-browser` passou com resposta divergente simulada e confirmou uma única tentativa; build e lint direcionado passaram. Integração real após essa alteração segue pendente.

**Concorrência em coleções:** uma trava síncrona impede que duas ações sejam iniciadas antes da atualização visual do estado ocupado. `test:collections-browser` passou ao disparar dois envios consecutivos com resposta simulada atrasada e confirmou uma única escrita, além dos fluxos existentes; build e lint direcionado passaram. A prova real após essa alteração segue pendente.

**Curtidas de comentários:** `npm.cmd run test:comment-browser` passou com API simulada para resposta perdida após a gravação: a interface sinalizou resultado incerto e a atualização consultou o estado sem repetir a escrita. O teste também cobriu troca de conta em outra aba enquanto a remoção da curtida estava em andamento: a conta seguinte recebeu seu próprio estado e a mutação não foi repetida. A verificação correspondente contra API real continua pendente.

**Paginação administrativa:** `npm.cmd run test:admin` passou com API simulada para duas páginas de categorias e usuários ativos, links de ida e volta e rejeição de parâmetros de página duplicados. A paginação real e as demais verificações de autorização e infraestrutura continuam pendentes; a flag permanece desativada.

**Confirmação de revisão:** a decisão editorial agora exige HTTP 201 e status retornado igual à decisão solicitada; resposta divergente ou inválida é tratada como resultado incerto, sem repetir. A rota também distingue 400, 404 e 429 e rejeita campos duplicados. Build, lint direcionado, `test:admin` e `test:editorial-e2e` passaram com API simulada; a prova real da fila continua pendente.

**Confirmação de denúncia:** a decisão administrativa exige HTTP 200 e resposta com o identificador e o status esperados; resposta divergente é tratada como resultado incerto, sem repetição automática. Build, lint direcionado, `test:admin` e `test:editorial-e2e` passaram com API simulada; a prova real permanece pendente e a flag continua desativada.

O envio de denúncia pelo leitor também valida o identificador e o status `PENDING` retornados na criação. Respostas divergentes preservam o texto e bloqueiam novo envio como resultado incerto. `test:comment-browser` passou com API simulada para esse caso; build e lint direcionado passaram, com dois avisos preexistentes no teste. A integração autenticada real continua pendente.

## Sprint 1 — fundação e autenticação

**Progresso com a API de teste existente:** `BLOG_DEV_SESSION_E2E=1 node --test tests/development-session-real.test.mjs` passou com conta sintética: alteração e leitura persistida de nome e biografia, duas sessões simultâneas, revogação da outra sessão com 401 para seu token e manutenção da sessão atual, além dos cenários de coleção e logout já registrados. A conta foi desativada ao final. A prova é HTTP direto à API, não teste da interface ou concorrência entre abas; a Sprint 1 continua aberta e os fluxos de e-mail foram adiados pelo usuário.

A mesma prova foi ampliada e passou para alteração de senha: o token anterior deixou de funcionar, a senha antiga foi rejeitada e a nova permitiu entrar, encerrar a sessão e entrar novamente. A conta sintética foi desativada ao final; a jornada em navegador ainda precisa ser verificada.

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

A identidade Grifório foi aplicada ao cabeçalho, aos ícones, rodapés, textos e metadados públicos, preservando as cores e as preferências existentes. Build e 17 testes públicos passaram; lint passou com 17 avisos preexistentes.

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
