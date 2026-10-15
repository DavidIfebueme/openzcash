# Private Chat — correções da auditoria

> Registro da primeira rodada. A implementação do ratchet e as validações posteriores de build/navegador/rede estão em [Validação do ratchet](private-chat-ratchet-validation-2026-10-15.md). As pendências e resultados abaixo descrevem o estado anterior.

Data: 15/10/2026. Branch local `michae2xl/private-chat`, base `c7c94bac8c476ab2563f39a6e54190a993e977a3`. Alterações locais preservadas; sem merge ou deploy.

## Resultado

Os achados reproduzíveis de autorização do Discover, consumo de quota por lixo, ciclo de convites/reconexão e exposição desnecessária na interface foram corrigidos e ganharam regressões. Um runtime isolado de piloto foi implementado com resposta anônima, armazenamento persistente cifrado e recuperação após crash.

**Ainda não aprovar produção aberta.** A implementação do runtime não substitui a validação real com o cliente Nym nativo. O protocolo de conversa continua sem ratchet e sem revisão criptográfica independente. Ver [decisão criptográfica](../private-chat-crypto-decision.md) e [roteiro do piloto](../private-chat-pilot-runbook.md).

## Correções

| Achado | Mudança e limite |
| --- | --- |
| Lixo consome toda a quota | Frames de tamanho impossível, operações inválidas, salas não admitidas e replay são rejeitados antes de consumir a cota válida. Limites por sala e para trabalho concorrente; respostas a rejeições têm orçamento separado. |
| Presença sem autorização de sala | Salas v2 derivam chaves distintas para cifragem e assinatura. Listar/publicar exige prova de acesso à sala. Produção exige allowlist de IDs públicos com vagas reservadas. |
| Republicação de convite alheio | O emissor autoriza por assinatura convite, sala, publicador e prazo. O cliente rejeita grant incompatível após decifrar; conhecer o link da sala não permite fazer um convite alheio aparecer como legítimo. Membros ainda podem consumir a própria quota ou compartilhar manualmente o link. |
| Capacidade e churn | Paginação com seis entradas, cotas por sala, vagas online separadas de tombstones/revisões antigas. Piloto deliberadamente limitado a duas salas de dez pessoas; a capacidade para 50 foi testada em memória, não validada como carga real Nym. |
| Endereço arbitrário para resposta | Runtime piloto exige SURB fornecido pelo transporte. Pedido não contém replyTo; o serviço não aceita escolher terceiro como destino. Modo de endereço permanece apenas no sidecar de desenvolvimento, sem fallback automático. |
| Reinício troca identidade e perde remoções | Identidade da aplicação e snapshot autenticado/cifrado persistem. Confirmação só após gravação atômica e fsync. Leases preservam prazo original; removidos não reaparecem por replay após restart. Persistência do endereço Nym depende também do volume do cliente nativo. |
| Crash deixa lock órfão | Launcher POSIX adquire flock e passa o descritor ao Node por exec. Teste mata o processo com SIGKILL, restaura com a mesma identidade e bloqueia a segunda instância concorrente. |
| Mudança da allowlist bloqueia restore para sempre | Snapshot vencido é validado e podado antes de aplicar a nova admissão. Registros ainda válidos de uma sala retirada bloqueiam startup até TTL; não apagar snapshot para contornar. |
| Aceite após cancelar | Revalidação de identidade, chave e estado imediatamente antes de enviar pacotes após operações assíncronas. Cobertura também para rejeição antiga e novo convite. |
| Aceite perdido ou pedido com endereço antigo | Reenvio autenticado do aceite e atualização sequenciada da rota do pedido. Ciphertext antigo não substitui uma rota mais nova. O formato estrito pré-publicação mudou; ambos clientes precisam ser atualizados juntos. |
| Convite no histórico/URL | Fragmento copiado para estado temporário e removido imediatamente ao abrir. Links de sala v1 deixam de funcionar; criar novos links v2. |
| Navegação, BFCache, identidade e copy | Leave limpa sessão; pagehide e retorno BFCache não preservam conversa nem reconectam automaticamente. Ação explícita para nova identidade, código de segurança visível, logo neutro até rota verificada e FAQ com limites de IP/retensão/correlação. |
| Superfície compartilhada | Chat usa shell mínimo, sem Zarvis/tesouraria. Entrada e saída por navegação completa. Configuração de origem isolada com rotas do portal bloqueadas, nonce e CSP específico, worker próprio e gateway WSS fixado. |
| Publicação/operabilidade | Prebuild prepara assets fixados e manifest SHA-256. Runtime Node separado, loopback apenas, métricas agregadas, fail-closed na queda do socket/erro de armazenamento e flags explícitas de piloto. Não houve publicação. |

## Evidência nesta rodada

- Rodada final focada: **135/135 testes em 21 arquivos**. A última restrição de subcaminhos do chat também foi repetida: **3/3**. TypeScript completo, compilação do runtime Node, ESLint dos arquivos alterados e git diff --check passaram. Testes complementares do projeto: **56/56**.
- Teste do runtime usa WebSocket nativo **simulado**: sobe o processo real, publica/lista/remove via SURB, verifica identidade após restart e SIGKILL, rejeita replay e encerra na perda do socket. Isso não comprova entrega pela mixnet real.
- Suíte integral: 3.853 passaram, 12 ignorados e seis excederam o timeout de cinco segundos em Monthly/PDF, OG e relatório Zarvis. Os três arquivos foram repetidos isoladamente: **30/30 passaram**, sem mudar código dessas áreas nem o timeout global.
- Auditoria npm: **zero avisos nas dependências de produção**. Nove avisos em ferramentas de desenvolvimento (4 moderados, 5 altos); não foi aplicado autofix com downgrade de toolchain. Tratar atualização do tooling em mudança separada.
- Resposta real do preview local: página e worker HTTP 200, CSP específico, nonce no documento e no-referrer. O Next dev usa Cache-Control no-cache; a política da versão servida de produção precisa ser conferida separadamente.
- Build completo Next/webpack isolado: prebuild e contratos de erro/cards passaram; a compilação foi interrompida após mais de 15 minutos sem concluir, para liberar recursos locais. **Build de produção não validado**; não houve servidor de produção/staging nem publicação. O distDir separado preservou o preview de desenvolvimento.
- O diretório de desenvolvimento foi restaurado e confirmou conexão real à Nym. Isso é evidência do sidecar WASM local, não do novo runtime nativo.
- A inspeção do navegador iniciou e mostrou o shell isolado/controles, mas a ferramenta de navegador sofreu timeouts ao tentar validar duas abas. Não reapresentar os testes reais da rodada anterior como evidência desta versão.

## Pendências antes de abrir o piloto

1. Concluir build servido/staging HTTPS com domínio e gateway reais: nonce, hidratação, CSP/WASM e rotas bloqueadas. Validar a configuração operacional dos logs/volumes/segredos.
2. Instalar o cliente Nym nativo fixado em ambiente Linux e provar roundtrip SURB com o navegador atual. Nesta máquina não há binário nativo instalado nem daemon Docker disponível; a compatibilidade real ainda não foi certificada.
3. Dois dispositivos/redes e navegadores móveis, perda de gateway, suspensão, reconexão, reinício e carga sustentada de duas salas. Health local não significa saúde ponta a ponta; usar sonda separada.
4. Ratchet mantido e revisão independente antes de prometer proteção de longo prazo ou equivalência ao Signal. A ausência dessas propriedades está explícita no FAQ/ADR.
5. Admitir os limites do piloto: membro malicioso ainda pode esgotar a própria sala; IP permanece visível ao host HTTPS/API/gateway; pseudônimo é correlacionável até troca explícita de identidade. Não há acesso onion implementado nesta mudança.

A auditoria original fica preservada como histórico. Este documento distingue correção em código, teste local, teste real de rede e aprovação de lançamento.
