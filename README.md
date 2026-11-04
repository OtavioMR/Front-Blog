# Frontend do blog

Base inicial em Next.js App Router, React e TypeScript. A página inicial consulta artigos públicos e busca na API; o desenvolvimento das demais jornadas está em andamento.

## Executar localmente

Requer Node.js compatível com o Next.js instalado. No Windows PowerShell:

```powershell
npm.cmd install
npm.cmd run dev -- -p 5173
```

Abra http://localhost:5173. Para o container `backend-blog` existente, copie `.env.example` para `.env.local` e configure `API_ORIGIN=http://localhost:3000` e `SITE_ORIGIN=http://localhost:5173`. A origem da API não deve conter barra final nem `/api/v1`. O arquivo local não deve ser versionado. A topologia de produção e a passagem de cookies e uploads ainda precisam ser verificadas na Sprint 0. Sem API acessível, a página informa que os artigos estão indisponíveis.

`SITE_ORIGIN` define a origem pública canônica, sem barra final, e deve corresponder a `FRONTEND_URL` do backend para que sitemap e feeds apontem para o site correto.

O proxy exige `Origin` igual a `SITE_ORIGIN` nas mutações de `/api/v1`. Em produção, o backend deve ficar privado ou ter proteção equivalente em todas as entradas; essa verificação não substitui autorização. Login e restauração dependem de Web Locks e BroadcastChannel; uma renovação de resultado incerto exige nova entrada. As provas de duas abas, HTTPS e encaminhamento de IP ainda fazem parte da Sprint 0.

Para verificar as jornadas públicas com respostas simuladas, execute `npm.cmd run build` e depois `npm.cmd run test:public`. Esse teste não substitui a integração com o backend real.

Execute `npm.cmd run test:session` para os testes simulados de coordenação de sessão.

Para o teste editorial em navegador com API simulada, execute `npm.cmd run test:editorial-e2e`. No Windows, o teste usa o Microsoft Edge instalado; em outros ambientes, informe o executável Chromium pela variável `CHROME_PATH`. Ele não usa o banco do backend e não substitui a validação integrada com a API real.

O usuário prefere usar o projeto Docker existente `backend-blog` para o backend e banco. O Compose da Sprint 0 foi criado para os testes sintéticos já executados; preserve seus volumes e consulte o backlog antes de mudar a topologia ou executar operações no banco existente.

Consulte [BACKLOG.md](BACKLOG.md) para o andamento e [AGENTS.md](AGENTS.md) para as regras do projeto.
