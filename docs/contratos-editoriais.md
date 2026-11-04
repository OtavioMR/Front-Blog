# Contratos editoriais confirmados

Inspeção estática do backend local no commit `f89622e`. Os caminhos abaixo usam o prefixo `/api/v1`; chamadas privadas exigem bearer JWT, sessão ativa e `no-store`. A validação real depende de API e banco isolados com as migrations aplicadas. O backend aplica `whitelist` e rejeita campos não declarados.

## Autoria

- `GET /users/author-rules` é público e retorna `{ version: '1', rules: string[] }`.
- `POST /users/me/author` exige autenticação e corpo `{ version: '1', accepted: true }`. Um `READER` ativo, com e-mail verificado e promoção não bloqueada, torna-se `AUTHOR`; sucesso 200 retorna `{ role: 'AUTHOR', rulesVersion: '1' }`, enquanto 400, 401 e 403 indicam respectivamente aceite inválido, sessão ausente e requisitos não atendidos.
- No commit `f89622e`, o perfil próprio retornado por `GET /users/:id` não inclui `firstPostApproved`. O código local do backend foi alterado posteriormente para incluí-lo apenas para o titular, com testes e Swagger; o container em execução ainda não recebeu essa alteração. O frontend ainda não consome essa capacidade. Não inferir aprovação pelo papel ou histórico; tratar conflitos da API.

## Artigos próprios

- `GET /posts/me?page=1&limit=10` exige JWT; retorna artigos ativos do próprio usuário, inclusive rascunhos, com `{ data, meta }`. `page` mínimo 1, `limit` 1–100. Ordena por criação e ID decrescentes. Os resumos incluem `id`, `slug`, `title`, `excerpt`, `coverImage`, `publishedAt`, `scheduledAt`, `published`, `reviewStatus`, `commentsEnabled`, `isActive`, `createdAt`, `updatedAt`, autor, categorias ativas, tags e `readingTimeMinutes`; não incluem `content`.
- `GET /posts/:id` aceita UUID, slug ou slug antigo e autenticação opcional. Retorna conteúdo para o autor ou ADMIN mesmo quando rascunho; outros recebem 404 para conteúdo não publicado. O detalhe contém `content`, `authorId`, categorias e tags. Use requisição autenticada e nunca compartilhe a resposta privada ou a inclua no cache público.
- `POST /posts` exige `AUTHOR` ou `ADMIN`, retorna 201 e aceita `title` (string 3–150), `content` (string 10–50000), `published` booleano opcional, `scheduledAt` ISO futura com fuso explícito opcional, `categoryIds` array de UUID v4 de categorias ativas e `tagNames` até 10 strings de 1–50 caracteres. Tags inexistentes são criadas. O servidor sanitiza título e conteúdo, gera slug e resumo; título ou conteúdo vazio após sanitização é inválido. Rascunhos usam `published: false` ou omissão. O backend limita criação a 10 por minuto/IP.
- `PATCH /posts/:id` exige UUID e JWT; autor `AUTHOR` do artigo ou `ADMIN`. Aceita os campos de criação opcionais e também `commentsEnabled` e `isActive` booleanos. Slug permanece estável; `categoryIds: []` ou `tagNames: []` limpa as relações. `scheduledAt: null` cancela agendamento; publicar ou desativar também o cancela. `isActive: false` despublica. Limite de 20 edições por minuto/IP.
- `DELETE /posts/:id` exige JWT e a mesma autorização de propriedade/ADMIN; responde 204 e desativa, despublica e remove logicamente. Não é uma exclusão reversível pela interface existente.
- Erros comuns: 400 para DTO ou conteúdo inválido; 401 para sessão ausente/revogada; 403 para propriedade/papel; 404 para artigo ou categoria inexistente/inativa; 409 para primeiro artigo sem aprovação ou artigo pendente; 429 para limite de requisições. Não repetir mutação automaticamente após resposta incerta; preservar o texto do editor e consultar o estado antes de uma nova tentativa.

## Revisão do primeiro artigo

O artigo inicia com `reviewStatus: DRAFT`. Antes da primeira aprovação, o banco impede publicação e agendamento, inclusive se o cliente chamar diretamente `POST` ou `PATCH` com esses campos. Os erros de restrição mapeados pela aplicação retornam 409. Um rascunho `PENDING` não pode ser editado, removido ou ter suas relações e capa alteradas; o cliente deve atualizar o estado após conflito.

`POST /post-reviews/:id/submit` exige JWT e UUID. Apenas o `AUTHOR` ativo proprietário pode enviar; o artigo precisa estar ativo, não publicado, sem agendamento, fora de `PENDING`, e o autor não pode ter primeira aprovação. Retorna 201 `{ status: 'PENDING' }`; 403 para autoria não autorizada, 404 ausente e 409 para inelegibilidade. `REJECTED` pode ser editado e reenviado enquanto o autor ainda não tiver primeira aprovação.

`GET /post-reviews` exige `ADMIN` no backend e retorna array simples de até 100 artigos ativos com `reviewStatus: PENDING`, em ordem de `updatedAt` crescente. Retorna entidades de artigo com campos próprios, incluindo `id`, `authorId`, `title`, `content`, `excerpt`, `coverImage`, estados e datas; a consulta não carrega relações de autor, categorias ou tags. Não há paginação nem motivo de rejeição nesse contrato.

`POST /post-reviews/:id/decision` exige `ADMIN` e corpo `{ decision: 'APPROVED' | 'REJECTED' }`; sucesso 201 retorna `{ status }`. Aprovar publica imediatamente, registra `publishedAt`, libera publicações futuras do autor e marca como `REJECTED` os outros artigos pendentes desse autor. Rejeitar mantém o artigo não publicado. As decisões são transacionais e auditadas. 400 indica DTO inválido, 401 sessão ausente, 403 papel inadequado, 404 artigo ausente e 409 alteração concorrente ou autor/artigo inelegível.

## Capas e riscos de integração

`POST /posts/:id/cover-image` recebe multipart com campo `file`, exige autor proprietário ou ADMIN e aceita JPEG, PNG ou WebP válido até 5 MiB; converte para WebP com dimensões máximas 1920 × 1080. Retorna 201 `{ coverImage: '/uploads/post-covers/<uuid>.webp' }`. `DELETE` na mesma rota retorna 200 `{ coverImage: null }`. Podem ocorrer 400, 401, 403, 404, 409 ou 413.

**Bloqueio de privacidade:** o backend serve `/uploads/post-covers/` como arquivo estático público, inclusive capa de rascunho. Oculte upload de capa privada até existir proteção adequada no backend e topologia; não presuma que ausência de link proteja a mídia.

A fila administrativa precisa de área e layout separados, sem link na interface pública. Autorização de dados e ações é do backend; não confiar apenas na interface, no papel decodificado do token ou em rota desconhecida. Testar acesso direto como visitante, `READER`, `AUTHOR` e `ADMIN`, inclusive revogação de sessão. `OWNER` não consta no contrato atual. Verificar sanitização do conteúdo mostrado na revisão, sem inserir HTML bruto.

## Fontes

- `Backend-Blog/src/modules/posts/posts.controller.ts`, `posts.service.ts`, `dto/create-post.dto.ts` e `dto/update-post.dto.ts`
- `Backend-Blog/src/modules/posts/post-review.controller.ts`, `post-review.service.ts` e `entities/post.entity.ts`
- `Backend-Blog/src/modules/users/users.controller.ts`, `users.service.ts` e `dto/accept-author-rules.dto.ts`
- `Backend-Blog/src/database/migrations/1795400000000-FirstPostReview.ts` e `src/common/global-exception.filter.ts`
- `Backend-Blog/src/main.ts` e `src/docs/decorators/posts.decorator.ts`
