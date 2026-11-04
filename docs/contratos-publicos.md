# Contratos públicos confirmados no backend

Inspeção estática do backend local no commit `f89622e`; não substitui uma chamada de integração real. Prefixo de API: `/api/v1`. Imagens de capa são servidas em `/uploads/post-covers/`, fora do prefixo da API, na origem do backend.

## Artigos

`GET /api/v1/posts` é público e retorna apenas artigos ativos e publicados. Sem cursor retorna `{ data, meta }`, com paginação descrita abaixo. A ordem normal é `publishedAt` descendente e depois `id` descendente. Com `search` e sem cursor, a relevância precede essa ordem.

Parâmetros opcionais: `page`, `limit`, `search` (até 100 caracteres; busca em português por título e conteúdo), `author` (nome parcial), `categoryName` (nome parcial), `categoryId` (UUID v4), `categorySlug` e `tagSlug` (strings até 100 caracteres). Se `categoryId` e `categorySlug` forem enviados juntos, o ID prevalece. O backend rejeita parâmetros não reconhecidos.

Cada resumo seleciona `id`, `slug`, `title`, `excerpt`, `coverImage` (caminho ou `null`), `publishedAt` (data ou `null`), `published`, `reviewStatus`, `commentsEnabled`, `isActive`, `createdAt`, `updatedAt`, `author` (`id`, `name`), `categories` (`id`, `name`, `slug`, `isActive`) e `tags` (`id`, `name`, `slug`), além de `readingTimeMinutes` calculado. `content` é removido do resumo; categorias inativas são removidas. Datas são serializadas com fuso horário explícito. Não presumir que dados de categoria associados tenham todos os campos retornados pela listagem de categorias.

`GET /api/v1/posts/:id` aceita UUID, slug atual ou slug antigo. Para visitante, artigos não publicados ou inativos respondem 404; o endpoint aceita autenticação opcional e pode retornar rascunhos ao autor ou ADMIN. Portanto, a leitura pública deve chamar sem credenciais e jamais colocar respostas autenticadas em cache público. O detalhe acrescenta `content`, `authorId`, `scheduledAt` e, para publicados, `series` (`null` ou navegação com `id`, `title`, `totalParts`, `previous`, `next`); os vizinhos possuem `id` e `slug`. Use o `slug` retornado para URL canônica, inclusive após acessar slug antigo. O conteúdo é sanitizado no backend, mas a interface também deve tratar HTML com segurança.

`GET /api/v1/posts/:id/related` aceita UUID ou slug e retorna até quatro artigos públicos completos, ou `[]`; o artigo de referência inexistente/não público gera 404.

## Categorias

`GET /api/v1/categories` retorna `{ data, meta }` com categorias ativas em ordem crescente de nome. Aceita `page`, `limit` e `search` (até 100 caracteres, busca parcial por nome ou slug, sem distinção de caixa ou acento). Os campos da entidade retornada incluem `id`, `name`, `slug`, `description` (`null` permitido), `isActive`, `creatorId` (`null` permitido), `createdAt` e `updatedAt`.

`GET /api/v1/categories/:idOrSlug` aceita UUID v4 ou slug e retorna uma categoria ativa; ausente/inativa gera 404. `GET /api/v1/categories/:idOrSlug/posts` primeiro procura a categoria e depois retorna os mesmos resumos paginados de artigos, aceitando apenas `page` e `limit`; categoria inexistente gera 404, enquanto categoria existente sem artigos retorna lista vazia.

## Paginação e falhas

`page` é inteiro mínimo 1 e padrão 1; `limit` é inteiro de 1 a 100 e padrão 10. A resposta por página tem `meta: { page, limit, total, totalPages, hasNextPage, hasPreviousPage }`. Para zero resultados, `totalPages` é 0; `hasPreviousPage` depende de `page > 1`, inclusive em página além do total.

Na listagem de artigos, `cursor=start` ativa paginação por cursor; envie depois o `nextCursor` retornado. Nesse modo `meta` é `{ nextCursor: string | null, hasMore: boolean }`, sem totais. `limit` continua aplicável e `page` não desloca o resultado. Há possibilidade de 409 se a lista mudar durante a geração do cursor; cursor inválido ou parâmetros inválidos podem gerar 400. Busca com cursor segue ordem de publicação, não a ordenação por relevância usada na paginação por página.

Falhas de rede, 5xx e outras falhas da API não significam conteúdo ausente. Preserve 404 somente quando a API confirmar ausência; apresente erro recuperável nos demais casos. Não houve validação de HTTP real nesta inspeção.

## Fontes

- `Backend-Blog/src/main.ts`
- `Backend-Blog/src/modules/posts/posts.controller.ts`, `posts.service.ts` e `dto/find-posts-query.dto.ts`
- `Backend-Blog/src/modules/categories/categories.controller.ts`, `categories.service.ts`, `entities/category.entity.ts` e `dto/find-categories-query.dto.ts`
- `Backend-Blog/src/common/dto/pagination-query.dto.ts` e `src/common/utils/pagination.ts`
- `Backend-Blog/src/docs/models/post-response.dto.ts` e `category-response.dto.ts`
