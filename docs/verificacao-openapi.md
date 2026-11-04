# Verificação parcial do Swagger do backend

Execute a partir da pasta do frontend no Windows:

```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/check-backend-openapi.ps1
```

O caminho padrão é o projeto irmão `Backend-Blog`; use `-BackendPath` para outro checkout. São necessárias as dependências já instaladas do backend. O comando executa `src/docs/swagger.spec.ts` nesse checkout e retorna erro se o teste falhar. Ele não inicia a aplicação nem precisa de PostgreSQL, Redis ou credenciais: o módulo Nest do teste substitui os serviços por objetos vazios. Não altera o backend nem acessa o banco original. Em 04/11/2026, no commit `f89622ec911fbe69a8f7fb2f46b179444733c04b`, passou com 2 testes.

Esse teste gera um documento OpenAPI em memória e verifica operações e propriedades selecionadas, além da desativação do Swagger em produção. Ele é uma verificação parcial, não uma fotografia completa do contrato nem uma prova do comportamento HTTP ou das permissões reais. O teste monta uma lista explícita de controllers e uma configuração `DocumentBuilder` própria; por exemplo, não inclui `CategoriesController` nem `TagsController`, e sua configuração não é idêntica à de `src/docs/swagger.config.ts`. Uma rota adicionada fora dessa lista pode não aparecer sem fazer o teste falhar. O Swagger da API configurada em produção é desativado, portanto não é possível exportar o documento completo pela instância de produção existente.

Para uma exportação e comparação completa e reproduzível, o backend precisa fornecer um gerador que use os módulos e a configuração efetivos da aplicação, com dependências externas substituídas por fixtures, além de uma referência versionada e verificação de diferenças. Até existir essa fonte completa, revise controllers, DTOs, guards e testes relevantes diretamente e valide os fluxos HTTP reais em ambiente de teste. Não trate o sucesso deste script como conclusão da Sprint 0 ou como garantia de compatibilidade integral.
