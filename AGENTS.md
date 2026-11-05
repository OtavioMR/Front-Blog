# Regras do projeto frontend

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Backlog e escopo
- [BACKLOG.md](BACKLOG.md) é a fonte local de tarefas e status. Consulte a sprint relevante e atualize tarefas, evidências, pendências e bloqueios. Não declare uma sprint concluída sem seus critérios de aceite.
- Consulte `C:/Users/otavv/Downloads/Arquitetura_Frontend_Blog.md` e confirme propostas no backend `C:/Users/otavv/Documents/Backend-Blog`. O planejamento usou o commit `f89622e`; não suponha que contratos propostos existam.
- Trabalhe na sprint solicitada e limite mudanças ao necessário. Alterações no backend seguem também o [AGENTS.md do backend](../Backend-Blog/AGENTS.md). Não exponha segredos nem dados reais em exemplos, testes ou logs.
- O usuário definiu o projeto Docker existente `backend-blog` e seu banco principal como ambiente de testes. Use essa API e esse banco para integrações, com contas e conteúdo identificados como sintéticos; preserve dados existentes, volumes e migrations. Não exija uma cópia isolada como pré-requisito. Verifique efeitos externos de SMTP e entregas antes de executar fluxos que enviem mensagens.
- Estado recente: use o componente global `src/app/_components/avatar.tsx` para toda foto de perfil; ele aceita ausência, URL inválida e falha após hidratação, exibindo iniciais ou ícone. `/configuracoes` é público e concentra aparência; `/conta/configuracoes` é privado e trata apenas conta/segurança. A navbar mantém Configurações antes de Entrar/Minha conta. Não reintroduza tema na área privada nem renderize imagens de perfil diretamente.

## Arquitetura e segurança
- Use Next.js App Router, React e TypeScript, com renderização no servidor para leitura pública e URL canônica `/posts/[slug]`. Integre com os contratos reais do NestJS em `/api/v1`; valide DTOs, respostas, erros e paginação.
- Separe experiências e layouts públicos, conta, Studio e administração. Não inclua links, menus, rotas ou detalhes administrativos na navegação ou conteúdo entregue ao usuário comum.
- O endereço desconhecido não é controle de acesso. Entradas, dados e ações administrativas exigem autenticação e autorização no servidor/backend. Trate 401 e 403 e teste visitante, READER, AUTHOR e ADMIN. OWNER só após existir e ser protegido no backend.
- Não armazene refresh token em JavaScript ou localStorage. Preserve o cookie HttpOnly e a rotação da API; trate concorrência entre abas, revogação e troca de conta. Use `no-store` em áreas privadas e `noindex` para conta, autenticação e painéis.
- Não exponha rascunhos, tokens ou dados privados em HTML público, metadados, logs ou caches. Preserve 404 real para conteúdo inexistente ou não público e diferencie falha da API. Sanitize conteúdo e valide redirecionamentos e uploads.
- A fila administrativa mínima de revisão acompanha o Studio. OWNER e contratos propostos dependem de implementação e testes no backend antes da interface.

## Qualidade e operação
- Mantenha acessibilidade, responsividade, teclado e estados de carregamento, vazio, erro e sucesso. Prefira componentes reutilizáveis e mudanças pequenas.
- Faça testes úteis e verificações proporcionais ao risco. Teste integração real para sessão, permissão, publicação e SEO; registre comandos e limitações. Quando disponíveis, execute lint, typecheck, testes e build.
- Alterações de contrato no backend exigem Swagger e respeito às regras de migrations do backend. Não altere migrations antigas, `dist/`, `node_modules/` ou `.git/`.
- Isolamento de estilos e componentes reutilizáveis: evite seletores de elemento genéricos desqualificados dentro de contêineres em CSS Modules (por exemplo, `.content button` ou `.form input`). Ao estilizar botões ou ações de formulário, utilize classes dedicadas ou restrinja o seletor com `:not([data-back-button]):not([class*="back"])`, garantindo que componentes reutilizáveis de navegação não herdem estilos indevidos que quebrem estados de foco, hover e contraste.
- Use LF e nunca versione `.env`, credenciais ou dados sensíveis. Mantenha alterações locais: não faça commits, push, PRs ou chamadas à API do GitHub; o usuário controla essas ações ao final da sprint.
