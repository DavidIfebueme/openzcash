# Private Chat — avaliação funcional, privacidade e prontidão

Data: 15 de outubro de 2026. Branch local: `michae2xl/private-chat`.
Base Git: `c7c94bac8c476ab2563f39a6e54190a993e977a3`, com alterações locais de desenvolvimento já existentes.
Preview: http://127.0.0.1:4430/private-chat.

## Decisão

Bom conceito para conversas temporárias individuais, sem cadastro, com descoberta restrita a um link e transporte pela Nym. **Não liberar para produção aberta nesta versão.** A proteção do conteúdo é real, mas há problemas de controle da reconexão, resistência a abuso e preparação operacional. O protocolo próprio não recebeu auditoria independente nem implementa ratchet.

Esta é uma revisão de código e validação funcional local, não uma certificação de segurança. Nenhuma alteração de aplicação, publicação ou implantação foi feita nesta avaliação. Os usuários Audit Alice e Audit Bob são sintéticos; os testes usam duas abas com identidades distintas no mesmo navegador/computador, conectadas à rede Nym real. Isso não substitui dois aparelhos, redes independentes ou testes em dispositivos móveis.

## Evidência funcional

| Cenário | Resultado e alcance |
| --- | --- |
| Alias e conexão explícita | Duas identidades temporárias conectaram; a rota só ficou verificada após retorno pela Nym. |
| Convite direto e consentimento | Pedido apareceu no destinatário; o compositor permaneceu bloqueado antes de aceitar. |
| Recusar | O remetente recebeu a recusa e a conversa não abriu. |
| Revogar convite copiado | O pedido não abriu conversa; o solicitante continuou esperando em vez de receber aviso imediato de revogação. Também coberto em teste automatizado. |
| Expiração e adulteração | Regras de 5 minutos, assinatura, rejeição de convite expirado e aceite tardio verificadas com relógio controlado nos testes. Não foi feita uma espera manual integral de 5 minutos no navegador. |
| Comparar código | Os códigos de segurança das duas sessões coincidiram. Isso compara chaves; um alias continua sem identidade civil verificada. |
| Mensagens reais | Envio e confirmação nos dois sentidos; português, símbolos e emojis. Texto `<b>texto literal</b>` apareceu literalmente, sem gerar elemento HTML. |
| Destinatário desconectado | Mensagem ficou aguardando e depois sem confirmação, em vez de mostrar entrega falsa. |
| Reconexão manual e reenvio | Histórico preservado; foi necessário Check connection e Retry. A mensagem recuperada apareceu uma vez no destinatário e ficou Delivered no remetente. |
| Queda de internet simulada | A rota voltou e o contato foi autenticado novamente. O switch apresentou o problema descrito em F1. |
| Encerrar conversa | O outro usuário recebeu Conversation ended e não podia continuar enviando. |
| Discover por padrão | Entrar na sala não publicou presença. Só o opt-in tornou Alice visível. |
| Convite via Discover em sessão nova | Pedido chegou, foi aceito e mensagens receberam confirmação nos dois sentidos pela Nym. |
| Retirar disponibilidade | Off revogou o convite local; após atualizar, Bob viu a lista passar de 1 para 0. |
| Isolamento de salas | Alice publicada na sala A não apareceu para Bob na sala B; apareceu quando Bob entrou na sala A pelo link. |
| Recarregar / Leave & clear | Alias, sala e histórico desapareceram da interface; conexão voltou desligada. Isso não prova apagamento forense da memória ou do armazenamento do SDK. |
| Discover após interrupção | Um pedido após queda/restauração de rede não apareceu na sessão destinatária, mesmo após reenvio; a disponibilidade posteriormente voltou a off. Causa não determinada. Não classificado como aprovado. O fluxo em identidades novas funcionou. |

Uma aba de teste anterior deixou de estar acessível à ferramenta durante a execução. O cenário offline foi reiniciado com uma nova identidade e concluído; a interrupção da ferramenta não foi atribuída à aplicação.

As sessões fictícias foram encerradas ao final, a simulação de falta de rede foi removida e o preview ficou na tela inicial. Nenhuma chave ou link de convite foi incluído nos artefatos salvos.

### Verificações automáticas desta avaliação

- 89 testes passaram em 16 arquivos: convite, protocolo, envelopes, presença, API, controlador, transporte, compositor, interface, navegação e limites de produção/CSP.
- TypeScript (`tsc --noEmit --incremental false`): aprovado.
- ESLint focado nos módulos do chat, API e scripts do worker: aprovado.
- `git diff --check`: aprovado.
- Auditoria npm das dependências de produção: zero avisos conhecidos. Isso não equivale a auditoria do protocolo, do binário Rust/WASM nem da infraestrutura.
- Não foi executada a suíte inteira do OpenZcash nem um novo build de produção nesta rodada. A instância de desenvolvimento usa o mesmo diretório `.next`; a validação de publicação deve ocorrer em ambiente isolado.

## Como funciona e quem observa o quê

1. O navegador gera uma identidade temporária, sem telefone, email ou carteira.
2. O usuário liga a Nym. Um worker local carrega o SDK WASM e verifica uma ida e volta pela mixnet.
3. Um convite assinado vincula alias, chave pública, endereço Nym e validade. A outra pessoa solicita e o dono aceita.
4. O navegador cifra mensagens com `crypto_box_easy` antes de enviá-las pela Nym. O destinatário decifra e responde com uma confirmação autenticada.
5. Discover é separado: cada sala tem um segredo aleatório no fragmento do link; o navegador cifra a presença com uma chave derivada. O servidor recebe o registro cifrado por HTTP normal — HTTPS quando hospedado em produção.

| Observador | O que pode observar hoje |
| --- | --- |
| Outra pessoa na conversa | Mensagens, alias, chave pública e endereço Nym dessa identidade temporária. Pode copiar ou capturar a conversa. |
| Alguém com o link da sala | Participantes que optaram por aparecer, seus convites/aliases e endereços Nym. Não recebe por isso as chaves secretas das conversas individuais. Pode encaminhar o link. |
| Servidor/CDN OpenZcash | IP e horários ao carregar o site. No Discover: ID opaco da sala, identificador público de presença, revisões, validade, padrão de consultas/renovações e conteúdo cifrado. Pode correlacionar acessos à mesma sala, mesmo sem decifrar aliases. |
| Gateway de entrada Nym / API de bootstrap | Conexões e metadados do cliente conforme a função do serviço. A mixnet reduz a ligação entre origem e destino; não torna o navegador invisível a todos os componentes. |
| Site comprometido, XSS ou extensão maliciosa | Pode acessar o conteúdo no navegador e potencialmente as chaves em uso. A cifragem de transporte não protege um endpoint comprometido. |

Na inspeção das requisições do Discover, o corpo de upsert continha somente `op`, `room`, `owner`, `sealed`, `expiresAt`, `revision` e `signature`. `sealed` tinha 2.784 caracteres (2.088 bytes codificados). O alias e o token da sala não estavam em texto aberto. Não havia Cookie e Referer estava vazio; a política era `no-referrer`. O ID opaco e o ritmo de acesso permanecem observáveis.

O diretório consulta a cada 5 segundos quando aberto, renova presença a cada 15 segundos e usa uma lease de 45 segundos. Os convites duram 5 minutos. Um registro/tombstone pode permanecer na memória até a expiração do convite, mesmo depois de sair da listagem.

## Achados e critérios para resolver

### F1 — P1: switch não representa a intenção de reconexão offline

**Reproduzido no navegador e confirmado no código.** Ao perder a internet, o switch mostra off, mas `wanted` continua true. Clicar enquanto offline chama reconnect, não disconnect; o usuário não consegue cancelar a intenção de reconectar por esse controle. Ao restaurar a rede, o switch volta a on e a conexão reinicia.

Referências: `src/app/private-chat/private-chat-preview.tsx:349–370`; `src/lib/private-chat/controller.ts:216–303`.

Correção necessária: modelar separadamente intenção ligada/desligada e estado da rota. O switch deve controlar a intenção mesmo offline, em falha ou retry; um off deve cancelar todas as tentativas. A etiqueta pode continuar indicando offline/checking. Testar queda → off → rede de volta sem criar worker, sem presença e sem tráfego de chat; testar on pendente → retorno normal.

### F2 — P1: quota global do Discover é fácil de esgotar

**Reproduzido em processo isolado, sem atingir o servidor do preview.** Uma identidade de assinatura gerada localmente, usando salas aleatórias e blobs com tamanho válido, obteve 200 gravações aceitas; a 201ª retornou 503. Nenhuma chave de sala foi necessária. O servidor verifica autoria da gravação, mas não comprova pertencimento à sala. Um cliente arbitrário pode gerar suas próprias chaves; Origin não é autenticação para clientes fora do navegador.

Referências: `src/lib/private-chat/presence-store.ts:30–63`; `src/lib/private-chat/presence.ts:38–59`; `src/app/api/private-chat/presence/route.ts:24–68`.

Correção necessária: admissão e limitação de abuso compatíveis com o modelo de privacidade, quotas que não permitam monopolizar a capacidade global, limites de processamento e teste de carga. Evitar resolver apenas com logs permanentes de IP ou identificadores globais. Limitar a fila de mensagens recebidas e o custo de verificações também merece revisão (`controller.ts:319–327`). Não houve teste de exaustão de recursos na rede pública.

### F3 — P1 de prontidão: produção ainda está deliberadamente desabilitada

`config.ts` bloqueia a página e API em produção mesmo com a flag de preview. O CSP de produção não autoriza as conexões Nym/WASM necessárias. O preparo dos arquivos do SDK roda em predev, mas não em prebuild; os arquivos gerados são ignorados pelo Git. Um checkout limpo de produção não deve depender de resíduos do preview.

Referências: `src/lib/private-chat/config.ts:1–4`; `next.config.ts:23–34`; `package.json` (predev/prebuild); `scripts/stage-private-chat-nym.mjs:5–18`.

Correção necessária: pipeline reproduzível com worker e WASM versionados, build isolado, CSP adequada e mínima, implantação HTTPS de staging, teste completo dos arquivos servidos e configuração de gateways. Ativar uma flag sozinha não conclui esse trabalho.

O diretório ainda é um Map na memória de um processo: reinícios removem presença e réplicas podem discordar. Definir operação com uma instância ou serviço TTL compartilhado antes de escalar; manter revisões/remoção atômicas e retenção curta.

### F4 — P2 funcional: recuperação e pedidos precisam de maior confiabilidade

O fluxo direto funciona, mas após timeout o remetente precisou de Check connection antes de Retry. Um pedido do Discover após restauração de rede não completou nesta execução. O teste não determina se a causa está em perdas/temporização na Nym, no ciclo do worker ou no protocolo. Esse cenário deve ser diagnosticado antes de afirmar reconexão transparente.

Critérios: repetir perdas, retornos simultâneos, destinatário offline, aba suspensa e troca de rede; medir tempos de conexão/aceite/entrega; tratar retries com idempotência e prazo claro. Convites revogados devem terminar de maneira compreensível para quem solicitou, sem prometer disponibilidade instantânea. Manter diferenciação entre enviado, confirmado e lido — atualmente não há recibo de leitura.

### F5 — limite de segurança: sem ratchet e sem auditoria independente

`crypto_box_easy` usa primitivas estabelecidas (X25519, XSalsa20 e Poly1305), mas a chave de box permanece a mesma durante a identidade da aba. Nonces aleatórios não são rotação de chaves. Se essa chave for comprometida e ciphertexts da aplicação estiverem disponíveis, mensagens dessa sessão poderão ser decifradas; não há sigilo futuro por mensagem nem recuperação pós-comprometimento equivalente a um Double Ratchet.

Referências: `src/lib/private-chat/identity.ts:17–35`; `src/lib/private-chat/envelope.ts:19–50`.

Para promessa forte de mensageiro privado: adotar um protocolo revisado com ratchet, validação de identidade apropriada e revisão externa. Não inventar um ratchet próprio como ajuste rápido. Até lá, descrever honestamente o escopo experimental e não posicionar como proteção para comunicações de alto risco.

### F6 — limites de privacidade/isolamento e ciclo de vida

- Discover via HTTPS comum permite correlação de salas por IP/horários. Pode ser aceitável no piloto com aviso explícito; para uma promessa de privacidade de metadados também contra o operador, o diretório precisa de outra arquitetura (por exemplo acesso protegido via mixnet/onion, avaliado separadamente).
- O chat compartilha a origem e o shell do restante do site, inclusive componentes e chamadas normais de navegação. Não foi encontrada integração que envie mensagens do chat ao Zarvis; ainda assim, uma origem mínima dedicada reduziria a superfície de comprometimento.
- O SDK conserva armazenamento de transporte cifrado em IndexedDB. A passphrase e as chaves de chat são temporárias; Leave limpa as referências e zera arrays do aplicativo, mas não apaga os bancos do SDK nem garante apagamento forense em JavaScript. Definir limpeza e descrição de retenção.
- O fragmento do convite direto não é removido ao enviar o pedido, ao contrário da entrada por link de sala. Embora não contenha a chave secreta de mensagens, expõe alias/chaves públicas/endereço Nym a quem acessar URL/histórico. Remover após consumo e conferir histórico/clipboard/compartilhamento.
- O segredo da sala funciona como capacidade compartilhável. Não há expulsão de um participante nem rotação do mesmo link com revogação individual. Criar outra sala é a alternativa atual.
- Logs do provedor, CDN, proxy e política efetiva de retenção não foram auditados. Não prometer “zero logs”.

## Escopo de produto recomendado

Posicionar como **conversas temporárias um a um para a comunidade**, com entrada por convite e metadados de transporte protegidos pela Nym dentro dos limites descritos. A ausência de conta/carteira reduz atrito e coleta. Salas privadas ajudam a encontrar pessoas sem um diretório global.

Hoje não é um substituto completo para Signal/WhatsApp/Discord: há uma conversa por vez, limite de 200 mensagens por sessão e 400 unidades UTF-16 por mensagem, sem histórico recuperável, múltiplos dispositivos ou entrega offline garantida. A latência da mixnet faz parte do modelo; não foi produzido benchmark estatístico de latência, bateria ou banda.

## Ordem de liberação

1. Resolver F1 e F2; diagnosticar a falha de recuperação de F4 e cobrir os cenários com testes de regressão relevantes.
2. Definir modelo de ameaças, garantias publicáveis, retenção e isolamento. Decidir ratchet/protocolo antes de prometer proteção forte.
3. Preparar build/CSP/ativos e diretório de produção em staging, com observabilidade sem conteúdo/chaves e com retenção limitada.
4. Testar dois aparelhos e redes diferentes, Safari/iOS/Android, background/suspensão, gateway indisponível, reconexões repetidas, carga, consumo e dependências.
5. Revisão externa e piloto fechado opt-in, com limites visíveis. Só depois avaliar abertura pública; o resultado desta rodada não autoriza afirmar que produção já está pronta.

## Fontes primárias

- [Nym — limitações e modelo de aplicação](https://nym.com/docs/developers/limitations): mixnet protege o transporte; identidade e comportamento no destino ainda dependem da aplicação.
- [Nym — TypeScript quick start](https://nym.com/docs/developers/typescript/quick-start): referência de integração e comportamento do cliente; o pacote instalado deve ser validado independentemente da documentação mais recente.
- [Libsodium — authenticated public-key encryption](https://doc.libsodium.org/public-key_cryptography/authenticated_encryption): algoritmo e limites de uso das caixas autenticadas.
- [Signal — Double Ratchet specification](https://signal.org/docs/specifications/doubleratchet/): evolução de chaves, sigilo futuro e recuperação após comprometimento.

Os resultados desta revisão se referem ao código local e aos cenários observados nesta data. A documentação dos fornecedores explica mecanismos; não certifica a segurança desta implementação.

## Artefatos desta avaliação

- [Conversa recuperada após desconexão](audits/private-chat-2026-10-15/conversation.jpg).
- [Conversa iniciada no Discover, com entrega confirmada](audits/private-chat-2026-10-15/discover-conversation.jpg).
- [Estado incoerente do switch durante falta de internet](audits/private-chat-2026-10-15/offline-switch.jpg).
- [Eventos sanitizados e resultados](audits/private-chat-2026-10-15/evidence.json).

As imagens mostram somente usuários e mensagens fictícios. Elas registram a validação; as sessões mostradas já foram encerradas.
