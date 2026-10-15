# Private Chat — revisão interna de segurança

Data: 15/10/2026. Branch `michae2xl/private-chat`. Revisão do código atual do protocolo v3, controlador, Nym WASM, diretório nativo, isolamento Next e declarações de privacidade. **Isto é revisão interna, não auditoria criptográfica independente.** Não houve publicação.

## Resultado e evidência

Não identifiquei caminho de downgrade para mensagem de conversa cifrada apenas pela chave estática, execução de HTML de mensagens ou fallback HTTP do Discover. O controlador só aceita `text`, `ack`, `resume`, `ready` e `bye` após descriptografia Olm e conferência do contato, conversa e IDs externo/interno. O convite assinado vincula chave, endereço e validade; os bundles Olm chegam dentro do envelope autenticado. A instância Olm usa armazenamento somente em memória, confirmado pela [API oficial](https://matrix-org.github.io/matrix-sdk-crypto-wasm/classes/OlmMachine.html#initialize).

O diretório exige prova da sala, limita tamanhos, concorrência e replay, e no piloto responde por SURB sem endereço de retorno. Ele ainda vê o ID da sala, horário do pedido e a chave pseudônima que liga publicações de presença durante uma sessão. A [documentação Nym](https://nym.com/docs/developers/what-is-a-nym-client) confirma que SURBs permitem resposta sem revelar o endereço ao destinatário e que envio à fila não equivale a entrega. A página do piloto isola as rotas, aplica CSP com nonce, `no-store` e `no-referrer`; a verificação definitiva depende dos cabeçalhos no domínio HTTPS servido após CDN/proxy.

A suíte focada executada nesta revisão passou: **50/50 testes** em `ratchet.test.ts`, `controller.test.ts`, `presence-service.test.ts` e `pilot-proxy.test.ts`, com um worker. ESLint do FAQ passou. Após uma falha inicial de DNS, `npm audit --omit=dev --json` foi repetido nesta sessão e concluiu com **zero vulnerabilidades reportadas** nas dependências de produção. A [página oficial de segurança Matrix](https://github.com/matrix-org/matrix-sdk-crypto-wasm/security) não lista avisos próprios publicados; o [changelog](https://github.com/matrix-org/matrix-sdk-crypto-wasm/blob/main/CHANGELOG.md) registra a correção de sender binding em v18.3.0. O pacote fixado neste branch é 18.9.0. Esse exame de avisos não certifica a integração.

## Achados

| Prioridade | Achado | Estado |
| --- | --- | --- |
| Média | O serviço nativo aceitava um endereço Nym diferente após reinício e podia anunciar `ready` com um descriptor novo, enquanto clientes ainda apontavam para o endereço anterior. | Corrigido nesta branch: `binding.sealed` fixa endereço Nym e chave da aplicação antes da publicação de `descriptor.json`. A inicialização é explícita; o runtime exige volume inicializado e confere endereço e chave pública esperados. Endereço diferente ou volume vazio impedem `ready` e mantêm o descriptor anterior quando presente. Revisei o fluxo e os testes de reinício, troca de identidade e volume vazio; a suíte operacional correspondente passou 6/6, conforme o agente responsável, além de build e lint. A recuperação do volume real segue como validação do piloto. |
| Baixa | O FAQ dizia que o diretório sempre via um endereço Nym temporário, embora o piloto use resposta anônima por SURB. | Corrigido em `src/app/private-chat/chat-help.tsx`: agora distingue preview local e piloto. ESLint passou. |

## Riscos e limites de lançamento

- Na consulta de 15/10/2026, a [listagem oficial de releases da Nym](https://github.com/nymtech/nym/releases) e a [página da release exata](https://github.com/nymtech/nym/releases/tag/nym-binaries-v2026.20-glasgow) identificam `nym-binaries-v2026.20-glasgow`, versão fixada para o serviço nativo, como **Latest**. Antes de operar, conferir o hash do artefato exato, manter rollback e monitorar o piloto.
- A conexão ao cliente Nym nativo usa WebSocket de loopback sem autenticação própria. O host deve ser dedicado/confiável, com porta 1977 indisponível externamente; um processo local malicioso pode causar indisponibilidade. O processo Next também deve ficar acessível só pelo proxy HTTPS que sobrescreve Host e cabeçalhos de encaminhamento.
- O servidor HTTPS e o gateway de entrada Nym observam o IP de conexão. A biblioteca Nym pode manter dados cifrados de transporte no IndexedDB. A aplicação não promete apagamento forense nem privacidade contra dispositivo ou JavaScript comprometido.
- A adaptação do handshake Matrix, controle de estado e implantação **ainda requer revisão criptográfica independente**, incluindo cenários de comprometimento e testes adversariais. A auditoria publicada do vodozemac cobre a biblioteca, não este produto. Até lá, não anunciar equivalência ao Signal nem “privacidade máxima”.

A revisão externa deve receber `src/lib/private-chat/ratchet.ts`, `controller.ts`, `protocol.ts`, `envelope.ts`, `live-invite.ts`, `presence*.ts`, `directory-*.ts`, `scripts/private-chat-directory-server.ts`, `src/proxy.ts`, o runbook, o lockfile e a configuração real de ingress/volumes. Critérios de aceitação: não haver falha alta/crítica aberta, reproduzir convite/aceite/replay/reconexão/SURB, e conferir que logs/backup não retêm conteúdo ou segredos.
