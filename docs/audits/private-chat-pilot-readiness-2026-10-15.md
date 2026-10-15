# Private Chat — decisão de prontidão do piloto

Data: 15/10/2026. Registro de preparação anterior ao deploy, no branch `michae2xl/private-chat`. A configuração usada naquele build é sintética. O [relatório posterior do piloto hospedado](private-chat-pilot-production-2026-10-15.md) documenta a implantação autorizada e as verificações reais; este registro preserva o alcance dos testes anteriores.

## Decisão

**Ainda não abrir o piloto hospedado nem a produção pública.** O chat direto passou pela Nym real entre Mac e Linux em redes distintas. O diretório atualizado do Discover passou pela Nym real em um ensaio temporário, antes e depois de reiniciar seus processos no mesmo container. A instância testada não tem volume durável; faltam validação em aparelhos móveis, infraestrutura final e revisão criptográfica independente.

Uma sala privada é um espaço de descoberta por link, não um chat em grupo. O Discover mostra apenas pessoas da mesma sala que ativaram **Available to chat**; não há catálogo público de pessoas ou grupos. Cada aba mantém uma conversa individual ativa por vez, sem histórico de múltiplas conversas. A interface agora explicita isso.

## Evidência concluída

| Área | Resultado e alcance |
| --- | --- |
| Segurança interna | [Revisão](private-chat-security-review-2026-10-15.md): 50/50 testes focados passaram. FAQ corrigido para distinguir metadados de preview e SURB; inicialização explícita e pins de endereço/chave impedem troca silenciosa da identidade Nym e `ready` com volume vazio. Isto não é auditoria independente. |
| Chat entre redes | [Ensaio Mac + Linux](private-chat-ratchet-2026-10-15/real-nym-cross-network.md): dois hosts/redes, convite assinado, aceite, 12 mensagens cifradas com recibos, bloqueio offline, reconexão e encerramento pela Nym real em cerca de 51 segundos. Foi convite direto em clientes headless, sem Discover e sem telefone. |
| Diretório e carga local | [Validação operacional](private-chat-pilot-2026-10-15/operations.md): build do diretório, lint, TypeScript e 6/6 testes passaram. Reinício/SIGKILL, lock, replay, endereço alterado, volume vazio e métricas agregadas foram verificados com WebSocket nativo simulado. Duas salas de dez participantes executaram 46 operações locais, com paginação, restore cifrado, heartbeat e recusa da 11ª presença. Não há latência nem vinte clientes reais na mixnet. |
| Discover real no runtime atual | [Ensaio temporário](private-chat-pilot-2026-10-15/operations.md) em `zbo/redesign`: 9/9 verificações passaram pela Nym real, com Discover SURB, convite/aceite, dez mensagens, recibos e reconexão. Após reiniciar runtime e cliente Nym no mesmo container, endereço e arquivos de identidade continuaram iguais e 9/9 verificações passaram novamente. Contadores do diretório: 7/7 respostas antes e 6/6 depois, sem descartes ou falhas. Não prova persistência entre containers. |
| Interface móvel | Preview sintético em 375 px, temas [claro](private-chat-pilot-2026-10-15/discover-mobile.jpg) e [escuro](private-chat-pilot-2026-10-15/discover-mobile-dark.jpg), sem rolagem horizontal observada. O contraste dos controles de sessão no escuro foi aumentado. Emulação de viewport no Mac, não aparelho físico. |
| Build e regressão | Build Next completo do piloto com host/gateway **sintéticos**, TypeScript e lint dos arquivos alterados passaram. Suíte completa: **3.876 testes passaram, 12 ignorados**. A primeira execução encontrou apenas a expectativa antiga de texto no FAQ; após atualizá-la, a suíte inteira passou. Servido em loopback: `/private-chat` 200 com CSP/nonce, `no-store` e `no-referrer`; `/zcg` e Host estranho 404; worker e WASM 200, com MIME `application/wasm` correto. O servidor de teste foi encerrado. Após falha inicial de DNS, `npm audit --omit=dev --json` concluiu com **zero vulnerabilidades reportadas** nas dependências de produção. |

O [teste anterior do diretório nativo com SURB real](private-chat-ratchet-validation-2026-10-15.md) passou antes da mudança de bootstrap e pin. A prova da versão atual é o [ensaio operacional temporário](private-chat-pilot-2026-10-15/operations.md); ambos usaram identidade efêmera, sem volume durável.

## Saídas necessárias antes do piloto hospedado

1. Provisionar serviço isolado com **volume durável** para app e cliente Nym. Repetir recuperação após recriação do container com identidade fixa, remoção sem ressurreição, supervisão e sonda ponta a ponta. O roundtrip do runtime atual após reinício de processos no mesmo container já passou.
2. Testar aparelhos reais e redes de acesso diferentes, incluindo navegador móvel, troca de rede e suspensão/retorno da aba. O ensaio Mac + VM remota prova transporte entre hosts, não a experiência em iOS/Android.
3. Configurar e conferir domínio HTTPS piloto, proxy que fixa Host/esquema, gateway WSS, portas locais fechadas, logs/backup sem conteúdo ou segredos e observabilidade sem identificadores. Medir vinte clientes reais por tempo sustentado, p95/p99, backlog e timeouts. O health local só confirma socket e armazenamento, não entrega pela mixnet.
4. Obter revisão criptográfica independente da **integração OpenZcash** antes de abertura pública ou alegações equivalentes às de mensageiros auditados.

O serviço Railway `zbo/redesign` não tem volume durável nem Python 3 para o launcher de produção. Após duas recusas iniciais do auto-review por falta de autorização para o payload/destino, o usuário autorizou expressamente enviar **17 JS compilados (88.523 bytes)** ao `/tmp` desse serviço para o ensaio. O teste foi executado sem mexer no deploy, configuração ou rota pública; os processos e o diretório temporário foram removidos. O `tar` macOS também enviou involuntariamente 22 entradas AppleDouble (3.586 bytes) de metadados de proveniência, removidas antes da execução; a [validação operacional](private-chat-pilot-2026-10-15/operations.md) registra a checagem. A autorização foi apenas para esse teste temporário, e um serviço com volume ainda é necessário para provar recuperação durável.

A [release oficial Nym v2026.20](https://github.com/nymtech/nym/releases/tag/nym-binaries-v2026.20-glasgow) aparece como **Latest** em 15/10/2026. Seu status não certifica a integração ou a operação deste chat.
