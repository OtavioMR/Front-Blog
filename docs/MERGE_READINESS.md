# Front-Blog — parecer final de merge

**Frontend: APTO PARA MERGE.**

Parecer sobre o conteúdo da árvore de trabalho validado em 12/11/2026. Não é autorização para deploy nem significa que os arquivos locais já estejam em commits. O usuário deve revisar e versionar integralmente o conteúdo listado, inclusive arquivos novos, antes de integrar. Nenhum commit, push, merge, rebase, deploy ou alteração da main foi realizado.

## Auditoria Git

- Branch: `chore/limpeza-pre-deploy`.
- HEAD: `b941dd6f4f0afb4777bd0bbe8ad0d01b1e338090`.
- Main local e `origin/main`, confirmadas por fetch ao início e fim: `b941dd6f4f0afb4777bd0bbe8ad0d01b1e338090`.
- Divergência remota: 0 commits atrás / 0 à frente; branch e main apontam ao mesmo commit.
- Índice de staging vazio; alterações continuam locais e não commitadas.
- Inventário anterior preservado: 35 caminhos com mudanças já existentes; todos os seus conteúdos de código/documentação/testes foram preservados, exceto os ajustes explicitamente descritos desta consolidação. A comparação SHA-256 de todos os arquivos inventariados não encontrou mudança inesperada.
- Estado final: **32 modificados, 2 excluídos, 5 novos não rastreados**.
- Diferença acumulada com main: 34 caminhos rastreados + 5 novos, detalhados ao final. Inclui trabalho anterior; não foi tudo criado nesta limpeza.
- Conflitos: nenhum indício de conflito de conteúdo na consulta atual, pois a main remota não contém commits exclusivos. A integração pode ser fast-forward depois de o usuário criar os commits locais, se a main continuar inalterada. Não foi executado merge de teste. Uma main remota que avance exige nova comparação.

### Commits existentes além da main

Nenhum. Um merge da branch como está hoje não leva as alterações ainda não commitadas.

## Limpezas desta etapa

- Removidos somente `src/app/_components/image-crop.tsx` e `src/app/_components/image-crop.module.css`. Grafo AST de imports/exports, busca de referências por arquivo/símbolo e inspeção dos consumidores de upload não encontraram uso. Não são rotas ou assets públicos; o componente não integra nenhuma página atual. O CSS era importado apenas por ele. Nenhum formulário de upload ou processamento de imagem ativo foi alterado.
- [.gitignore](../.gitignore): ignorar logs gerais e pastas locais .tmp/.temp. Nenhum dado local foi apagado.
- [BACKLOG.md](../BACKLOG.md): evidências e parecer atuais; relatórios anteriores preservados.

Nenhuma dependência foi removida, instalada ou atualizada; manifest e lockfile têm as mesmas dependências e versões declaradas. Os ajustes prévios nos scripts foram mantidos. Não houve mudança de arquitetura, schema, regra de negócio, visual, autorização, recuperação ou protocolo nesta consolidação.

## Mantidos / dúvidas registradas

- Assets de public, inclusive SVGs genéricos e variações de marca: URLs públicas podem ter consumidores externos. Ausência de import não autoriza exclusão. Favicons/apple-icon são entradas automáticas do Next.
- CSS e componentes ligados ao grafo atual; fontes e licenças OFL; rotas de conta, Studio, administração, feeds/sitemap e aliases públicos. Não foram eliminados seletores com referência dinâmica ou utilidade não comprovadamente obsoleta.
- Autenticação V2 completa, namespace de coordenação, tombstones, prova HttpOnly, recuperação, bloqueios entre abas, compatibilidade de payload e fencing de respostas antigas.
- Relatórios de sprints/auditorias, AGENTS/AGENTES, Compose de testes e scripts OpenAPI: úteis para manutenção e incidentes.
- Newsletter permanece sem página/formulário/rota ativa V1. Existe menção e campo histórico de inscrições no painel de estatísticas, parte do contrato de analytics; mantidos para não alterar esse contrato. Limpar a descrição é melhoria editorial opcional.
- React DOM e pacotes de tipos sem import literal são utilizados pelo framework/TypeScript; não são dependências mortas.

## Segurança e arquivos gerados

- Inventariados 335 arquivos rastreados ou novos na entrada da auditoria, com AST de 250 fontes e entradas automáticas/CLI/testes consideradas. Diretórios ignorados foram examinados por metadados, sem abrir ambientes pessoais ou copiar dados reais.
- Arquivo de ambiente versionado encontrado: apenas .env.example. Variantes .env.production/.env.staging/.env.test e os ambientes locais estão ignorados. Nenhum build, cobertura, node_modules, upload, log, dump, backup, chave PEM/KEY/P12/PFX foi identificado como versionado.
- Pesquisa local de chaves privadas, padrões AWS/GitHub/Google/Slack e URIs com credenciais, incluindo histórico alcançável para nomes e padrões de alta confiança: sem segredo real identificado. Duas ocorrências candidatas são segredos explicitamente sintéticos no guia local de testes. Nenhum valor é reproduzido aqui. Não foi feita reescrita de histórico nem revogação de credenciais. A busca não certifica formatos desconhecidos ou segredos fora do repositório.
- `npm ls --omit=dev --depth=0`: exit 0. Manifest/lockfile consistentes e inalterados nesta consolidação. `npm audit --omit=dev`: zero vulnerabilidades reportadas nesta consulta; dependências de desenvolvimento não incluídas nessa contagem.
- `git diff --check` contra HEAD e main: sem erro após as limpezas.
- Compose validado com .env.example e `--quiet --no-env-resolution`, sem ler/imprimir o ambiente de serviço real. Não há Dockerfile frontend; não foi criado um .dockerignore sem aplicação concreta.

## Validação atual

| Comando | Resultado |
| --- | --- |
| npm run lint | Exit 0; 0 erros, 5 avisos anteriores |
| npm run typecheck | Exit 0 |
| npm run build | Exit 0, Turbopack, 29 páginas estáticas geradas |
| npm run test:session | 28 aprovados |
| npm run test:admin | 8 aprovados |
| npm run test:public | 17 aprovados |
| npm run test:theme | 12 aprovados |
| npm run test:studio | 13 aprovados |
| 8 regressões UI Chromium | 8 aprovadas, 0 falhas/skips |
| session-v2-real-browser | 11 subtestes de cenários aprovados; runner conta 12 incluindo o agrupador; 0 falhas/skips |

A matriz real utiliza Next/BFF e API em produção em cópias temporárias, HTTPS local e Chromium com perfil próprio, PostgreSQL/Redis/Mailpit novos. Confirma login/logout, JWT expirado, recarga durante rotação, concorrência de chamadas/abas, perda antes/depois do commit e após Set-Cookie, revogação, TOTP, isolamento administrativo, resposta g1 depois de g2 e logout antigo contra login novo. As regressões UI cobrem confirmação de e-mail, desativação, comentários, editorial, publicação, séries, revisões e coleções.

Os cinco avisos preservados são os três img, a recarga integral administrativa e o contador numérico de requisições no cleanup; justificativas em [PREDEPLOY_VALIDATION.md](PREDEPLOY_VALIDATION.md).

Os três serviços descartáveis foram parados após a validação; não foram removidos volumes. Os diagnósticos do editor não responderam nesta execução e não são usados como evidência; lint/typecheck/build CLI concluíram com sucesso. Execução fria de npm ci e homologação real do Render não foram feitas; não se instalaram dependências.

## Pendências por severidade e riscos

- **Crítica/alta para o merge:** nenhuma identificada no conteúdo validado.
- **Média operacional para deploy:** homologar domínio/HTTPS público, cadeia de proxy/IP/rate limiting, serviços externos, SMTP, persistência de uploads e backups/restauração. Aprovação de merge não libera produção.
- **Média operacional:** BFF permanece em memória de uma instância; restart exige novo login administrativo e múltiplas réplicas sem estado compartilhado não são suportadas. Janela de recuperação V2 é finita; os limites não foram afrouxados.
- **Média de compatibilidade entre repositórios:** integrar/publicar os dois conjuntos de maneira coordenada. O frontend atualizado exige API V2; a API atual rejeita refresh legado sobre sessões V2. Não publicar uma combinação incompatível de versões.
- **Baixa:** cinco avisos de lint conhecidos, assets públicos sem consumidor interno conhecido e texto histórico de inscrições em analytics. Não justificam refatoração nesta consolidação.
- **Procedimental:** o conteúdo aprovado ainda precisa ser commitado pelo usuário. HEAD igual à main: merge imediato da branch sem commits locais é vazio. Incluir todos os novos arquivos necessários, e não apenas arquivos já rastreados.

Risco de regressão desta limpeza: baixo, pois somente componente não alcançável/CSS exclusivo e regras de ignore foram removidos/ajustados. O conjunto acumulado anterior tem sensibilidade maior em autenticação, recuperação e permissões; foi preservado e validado com backend/frontend juntos.

## Inventário completo da árvore de trabalho

| Status | Arquivo | Origem/justificativa |
| --- | --- | --- |
| M | [.gitignore](../.gitignore) | Proteção de temporários/logs |
| M | [BACKLOG.md](../BACKLOG.md) | Registro da consolidação, mantendo histórico |
| M | [package.json](../package.json) | Trabalho anterior preservado |
| D | `src/app/_components/image-crop.module.css` | Remoção segura: arquivo sem consumidores |
| D | `src/app/_components/image-crop.tsx` | Remoção segura: arquivo sem consumidores |
| M | [src/app/diretrizes/ia/page.tsx](../src/app/diretrizes/ia/page.tsx) | Trabalho anterior preservado |
| M | [src/app/diretrizes/page.tsx](../src/app/diretrizes/page.tsx) | Trabalho anterior preservado |
| M | [src/app/gestao-editorial/entrar/sessao/route.ts](../src/app/gestao-editorial/entrar/sessao/route.ts) | Trabalho anterior preservado |
| M | [src/app/gestao-editorial/sair/route.ts](../src/app/gestao-editorial/sair/route.ts) | Trabalho anterior preservado |
| M | [src/app/privacidade/page.tsx](../src/app/privacidade/page.tsx) | Trabalho anterior preservado |
| M | [src/lib/admin-security.ts](../src/lib/admin-security.ts) | Trabalho anterior preservado |
| M | [src/lib/session-client.ts](../src/lib/session-client.ts) | Trabalho anterior preservado |
| M | [tests/account-real-browser.test.mjs](../tests/account-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/admin-api-real.test.mjs](../tests/admin-api-real.test.mjs) | Trabalho anterior preservado |
| M | [tests/admin-bff-http.test.mjs](../tests/admin-bff-http.test.mjs) | Trabalho anterior preservado |
| M | [tests/admin-security.test.mjs](../tests/admin-security.test.mjs) | Trabalho anterior preservado |
| M | [tests/collections-browser.test.mjs](../tests/collections-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/comment-browser.test.mjs](../tests/comment-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/comment-like-real-browser.test.mjs](../tests/comment-like-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/comment-real-browser.test.mjs](../tests/comment-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/deactivate-account-browser.test.mjs](../tests/deactivate-account-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/editorial-e2e.test.mjs](../tests/editorial-e2e.test.mjs) | Trabalho anterior preservado |
| M | [tests/follow-real-browser.test.mjs](../tests/follow-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/notifications-real-browser.test.mjs](../tests/notifications-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/publication-browser.test.mjs](../tests/publication-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/publication-real-browser.test.mjs](../tests/publication-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/recovery-email-docker-browser.test.mjs](../tests/recovery-email-docker-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/revisions-browser.test.mjs](../tests/revisions-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/revisions-docker-browser.test.mjs](../tests/revisions-docker-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/revisions-real-browser.test.mjs](../tests/revisions-real-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/series-browser.test.mjs](../tests/series-browser.test.mjs) | Trabalho anterior preservado |
| M | [tests/session-client.test.mjs](../tests/session-client.test.mjs) | Trabalho anterior preservado |
| M | [tests/session-profile.test.mjs](../tests/session-profile.test.mjs) | Trabalho anterior preservado |
| M | [tests/studio-editor.test.mjs](../tests/studio-editor.test.mjs) | Trabalho anterior preservado |
| A (não rastreado) | [docs/MERGE_READINESS.md](../docs/MERGE_READINESS.md) | Novo parecer desta consolidação |
| A (não rastreado) | [docs/PREDEPLOY_VALIDATION.md](../docs/PREDEPLOY_VALIDATION.md) | Trabalho anterior preservado |
| A (não rastreado) | [docs/SESSION_V2_VALIDATION.md](../docs/SESSION_V2_VALIDATION.md) | Trabalho anterior preservado |
| A (não rastreado) | [tests/session-v2-real-browser.test.mjs](../tests/session-v2-real-browser.test.mjs) | Trabalho anterior preservado |
| A (não rastreado) | [tests/support/v2-response.mjs](../tests/support/v2-response.mjs) | Trabalho anterior preservado |

## Diferenças acumuladas com origin/main

- M: `.gitignore`
- M: `BACKLOG.md`
- M: `package.json`
- D: `src/app/_components/image-crop.module.css`
- D: `src/app/_components/image-crop.tsx`
- M: `src/app/diretrizes/ia/page.tsx`
- M: `src/app/diretrizes/page.tsx`
- M: `src/app/gestao-editorial/entrar/sessao/route.ts`
- M: `src/app/gestao-editorial/sair/route.ts`
- M: `src/app/privacidade/page.tsx`
- M: `src/lib/admin-security.ts`
- M: `src/lib/session-client.ts`
- M: `tests/account-real-browser.test.mjs`
- M: `tests/admin-api-real.test.mjs`
- M: `tests/admin-bff-http.test.mjs`
- M: `tests/admin-security.test.mjs`
- M: `tests/collections-browser.test.mjs`
- M: `tests/comment-browser.test.mjs`
- M: `tests/comment-like-real-browser.test.mjs`
- M: `tests/comment-real-browser.test.mjs`
- M: `tests/deactivate-account-browser.test.mjs`
- M: `tests/editorial-e2e.test.mjs`
- M: `tests/follow-real-browser.test.mjs`
- M: `tests/notifications-real-browser.test.mjs`
- M: `tests/publication-browser.test.mjs`
- M: `tests/publication-real-browser.test.mjs`
- M: `tests/recovery-email-docker-browser.test.mjs`
- M: `tests/revisions-browser.test.mjs`
- M: `tests/revisions-docker-browser.test.mjs`
- M: `tests/revisions-real-browser.test.mjs`
- M: `tests/series-browser.test.mjs`
- M: `tests/session-client.test.mjs`
- M: `tests/session-profile.test.mjs`
- M: `tests/studio-editor.test.mjs`
- A (novo, não rastreado): `docs/MERGE_READINESS.md`
- A (novo, não rastreado): `docs/PREDEPLOY_VALIDATION.md`
- A (novo, não rastreado): `docs/SESSION_V2_VALIDATION.md`
- A (novo, não rastreado): `tests/session-v2-real-browser.test.mjs`
- A (novo, não rastreado): `tests/support/v2-response.mjs`

## Recomendação

**Frontend: APTO PARA MERGE do conteúdo integral validado, após revisão e commits pelo usuário.** Não executar integração com arquivos novos faltando, não confundir merge com deploy e revalidar se a main ou o conteúdo mudar. Não há aprovação para descartar alterações existentes ou remover proteções V2.
