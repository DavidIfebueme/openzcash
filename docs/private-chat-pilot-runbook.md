# Private Chat — operação de piloto isolado

Estado em 15/10/2026: piloto experimental hospedado, autorizado para um teste humano entre duas pessoas. A instância usa origem HTTPS isolada, gateway fixado e volume durável; o fluxo real Nym/SURB passou antes e depois de recriar o container. Consulte a [evidência da implantação](audits/private-chat-pilot-production-2026-10-15.md). Testes em aparelhos físicos e revisão independente continuam pendentes; este roteiro não aprova um lançamento amplo.

## Componentes

- Aplicação Next em origem HTTPS exclusiva para o chat, com rotas do portal bloqueadas, sem Zarvis/tesouraria, CSP com nonce e um gateway WSS fixado.
- Navegadores com Nym WASM 1.4.1 servido pela própria origem. O manifest gerado no prebuild identifica versão e SHA-256 dos assets.
- Cliente Nym nativo persistente. O Node conecta somente ao seu WebSocket de loopback; não existe endpoint público de Discover.
- Diretório Node com respostas SURB, admissão de salas por chave pública e presença cifrada. Não usa IP, conta ou VPN paga para admitir usuários.
- Python 3/POSIX fornece o lock de instância única por `fcntl.flock`; o descritor é herdado pelo Node. Até SIGKILL libera o bloqueio no kernel. Usar disco local; NFS e múltiplas réplicas não foram validados.

O teste de integração local cobre exclusão simultânea, SIGKILL e restauração com identidade/remoções preservadas. Ele usa um WebSocket Nym simulado. Um [ensaio separado do runtime atual](audits/private-chat-pilot-2026-10-15/operations.md) confirmou entrega real via Nym/SURB antes e depois de reiniciar o runtime e o cliente nativo no mesmo container temporário, mas não prova restauração entre containers.

O protocolo binário foi implementado a partir do código da release [`nym-binaries-v2026.20-glasgow`](https://github.com/nymtech/nym/releases/tag/nym-binaries-v2026.20-glasgow), identificada como **Latest** em 15/10/2026. Fixar a versão do binário e conferir o SHA-256 do artefato exato antes de instalar. A versão do navegador e a do cliente nativo têm numerações distintas.

Referências: [setup do cliente](https://nym.com/docs/developers/clients/websocket/setup), [uso e SURBs](https://nym.com/docs/developers/clients/websocket/usage), [requests](https://github.com/nymtech/nym/blob/nym-binaries-v2026.20-glasgow/clients/native/websocket-requests/src/requests.rs), [responses](https://github.com/nymtech/nym/blob/nym-binaries-v2026.20-glasgow/clients/native/websocket-requests/src/responses.rs).

## Diretório e armazenamento

Inicializar o cliente Nym **uma vez** com `nym-client init --id openzcash-directory`; iniciar com `nym-client run --id openzcash-directory`. Preservar o diretório de identidade do Nym, gateway e SURBs entre reinícios. Restringir o WebSocket à interface de loopback, porta 1977; não publicar essa porta nem a porta 1978.

Inspecionar a configuração gerada pela versão fixada: desativar o envio de estatísticas e logs com endereços/payloads; manter cover traffic e atrasos padrão. As chaves do cliente nativo dependem das permissões do usuário e da proteção do volume. A cifragem da aplicação descrita abaixo não cobre automaticamente os arquivos internos do Nym.

Configuração privada do serviço:

| Variável | Conteúdo |
| --- | --- |
| NODE_ENV | production |
| PRIVATE_CHAT_DIRECTORY_DATA | Diretório absoluto persistente, dono do serviço, modo 0700 |
| PRIVATE_CHAT_DIRECTORY_STORAGE_KEY | Chave aleatória de 32 bytes, base64url sem padding, em secret manager |
| PRIVATE_CHAT_DIRECTORY_ADDRESS | Endereço público da identidade nativa Nym; também é o pin obrigatório no runtime |
| PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY | Chave pública retornada em `descriptor.json` após a inicialização; pin obrigatório no runtime |
| PRIVATE_CHAT_DIRECTORY_ROOMS | Objeto JSON chave pública da sala → vagas, de 1 a 2 salas, até 10 vagas por sala |
| PRIVATE_CHAT_NYM_WEBSOCKET | ws://127.0.0.1:1977 |
| PRIVATE_CHAT_DIRECTORY_HEALTH_PORT | 1978; listener somente em 127.0.0.1 |

Não registrar a chave nem o link secreto da sala em logs. A allowlist usa apenas o ID público de uma sala v2 criada no cliente.

Inicializar com o endereço nativo conhecido, antes de iniciar o runtime. A inicialização é uma ação explícita do operador e usa o mesmo lock exclusivo do serviço; nunca executá-la automaticamente no deploy. Ela grava `identity.sealed`, `binding.sealed` e `descriptor.json`. Depois, configurar `PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY` com o valor público do descriptor e conferir que o endereço corresponde ao cliente nativo. Só então iniciar o serviço:

```sh
npm ci
npm run chat:directory:build
npm run chat:directory:init
npm run chat:directory:pilot
```

O launcher adquire o lock e o runtime valida seu descritor. Não iniciar o arquivo JavaScript diretamente. Um segundo processo falha sem alterar o estado. O runtime exige identidade/binding já persistidos e os dois valores públicos fixados; um volume vazio, perdido ou com endereço/chave divergentes falha antes de ficar pronto. Identidade da aplicação e presença são gravadas com AES-256-GCM, AAD por arquivo, nonce aleatório, modo 0600, rename atômico e fsync. Uma publicação só é confirmada após persistência. Erro de persistência encerra o serviço.

O `zbo/redesign` usado no teste temporário não possui Python 3 nem volume montado. Nesse ensaio, o operador usou `flock` nativo do Linux com descritor herdado, conservou app e cliente Nym em `/tmp` e apagou tudo ao fim. **Isso não substitui o launcher e o volume exigidos para o piloto hospedado.** Não copiar o estado efêmero para o ambiente final como se fosse backup.

O arquivo `descriptor.json` contém somente endereço Nym, chave pública do diretório e modo `surb`. A vinculação também fica cifrada em `binding.sealed`: ao reiniciar, mudança do endereço nativo ou da chave de aplicação faz o processo falhar antes de ficar pronto, inclusive se o descriptor público tiver sido removido. Copiar os valores públicos do descriptor para a configuração do frontend; eles não são segredos. Preservar `identity.sealed`, `binding.sealed`, a chave de armazenamento e a identidade interna do cliente Nym no volume durável. Perda da chave de armazenamento ou do volume impede restaurar a identidade: recuperar do procedimento privado de backup ou executar conscientemente uma nova inicialização e atualizar explicitamente ambos os pins e o frontend. Nunca substituir uma identidade silenciosamente.

Presença online expira em até 120 segundos sem heartbeat; tombstones anti-replay duram até o fim do convite (5 minutos). O snapshot é podado a cada 20 segundos enquanto o serviço funciona e ao iniciar. Disco de um serviço parado pode conter estado cifrado expirado até o próximo início; backups/snapshots do volume podem estender essa retenção. Não incluir snapshots de presença em backups históricos. A cifragem não impede rollback de um volume restaurado por administrador.

Para retirar uma sala da allowlist: impedir novas publicações, esperar o vencimento dos registros/convites (até 5 minutos), parar e alterar a configuração. Registros ainda válidos de uma sala removida bloqueiam a restauração; registros vencidos são validados e descartados. Não apagar o snapshot para contornar esse bloqueio.

## Frontend

Definir os valores públicos também no **build**, pois Next incorpora `NEXT_PUBLIC_*` ao bundle:

| Variável | Conteúdo |
| --- | --- |
| PRIVATE_CHAT_DEPLOYMENT | pilot |
| NEXT_PUBLIC_PRIVATE_CHAT_PILOT | true |
| PRIVATE_CHAT_ISOLATED | true |
| PRIVATE_CHAT_ORIGIN | Origem HTTPS exclusiva, sem path, query ou credenciais |
| NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ORIGIN | Origem WSS exata do gateway, incluindo porta quando necessária |
| NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID | Identity key base58 correspondente ao gateway |
| PRIVATE_CHAT_DIRECTORY_ADDRESS | Endereço do descriptor do serviço |
| PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY | Chave pública do mesmo descriptor |

O piloto configurado sempre isola as rotas, mesmo se PRIVATE_CHAT_ISOLATED não for informado; a flag explícita também fecha a instância quando a configuração estiver incompleta. Manter o site principal sem as flags de piloto. Não usar wildcard WSS em produção. O gateway fixado perde failover automático; indisponibilidade deve suspender o chat, nunca abrir conexão direta alternativa.

`npm run build` prepara os assets Nym; `npm start` executa o frontend. Validar cabeçalhos reais depois do proxy TLS/CDN. Página: nonce, no-referrer, no-store, noindex, câmera/microfone bloqueados. Worker: origem própria, wasm-unsafe-eval, connect-src restrito. Uma flag pública sozinha não habilita a página em produção.

O proxy TLS deve preservar o Host público, sobrescrever os cabeçalhos de encaminhamento (em especial X-Forwarded-Proto) e manter a porta do processo Next acessível apenas ao proxy. O aplicativo confere o Host canônico e o esquema HTTPS; ignora X-Forwarded-Host para autorização da origem. Isso evita usar o hostname interno reconstruído pelo next start como se fosse o domínio público.

Em modo pilot ou PRIVATE_CHAT_ISOLATED=true, a instrumentação não inicia os coletores do portal, canários Zarvis, aquecimento de dados ou jobs que escrevem no banco. O processo principal do portal, sem essas flags, mantém a coleta habitual.

Não adicionar analytics, replay de sessão, relatórios de erro com conteúdo da conversa ou logs de URL/fragmento. Reduzir e documentar logs de acesso da hospedagem. O servidor HTTPS, a API de topologia e o gateway de entrada ainda podem observar o IP de conexão; a mixnet não oculta o carregamento inicial do site.

## Limites e monitoramento

Piloto: no máximo 2 salas de 10 usuários; 120 operações válidas/minuto/sala. Há cota separada para rejeições e limite de trabalho concorrente. Paginação tem seis presenças por resposta; frames de request/resposta são preenchidos para 4.169/16.457 bytes. Capacidade real depende da fragmentação, SURBs e latência da mixnet; medir antes de ampliar.

Um membro com o link pode consumir recursos da sua própria sala ou repassar o link. Provas de sala evitam terceiros sem o link; não identificam seres humanos nem resolvem Sybil público. O orçamento separado de histórico anti-replay permite churn normal, mas continua finito.

`GET http://127.0.0.1:1978/healthz` confirma serviço, armazenamento inicializado e WebSocket local respondendo. **Não comprova entrega pela mixnet.** `/metrics` expõe apenas contadores agregados e uptime, sem usuários/salas/endereços. `queued` conta enfileiramentos no socket, não entrega ao navegador. Não expor esses endpoints na internet.

## Critérios para ampliar o piloto

1. Roundtrip real de SURB com o cliente nativo fixado em Linux, WASM 1.4.1 e protocolo v3 passou no ambiente temporário e foi repetido no [piloto hospedado](audits/private-chat-pilot-production-2026-10-15.md) antes e depois de recriar o container. Repetir após mudanças de gateway, domínio ou protocolo.
2. Dois dispositivos/redes independentes: criar/entrar na sala, aceitar/recusar/expirar convite, mensagens/recibos, perda de rede antes e depois do aceite, reconectar, sair e voltar.
3. Recriação sobre volume durável com endereço/chave estáveis e novo roundtrip real passou no piloto hospedado. Exclusão, lock, SIGKILL e rejeição de identidade divergente têm cobertura local. Ainda ensaiar recuperação de desastre a partir de backup privado, sem ressuscitar presença expirada.
4. Medir 2 salas × 10 usuários por tempo suficiente, p95/p99, backlog e timeouts; acompanhar uma sonda ponta a ponta em sala de teste isolada.
5. Build público validado em desktop e viewport móvel, claro/escuro, nonce/hidratação/WASM e reconexão. Completar navegação/BFCache e suspensão em aparelhos físicos. Nenhuma chamada de Discover por HTTP e nenhum recurso externo além dos endpoints Nym autorizados.
6. Revisão criptográfica independente conforme [ADR](private-chat-crypto-decision.md). O protocolo v3 usa Olm Double Ratchet em memória, pela biblioteca oficial fixada, e os testes locais usam o WASM real. A auditoria da dependência não certifica a adaptação; o lançamento continua condicionado à revisão da integração completa.

O site pode chamar isso de piloto experimental com limites explícitos. Não anunciar privacidade máxima nem equivalência criptográfica ao Signal.
