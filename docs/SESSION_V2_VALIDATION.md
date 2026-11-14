# Sessões V2 — diagnóstico, implementação e prova real

Data: 12/11/2026. Branches: `chore/limpeza-pre-deploy` nos dois repositórios. Alterações anteriores preservadas; sem commit, push, merge ou deploy. Nenhum banco ou volume existente foi usado para escrita.

## Conclusão

**A integração de refresh legado no cliente/BFF foi substituída pelo V2 e o problema original não permaneceu reproduzível nos cenários aprovados.** Recargas rápidas, várias chamadas/abas, perda de resposta após commit, falhas transitórias e logout concorrente foram exercitados com API real, PostgreSQL, Redis, Next em produção e Chromium real sobre HTTPS.

Isso encerra o bloqueador de integração identificado na auditoria no escopo testado: **uma instância Next/BFF**. Não certifica múltiplas réplicas, sobrevivência da sessão administrativa a restart do processo nem a infraestrutura Render real. Os critérios externos de domínio, proxy/IP, armazenamento persistente, e-mail e backup continuam necessários antes do lançamento.

## Diagnóstico anterior às alterações

1. [session-client.ts](../src/lib/session-client.ts) usava `/auth/refresh`, persistia somente `epoch/pending` e recusava qualquer nova tentativa após um resultado incerto. Recarregar durante essa pendência tornava a sessão irrecuperável mesmo quando o backend já tinha confirmado a rotação.
2. [admin-security.ts](../src/lib/admin-security.ts) mantinha somente o cookie legado no servidor e removia a sessão administrativa ao capturar uma falha de rede. O navegador perdia a sessão embora a API pudesse tê-la renovado.
3. Login/2FA já entregavam `session_id`, `refresh_generation`, `refresh_protocol` e cookies V2, mas os dois clientes descartavam esses metadados. Logout também usava o caminho legado e, no cliente público, exigia refresh prévio para renovar access token expirado.
4. O backend já tinha locks usuário → sessão, comparecimento de token assinado e prova HttpOnly, resultado cifrado por operação, recuperação idempotente e cookies separados por sessão/geração. Esses mecanismos foram reutilizados.
5. A limpeza periódica executava `SELECT DISTINCT ... FOR UPDATE`, rejeitado pelo PostgreSQL com `FOR UPDATE is not allowed with DISTINCT clause`; a exceção era silenciosamente capturada. O problema foi reproduzido num PostgreSQL descartável.
6. A capacidade de 64 operações contava metadados históricos retidos por dias, e não apenas operações ainda recuperáveis. Uma sessão normal poderia esgotar a capacidade permanentemente até expirar o histórico.
7. O identificador da chave cifradora indicava uma posição fixa, fazendo a chave nova encobrir a anterior em uma rotação explícita. A recuperação precisava identificar a chave efetiva.
8. Um logout administrativo atrasado enviava exclusão do cookie opaco de nome fixo; essa resposta podia apagar o cookie de um login mais recente.
9. Uma aba com JavaScript antigo podia sobrescrever a chave de coordenação V1 ou chamar o endpoint legado com um cookie V2 obsoleto, revogando a sessão da versão nova. O isolamento por versão também era necessário.

## Comportamento implementado

### Cliente público

- Mantidos Web Locks e BroadcastChannel. O armazenamento contém apenas coordenação: epoch, ID da sessão, geração, ID CSPRNG da operação, pendência e prazo de recuperação. Não contém access/refresh tokens, prova, senha ou perfil. Access token continua em memória e as credenciais de refresh/prova continuam HttpOnly.
- A chave/canal/bloqueio usam o namespace V2; uma aba legada não sobrescreve a coordenação atual. O endpoint legado também não pode rotacionar nem revogar uma sessão V2, mesmo na geração inicial. Sessões antigas sem metadados V2 precisam de uma nova entrada.
- A operação é persistida **antes** do envio. Timeout, 5xx ou corpo truncado preservam a mesma operação; uma recarga retoma essa operação. Não se inventa outro ID após uma rotação de resultado desconhecido.
- Abas sem access token local podem recuperar a operação já confirmada dentro de seu prazo, evitando uma rotação nova a cada recarga. A autorização de qualquer consulta permanece na API.
- Respostas só são aceitas se epoch, sessão, ID de operação e geração correspondem ao estado atual. Logout deixa um tombstone local antes de enviar `/auth/logout/v2`, mesmo sem access token válido. Uma resposta antiga não desfaz esse estado.
- 401 confirmado encerra a sessão; falhas temporárias lançam erro recuperável, permitindo que a UI preserve o último perfil conhecido em vez de apresentar logout falso. Tentativa de novo login que falha não destrói a sessão anterior.
- O backend só informa `retry_generation` quando o chamador apresenta **token atual e prova válida**. Assim, uma operação expirada com Set-Cookie já recebido pode avançar legitimamente; token antigo, ID isolado ou prova isolada não autorizam isso.

### BFF administrativo

- Guarda cookies V2 e coordenação no estado administrativo já existente; não entrega essas credenciais ao navegador. O navegador continua recebendo apenas o ID opaco administrativo com HttpOnly/Secure/SameSite Strict.
- Usa o mesmo endpoint V2, com Origin configurada explicitamente e uma única renovação em andamento por sessão. Mantém a operação após falhas transitórias e recupera seu resultado; não apaga a sessão por um timeout.
- Credenciais de uma resposta que chega após revogação não são reaplicadas. Logout usa um snapshot da sessão antiga e não precisa renovar antes de revogar.
- O logout revoga o ID opaco no servidor e **não envia exclusão tardia do cookie de nome fixo**. Esse ID inválido pode permanecer no navegador até expirar ou ser substituído, mas não autoriza nenhuma consulta. O teste HTTP confirma que reapresentá-lo redireciona à entrada. Isso impede que uma resposta antiga apague uma sessão nova.
- Login e ações administrativas continuam sujeitos a CSRF, identidade/papel revalidados na API e requisitos de TOTP/e-mails verificados. Não foi criado outro sistema de autorização.

### Backend

- Corrigidos os locks da limpeza periódica, mantendo retenção de metadados e descarte de ciphertext expirado.
- O limite de 64 continua aplicado a operações dentro da janela recuperável; metadados expirados não esgotam a capacidade de rotação. Testadas 65 rotações com histórico preservado.
- Chaves cifradoras passam a ter ID derivado da chave efetiva, dentro do tamanho existente da coluna. A chave anterior configurada consegue recuperar envelopes anteriores; envelopes de ID legado também são suportados. AES-GCM e AAD permanecem obrigatórios.
- Origin exige igualdade com uma origem serializada autorizada, sem caminhos, credenciais ou normalização permissiva.
- O controller legado exige protocolo 1; devolve `400 PROTOCOL_V2_REQUIRED` para sessões V2 antes de qualquer rotação ou revogação. A compatibilidade de sessões protocolo 1 foi preservada e provada com fixture assinada genuinamente legada nos E2E.
- `retry_generation` é uma informação aditiva de coordenação, documentada no Swagger; não contém credenciais e não permite recuperar tokens antigos fora da política. Nenhuma migration foi alterada ou criada.

## Arquivos desta etapa

| Grupo | Arquivos e motivo |
| --- | --- |
| Sessão pública | [session-client.ts](../src/lib/session-client.ts): coordenação e recuperação V2, logout e proteção de respostas antigas |
| Sessão administrativa | [admin-security.ts](../src/lib/admin-security.ts), [entrada](../src/app/gestao-editorial/entrar/sessao/route.ts), [saída](../src/app/gestao-editorial/sair/route.ts): jar V2 interno, single-flight, recuperação e revogação isolada |
| Testes unitários/HTTP | [session-client.test.mjs](../tests/session-client.test.mjs), [session-profile.test.mjs](../tests/session-profile.test.mjs), [admin-security.test.mjs](../tests/admin-security.test.mjs), [admin-bff-http.test.mjs](../tests/admin-bff-http.test.mjs): contrato V2 e regressões de segurança |
| Nova prova real | [session-v2-real-browser.test.mjs](../tests/session-v2-real-browser.test.mjs): backend, Next/BFF, TLS, Chromium e falhas controladas após commit |
| Fixtures de UI | [v2-response.mjs](../tests/support/v2-response.mjs) e testes de [coleções](../tests/collections-browser.test.mjs), [comentários](../tests/comment-browser.test.mjs), [desativação](../tests/deactivate-account-browser.test.mjs), [editorial](../tests/editorial-e2e.test.mjs), [publicação](../tests/publication-browser.test.mjs), [revisões](../tests/revisions-browser.test.mjs) e [séries](../tests/series-browser.test.mjs): metadados/cookies do contrato novo; não usados como prova da criptografia |
| Backend | [auth.service.ts](../../Backend-Blog/src/modules/auth/auth.service.ts), [controller](../../Backend-Blog/src/modules/auth/auth.controller.ts), [testes do controller](../../Backend-Blog/src/modules/auth/auth.controller.spec.ts), [criptografia/Origin](../../Backend-Blog/src/modules/auth/refresh-recovery-v2.ts), [integrações](../../Backend-Blog/src/modules/auth/refresh-concurrency.integration.spec.ts), [novo teste criptográfico](../../Backend-Blog/src/modules/auth/refresh-recovery-v2.spec.ts), [E2E legado](../../Backend-Blog/test/auth.e2e-spec.ts) e [Swagger](../../Backend-Blog/src/docs/decorators/auth.decorator.ts) |
| Evidências | Este relatório, backlogs e avisos nos relatórios pré-deploy anteriores; guia operacional V2 no Backend-Blog |

## Resultados finais

| Verificação | Resultado |
| --- | --- |
| Frontend lint | Exit 0, zero erros, cinco avisos anteriores preservados |
| Frontend typecheck e build normal Turbopack | Exit 0 em ambos |
| Público / sessão / tema / Studio / administração | **17 / 28 / 12 / 13 / 8 aprovados**: 78 testes, zero falhas |
| Regressões de UI em Chromium com API simulada | **8/8 aprovados** |
| Matriz V2 real completa | **11 subtestes de cenários aprovados; 12 testes do runner contando o agrupador**, zero falhas ou skips |
| Repetição focada da corrida de logout administrativo, mantendo a requisição antiga viva na outra aba | **1 cenário aprovado; 2 testes contando o agrupador** |
| Backend lint | Exit 0, um aviso anterior do alias de enum |
| Backend typecheck e build | Exit 0; build em cópia temporária, preservando `dist/` original |
| Backend unitários + integrações reais | **64 arquivos, 448 testes aprovados**, zero falhas ou skips |
| Backend E2E HTTP | **38 aprovados e 1 skip** preexistente da newsletter V2 |
| Integrações de refresh no PostgreSQL | **17/17 aprovadas**, incluindo limpeza, capacidade, posse para avançar geração, logout concorrente e bloqueio de clientes legados sobre sessões V2 |
| Editor e `git diff --check` | Sem erros |

As regressões de UI foram atualizadas porque suas APIs simuladas só respondiam no contrato legado. Na primeira execução de duas fixtures, o helper tentava definir cookies depois de `writeHead`; o setup foi corrigido e a suíte final inteira passou. Na matriz real, a primeira injeção era consumida automaticamente pela navbar; a página técnica temporária passou a usar a exclusão de chrome existente, permitindo controlar precisamente o evento. Nenhuma expectativa de autorização foi relaxada.

### Matriz real coberta

1. Login/logout normal; saída elimina a sessão no PostgreSQL e impede restauração.
2. Recargas rápidas repetidas com a resposta da primeira rotação retida após commit; uma geração e uma operação confirmadas.
3. Oito consultas autenticadas simultâneas.
4. Duas abas no mesmo perfil Chromium, compartilhando cookies e Web Locks.
   Uma chamada legada adicional, com o cookie antigo ainda presente, recebe 400 e deixa a sessão V2 funcional.
5. Resposta descartada **depois** de a API confirmar a rotação; recarga recupera a mesma operação com o cookie de entrada.
6. 503 antes de chegar à API; mesma operação conclui depois, sem falso logout.
7. Expiração real do JWT de acesso e renovação; sessão expirada no banco é recusada e vira estado local de saída.
8. Logout em outra aba durante resposta de refresh retida; sessão permanece revogada.
9. Resposta g1 recebida após g2; cookie g2 permanece e a aba continua autenticada mesmo com g1 residual.
10. Administrador com TOTP real, rejeição de código incorreto, recuperação do BFF e logout sem afetar a sessão pública.
11. Corpo truncado **depois** de Set-Cookie, com expiração posterior da recuperação; somente a posse do token/prova atuais permite avançar para g2.
12. Logout administrativo antigo retido enquanto outra aba conclui novo login com TOTP não reutilizado; a resposta antiga não apaga o login novo.

## Reprodução segura

Pré-requisitos: Node 24, dependências locais já instaladas, Docker com PostgreSQL 16, Redis 7 e Mailpit; Edge/Chromium e OpenSSL. Não é necessário instalar dependências do projeto. O teste exige opt-in e rejeita host de banco/SMTP fora de `127.0.0.1`, Redis fora do loopback e nome de banco sem prefixo `griforio_v2`.

Crie serviços **novos**, com nomes próprios, banco `griforio_v2`, usuário/senha exclusivamente sintéticos, porta aleatória ligada ao loopback e tmpfs PostgreSQL. Não reutilize o projeto/banco existente. Configure no processo que executará o teste: `DB_HOST=127.0.0.1`, porta publicada, `DB_USER`, `DB_PASSWORD`, `DB_NAME=griforio_v2`, `DB_SSL=false`; `REDIS_URL` local; `SMTP_HOST=127.0.0.1`, porta do Mailpit, usuário/senha sintéticos e remetente `example.test`; segredos JWT sintéticos distintos com 32+ caracteres, `TOTP_ENCRYPTION_KEY` sintética de 64 dígitos hexadecimais e `STORAGE_DRIVER=local`.

No PowerShell do frontend:

```powershell
$env:GRIFORIO_V2_ISOLATED = '1'
node --test --test-reporter=tap tests/session-v2-real-browser.test.mjs
```

Para repetir somente a corrida administrativa:

```powershell
$env:GRIFORIO_V2_CASE = '12'
node --test --test-reporter=tap tests/session-v2-real-browser.test.mjs
Remove-Item Env:GRIFORIO_V2_CASE
```

Para demonstrar o defeito antigo do logout, além do filtro `12`, defina `GRIFORIO_V2_REPRODUCE_OLD_LOGOUT=1`. Essa opção modifica **somente a cópia temporária** para reenviar a exclusão antiga. O teste falha com `late logout must preserve the new opaque cookie`. Remova a variável e execute novamente: o teste passa. Essa prova vermelha/verde foi executada; compara o cookie novo após o processamento da resposta antiga e usa leitura administrativa sem seguir redirects, evitando um falso sucesso na página de login.

`CHROME_PATH` e `OPENSSL_PATH` permitem informar os executáveis. A suíte copia código para pasta temporária **sem `.env`**, reutiliza dependências por junction/symlink, compila o backend e aplica migrations somente no banco isolado explicitamente configurado. Compila Next com Webpack na cópia temporária para suportar a junction externa; o build normal do repositório foi validado separadamente com Turbopack. A página `/admin/session-test` só existe nessa cópia e não integra o app versionado de produção.

Um gateway HTTPS com certificado temporário encaminha ao Next real; uma ponte de rede encaminha à API real e injeta falhas somente nos momentos programados. Não há endpoints de teste na API de produção. Chromium usa perfil temporário e ignora apenas o erro do certificado local autossinado; não desativa segurança web, SameSite ou HttpOnly. APIs recebem assinaturas/provas reais. PostgreSQL é consultado para conferir geração, número/ausência de sessões e efeitos reais. Não são impressos tokens, provas ou senhas.

Na execução desta preparação, apenas os contêineres `griforio-v2-pg`, `griforio-v2-redis` e `griforio-v2-mail` foram criados para a tarefa e parados ao final. Nenhum volume foi removido. Diretórios temporários de prova não foram publicados no repositório.

## Limites e riscos remanescentes

- **Recuperação finita:** o prazo é o menor entre a janela configurada (120 s por padrão) e os vencimentos dos tokens. O teste usa JWT de 12 s para provar expiração real rapidamente. Se corpo **e** cookies da saída se perderem e o prazo acabar, só há o token antigo: nova autenticação é obrigatória. Não se permite aceitá-lo arbitrariamente para prolongar a recuperação. Se o cookie atual já chegou, o avanço autenticado foi testado.
- **Persistência do BFF:** seu estado continua em memória de uma única instância. Restart/perda do processo encerra a sessão administrativa; réplicas sem estado compartilhado não são suportadas por esta entrega. Não habilitar escala horizontal contando apenas com estas provas.
- **Logout sem rede:** o estado local é encerrado imediatamente, mas uma revogação sem confirmação da API é reportada como incerta; não prometer revogação remota durante indisponibilidade. O tombstone impede restauração automática; no cliente público o logout pode ser repetido com cookies V2.
- **Sessões locais antigas:** coordenação legada sem `session_id`/prova V2 precisa de uma nova entrada; não foi criado fallback inseguro para o endpoint antigo.
- **Orçamento de cookies:** limites existentes de tamanho/duplicatas permanecem, sem truncamento que esconda credenciais ambíguas. Muitas sessões antigas, cookies forjados ou armazenamento indisponível podem exigir intervenção/reautenticação; não há garantia para navegador cujo armazenamento ou Web Locks foi bloqueado.
- **Cobertura de plataforma:** Chromium/Edge, duas abas e HTTPS local. Safari, Firefox, extensões interferindo em cookies, suspensão prolongada do dispositivo e falhas de infraestrutura Render não foram homologados nesta matriz.
- **Produção real:** certificado/HTTPS público, domínio, cadeia de proxy/IP/rate limiting, PostgreSQL/Redis externos, SMTP, armazenamento de uploads, backups e restauração ainda exigem homologação. Nenhum deploy foi realizado.

Não ficou identificado um cenário de perda indevida reproduzível **dentro da matriz e dos limites acima**. A liberação pública continua condicionada aos critérios operacionais e à decisão explícita sobre persistência/escala do BFF.
