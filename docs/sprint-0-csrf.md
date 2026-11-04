# Sprint 0 — análise de CSRF e origem

Análise em 04/11/2026 do backend no commit `f89622e` e da topologia local. Uma primeira validação de origem foi implementada em [proxy.ts](../src/proxy.ts); os testes de navegador, gateway e produção abaixo permanecem necessários.

## Situação observada

- O frontend encaminha `/api/v1/:path*` à API por rewrite. O Nest configura CORS para a origem de `FRONTEND_URL` e credenciais, mas não foi identificada validação geral de `Origin` ou token CSRF no código inspecionado. CORS determina acesso do navegador à resposta; não é, por si só, bloqueio de todas as requisições que causam efeitos.
- Login define refresh cookie `HttpOnly`, `SameSite=Strict`, com caminho `/api/v1/auth`; `Secure` está ativo apenas em produção. Refresh consome o cookie, gira-o e devolve um access token; logout exige Bearer e revoga a sessão. Proteger login também importa para evitar associação indevida de sessão. Os métodos que usam Bearer continuam exigindo autorização no backend; não devem depender exclusivamente do filtro de origem.
- Um POST de teste ao refresh, sem cookie e com `Origin` externo, recebeu 401 do handler tanto pela origem do Next como diretamente na API, sem `Access-Control-Allow-Origin`. Isso mostra que a requisição chegou ao handler; não demonstra que um ataque autenticado teve sucesso. O smoke anterior de cookie, feito com Node, não simula as políticas de um navegador.
- SameSite reduz exposição a requisições entre sites, mas não distingue origens de subdomínios do mesmo site; não substitui validação de origem. O cookie não é disponibilizado ao JavaScript, o que não impede o navegador de enviá-lo automaticamente.

## Proposta para a origem pública

1. Validar, antes do encaminhamento, `POST`, `PUT`, `PATCH`, `DELETE` e outros métodos não seguros em todo `/api/v1`, incluindo login, refresh, logout, registro, publicação e uploads. Exigir um único `Origin` válido exatamente igual à origem pública explicitamente configurada (esquema, host e porta); rejeitar `null`, múltiplos, inválidos, não correspondentes ou ausentes com 403 e `Cache-Control: no-store`. Não derivar a origem autorizada de `Host`, `Forwarded` ou `X-Forwarded-*` fornecidos pelo cliente.
2. Usar a convenção `src/proxy.ts` do Next 16 e matcher adequado à API. A documentação local do Next indica que Proxy executa antes dos rewrites de `next.config`, podendo devolver resposta diretamente. `middleware.ts` é a convenção descontinuada nesta versão. Testar efetivamente a ordem e a cobertura no deploy, inclusive caminho raiz, barra final, normalizações e caminhos codificados; não presumir que um matcher cubra aliases que alcancem a API.
3. Expor ao navegador somente a origem pública protegida. API upstream e qualquer entrada alternativa de gateway devem ser privadas ou aplicar proteção equivalente; se o gateway encaminhar `/api/v1` diretamente ao Nest, o Proxy do Next não será executado. Restringir acesso direto ao upstream e validar política em staging. A comparação de `Origin` é defesa contra CSRF no navegador, não autenticação: clientes fora do navegador podem forjar cabeçalhos.
4. Não liberar origens curingas nem confiar em `Sec-Fetch-Site: same-site` como substituto da comparação exata. `Sec-Fetch-*` pode complementar a verificação, respeitando navegadores que não enviam esses cabeçalhos. Para clientes de servidor ou integrações legítimas sem `Origin`, definir canal privado autenticado próprio; não criar exceção pública baseada apenas na ausência de cabeçalho. Confirmar que as chamadas browser de sessão enviam Origin e adaptar testes Node para enviar a origem permitida.
5. Preservar corpo multipart e cabeçalhos, `Set-Cookie`, `Authorization`, status, limites de upload e comportamento de rate limit; não registrar cookies, tokens, corpo ou URLs com tokens. A verificação deve ocorrer antes de qualquer mutação, e erros não devem ser armazenados em cache. Validações de `Content-Type` e um cabeçalho obrigatório para chamadas JavaScript são defesas adicionais possíveis, mas não cobrem sozinhos todos os fluxos e exigem teste de compatibilidade.

Essa proteção na borda não substitui autenticação, autorização, proteção contra XSS ou validação no Nest. A proteção automática de `Origin` documentada para **Server Actions** não deve ser presumida para rewrites externos ou Route Handlers; verificar a política de cada novo endpoint Next que altere dados.

## GETs com efeitos e integrações externas

Nem todo GET existente é sem efeitos: OAuth inicia estado em cookie e seu callback processa retorno externo com state e PKCE; newsletter confirma e cancela inscrição por links com token. Não aplicar uma regra cega de exigir `Origin` em todos os GETs, pois navegação de e-mail e retorno OAuth não a garantem. Revisar cada fluxo separadamente antes de disponibilizá-lo: conferir state/PKCE e cookie OAuth na topologia real; evitar vazamento de tokens em logs e referrers; avaliar scanners de e-mail que abrem links GET e migração para confirmação explícita por POST. Isso pode exigir alteração contratual no backend, fora desta proposta.

## Testes necessários antes da entrega

- Navegador real: mesma origem aceita para login, refresh, logout e upload; origens externas e subdomínios do mesmo site rejeitados antes de alcançar a API, inclusive formulários simples e multipart. Verificar `Origin: null`, ausente, incorreto, múltiplo, cabeçalhos de host forjados, métodos e caminhos alternativos.
- Com cookie sintético válido, demonstrar que refresh bloqueado não gira nem revoga a sessão e que login forjado não troca a conta. Testar também requisições válidas, 401/403, logout e duas abas, sem imprimir credenciais.
- Testar acesso direto ao upstream e todos os caminhos do gateway, bem como chamadas de servidor legítimas. Checar que `/uploads`, GETs públicos, feeds e OAuth/newsletter previstos continuam funcionais. Repetir em HTTPS e na infraestrutura de produção/staging.

Referências locais: [Proxy do Next](../node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md), [segurança de dados do Next](../node_modules/next/dist/docs/01-app/02-guides/data-security.md) e [configuração de rewrites](../next.config.ts).
