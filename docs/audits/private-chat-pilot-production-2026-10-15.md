# Private Chat — piloto hospedado para duas pessoas

Publicado em 15/10/2026, por autorização do usuário, como **piloto experimental** em origem HTTPS isolada. O portal principal não foi alterado. Isto não é uma auditoria independente nem aprovação para divulgar o serviço como produto de privacidade máxima.

URL: https://private-chat-production-b8bd.up.railway.app/private-chat

## Implantação

| Componente | Evidência |
| --- | --- |
| Interface | Railway `private-chat`, ambiente `production`; deploy `47c384f6-6366-4922-a2df-29284842937b`, `SUCCESS` |
| Diretório | Railway `private-chat-directory`, ambiente `production`; deploy inicial de operação `540990a8-355d-42fe-9bb1-5ea8a09db302` |
| Recriação | Novo deploy `6a049b96-2bef-4d37-b658-f84f7df918ac`, `SUCCESS`; novo container usando o mesmo volume |
| Volume | `private-chat-directory-volume`, montado em `/data`; guarda identidade Nym e estado cifrado do diretório |
| Admissão Discover | Uma sala aprovada, até duas presenças simultâneas. O segredo da sala fica apenas no arquivo local ignorado pelo Git e com os participantes. |
| Gateway do navegador | Identidade fixada `CFofVdokf1gUucHwFK7MppJFAu8aRTiPHvGjud7Bdc7h`, WSS `s2.sa.br.nympool.drpip.im` |

O domínio da interface é público, sem conta de acesso. O limite de duas presenças se aplica à sala do Discover; não é um bloqueio global de todos os convites diretos. Nenhum anúncio público foi feito. O piloto não exige assinatura de VPN.

Os [manifestos dos pacotes publicados](private-chat-pilot-production-2026-10-15/artifact-summary.json) registram hashes dos arquivos enviados, sem variáveis privadas, links de sala, bancos ou arquivos `.env`. O build usa Node 26.12.0 com imagem fixada por digest e o binário Nym `nym-binaries-v2026.20-glasgow` verificado por SHA-256. A inicialização de identidade foi uma operação explícita, anterior à ativação; o processo normal não cria identidades silenciosamente.

## Testes no ambiente hospedado

- [Antes da recriação](private-chat-pilot-production-2026-10-15/real-nym-before-redeploy.json): **9/9 verificações**, aproximadamente 61 segundos.
- [Depois da recriação](private-chat-pilot-production-2026-10-15/real-nym-after-redeploy.json): **9/9 verificações**, aproximadamente 96 segundos. O Discover levou cerca de 33 segundos nesta execução; não prometer latência instantânea.
- Cada execução cobriu dois clientes Nym WASM independentes, Discover cifrado com respostas SURB, convite/aceite, dez mensagens alternadas, recibos autenticados, bloqueio de envio offline, reconexão e mais duas mensagens, encerramento, recusa e rejeição local de convite expirado.
- Ambos os testes reportaram **zero destinos HTTP inesperados**. Foram duas sessões no mesmo Mac/rede acessando o diretório hospedado; isto não substitui dois telefones/redes físicas.
- Duas abas reais no domínio publicado: alias, conexão, convite direto, aceite, código de segurança idêntico, mensagens nas duas direções, recibos, emoji, desligar/ligar Nym e nova mensagem após reconectar. A sessão offline desabilitou o compositor e manteve a conversa na aba. Nenhum erro de console observado.
- Discover na interface: entrada pelo segredo da sala, listagem de `Pilot Alice` apenas após ativar disponibilidade, pedido individual, aceite e nova mensagem entregue. [Evidência da lista](private-chat-pilot-production-2026-10-15/discover-mobile.jpg). Ao aceitar, a presença foi retirada; ao final, o outro navegador mostrou zero pessoas disponíveis. As duas sessões sintéticas foram limpas. Uma conversa encerrada pelo outro participante permanece visível até o usuário fechar com `End chat`; é preciso fechá-la antes de iniciar outra.
- Desktop e viewport de 390 × 844 nos temas claro e escuro, sem overflow horizontal observado. [Desktop](private-chat-pilot-production-2026-10-15/desktop.jpg), [mobile claro](private-chat-pilot-production-2026-10-15/mobile.jpg), [mobile escuro](private-chat-pilot-production-2026-10-15/mobile-dark.jpg). Viewport emulado não é aparelho físico.

## Recuperação e isolamento

Os hashes abaixo foram iguais antes e depois da recriação, confirmando que o novo container retomou a identidade persistida:

| Arquivo | SHA-256 |
| --- | --- |
| `identity.sealed` | `90c7680d2ebd97bb25ab827ec033977789bcc27b10081b1614661114a0696202` |
| `binding.sealed` | `6e08e447ee92563a2fb0a17b831a40327df14a564160b485be39fdbcf01da227` |
| `descriptor.json` | `9a114c45f2536663cbacd04436062a9be116c6880bbaf2359b81963228844634` |

Cliente nativo e diretório executam como UID 1000. Portas 1977 e 1978 escutam somente em `127.0.0.1`; o diretório não tem domínio público. Identidade e binding usam modo 0600. Estatísticas nativas Nym estão desativadas. A saúde interna respondeu `ready: true`; uma amostra de métricas após recriação mostrou 7 recebimentos, 7 enfileiramentos, zero descartes e zero falhas. Saúde/enfileiramento sozinhos não comprovam entrega; a prova de entrega são os testes acima.

HTTPS público: `/private-chat` 200; `/` redireciona para o chat; `/zcg` e `/api/private-chat/presence` 404. Página com CSP/nonce, apenas origem própria, topologia Nym e gateway WSS fixado, `no-store`, `no-referrer`, `noindex`, câmera/microfone bloqueados. Worker e WASM retornaram 200 e MIME correto. Os coletores e jobs do portal estão desativados nesta instância.

Build Next/Docker e TypeScript passaram. Lint dos arquivos alterados e `git diff --check` passaram. **17 testes focados** da interface/proxy passaram após o ajuste de healthcheck. A suíte completa anterior permanece registrada no [relatório de preparação](private-chat-pilot-readiness-2026-10-15.md); não foi repetida sem nova mudança que a justificasse. `npm audit --omit=dev` foi reconfirmado com **zero vulnerabilidades reportadas**. A instalação de build reportou nove avisos em dependências de desenvolvimento; não são zero avisos no conjunto completo de ferramentas.

## Privacidade e limites do ensaio

A implementação atual não envia mensagens legíveis ou chaves de conversa ao servidor OpenZcash. Não existe painel de leitura nem banco de conversas. [Amostra dos logs de aplicação](private-chat-pilot-production-2026-10-15/log-review.json): nenhuma mensagem/alias sintético ou marcador de chave privada encontrado. Esta verificação não prova ausência de metadados nos logs do provedor de hospedagem.

O host HTTPS e o gateway de entrada ainda podem observar o IP de conexão. O diretório conhece o identificador da sala e horários de operações, mas a lista é cifrada para quem possui o link e as respostas deste piloto usam SURBs. O link pode ser repassado por um participante. O destinatário pode copiar mensagens, e um aparelho comprometido pode ler a aba. Como todo cliente web, o código servido também é parte da confiança: uma alteração maliciosa no frontend poderia capturar texto/chaves. Portanto, não prometer que o operador **nunca** poderia ter acesso sob qualquer cenário.

Ainda pendentes para ampliar o piloto: teste humano com dois aparelhos/redes distintos (incluindo suspensão e retomada móvel), revisão criptográfica independente da integração, ensaio de carga prolongado, monitoração ponta a ponta contínua e procedimento privado de recuperação de desastre. Não há automação de monitoramento criada por este pedido.

Se houver divergência de identidade, falha de armazenamento, exposição de conteúdo em logs ou envio fora da Nym: interromper o piloto, preservar evidências mínimas sem conteúdo e investigar. Para desligar, parar a interface e o diretório no Railway; preservar o volume e a chave do secret manager para recuperação. Não reinicializar a identidade como tentativa automática de reparo.

O arquivo local `tmp/private-chat-pilot-invite.md` contém o link reservado e o roteiro para os dois participantes; permanece ignorado pelo Git. Não incluir esse link em issues, commits ou neste relatório.
