# Private Chat — verificação preliminar do transporte Nym

Data da consulta: **15 de outubro de 2026**.

Status: **piloto local atualizado em 15 de outubro de 2026**. A primeira prova do transporte usou convites versão 2. O preview atual utiliza convites assinados versão 3, aceite explícito e salas de descoberta por link com presença cifrada no navegador. Duas abas independentes conectaram à Nym, se encontraram no Discover, aceitaram a conversa e confirmaram mensagens nos dois sentidos. Os resultados e limites atuais estão em [Private Chat — preview](private-chat-preview.md). As seções abaixo preservam a pesquisa preliminar do SDK; hipóteses antigas não substituem o estado descrito no documento do preview. Produção permanece desabilitada.

## O que foi verificado

Foram consultadas a documentação oficial, os metadados públicos do npm, o código-fonte oficial e os arquivos dos pacotes publicados. Os tarballs foram lidos em memória, sem instalação nem execução. Também foram feitas requisições de leitura a endpoints públicos de topologia.

| Pacote npm                    | Versão `latest` consultada | Conteúdo observado                                                                         |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| `@nymproject/sdk`             | `1.4.1`                    | `index.js` de 18.724 bytes e `web-worker-0.js` de 5.034.097 bytes; WASM embutido no worker |
| `@nymproject/sdk-full-fat`    | `1.4.1`                    | `index.js` de 6.732.009 bytes, com worker embutido                                         |
| `@nymproject/nym-client-wasm` | `1.4.1`                    | módulo JavaScript, tipos e `nym_client_wasm_bg.wasm` de 3.700.404 bytes                    |

Esses tamanhos são dos arquivos descompactados, não do tráfego comprimido servido ao navegador. O `time.modified` do registro npm não deve ser interpretado como a data de publicação da versão.

A documentação de zk-nym afirma que integrações SDK atualmente conectam à mixnet sem credenciais. Isso permite tentar a prova técnica sem pedir carteira ou tokens ao usuário; não garante acesso permanente gratuito nem comprova que a versão consultada conecta hoje.

## Diferenças entre documentação e pacote publicado

O quick-start atual descreve `createNymMixnetClient`, `start`, `send`, eventos de recebimento e `stop`. O contrato publicado exige alguns cuidados adicionais:

- `selfAddress()` retorna `Promise<string | undefined>`. O exemplo resumido que usa o resultado sem `await` não corresponde a esse tipo.
- O quick-start mostra `replyWithSurb()` e `senderTag` no evento de texto. Esses membros não aparecem na interface pública do wrapper `@nymproject/sdk@1.4.1` inspecionado. Não implementar respostas anônimas com base apenas nesse exemplo.
- O worker standard é carregado pelo endereço relativo fixo `web-worker-0.js`; as opções públicas não oferecem um caminho alternativo. Copiar arquivos ou importar o pacote, por si só, não prova que o worker será encontrado em todas as rotas do Next.
- Os tipos do SDK importam `@nymproject/nym-client-wasm`, mas seu `package.json` publicado não declara essa dependência. A instalação e a resolução de tipos precisam ser verificadas explicitamente.
- O fluxo principal de publicação descrito no repositório inclui `mix-tunnel`, `mix-fetch`, `mix-dns` e `mix-websocket`. Os diretórios v1 do SDK bruto estão fora desse fluxo. A existência do pacote npm não comprova a compatibilidade atual nem o mesmo nível de cobertura de testes dos pacotes novos.

`mix-fetch` e `mix-websocket` encaminham tráfego a serviços externos. Eles não são substitutos equivalentes para mensagens diretas entre dois clientes Nym.

## Estados que o wrapper não comprova

No `web-worker-0.js` publicado de `@nymproject/sdk@1.4.1`:

| Operação               | Comportamento observado                                                      | Consequência para o produto                                                                            |
| ---------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `start()`              | Dispara `startHandler` sem devolver sua promessa e captura falhas no console | `await start()` não comprova conexão; aguardar evento `Connected` com endereço válido e timeout        |
| `send()` / `rawSend()` | Disparam o envio e capturam falhas no console                                | O retorno não comprova aceitação pelo transporte nem entrega ao destinatário                           |
| `stop()`               | Libera a instância com `free()`; o wrapper não expõe `worker.terminate()`    | Testar cancelamento durante o handshake e impedir que uma conexão tardia permaneça ativa após desligar |
| Inicialização          | Registra o objeto de configuração no console                                 | Não fornecer passphrase secreta a esse wrapper sem corrigir o comportamento de log                     |

Uma mensagem só pode aparecer como entregue após confirmação do outro cliente. Uma confirmação local do SDK não deve produzir esse estado. Eventos recebidos também precisam de validação, deduplicação e vínculo autenticado com a conversa; o alias informado no conteúdo não é prova da identidade do remetente.

## API pública de rede consultada

Base usada na documentação: `https://validator.nymtech.net/api`.

| Caminho consultado               | Resultado HTTP na consulta |
| -------------------------------- | -------------------------- |
| `/v1/api-status/health`          | 200                        |
| `/v1/unstable/nym-nodes/skimmed` | 200                        |
| `/v1/nym-nodes/bonded`           | 200                        |
| `/v1/gateways`                   | 404                        |
| `/v1/mixnodes/active`            | 404                        |
| `/v1/nym-nodes/skimmed`          | 404                        |
| `/v1/epoch/rewarded-set`         | 404                        |

Isso confirma que os endpoints consultados responderam. Não confirma quais rotas o WASM publicado utiliza, handshake com gateway, transporte de mensagens, latência ou estabilidade. Os caminhos `unstable` não devem ser tratados como contrato permanente.

## Próxima prova técnica proposta

Avaliar `@nymproject/nym-client-wasm@1.4.1` em um **worker próprio**, com assets servidos pela mesma origem e versão fixada. Seu contrato publicado expõe `NymClient`, `selfAddress`, `send_regular_message`, `send_anonymous_message`, `send_reply` e `free`. A abordagem é uma hipótese de implementação, ainda não validada em execução.

O worker controlado deve propagar falhas, permitir timeout e encerramento imediato, invalidar operações pendentes ao desconectar e evitar logs de conteúdo, endereços de conversa ou segredos. Não alterar parâmetros que removem cobertura ou atrasos de mistura para melhorar artificialmente os resultados. Verificar também a opção de desativar estatísticas do cliente sem alterar essas proteções.

Contrato mínimo sugerido para o adapter:

- `connect(identityId, signal)` resolve somente com endereço válido após conexão real.
- `send(recipient, envelope)` retorna um estado de submissão comprovado pelo código executado; entrega depende de confirmação autenticada do destinatário.
- `subscribe(listener)` recebe apenas bytes; validação e protocolo de conversa ficam em camada separada.
- `disconnect()` encerra o worker, remove listeners e impede callbacks antigos de reativarem a sessão.
- Estados distintos: desconectado, conectando, conectado e falha. Nunca substituir uma falha por conexão simulada ou reenvio pela internet comum.

A disponibilidade pública é outro contrato: desligada por padrão, consentida e com expiração. Não publicar presença quando o transporte estiver indisponível. Desligar a descoberta não deve interromper conversas existentes; encerrar a conexão é uma ação distinta.

## Next e política de segurança

O projeto inspecionado usa Next `16.3.8`. A integração deve ser carregada apenas no navegador após ação do usuário. Não há prova de compatibilidade do pacote com o build atual, Turbopack, navegadores móveis ou CSP de produção.

A compilação de WASM exige uma política apropriada, e a conexão necessita dos destinos HTTPS de bootstrap e WSS do gateway. O full-fat também pode exigir permissão para worker `blob:`. O piloto usa worker e WASM locais. A exceção de CSP existe só no preview de desenvolvimento, porque os gateways não cabem numa lista fixa de hostnames. Produção e os outros ambientes permanecem em `connect-src 'self' blob:`. Conferir os cabeçalhos efetivos da página e do worker no piloto.

A integração JavaScript não protege automaticamente o carregamento inicial da página HTTPS, cookies, recursos externos nem outros endpoints do OpenZcash.

## Critérios de aceite antes de habilitar mensagens reais

1. Dois navegadores ou contextos isolados criam identidades independentes e recebem confirmação real de conexão. Carregar o worker ou resolver uma promessa não basta.
2. A envia um texto com identificador único a B; B confirma o conteúdo recebido; B envia outro a A. Registrar somente evidência técnica sem segredos ou conteúdo privado.
3. Confirmações de entrega são autenticadas e pertencem à conversa correta. Repetições, mensagens fora de ordem e payloads inválidos não duplicam conteúdo nem mudam a identidade do contato.
4. Cancelar durante o handshake e desconectar após a conexão encerra o worker e seu tráfego. Callbacks tardios não publicam presença nem restauram a sessão.
5. Gateway indisponível, timeout, perda de rede e tentativa de reconexão produzem estados verdadeiros. Não há fallback automático fora da mixnet.
6. Convites e informações públicas de contato não transportam chaves privadas. Verificar o vínculo entre chave, contato e conversa; não confiar apenas em alias ou endereço inserido no payload.
7. O teste passa no build de produção com CSP efetiva e nos navegadores escolhidos. Medir tempo de conexão, entrega, uso de rede e comportamento móvel; não publicar números estimados como resultados.
8. Disponibilidade começa desligada; apenas o consentimento explícito publica uma entrada temporária. Desligar remove a entrada e preserva conversas já aceitas. Nenhum usuário fictício aparece como online.
9. Avaliar persistência de identidade, limpeza de dados e perda do dispositivo antes de prometer recuperação. Mensagens offline e múltiplos dispositivos ficam fora da primeira prova.

## Fontes primárias

Documentação:

- [SDK TypeScript](https://nym.com/docs/developers/typescript)
- [Quick-start](https://nym.com/docs/developers/typescript/quick-start)
- [Contrato Client](https://nym.com/docs/developers/typescript/api/sdk/interfaces/Client)
- [Bundling e CSP](https://nym.com/docs/developers/typescript/bundling/bundling)
- [Limites e ausência de descoberta de endereços](https://nym.com/docs/developers/limitations)
- [Credenciais zk-nym e acesso atual dos SDKs](https://nym.com/docs/network/cryptography/zk-nym/zk-nym-overview)

Pacotes consultados, com versão explícita:

- [npm: sdk 1.4.1](https://www.npmjs.com/package/@nymproject/sdk/v/1.4.1) · [tarball inspecionado](https://registry.npmjs.org/@nymproject/sdk/-/sdk-1.4.1.tgz)
- [npm: sdk-full-fat 1.4.1](https://www.npmjs.com/package/@nymproject/sdk-full-fat/v/1.4.1) · [tarball inspecionado](https://registry.npmjs.org/@nymproject/sdk-full-fat/-/sdk-full-fat-1.4.1.tgz)
- [npm: nym-client-wasm 1.4.1](https://www.npmjs.com/package/@nymproject/nym-client-wasm/v/1.4.1) · [tarball inspecionado](https://registry.npmjs.org/@nymproject/nym-client-wasm/-/nym-client-wasm-1.4.1.tgz)

Repositório oficial; links de `develop` são mutáveis e devem ser revalidados antes da implementação:

- [Publicação TypeScript](https://github.com/nymtech/nym/blob/develop/ts-sdk-publishing.md)
- [Tipos do wrapper SDK](https://github.com/nymtech/nym/blob/develop/sdk/typescript/packages/sdk/src/mixnet/wasm/types.ts)
- [Manifesto-fonte do SDK](https://github.com/nymtech/nym/blob/develop/sdk/typescript/packages/sdk/package.json)

Endpoints lidos:

- [Saúde da API](https://validator.nymtech.net/api/v1/api-status/health)
- [Topologia resumida](https://validator.nymtech.net/api/v1/unstable/nym-nodes/skimmed)
- [Nós vinculados à rede](https://validator.nymtech.net/api/v1/nym-nodes/bonded)
