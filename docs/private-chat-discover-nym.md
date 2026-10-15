# Discover pela Nym — revisão de 15/10/2026

Branch `michae2xl/private-chat`. Preview local; publicação em produção continua bloqueada.

## Estado atual do hardening (15/10/2026)

- **Room v2:** o link `ozroom2.` contém um segredo que deriva, com separação de domínio, a chave de cifragem dos convites e uma chave Ed25519 de autorização. O diretório recebe somente o ID público da sala. `list` e `upsert` exigem prova assinada da sala; `remove` pode usar o comando já assinado após sair. Links `ozroom1.` precisam ser recriados.
- **Sala e conversa:** a sala é uma lista de descoberta acessível por link, não um chat em grupo. No Discover aparecem apenas as pessoas da mesma sala que ligaram **Available to chat**. Cada aba mantém uma conversa individual ativa por vez; é preciso encerrá-la para iniciar outra. Não há catálogo público de pessoas ou grupos nem histórico de várias conversas.
- **Convites:** para publicar, o emissor do convite assina um grant vinculado à sala, ao publisher, ao ID do convite e à validade. O cliente verifica grant, assinatura do publisher, prova da sala e convite antes de mostrar alguém no Discover. Um membro abusivo com o segredo da sala ainda pode ocupar os slots da própria sala com registros invisíveis; o piloto limita esse impacto.
- **Capacidade:** páginas com até seis presenças e máximo de 50 no protocolo. Pedidos malformados, sala não admitida, assinatura inválida e publicações rejeitadas não consomem a cota de pedidos válidos. Há cotas globais e por sala, fila de processamento limitada e histórico anti-replay separado dos slots online. Tombstones são limitados, mas churn malicioso contínuo pode bloquear novas entradas até a expiração.
- **Transporte:** o preview de desenvolvimento ainda aceita retorno por endereço Nym temporário. O novo sidecar piloto usa cliente Nym nativo e SURB de resposta sem `replyTo` no payload; o modo `surb` é obrigatório em produção, sem fallback HTTP ou mudança automática para endereço. O fluxo passou num ensaio real da mixnet em ambiente Linux temporário; ainda faltam a infraestrutura definitiva, o ensaio entre hosts/redes distintos e a auditoria independente antes da abertura pública.
- **Mensagens:** o protocolo v3 usa Olm Double Ratchet por conversa, com estado em memória. Consulte a [validação](audits/private-chat-ratchet-validation-2026-10-15.md); ela não substitui revisão criptográfica independente.
- **Piloto:** exige allowlist de uma ou duas salas, no máximo dez participantes online por sala, identidade estável e snapshot cifrado em disco com bloqueio de instância única. Para retirar uma sala da allowlist sem apagar o snapshot, esperar até cinco minutos para as revisões/tombstones existentes expirarem; registros expirados íntegros são descartados no restore. Isso é um limite de piloto, não uma garantia de resistência a Sybil nem aprovação para produção.

As descrições abaixo preservam o comportamento do preview anterior; quando diferirem deste bloco, são **histórico de implementação**.

## Transporte

```text
Navegador → cliente Nym do chat → mixnet → diretório Nym
Navegador ← cliente Nym do chat ← mixnet ← resposta cifrada do diretório
```

Listar, publicar, renovar e remover presença usam exclusivamente mensagens Nym. O cliente não possui `fetch`, WebSocket direto para o diretório nem fallback HTTP. A antiga API de presença retorna 410 no preview e 404 em produção. Entrar em uma sala com Nym desligada cria somente estado local e mostra **Discover paused**.

Cada pedido usa uma chave X25519 efêmera, autenticação `crypto_box` e a chave pública fixada do diretório. A resposta só é aceita se corresponder à chave e ao identificador do pedido ativo. Requisições são preenchidas até 4096 bytes e respostas até 16384 bytes antes da cifragem. A chave da sala nunca é enviada: os convites continuam cifrados separadamente com XChaCha20-Poly1305 e assinados por uma identidade por sala.

No modo de desenvolvimento por endereço, o diretório também recebe o **endereço Nym temporário de retorno** e pode correlacionar pedidos desse endereço. No piloto por SURB, não há `replyTo` no payload; horários, volume, ID da sala e publisher ainda são metadados observáveis pelo serviço. O transporte não entrega o IP do navegador ao diretório, mas o carregamento do site continua fora da mixnet.

**Histórico do preview:** o SDK WASM 1.4.1 não expõe uma conversão pública utilizável de `AnonymousSenderTag` para `send_reply`, então o preview antigo devolvia respostas regulares. O novo sidecar nativo implementa SURBs; a interoperabilidade e disponibilidade na mixnet real ainda precisam ser medidas.

Não exige assinatura NymVPN. O carregamento inicial do site, recursos e descoberta de gateways não é tunelado por esse fluxo. A hospedagem ainda pode observar o IP no acesso ao site e o gateway de entrada Nym vê o IP de conexão. Não há promessa de anonimato absoluto, auditoria independente ou sigilo futuro por Double Ratchet.

## Falhas e reconexão

- O botão liga/desliga reflete a intenção do usuário, inclusive offline. Desligar cancela tentativas e a volta da internet não reconecta por conta própria.
- Uma rota só vira **Route verified** após um desafio cifrado atravessar a Nym e retornar. A checagem periódica e o limite de tentativas existentes foram mantidos.
- Desconectar cancela pedidos pendentes do diretório, limpa a lista e invalida callbacks de conexões/salas anteriores. A fila de recebimento da aplicação tem limite de 32 mensagens em processamento/espera.
- Ao receber a nova rota autenticada de um contato, um desafio pendente é reenviado para essa rota. Isso corrige a situação em que apenas um lado ficava pronto após reconectar.
- Disponibilidade não é reativada automaticamente. O convite é revogado localmente ao desligar. A remoção via Nym é feita enquanto há conexão; após queda ou fechamento imediato, a presença remota expira em até dois minutos.
- Renovação e consulta a cada 30 segundos, no máximo quatro pedidos simultâneos e 45 segundos de espera por resposta. Falha permanece falha; nenhum desses caminhos abre HTTP.
- Respostas têm até seis entradas por página, limite total de 50; cursores inválidos/repetidos e respostas adulteradas são rejeitados.

## Executar o preview

1. Instalar as dependências bloqueadas do projeto (`npm ci`).
2. Executar `npm run chat:directory` na raiz deste worktree e esperar a confirmação de conexão.
3. Executar `node scripts/stage-private-chat-nym.mjs`.
4. Executar `NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW=true DISABLE_AUTO_REFRESH=true ZARVIS_CANARY_SCHEDULE=false npm run dev -- --hostname 127.0.0.1 --port 4430`.
5. Abrir `http://127.0.0.1:4430/private-chat` em duas abas. Escolher aliases, ligar Nym, compartilhar uma sala e habilitar disponibilidade explicitamente.

**Preview de desenvolvimento:** o processo auxiliar usa o **cliente Nym real**, com IndexedDB em memória (`fake-indexeddb`) no Node. O arquivo ignorado `tmp/private-chat-directory.json` contém somente o endereço Nym e a chave pública do serviço. Essa identidade de preview é efêmera; o sidecar piloto nativo usa identidade e presença cifradas persistidas separadamente.

O processo não abre porta HTTP, não imprime pedidos, conteúdo ou endereços de usuários e desliga as estatísticas do cliente Nym. TLS, tráfego de cobertura e atrasos padrão são preservados. Para produção, preferir um cliente Nym servidor suportado, identidade persistida com proteção e supervisão/recovery do serviço.

## Limites do serviço

O preview de desenvolvimento mantém armazenamento local de até 200 registros. O piloto admite até duas salas de dez online cada, com tombstones limitados separadamente; usa snapshot cifrado e identidade persistente em instância única. O serviço limita a oito pedidos em processamento, cotas por sala, 512 identificadores de replay e janela de aceitação de 45 segundos. Essas barreiras limitam recursos, **não resolvem abuso de um membro admitido nem Sybil**. Disponibilidade distribuída, retenção da infraestrutura, revisão criptográfica independente e testes de carga e mixnet real são pendências para produção.

Referências: [serviços pela Nym](https://nym.com/docs/developers/service-providers), [código do SDK](https://github.com/nymtech/nym/tree/develop/wasm/client/src), [limites do transporte no navegador](https://nym.com/docs/developers/browser-routing).

## Verificação desta revisão

**Histórico do preview anterior:** [registro dos testes e evidências](audits/private-chat-discover-nym-2026-10-15/verification.md): 96 testes passaram, tipos/lint verificados e fluxo real com duas sessões pela Nym. Esses resultados não validam automaticamente o novo sidecar nativo nem sua prontidão para produção.
