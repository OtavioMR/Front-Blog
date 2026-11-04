param(
    [string]$BackendPath = (Join-Path $PSScriptRoot '../../Backend-Blog')
)

$ErrorActionPreference = 'Stop'
$backend = (Resolve-Path -LiteralPath $BackendPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $backend 'src/docs/swagger.spec.ts'))) {
    throw 'Teste Swagger do backend não encontrado.'
}
if (-not (Test-Path -LiteralPath (Join-Path $backend 'node_modules/.bin/vitest.cmd'))) {
    throw 'Dependências do backend indisponíveis; instale-as no projeto backend antes de executar.'
}

Push-Location -LiteralPath $backend
try {
    & npm.cmd run test -- src/docs/swagger.spec.ts
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
