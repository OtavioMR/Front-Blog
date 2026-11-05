# Invent?rio de integra??o HTTP

Refer?ncia: controllers atuais e tabela de 104 opera??es do README do backend local, conferida em 05/11/2026. M?todo e rota contam separadamente; par?metros e variantes de payload n?o s?o opera??es adicionais. O backend em execu??o pode estar em outra vers?o.

**89 de 104 operações têm ao menos um uso no frontend; 15 não têm chamada explícita no frontend.** Presença em código não comprova funcionalidade completa, disponibilidade em produção, cobertura de todos os parâmetros ou integração real. As 22 marcadas com flag dependem da configuração editorial ou administrativa; as flags permanecem desligadas. Há provas reais parciais descritas no backlog, e muitas jornadas ainda usam somente simulação.

Os dois GETs de newsletter s?o gerados e atendidos pelo backend diretamente nos links de e-mail; contabiliz?-los como ausentes no frontend n?o significa que inexistam no backend. Os POSTs de confirma??o e cancelamento s?o alternativas JSON, n?o necessariamente tarefas obrigat?rias. Health tamb?m ? operacional, n?o necessariamente interface de usu?rio.

| # | M?todo | Rota | Estado no frontend |
|---:|---|---|---|
| 1 | `GET` | `/api/v1/health` | Sem chamada ? Health operacional; decidir monitoramento. |
| 2 | `POST` | `/api/v1/auth/login` | Em c?digo; escopo e testes variam |
| 3 | `POST` | `/api/v1/auth/refresh` | Em c?digo; escopo e testes variam |
| 4 | `POST` | `/api/v1/auth/logout` | Em c?digo; escopo e testes variam |
| 5 | `GET` | `/api/v1/auth/sessions` | Em c?digo; escopo e testes variam |
| 6 | `DELETE` | `/api/v1/auth/sessions/:id` | Em c?digo; escopo e testes variam |
| 7 | `POST` | `/api/v1/auth/forgot-password` | Em c?digo; escopo e testes variam |
| 8 | `POST` | `/api/v1/auth/reset-password` | Em c?digo; escopo e testes variam |
| 9 | `GET` | `/api/v1/auth/social/:provider/start` | Sem chamada ? OAuth: in?cio de login. |
| 10 | `POST` | `/api/v1/auth/social/:provider/link` | Sem chamada ? OAuth: vincula??o. |
| 11 | `GET` | `/api/v1/auth/social/:provider/callback` | Sem chamada ? OAuth: callback. |
| 12 | `POST` | `/api/v1/auth/social/challenge` | Sem chamada ? OAuth: desafio TOTP. |
| 13 | `POST` | `/api/v1/auth/totp/setup` | Em c?digo; escopo e testes variam |
| 14 | `POST` | `/api/v1/auth/totp/enable` | Em c?digo; escopo e testes variam |
| 15 | `POST` | `/api/v1/auth/totp/disable` | Em c?digo; escopo e testes variam |
| 16 | `GET` | `/api/v1/users/author-rules` | Em c?digo; escopo e testes variam |
| 17 | `POST` | `/api/v1/users/me/author` | Em c?digo; escopo e testes variam |
| 18 | `POST` | `/api/v1/users/confirm-email` | Em c?digo; escopo e testes variam |
| 19 | `POST` | `/api/v1/users/resend-verification` | Em c?digo; escopo e testes variam |
| 20 | `POST` | `/api/v1/users/confirm-email-change` | Em c?digo; escopo e testes variam |
| 21 | `POST` | `/api/v1/users/:id/profile-photo` | Em c?digo; escopo e testes variam |
| 22 | `POST` | `/api/v1/users` | Em c?digo; escopo e testes variam |
| 23 | `GET` | `/api/v1/users` | Em c?digo, sob flag; valida??o pendente |
| 24 | `GET` | `/api/v1/users/:id` | Em c?digo; escopo e testes variam |
| 25 | `PATCH` | `/api/v1/users/:id` | Em c?digo; escopo e testes variam |
| 26 | `DELETE` | `/api/v1/users/:id` | Em c?digo; escopo e testes variam |
| 27 | `GET` | `/api/v1/posts` | Em c?digo; escopo e testes variam |
| 28 | `GET` | `/api/v1/posts/me` | Em c?digo; escopo e testes variam |
| 29 | `GET` | `/api/v1/posts/:id/related` | Em c?digo; escopo e testes variam |
| 30 | `GET` | `/api/v1/posts/:id` | Em c?digo; escopo e testes variam |
| 31 | `POST` | `/api/v1/posts` | Em c?digo, sob flag; valida??o pendente |
| 32 | `PATCH` | `/api/v1/posts/:id` | Em c?digo, sob flag; valida??o pendente |
| 33 | `POST` | `/api/v1/posts/:id/cover-image` | Em c?digo, sob flag; valida??o pendente |
| 34 | `DELETE` | `/api/v1/posts/:id/cover-image` | Sem chamada ? Remo??o de capa; depende de pol?tica de m?dia. |
| 35 | `DELETE` | `/api/v1/posts/:id` | Em c?digo; escopo e testes variam |
| 36 | `GET` | `/api/v1/posts/saved` | Em c?digo; escopo e testes variam |
| 37 | `GET` | `/api/v1/posts/:id/interaction` | Em c?digo; escopo e testes variam |
| 38 | `PUT` | `/api/v1/posts/:id/like` | Em c?digo; escopo e testes variam |
| 39 | `DELETE` | `/api/v1/posts/:id/like` | Em c?digo; escopo e testes variam |
| 40 | `PUT` | `/api/v1/posts/:id/save` | Em c?digo; escopo e testes variam |
| 41 | `DELETE` | `/api/v1/posts/:id/save` | Em c?digo; escopo e testes variam |
| 42 | `GET` | `/api/v1/posts/trending` | Sem chamada ? Artigos em alta; avaliar jornada. |
| 43 | `POST` | `/api/v1/posts/:id/views` | Em c?digo; escopo e testes variam |
| 44 | `POST` | `/api/v1/post-reviews/:id/submit` | Em c?digo, sob flag; valida??o pendente |
| 45 | `GET` | `/api/v1/post-reviews` | Em c?digo, sob flag; valida??o pendente |
| 46 | `POST` | `/api/v1/post-reviews/:id/decision` | Em c?digo, sob flag; valida??o pendente |
| 47 | `GET` | `/api/v1/posts/:postId/revisions` | Em c?digo, sob flag; valida??o pendente |
| 48 | `GET` | `/api/v1/posts/:postId/revisions/:revisionId` | Em c?digo, sob flag; valida??o pendente |
| 49 | `POST` | `/api/v1/posts/:postId/revisions/:revisionId/restore` | Em c?digo, sob flag; valida??o pendente |
| 50 | `GET` | `/api/v1/series/me` | Em c?digo, sob flag; valida??o pendente |
| 51 | `GET` | `/api/v1/series/:id/manage` | Em c?digo, sob flag; valida??o pendente |
| 52 | `GET` | `/api/v1/series/:id` | Sem chamada ? Detalhe p?blico de s?rie; avaliar p?gina pr?pria. |
| 53 | `POST` | `/api/v1/series` | Em c?digo, sob flag; valida??o pendente |
| 54 | `PATCH` | `/api/v1/series/:id` | Em c?digo, sob flag; valida??o pendente |
| 55 | `PUT` | `/api/v1/series/:id/items` | Em c?digo, sob flag; valida??o pendente |
| 56 | `DELETE` | `/api/v1/series/:id` | Em c?digo, sob flag; valida??o pendente |
| 57 | `GET` | `/api/v1/posts/:postId/series` | Em c?digo; escopo e testes variam |
| 58 | `GET` | `/api/v1/authors/:id` | Em c?digo; escopo e testes variam |
| 59 | `GET` | `/api/v1/feed` | Em c?digo; escopo e testes variam |
| 60 | `GET` | `/api/v1/authors/:id/follow` | Em c?digo; escopo e testes variam |
| 61 | `PUT` | `/api/v1/authors/:id/follow` | Em c?digo; escopo e testes variam |
| 62 | `DELETE` | `/api/v1/authors/:id/follow` | Em c?digo; escopo e testes variam |
| 63 | `GET` | `/api/v1/feed/rss` | Em c?digo; escopo e testes variam |
| 64 | `GET` | `/api/v1/feed.xml` | Em c?digo; escopo e testes variam |
| 65 | `GET` | `/api/v1/feed/atom` | Em c?digo; escopo e testes variam |
| 66 | `GET` | `/api/v1/sitemap.xml` | Em c?digo; escopo e testes variam |
| 67 | `POST` | `/api/v1/collections` | Em c?digo; escopo e testes variam |
| 68 | `GET` | `/api/v1/collections` | Em c?digo; escopo e testes variam |
| 69 | `PATCH` | `/api/v1/collections/:id` | Em c?digo; escopo e testes variam |
| 70 | `DELETE` | `/api/v1/collections/:id` | Em c?digo; escopo e testes variam |
| 71 | `GET` | `/api/v1/collections/:id/posts` | Em c?digo; escopo e testes variam |
| 72 | `PUT` | `/api/v1/collections/:id/posts/:postId` | Em c?digo; escopo e testes variam |
| 73 | `DELETE` | `/api/v1/collections/:id/posts/:postId` | Em c?digo; escopo e testes variam |
| 74 | `GET` | `/api/v1/categories` | Em c?digo; escopo e testes variam |
| 75 | `GET` | `/api/v1/categories/:idOrSlug` | Em c?digo; escopo e testes variam |
| 76 | `GET` | `/api/v1/categories/:idOrSlug/posts` | Em c?digo; escopo e testes variam |
| 77 | `POST` | `/api/v1/categories` | Em c?digo, sob flag; valida??o pendente |
| 78 | `PATCH` | `/api/v1/categories/:id` | Em c?digo, sob flag; valida??o pendente |
| 79 | `DELETE` | `/api/v1/categories/:id` | Em c?digo, sob flag; valida??o pendente |
| 80 | `GET` | `/api/v1/tags` | Em código: listagem pública paginada. |
| 81 | `GET` | `/api/v1/tags/:slug` | Em código: detalhe e artigos filtrados. |
| 82 | `GET` | `/api/v1/posts/:postId/comments` | Em c?digo; escopo e testes variam |
| 83 | `GET` | `/api/v1/posts/:postId/comments/:id/replies` | Em c?digo; escopo e testes variam |
| 84 | `POST` | `/api/v1/posts/:postId/comments` | Em c?digo; escopo e testes variam |
| 85 | `PATCH` | `/api/v1/comments/:id` | Em c?digo; escopo e testes variam |
| 86 | `DELETE` | `/api/v1/comments/:id` | Em c?digo; escopo e testes variam |
| 87 | `GET` | `/api/v1/comments/:id/like` | Em c?digo; escopo e testes variam |
| 88 | `PUT` | `/api/v1/comments/:id/like` | Em c?digo; escopo e testes variam |
| 89 | `DELETE` | `/api/v1/comments/:id/like` | Em c?digo; escopo e testes variam |
| 90 | `GET` | `/api/v1/notifications` | Em c?digo; escopo e testes variam |
| 91 | `PATCH` | `/api/v1/notifications/read-all` | Em c?digo; escopo e testes variam |
| 92 | `PATCH` | `/api/v1/notifications/:id/read` | Em c?digo; escopo e testes variam |
| 93 | `GET` | `/api/v1/newsletter/confirm` | Sem chamada ? Link de confirma??o tratado diretamente pelo backend; falta jornada frontend e prova de topologia. |
| 94 | `GET` | `/api/v1/newsletter/unsubscribe` | Sem chamada ? Link de cancelamento tratado diretamente pelo backend; falta jornada frontend e prova de topologia. |
| 95 | `POST` | `/api/v1/newsletter/subscribe` | Em c?digo; escopo e testes variam |
| 96 | `POST` | `/api/v1/newsletter/confirm` | Sem chamada ? Confirma??o por JSON; alternativa ao link GET, avaliar necessidade. |
| 97 | `POST` | `/api/v1/newsletter/unsubscribe` | Sem chamada ? Cancelamento por JSON; alternativa ao link GET, avaliar necessidade. |
| 98 | `POST` | `/api/v1/reports` | Em c?digo; escopo e testes variam |
| 99 | `GET` | `/api/v1/reports` | Em c?digo, sob flag; valida??o pendente |
| 100 | `PATCH` | `/api/v1/reports/:id` | Em c?digo, sob flag; valida??o pendente |
| 101 | `POST` | `/api/v1/admin/users/:id/suspension` | Sem chamada ? Suspens?o administrativa; depende de pol?tica por alvo e testes. |
| 102 | `POST` | `/api/v1/admin/users/:id/restore` | Sem chamada ? Restaura??o administrativa; depende de pol?tica e localiza??o de suspensos. |
| 103 | `GET` | `/api/v1/admin/analytics/overview` | Em c?digo, sob flag; valida??o pendente |
| 104 | `GET` | `/api/v1/admin/audit-logs` | Sem chamada ? Auditoria administrativa; depende de jornada e autoriza??o. |

## Limites conhecidos

- `PATCH /users/:id` cobre perfil e senha; gest?o de papel, estado e outros usos administrativos n?o est?o entregues. Altera??o de e-mail usa fluxo pr?prio.
- `GET /posts` n?o cobre todos os filtros e estrat?gias de pagina??o dispon?veis; a busca por categoria e autor existe.
- A gest?o de categorias, den?ncias, usu?rios, m?tricas e revis?o usa BFF prot?tipo em mem?ria, sem HTTPS real ou opera??o distribu?da comprovada. A revis?o completa depende de testes reais de autoriza??o, revoga??o e concorr?ncia.
- O editor e as s?ries dependem da flag editorial, de testes integrados completos e da decis?o sobre exposi??o de capas de rascunho. S?rie n?o possui ETag para impedir sobrescrita concorrente.
- Contagem de endpoints mede superf?cie de integra??o, n?o tarefas conclu?das: diversos fluxos requerem testes reais, acessibilidade, estados de erro, seguran?a e infraestrutura. Consulte [BACKLOG.md](../BACKLOG.md).
