# Verificação — Discover pela Nym

15/10/2026, preview `http://127.0.0.1:4430/private-chat`, branch `michae2xl/private-chat`.

## Resultados confirmados

- 96 testes em 16 arquivos passaram, cobrindo diretório cifrado, pinagem da chave do provedor, corrupção/replay, limites de paginação, timeout sem fallback, expiração local de presença, convites/aceite, deduplicação, reconexão, UI e proteção de produção.
- TypeScript e ESLint dos arquivos do chat passaram. `git diff --check` passou.
- Consulta ao registro de vulnerabilidades: zero alertas conhecidos nas dependências de produção. Isso não substitui auditoria criptográfica ou de infraestrutura.
- A antiga rota HTTP foi consultada diretamente no preview e respondeu 410.

## Navegador com Nym real

Duas abas independentes, Alice e Bob, com identidades e credenciais de transporte separadas. O diretório também executou um cliente Nym real em outro processo. Nenhuma etapa abaixo usou o diretório em memória injetado pelos testes unitários.

1. Alice ligou Nym, verificou a rota, criou a sala e habilitou disponibilidade. Bob entrou pelo link, ligou Nym e encontrou Alice no Discover.
2. Bob enviou o pedido; Alice recebeu e aceitou explicitamente. Os dois lados passaram para **Encrypted conversation**.
3. Duas mensagens, incluindo emoji, foram entregues e confirmadas nos dois sentidos.
4. A internet da aba Bob foi temporariamente desativada pela ferramenta de teste. O switch permaneceu ligado enquanto a intenção era reconectar.
5. Bob desligou o switch durante a queda. A rede foi restaurada e o switch permaneceu desligado; Discover mostrou **Discover paused**, sem lista antiga nem atualização direta.
6. Alice enviou uma mensagem durante a queda. Sem confirmação, a UI mudou para **No confirmation** e iniciou a verificação do contato.
7. Bob voltou a ligar Nym. A rota e a conversa dos dois lados foram recuperadas sem usar **Check connection** manualmente.
8. Alice clicou Retry. A mensagem apareceu exatamente uma vez em Bob e foi confirmada; Bob enviou nova mensagem, também entregue.
9. A captura de rede da aba Alice registrou 87 pedidos da página/recargas durante a preparação e zero pedidos a `/api/private-chat/presence`; a segunda leitura durante conversa, queda e recuperação registrou zero pedidos adicionais. A ausência do caminho HTTP também foi verificada no código e por testes de timeout/desconexão. Essa captura não pretende observar todo o tráfego da máquina nem esconder o carregamento inicial do site.
10. Ambas as sessões sintéticas foram encerradas e apagadas da UI. A emulação offline foi removida e a segunda aba fechada. O preview foi deixado aberto no estado inicial, com o diretório rodando.
11. Tela de 375 px: Discover pausado e ajuda legíveis; largura útil/documento de 360 px, sem transbordamento horizontal. A largura normal foi restaurada após o teste.

A expiração local da lista foi acrescentada após o teste de conversa, verificada por regressão automatizada e seguida de nova checagem de UI móvel. Não foi necessário repetir mensagens reais: o protocolo de conversa e reconexão não mudou nessa última correção.

## Evidências

- [Conversa e reenvio confirmado](conversation.jpg)
- [Discover fechado com Nym desligada](paused.jpg)
- [Discover em tela pequena](mobile.jpg)
- [Arquitetura, execução e limitações](../../private-chat-discover-nym.md)

Não houve publicação em produção. O serviço permanece experimental: o diretório vê o endereço Nym temporário de retorno e metadados dos pedidos; hospedagem/bootstrap continuam fora do túnel; abuso distribuído, operação persistente do provedor e auditoria independente continuam pendentes.
