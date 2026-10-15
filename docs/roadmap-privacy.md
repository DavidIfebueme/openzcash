# OpenZcash — roadmap de acesso privado

Atualizado em 15 de outubro de 2026.

Direção: **transparência sobre o ecossistema, com privacidade para quem pesquisa**.

Este documento registra planejamento. Nenhum serviço Tor ou Nym foi implantado nesta tarefa.

| Frente | Estado | Próxima entrega |
| --- | --- | --- |
| OpenZcash HTTPS + onion | Direção definida; implementação futura | Piloto das páginas públicas com os dois acessos coexistindo |
| Nym mixnet | Estudo de viabilidade | Prova técnica pequena e definição do modelo de privacidade |
| Chat privado | Hipótese de produto | Validar conversas individuais entre usuários, incluindo orientação e pesquisa |

## 1. Manter as duas entradas do OpenZcash

Manter `https://openzcash.org` e acrescentar um endereço onion oficial, com a mesma identidade, código e fonte de dados. A preferência inicial é uma entrada Tor conectada à aplicação existente, com comunicação interna protegida. Os coletores e as migrações continuam coordenados em um único fluxo operacional.

Um clone integral teria tarefas automáticas duplicadas: a versão inspecionada inicia importadores, aquecimento de dados e verificações periódicas por processo. A arquitetura deve resolver essa concorrência antes de acrescentar instâncias completas. Compartilhar o backend também mantém a disponibilidade das duas entradas ligada à infraestrutura existente; independência operacional é uma evolução separada.

### Etapa A — acesso público

- Publicar Network, grants, histórico, diretórios, biblioteca e APIs de leitura pelo onion.
- Manter links internos no acesso escolhido; identificar saídas para serviços externos.
- Divulgar o endereço no site HTTPS e configurar Onion-Location.
- Preservar fontes, horários de coleta e avisos sobre dados incompletos.
- Servir recursos essenciais localmente e oferecer leitura básica compatível com JavaScript desabilitado.
- Definir retenção mínima de logs, armazenamento seguro da chave onion, backup e monitoramento.

Entrega verificável: navegar por todas as páginas públicas no Tor Browser, testar downloads e APIs, conferir consistência com HTTPS e verificar as conexões externas. Cobrir desktop e acesso móvel compatível. Registrar latência e disponibilidade efetivamente observadas.

### Etapa B — funções interativas

- Adaptar origens permitidas, cookies e autenticação do Participate; testar passkeys no domínio e navegador escolhidos.
- Definir o comportamento do Zarvis no onion: respostas diretas dos dados locais e eventual uso explícito de provedor externo.
- Adaptar cotas de uso para não agrupar todos os visitantes na identidade do proxy.
- Validar comentários, publicação e recuperação de conta sem misturar estados privados e registros públicos.

Entrega verificável: fluxos completos com contas de teste, falhas de conexão e proteção contra envio involuntário por outra rota. Um endereço onion não transforma login identificado ou conteúdo enviado à IA em informação anônima.

### Etapa C — infraestrutura e descoberta

Avaliar diretório de serviços onion do ecossistema, medindo disponibilidade, atualização de blocos e compatibilidade declarada versus testada. Esses indicadores não constituem um selo de anonimato. Réplica independente e endpoint lightwalletd onion dependem de necessidade e testes próprios.

## 2. Nym no OpenZcash — hipótese de integração

A Nym oferece caminhos de integração no navegador: mensagens entre clientes Nym e requisições HTTP pelo mixnet. São arquiteturas diferentes. O modo proxy ainda entrega a requisição ao servidor de destino; o modo entre clientes permite manter o transporte dentro da mixnet. Fixar versões e comprovar instalação, build e operação dos pacotes antes de escolher a implementação. [Visão geral oficial](https://nym.com/docs/developers).

Há uma ressalva de distribuição: o fluxo atual descrito no repositório publica a família mix-tunnel/fetch/dns/websocket, enquanto o SDK de mensagens v1 não faz parte desse fluxo. Isso exige verificar o pacote efetivamente disponível, sua manutenção e compatibilidade antes do piloto. [Publicação dos pacotes](https://github.com/nymtech/nym/blob/develop/ts-sdk-publishing.md).

### Produto candidato: conversas privadas entre usuários

Conversas individuais entre usuários, incluindo dúvidas sobre Zcash, pesquisa e discussão de rascunhos com mentores ou colaboradores antes de uma publicação voluntária. As conversas devem ter armazenamento e identidade próprios.

Posição definida para a futura entrada: abaixo de Monthly no menu principal, com espaço vertical maior e um divisor discreto. Preservar cores, tipografia e padrão de ícones do OpenZcash. Nome provisório: Private Chat. Esta definição está no roadmap; o menu de produção ainda não foi alterado.

Fluxo de entrada proposto:

1. Abrir Private Chat e escolher um apelido; o aplicativo gera as chaves do chat no dispositivo. O usuário não precisa criar/copiar uma chave manualmente nem conectar uma carteira Zcash.
2. Criar um convite ou entrar por um convite/link/QR recebido. O convite compartilha informações públicas necessárias à conexão; as chaves privadas permanecem no dispositivo no modelo proposto.
3. Permitir verificar o contato por um código de segurança. Apelidos não comprovam identidade e não devem permitir substituição silenciosa de chaves.
4. Diferenciar sessão temporária de identidade salva neste dispositivo. Sem persistência ou recuperação, perder a sessão/chaves pode impedir retomar a identidade e acessar o histórico; continuidade entre aparelhos requer um fluxo próprio.

Controle definido para a descoberta: botão liga/desliga **“Disponível para conversar”**, no topo do chat, desligado por padrão.

- **Ligado:** mostrar o apelido na lista de pessoas disponíveis e permitir pedidos de conversa, sempre sujeitos a aceite.
- **Desligado:** retirar o apelido da lista e impedir novos pedidos pela descoberta. Conversas existentes continuam disponíveis; bloquear um contato é uma ação separada.
- Desligar deve cancelar também pedidos de descoberta ainda não aceitos. Abrir o chat novamente não deve reativar a disponibilidade automaticamente.
- A disponibilidade deve expirar quando a sessão perder a conexão ou for encerrada, evitando mostrar alguém como online indefinidamente. Definir e testar o prazo dessa expiração na implementação.
- Mostrar o estado com texto e posição do controle, além da cor, com operação por teclado e nome acessível.

Esse botão controla a visibilidade para outros usuários; a proteção das mensagens permanece ativa nos dois estados. Presença e horários expostos são metadados, mesmo com mensagens cifradas. O primeiro piloto técnico continua por convite; a descoberta com esse controle é uma etapa posterior do produto, não fornecida automaticamente pela Nym.

Escopo proposto do primeiro piloto:

- Texto curto e conversas por convite, sem conta Participate obrigatória.
- Chaves verificáveis e protocolo de criptografia de aplicação revisado; o servidor de encaminhamento não deve precisar ler o conteúdo.
- Sem anexos, chamadas, presença ou indicador de digitação no piloto.
- Sem publicação ou ancoragem automática de mensagens privadas.
- Estados claros de envio, falha e confirmação; falha na mixnet não deve disparar reenvio silencioso pela web comum.
- Primeiro teste com as duas pontas abertas. Entrega offline, expiração e recuperação são requisitos adicionais, não capacidades presumidas de um chat pronto.
- Bloqueio de contatos e limites de uso compatíveis com privacidade; eventual denúncia deve compartilhar somente o material escolhido pelo usuário.

Nym protege propriedades do transporte, mas um servidor que roteia por contas ainda pode conhecer os interlocutores. Autenticação do destinatário, confidencialidade do conteúdo e minimização de metadados da aplicação precisam ser desenhadas em conjunto. [Modelo oficial de mensagens](https://nym.com/docs/network/threat-model/examples/messaging).

### Prova técnica antes do produto

1. Fixar versões do SDK e obter uma conversa de teste entre dois clientes, sem mensagens reais de usuários.
2. Validar WASM, Web Worker e conexões aos gateways no frontend atual. Restringir mudanças de CSP ao módulo necessário.
3. Medir conexão inicial, entrega, perdas, repetição, reconexão, banda e consumo em celular. A mixnet introduz atrasos deliberados e tráfego de cobertura; não há prazo de entrega prometido neste roadmap. [Limitações documentadas](https://nym.com/docs/developers/limitations).
4. Verificar descoberta/autenticidade dos contatos, vida útil de credenciais de resposta e política de mensagens offline.
5. Confirmar requisitos atuais de acesso à rede, credenciais de banda, subsídio e custo operacional. As docs consultadas dizem que integrações SDK atualmente conectam sem credenciais; o acesso do NymVPN é diferente. Não presumir gratuidade permanente nem necessidade de o usuário comprar tokens. [Credenciais e acesso](https://nym.com/docs/network/cryptography/zk-nym/zk-nym-overview).
6. Revisar chaves, retenção, prevenção de replay e exposição do grafo de conversas; realizar teste adversarial antes de tratar o canal como apto a conteúdo sensível.

Decisão após a prova: seguir com chat individual se entrega, custo e experiência forem aceitáveis. A alternativa menor é experimentar consultas de leitura específicas por mixnet, reutilizando as APIs públicas.

### Fronteiras de privacidade

O transporte Nym precisa começar no cliente. Colocá-lo apenas atrás da API OpenZcash preserva a exposição da conexão inicial ao portal. A visita HTTPS, recursos carregados pelo navegador e sessões preexistentes não passam automaticamente pela mixnet. Isolar a experiência e testar quais requisições continuam diretas. [Integração no navegador](https://nym.com/docs/developers/browser-routing).

No Zarvis, Nym poderia proteger o caminho de uma pergunta, mas o receptor OpenZcash continuaria lendo o texto; um modelo externo também receberia o contexto encaminhado. Uma opção limitada aos dados e respostas locais tem um modelo de compartilhamento mais simples.

Tor para acesso ao portal e Nym para mensagens são frentes complementares. Empilhar as redes exige testes próprios, especialmente de WASM, WebSockets e funcionamento no Tor Browser. Não condicionar o lançamento onion à conclusão da pesquisa Nym.

## Fontes e estado da validação

- [Tor: configurar um onion service](https://community.torproject.org/onion-services/setup/).
- [Tor: Onion-Location](https://community.torproject.org/onion-services/advanced/onion-location/).
- [Nym: SDK de mensagens no navegador](https://nym.com/docs/developers/typescript).
- [Nym: planejar a integração por fluxo](https://nym.com/docs/developers/integrating).

A análise do código usou o worktree `zcg-participate-nav/openzcash`, revisão `b046be92c516c28c948a0a976c400c05f26f1d42`: `next.config.ts`, `src/instrumentation.ts`, `src/lib/participate/upstream.ts`, `src/lib/zarvis/validation.ts`, `src/lib/zarvis/usage.ts` e os componentes de discussão/arquivo do Participate. A configuração privada e a operação do backend externo de Participate não foram auditadas. Não houve teste de tráfego Tor ou Nym nesta etapa.
