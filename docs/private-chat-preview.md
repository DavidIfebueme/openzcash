# Private Chat — preview local

Atualizado em 15 de outubro de 2026. Branch `michae2xl/private-chat`; desenvolvimento local, sem publicação em produção.

## Revisão de 22 de outubro de 2026

- **Pedidos pendentes.** Aceitar um pedido não apaga os demais nem o convite. Os pedidos ficam em **Requests**, na barra lateral, com Accept e Decline em cada um; novos pedidos continuam chegando enquanto o convite vale (5 minutos) e a expiração limpa só o que ainda está pendente. Um link de quem já pediu é respondido em vez de gerar um pedido de volta; pedidos simultâneos se resolvem pela ordem das chaves (a menor cede e lista o pedido da outra).
- **Responder citando e reagir.** Passar o mouse sobre um balão (ou tocá-lo no celular) mostra Reply e React. A resposta carrega só o id da mensagem citada (`re` no pacote `text`), nunca o texto, e tocar na citação volta ao original. Reações usam um conjunto fixo de seis emojis (👍 ❤️ 😂 😮 😢 🙏), uma por pessoa por mensagem, no pacote `react` dentro do ratchet; não contam no limite de 200 mensagens nem são persistidas.
- **Discover escondido.** A aba Discover, a sala e a disponibilidade só aparecem com `NEXT_PUBLIC_PRIVATE_CHAT_DISCOVER=true` no build. Sem a flag, links `#room=` viram um aviso e as variáveis do diretório deixam de ser obrigatórias no piloto. O código do diretório permanece para uma limpeza posterior.
- **Celular com chat aberto.** O painel de status da rede sai do cabeçalho compacto, o documento não rola sob o shell de altura fixa e html/body seguem a cor do tema.

## Revisão anterior

O Discover migrou para mensagens Nym, com bloqueio de acesso direto e correções de reconexão. Consulte [o funcionamento, limites e execução atualizados](private-chat-discover-nym.md). As notas abaixo preservam o estado anterior à migração; menções a HTTP e aos prazos de 15/45 segundos foram substituídas pela revisão acima.

## Fluxo anterior à migração

- Cada aba gera uma identidade temporária e conecta à Nym somente por ação da pessoa.
- O **Discover** exige uma sala por link privado `ozroom1`. Criar ou entrar em uma sala não torna a pessoa visível. Não há lista pública nem consulta global. A chave fica no fragmento do link; ao entrar, o fragmento é retirado da barra de endereço.
- **Available to chat** começa desligado. Ao ligar, o navegador cifra o convite com a chave da sala antes de enviá-lo ao diretório por até cinco minutos. A assinatura de presença usa uma identidade separada da identidade do chat, renovada a cada entrada em sala. Desligar revoga imediatamente o convite atual e limpa pedidos pendentes, mesmo se a remoção HTTP falhar.
- A presença recebe uma renovação a cada 15 segundos, com validade máxima de 45 segundos desde a última renovação. Uma aba encerrada sem aviso pode permanecer visível por esse intervalo. O diretório é atualizado a cada cinco segundos enquanto o Discover está aberto.
- Convites `ozchat3` têm validade de cinco minutos e assinatura Ed25519 sobre alias, chave, endereço Nym, identificador e datas. A chave de cifragem deve corresponder à chave de assinatura. Convites antigos sem validade não são aceitos pelo fluxo atual.
- **Request chat** envia um pedido cifrado. A pessoa convidada escolhe **Accept** ou **Decline**. Não é possível enviar texto antes do aceite. Aceitar consome o convite e retira a pessoa do diretório. **Revoke**, disponibilidade desligada, saída da sala, expiração e desconexão invalidam novos pedidos. Uma nova disponibilidade gera outro convite; cópias anteriores continuam inválidas.
- Uma sessão mantém uma conversa por vez, até 200 mensagens de 400 caracteres. Balões distinguem recebidos e enviados, com horário e estado de entrega. **Delivered** exige confirmação autenticada do destinatário; não significa que a pessoa leu.
- Sem confirmação em 60 segundos, aparece **No confirmation**, o contato deixa de estar pronto para envio e começa uma nova verificação autenticada do contato. Reenviar exige a confirmação do contato e preserva o identificador; o destinatário confirma novamente sem duplicar a mensagem.
- **Route verified** só aparece após o retorno de um desafio aleatório cifrado enviado ao próprio endereço pela Nym. A rota é reavaliada a cada 30 segundos, com prazo de 60 segundos para retorno. Uma falha silenciosa retira a disponibilidade e dispara reconexão. A indicação comprova a última verificação, não disponibilidade contínua nem que o contato está online.
- Desconectar preserva a conversa na memória da aba. Reconectar reutiliza as credenciais Nym daquela sessão e realiza uma confirmação autenticada do contato antes de liberar o envio. Falhas detectadas tentam novamente após 2, 5 e 10 segundos. Desligar manualmente cancela essas tentativas. A disponibilidade nunca volta a ligar sozinha.
- **Leave & clear session** apaga a identidade da aplicação e a conversa da memória. Recarregar ou fechar a aba não permite recuperar esse histórico.

## Interface do chat

- Uma área de conversa com lateral compacta para alias, **Chats**, **Discover** e disponibilidade. O logo Nym verde, o estado da rota e um controle de liga/desliga ficam juntos abaixo do alias, dentro da lateral. O controle permanece visível durante a conversa no celular; amarelo indica conexão em andamento e verde exige a verificação da rota.
- Balões de entrada e saída, agrupamento de mensagens consecutivas, horário e ícones de confirmação. Emojis enviados sozinhos recebem destaque; confirmação de entrega não significa leitura.
- Compositor fixo na base da conversa, com Enter para enviar, Shift+Enter para nova linha e seletor local de emojis com busca e categorias. Inserção respeita o cursor, a seleção e o limite de 400 unidades UTF-16 já usado pelo protocolo. Não há busca externa, carregamento remoto ou armazenamento de emojis recentes.
- **Quick guide & FAQ** começa fechado na mesma página. Reúne tutorial em três passos e respostas sobre acesso, Discover, privacidade, entrega, histórico e convites. Os limites de privacidade continuam explícitos na ajuda.
- No celular, uma conversa aberta reduz a lateral a duas abas para dar espaço às mensagens. O alias e os controles da sessão continuam disponíveis em Discover; a conexão permanece acima das abas, dentro do chat.

## Privacidade e limites

O diretório continua passando pela conexão normal com o OpenZcash, fora da mixnet. Ele recebe um identificador opaco de sala, uma chave de assinatura temporária, revisões, horários de expiração e um envelope cifrado de tamanho fixo. Não recebe alias, chave do chat, endereço Nym ou chave da sala em claro. O convite é preenchido até 2048 bytes e cifrado com XChaCha20-Poly1305, vinculando sala, emissor, operação, revisão e expiração como dados autenticados. A chave e o identificador da sala derivam de um segredo aleatório de 256 bits com domínios distintos.

O servidor ainda pode observar IPs, horários, acesso à mesma sala, quantidade de participantes e continuidade de uma presença. HTTP usa POST, sem cookies e sem referrer. A rota não registra os corpos dos pedidos; isso não afirma ausência de registros em proxies, infraestrutura ou no navegador. Quem recebe o link pode compartilhá-lo e ver participantes que optarem por aparecer. Não há lista de membros autorizados nem expulsão individual: criar outra sala gera uma nova chave. A sala não possui expiração global; as presenças e convites expiram, e sair limpa a chave desta aba.

As mensagens e pedidos usam caixas autenticadas de ponta a ponta e trafegam pela Nym. O diretório nunca recebe o conteúdo da conversa. Não existe fallback de mensagens para HTTP comum. Aliases são autodeclarados: o código de segurança deve ser comparado por um canal confiável para confirmar quem está do outro lado. Este protocolo não foi auditado e não implementa Double Ratchet nem promete sigilo futuro.

O conteúdo e as chaves da aplicação ficam em memória. O SDK Nym mantém material de transporte cifrado em IndexedDB; a senha aleatória para acessá-lo existe somente na sessão da aba. **Leave** não é uma garantia de eliminação forense nem de remoção dos bancos cifrados criados pelo SDK. Não há recuperação de conta, histórico persistente, múltiplos dispositivos ou promessa de entrega offline.

O diretório usa memória de um único processo, limite de 200 registros no total e 50 por sala e revisões assinadas para impedir que uma renovação atrasada desfaça a remoção. Não é um serviço distribuído pronto para produção. Abuso, limitação de taxa, retenção na infraestrutura e auditoria do protocolo precisam ser resolvidos antes de um lançamento público.

## Escopo do preview

A rota, a navegação e a API exigem `NODE_ENV=development` e `NEXT_PUBLIC_PRIVATE_CHAT_PREVIEW=true`. Em produção a API e a página respondem 404 e a navegação fica oculta, inclusive com a flag de preview. As exceções de CSP para WASM e gateways WSS continuam limitadas ao ambiente de desenvolvimento. O worker próprio desativa estatísticas do cliente, mantém TLS e não remove tráfego de cobertura nem atrasos da mixnet.

## Validação

- Regressões de convites copiados após desligar, limpeza de pedidos pendentes, isolamento de salas, adulteração do envelope, chave incorreta, ausência de segredos no pedido HTTP e falha silenciosa do transporte.
- Testes automatizados de assinatura e adulteração, expiração, aceite/recusa/revogação, presença temporária, remoção concorrente, confirmação e deduplicação, reconexão, callbacks tardios e bloqueio em produção.
- Testes de UI com entradas assinadas: estado vazio e indisponível distintos, liga/desliga, convite, limpeza da sessão, abas por teclado e FAQ inicialmente fechado. O compositor cobre busca de emoji, inserção no cursor, substituição de seleção, limite de mensagem, Escape, clique externo, Enter, Shift+Enter e composição de texto.
- Teste real no navegador, repetido com salas cifradas: duas abas abriram a mesma sala por link, verificaram a rota Nym, descobriram uma presença, aceitaram o pedido e trocaram mensagens confirmadas nos dois sentidos. Uma aba desconectou, reconectou com o histórico preservado e entregou outra mensagem confirmada. As sessões de teste foram encerradas ao final.
- Depois do redesign, duas sessões de teste aceitaram um convite direto e trocaram mensagens pela Nym, incluindo emoji selecionado pela busca e emoji isolado, com confirmação de entrega. Temas claro/escuro, seletor, Discover e ajuda móvel conferidos; largura útil de 375 px sem rolagem horizontal.
- Suíte focada: 89 testes em 16 arquivos, incluindo proteções de produção, navegação e CSP; tipos e lint também verificados.
- A origem da API considera o Host do pedido para funcionar também quando Next usa localhost internamente e o preview é acessado por 127.0.0.1. Pedidos cross-site continuam rejeitados.

Referências de transporte: [quick-start oficial da Nym](https://nym.com/docs/developers/typescript/quick-start), [limitações](https://nym.com/docs/developers/limitations) e [pesquisa preliminar](private-chat-nym-spike.md).
