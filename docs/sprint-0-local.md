# Ambiente local isolado da Sprint 0

O [Compose de teste](../compose.sprint0.yml) prepara PostgreSQL, Redis e Mailpit apenas para dados sintéticos. Os serviços ficam ligados a `127.0.0.1`: PostgreSQL 15433, Redis 16380, SMTP 11025 e interface do Mailpit 18025. O projeto Compose e seu volume de banco têm nomes próprios; não são os volumes do backend. O Mailpit aceita qualquer autenticação SMTP sem TLS para que o backend possa enviar mensagens de teste; essa configuração é exclusivamente local e não deve ser exposta ou usada em produção.

## Iniciar serviços

No PowerShell, na pasta do frontend, com Docker Desktop ativo:

```powershell
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 15433,16380,11025,18025,3001 }
docker compose -f compose.sprint0.yml config --quiet
if ($LASTEXITCODE -ne 0) { throw "Configuração Compose inválida." }
docker compose -f compose.sprint0.yml up -d
if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar os serviços de teste." }
docker compose -f compose.sprint0.yml ps
```

Se alguma porta já estiver ocupada, não execute `up`: descubra a origem e escolha portas livres no Compose e na configuração da API. Aguarde PostgreSQL e Redis ficarem saudáveis. O Mailpit fica em `http://127.0.0.1:18025`; use exclusivamente endereços e conteúdos fictícios.

## Executar uma cópia isolada da API

O backend lê `.env` do diretório atual e grava uploads nele. Para não tocar no ambiente, arquivos de upload ou dados do backend existente, abra um novo PowerShell e prepare uma cópia temporária sem `.env`, uploads, dependências, build ou Git. O comando abaixo cria um diretório novo com nome único; não apaga nem sobrescreve a pasta original. Confira que o código-fonte local é o desejado antes de copiar.

```powershell
$sprint0Copy = Join-Path $env:TEMP ("front-blog-sprint0-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $sprint0Copy | Out-Null
robocopy C:\Users\otavv\Documents\Backend-Blog $sprint0Copy /E /XD .git node_modules dist uploads /XF .env* /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar o backend de teste." }
Set-Location $sprint0Copy
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependências na cópia de teste." }
```

Na mesma janela, defina todas as variáveis abaixo antes de executar migrations e API. Os valores são fixtures descartáveis, não credenciais reais. Faça isso em uma janela limpa, sem outras variáveis de integração, OAuth ou observabilidade herdadas. Ajuste a origem do frontend caso a porta 3000 esteja ocupada; `localhost` deve ser usado de forma consistente no navegador para os cookies.

```powershell
$env:NODE_ENV = 'development'
$env:PORT = '3001'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '15433'
$env:DB_USER = 'sprint0_test'
$env:DB_PASSWORD = 'sprint0_test_only'
$env:DB_NAME = 'sprint0_blog_test'
$env:REDIS_URL = 'redis://127.0.0.1:16380'
$env:JWT_SECRET = 'sprint0-test-only-access-secret-123456789'
$env:JWT_REFRESH_SECRET = 'sprint0-test-only-refresh-secret-12345678'
$env:FRONTEND_URL = 'http://localhost:3000'
$env:PUBLIC_API_URL = 'http://localhost:3000'
$env:SMTP_HOST = '127.0.0.1'
$env:SMTP_PORT = '11025'
$env:SMTP_USER = 'sprint0_test'
$env:SMTP_PASS = 'sprint0_test_only'
$env:SMTP_FROM = 'blog@example.test'
npm.cmd run migration:run
if ($LASTEXITCODE -ne 0) { throw "Falha nas migrations do banco de teste." }
npm.cmd run start:dev
```

Confirme que migrations concluíram sem erro antes de iniciar a API; interrompa se isso não ocorrer. Configure `API_ORIGIN=http://localhost:3001` no ambiente local do frontend. Verifique a saúde em `http://localhost:3001/api/v1/health`. Para e-mails e cookies na origem pública, o encaminhamento de `/api/v1` e `/uploads` ainda precisa estar configurado e testado; essas instruções não comprovam o proxy, HTTPS ou a integração.

Para parar os serviços sem apagar o volume de teste, use `docker compose -f compose.sprint0.yml down` na pasta do frontend. A cópia temporária e o volume permanecem para inspeção. Não utilize `down -v` sem conferir o projeto e a necessidade de descartar os dados.
