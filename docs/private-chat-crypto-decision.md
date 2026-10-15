# ADR — evolução criptográfica do Private Chat

**Data:** 15 de outubro de 2026  
**Estado:** Olm Double Ratchet integrado localmente; validação operacional e revisão independente ainda são gates de lançamento.

## Implementação escolhida

A conversa usa [`@matrix-org/matrix-sdk-crypto-wasm` **18.9.0**](https://github.com/matrix-org/matrix-sdk-crypto-wasm), fixado no lockfile, licença Apache-2.0. O próprio WASM informa `vodozemac 0.11.0`. Utilizamos **Olm**, o protocolo Double Ratchet de conversas entre dois participantes, pelo método `Device.encryptToDeviceEvent`. Não utilizamos Megolm, salas Matrix, homeserver, backup de chaves ou sincronização HTTP.

O SDK não executa I/O de rede. O adaptador `src/lib/private-chat/ratchet.ts` alimenta localmente suas operações de consulta e reivindicação de chaves com os registros públicos recebidos pela Nym. Assim, usa a implementação mantida de assinaturas, estabelecimento de sessão e evolução de chaves, sem implementar um ratchet próprio. Os identificadores no formato Matrix são aleatórios por conversa e pertencem a um domínio `.invalid`; não são contas ou endereços de serviço.

A carga de WASM é servida pela origem da aplicação. Não carregar a biblioteca de CDN. A compilação servida, CSP, hidratação e carregamento do WASM no navegador precisam ser verificados juntamente com o build.

## Handshake e vínculo de identidade

1. O convite Ed25519 continua vinculando o alias, chave X25519 da aba, endereço Nym e prazo de cinco minutos.
2. Ao pedir conversa, o solicitante cria uma máquina Olm nova em memória, exclusivamente para essa conversa, e envia seu bundle público no pacote `request` versão **3**, protegido pelo `crypto_box` autenticado existente.
3. Depois do aceite explícito, o convidante cria outra máquina nova e importa somente o bundle do solicitante autenticado. Sua resposta `accept` contém seu próprio bundle público e é autenticada pela chave do convite.
4. O solicitante verifica esse bundle e cria a sessão de saída usando a chave de uso único assinada do convidante. A primeira mensagem Olm contém o prekey; o convidante cria a sessão de entrada ao recebê-la.
5. `resume`, `ready`, `text`, `ack` e `bye` passam obrigatoriamente pelo Olm. Cada conteúdo cifrado inclui o ID da conversa e as duas chaves X25519 externas, além do pacote da aplicação. O receptor verifica esses vínculos, identidade Olm de origem/destino, tipo de evento e IDs externo/interno antes de aplicar o pacote.

Os bundles são aceitos somente após autenticação do envelope. O SDK verifica os registros de dispositivo. Como uma resposta inválida de reivindicação de chave pode ser ignorada sem rejeitar a Promise do SDK, o adaptador também verifica explicitamente a assinatura Ed25519 do registro canônico de chave de uso único com libsodium antes de importá-lo. Os testes cobrem adulteração dos dois registros.

A chave Olm do contato fica fixa durante a conversa; tentativa de trocar o bundle falha. O código de segurança existente compara as chaves autenticadas das abas, às quais os bundles Olm foram vinculados. Ele não verifica identidade civil. A proteção contra interceptação depende de compartilhar/verificar o convite e, quando necessário, comparar o código de segurança por outro canal confiável.

O envelope `crypto_box` permanece por fora como autenticação da aba e encapsulamento. Comprometer essa chave estática não fornece as chaves Olm de uma conversa passada. Não se deve confundir isso com uma prova de resistência a comprometimento completo de memória ou de navegador.

## Estado, limites e reconexão

- `OlmMachine.initialize` é chamado **sem nome de store**, selecionando armazenamento apenas em memória. Não há exportação/persistência de estado Olm, IndexedDB de conversa, cópia de chaves em logs ou recuperação por backup.
- Há uma máquina por conversa e apenas um contato importado. O SDK gera um conjunto limitado de chaves de uso único; apenas uma é incluída no bundle. Não há reposição pública, fallback key compartilhada nem reutilização da conta em outra conversa.
- O adaptador serializa suas operações, limita trabalho pendente a oito e recusa novos trabalhos imediatamente após `close`. O fechamento libera a máquina Rust após a operação já em curso. Não prometemos apagamento físico completo de memória JavaScript/WASM pelo navegador.
- Olm avança chaves por mensagem e elimina chaves consumidas. Permite mensagens fora de ordem com retenção limitada: a implementação vodozemac conserva até 40 chaves puladas por cadeia receptora (até 200 entre cadeias) e recusa saltos maiores que 2.000 mensagens. Atrasos maiores que essa janela podem tornar uma mensagem definitivamente indecifrável. Não aumentamos esses limites.
- A aplicação limita o texto a 400 caracteres e o histórico da aba a 200 mensagens. O adaptador aceita no máximo 3.072 bytes de plaintext e 6.500 bytes de conteúdo cifrado; o envelope externo tem limite próprio. Tamanho de mensagem e frequência continuam potencialmente observáveis no transporte.
- Desconectar/reconectar a Nym preserva a mesma máquina Olm na aba. Mensagens de atualização de rota são cifradas e sequenciadas. Repetir um `request`/`accept` perdido utiliza o mesmo bundle; não substitui a sessão.
- Uma tentativa de reenvio de mensagem gera nova cifra Olm com o mesmo ID de aplicação. O receptor reconhece esse ID, evita exibir duplicata e emite novo recibo. Repetir os mesmos bytes Olm é recusado pelo protocolo.
- Encerrar conversa, sair da página ou trocar identidade descarta a máquina. Recarregar a aba perde a sessão e exige novo convite. Não existe downgrade para texto protegido somente pela chave estática, transporte direto ou sessão legada.

## Evidência automatizada

`src/lib/private-chat/ratchet.test.ts` executa o WASM real, não um mock. Os nove testes passaram nesta implementação e cobrem:

- handshake, troca bidirecional e cifras diferentes para plaintext repetido;
- repetição da cifra original e repetição com ID Matrix alterado;
- chegada fora de ordem e descarte além da janela de chaves puladas;
- contato não autorizado, adulteração da cifra e recuperação após pacote inválido;
- vínculo de conversa e das duas identidades externas;
- assinaturas inválidas de dispositivo e chave de uso único, e recusa de troca de contato;
- limites de tamanho, campos extras, falta de aceite e fechamento;
- incapacidade de uma máquina recém-criada, com os mesmos vínculos externos, de abrir cifra de uma sessão anterior.

Esses testes validam a adaptação observável. Não simulam extração de todo o estado secreto do motor, nem demonstram por si mesmos sigilo futuro ou recuperação pós-comprometimento do produto. Essas propriedades dependem do protocolo mantido, eliminação de estado, integridade do dispositivo, trocas de ratchet posteriores e revisão da integração.

## Compatibilidade e gates restantes

O protocolo da aplicação agora exige versão **3** e bundles Olm no pedido/aceite. Os clientes anteriores são rejeitados; não há negociação de versão mais fraca. Os dois usuários do piloto precisam receber o mesmo build.

Antes de publicação aberta:

1. Concluir build e testar o resultado servido, incluindo carregamento de WASM com CSP, desktop/mobile e limpeza de página/BFCache.
2. Validar duas sessões independentes na Nym real, incluindo aceite, mensagens, recibos, perda de conexão, retomada e rejeição de downgrade. Dois processos no mesmo computador comprovam transporte real, mas não substituem a matriz de dois aparelhos/redes e navegadores móveis.
3. Validar o diretório com cliente Nym nativo/SURB, sem fallback, e os procedimentos de identidade estável, armazenamento, reinício e limites de capacidade.
4. Submeter protocolo, bindings, estado, aplicação e implantação a **revisão criptográfica independente**. A auditoria da dependência não cobre esta adaptação nem certifica o OpenZcash.

A Nym fornece proteção de metadados durante o transporte. O carregamento HTTPS, serviço de topologia e gateway de entrada continuam tendo visibilidade de IP de conexão; ratchet não remove essa limitação. Navegador ou aparelho comprometido pode acessar mensagens e estado ativos. Não anunciar “privacidade máxima” ou equivalência ao Signal.

## Fontes primárias

- [API oficial — Device.encryptToDeviceEvent](https://matrix-org.github.io/matrix-sdk-crypto-wasm/classes/Device.html#encrypttodeviceevent)
- [API oficial — OlmMachine e store em memória](https://matrix-org.github.io/matrix-sdk-crypto-wasm/classes/OlmMachine.html)
- [matrix-sdk-crypto-wasm — binding, carregamento e ausência de I/O de rede](https://github.com/matrix-org/matrix-sdk-crypto-wasm)
- [vodozemac — Olm e auditoria](https://github.com/matrix-org/vodozemac)
- [Limites de chaves puladas e de salto no código vodozemac](https://matrix-org.github.io/vodozemac/src/vodozemac/olm/session/receiver_chain.rs.html)
- [Relatório da auditoria independente do vodozemac](https://matrix.org/media/Least%20Authority%20-%20Matrix%20vodozemac%20Final%20Audit%20Report.pdf)
- [Especificação de referência — Double Ratchet](https://signal.org/docs/specifications/doubleratchet/)
