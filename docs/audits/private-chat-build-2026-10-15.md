# Private Chat: build e resposta servida — 15/10/2026

O build de produção completo passou, incluindo a integração do ratchet. O servidor local de produção passou em **68 verificações HTTP**, com a página renderizada e 35 scripts usando o nonce correto. Não houve publicação.

## Ambiente e execução

- Worktree `private-chat`, branch `michae2xl/private-chat`; alterações locais ainda sem commit.
- Node 26.5.0; Next 16.3.8; Turbopack padrão; pacote Matrix WASM fixado em 18.9.0.
- `npm run build` completo: prebuild, contratos, compilação, TypeScript, 36 páginas e otimização concluídos, exit 0.
- Build final com cache: compilação 5,1s; TypeScript 6,1s; geração de páginas 439ms.
- Saída separada em `.next-chat-build`, agora ignorada junto aos outros `.next-chat-*`. Preview de desenvolvimento preservado em 4430.
- Recursos limitados a dois workers de geração (`CIRCLE_NODE_TOTAL=3`), `RAYON_NUM_THREADS=2` e heap Node de 2 GiB. O webpack interrompido na rodada anterior foi substituído pelo bundler padrão, sem desativar validações.
- Servidor `next start`, somente em 127.0.0.1:4435, com configuração sintética de piloto para os testes de origem e CSP. `chat.example` e `gateway.example:9001` não são endpoints reais.

## Dois problemas encontrados e corrigidos no servidor real

1. O Next reconstrói `nextUrl` com o endereço interno do listener; comparar diretamente sua origem bloqueava uma requisição legítima ao domínio público. O piloto agora confere Host canônico e esquema HTTPS, ignora X-Forwarded-Host e rejeita host malformado, outra origem ou HTTP. Regressão cobre servidor interno atrás do proxy, cabeçalhos forjados, userinfo, path e query.
2. A instrumentação iniciava coletores de notícias, mercados, política, Zarvis e tarefas de banco também no piloto. Agora retorna antes desses imports/jobs quando PRIVATE_CHAT_DEPLOYMENT=pilot ou PRIVATE_CHAT_ISOLATED=true. Testes avançam sete horas e confirmam nenhum job/timer, preservando a coleta normal do portal.

Os testes de proxy e instrumentação passaram em **9/9**; lint dos quatro arquivos passou. A política operacional exige proxy TLS que preserve o Host público, sobrescreva os cabeçalhos de encaminhamento e mantenha privada a porta do Next.

## Verificações da resposta servida

- Página /private-chat: HTTP 200 e shell isolada renderizada.
- Nonce diferente a cada resposta; todos os 35 scripts com o nonce da CSP; cabeçalho forjado ignorado.
- strict-dynamic e wasm-unsafe-eval; sem unsafe-eval JavaScript ou exceção inline para scripts.
- connect-src limitado à origem, topologia Nym e gateway WSS exato; sem wildcard WSS.
- Documento com no-store, no-referrer, noindex e câmera/microfone bloqueados.
- Páginas/APIs alheias, subrota de chat, host inesperado e esquema HTTP: 404.
- Worker e assets Nym disponíveis com no-store; worker com política restrita e recurso same-origin.
- Scripts iniciais servidos pela própria origem.
- Asset WASM do ratchet servido com application/wasm; SHA-256 idêntico aos bytes do pacote oficial fixado.
- Inicialização do piloto sem os logs/jobs de coleta do portal que apareciam antes da correção.

## Alcance da evidência

Este relatório comprova build completo e HTTP servido em modo produção local. A configuração do descritor/gateway é sintética: estes checks **não** provam entrega Nym, execução/hidratação no navegador ou configuração de TLS/CDN em hospedagem real. O teste de duas sessões pela Nym é registrado separadamente. O piloto nativo com SURB e a revisão criptográfica independente permanecem avaliações separadas.

Evidências: [build](private-chat-build-2026-10-15/build.log), [68 checks HTTP](private-chat-build-2026-10-15/served-checks.json), [hashes do código verificado](private-chat-build-2026-10-15/source-sha256.json), [startup do servidor](private-chat-build-2026-10-15/server.log).
