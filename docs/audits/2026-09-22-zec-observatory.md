# Auditoria de dados — ZEC Observatory

Revisão em 22/09/2026, aproximadamente 21:54–22:23 em São Paulo (23/09 UTC). Escopo: cinco seções de `/zec-observatory`, cálculos, fontes, atualização e apresentação dos dados. A auditoria foi executada sobre `ea7ff56` e as correções locais desta revisão. Produção e publicação para a comunidade não fazem parte desta entrega.

**Parecer:** apresentável com ressalvas; correções verificadas na prévia local. Completude da revisão: **parcial**. A cobertura é pública e parcial, e não comprova todos os negócios, endereços, contratos, beneficiários ou reservas do mercado. O registro de cobertura distingue unidades inspecionadas de verificações pendentes.

## Correções materiais

### 1. Livros compartilhados inflavam o volume CEX

Coinbase USD/USDC e Gemini USD/GUSD/RLUSD/USDC representam livros unificados. APIs públicas HitBTC, Gleec, FMFW e Bequant também devolveram os mesmos IDs, horários, preços e quantidades para os mercados ZEC/BTC e ZEC/USDT; o nome legado ZEC/USD da FMFW corresponde ao mesmo livro USDT. Contar cada nome como atividade adicional inflava o denominador.

Correção: identificar esses livros explicitamente, preferir a fonte canônica válida e registrar cada alias excluído. Não combinar indiscriminadamente pares de stablecoins de outras exchanges.

No **mesmo snapshot**, dez aliases removidos totalizam **US$236.952.129,95**:

| Medida | Antes | Após corrigir somente os aliases |
| --- | ---: | ---: |
| CEX reportado | US$1.883.011.761,49 | US$1.646.059.631,54 |
| DEX reportado | US$62.351.930,19 | US$62.351.930,19 |
| Participação DEX | 3,20515544% | 3,64970196% |
| Volume DEX adicional para paridade | US$1.820.659.831,30 | US$1.583.707.701,35 |

Esses valores isolam o efeito da correção; não são uma promessa dos números de uma consulta posterior. Fontes: [Coinbase](https://www.coinbase.com/advanced-trade/spot), [Gemini](https://www.gemini.com/blog/introducing-combined-usd-and-usd-stablecoin-order-books), [mercado Coinbase ZEC-USDC](https://api.exchange.coinbase.com/products/ZEC-USDC), [Gemini ZECUSD](https://api.gemini.com/v1/pubticker/zecusd), [HitBTC ZECBTC](https://api.hitbtc.com/api/3/public/trades/ZECBTC), [Gleec ZECBTC](https://api.exchange.gleec.com/api/3/public/trades/ZECBTC), [Bequant ZECBTC](https://api.bequant.io/api/3/public/trades/ZECBTC), [FMFW ZECBTC](https://api.fmfw.io/api/3/public/trades/ZECBTC).

### 2. Falhas e limites de pools desapareciam no fallback

Uma falha posterior do GeckoTerminal descartava páginas anteriores válidas, e a alternativa DEX Screener era tratada como cobertura completa. Na captura do painel, OmniBridge Solana tinha 30 pools e US$33,79 milhões. A consulta independente encontrou 47 pools adicionais nas primeiras três páginas do Gecko, com aproximadamente US$9,87 milhões reportados. As capturas diferem em cerca de dois minutos; não são uma reconciliação simultânea exata. A falha anterior específica não pode ser recuperada porque o status era descartado.

Correção: preservar páginas válidas, propagar falhas e limites de paginação e marcar cobertura parcial no resumo, nos tokens e nas fontes. Deduplicar por rede/endereço continua obrigatório. A quarta página observada tinha mais 18 pools além do conjunto anterior e US$26,68 mil; elevar um limite não provaria cobertura universal.

Fontes: [DEX Screener API](https://docs.dexscreener.com/api/reference), [GeckoTerminal API](https://www.geckoterminal.com/dex-api). Os pools adicionais continham o mint OmniBridge registrado; volume reportado não comprova ausência de wash trading.

### 3. Maya: zero correto, estado operacional ausente

Midgard retornou zero swaps e zero volume na janela exata de 24 horas, com índice sincronizado. A API MayaNode informou `halted=true` e `chain_trading_paused=true` para ZEC. O status `available` do pool não significa negociação ativa.

Correção: mostrar negociação pausada a partir das flags de rede, manter indisponível quando essa consulta falhar e exigir bloco indexado com idade máxima de cinco minutos para aceitar volume atual. O histórico reconciliou **US$273.903.692,18 / 924.489 swaps**, incluindo operações nativas, trade assets e synths. Divisão dos campos USD por 100 confirmada; não reprecificar o histórico pelo preço atual.

Fontes: [MayaNode](https://mayanode.mayachain.info/mayachain/inbound_addresses), [regras de halt](https://docs.mayaprotocol.com/mayachain-dev-docs/concepts/network-halts), [Midgard](https://midgard.mayachain.info/v2/doc).

### 4. Escopo e confiança das métricas

As barras usam spot reportado. Hyperliquid entra pelo **UZEC/USDC spot**, identificado por token e mercado; perpétuos não entram em nenhum dos lados. NEAR Intents fica separado porque uma rota pode executar negócios já contados nos DEXs. A fonte de TVL confidencial NEAR usa a ressalva “Figures shown are illustrative”; a tela agora identifica esse dado como ilustrativo, de todos os ativos e fora da comparação.

As fórmulas de participação, razão DEX/CEX e metas foram recalculadas independentemente. Paridade: participação 50% e razão 100%; superar exige DEX maior que CEX. O volume necessário pressupõe CEX constante, não uma previsão.

Fontes: [Hyperliquid spot API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot), [NEAR Explorer](https://explorer.near-intents.org/), [NEAR Revenue](https://revenue.near.org/). O parser validou o filtro exato ZEC, as datas e o objeto de volume; TVL nunca foi somado a swaps.

## Ampliação solicitada durante a auditoria: Uniswap e PancakeSwap

O CoinMarketCap foi inspecionado diretamente em **DEX + Spot**, páginas 1 e 2. Os mercados Uniswap e PancakeSwap da BNB Chain usam Binance-Peg ZEC, contrato `0x1Ba42e5193dfA8B03D15dd1B86a3113bbBEF8Eeb`. Não são ZEC nativo executado na rede Zcash.

Na leitura de aproximadamente 01:08 UTC, CMC apresentou Uniswap v3 ZEC/USDT com US$1,649 milhão de volume e US$1,030 milhão de liquidez, Uniswap v2 ZEC/UNI com US$472,5 mil e US$1,309 milhão, e PancakeSwap v3 ZEC/USDT com US$1,430 milhão e US$504,3 mil, respectivamente. Há outros pools dos mesmos pares, taxas e versões, portanto uma linha não é o total do protocolo.

A coleta independente confirmou que o primeiro índice omitia pools, incluindo Uniswap ZEC/UNI. O pool `0x047d1ab83d5ca96daeac76ea439eb2fd6f634c0d` respondeu com a factory oficial Uniswap v2 da BNB Chain `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6` e o token Binance-Peg ZEC esperado.

A coleta GeckoTerminal foi ampliada para Base e BNB Chain, com as mesmas proteções contra duplicação, falhas e limites usadas na Solana. Os detalhes por DEX passam a mostrar **volume 24h** e **liquidez dos pools** separadamente. A liquidez soma o valor USD das reservas dos dois ativos dos pools únicos; não é volume, saldo ZEC puro, score de liquidez CEX nem profundidade garantida de execução. Liquidez ausente não vira zero. Os valores CMC e os indexadores têm horários/escopos diferentes e não devem ser forçados a coincidir.

Referência do usuário: [CoinMarketCap Zcash markets](https://coinmarketcap.com/currencies/zcash/?market=spot). Evidência adicional em `dex-liquidity.md` no diretório técnico de wrapped ZEC.

## Supply, custódia, contratos e instituições

- Supply no bloco **3.492.864**: **16.947.232,97804480 ZEC**. Os seis pools somaram exatamente o chainSupply, diferença **zero zatoshi**. Isto reconcilia a resposta CipherScan; não equivale a executar um nó independente ou auditar criptograficamente reservas.
- No snapshot imediatamente anterior do painel, CEX conhecido: **3.593.845,06068156 ZEC**, ou **21,20608949%** do supply daquele bloco. Custódia institucional está incluída; não representa somente saldo disponível para negociação.
- **48 labels únicos**, **500 endereços únicos**, **191 endereços com pelo menos 10 mil ZEC**. Endereços não equivalem a pessoas. Labels são atribuições públicas, não prova independente de titularidade.
- **Onze contratos configurados** conferem com registros de emissores: três Solana atuais (OmniBridge, zenZEC e Universal), cbZEC e outros deployments registrados. Seis supplies atuais e o renZEC legado foram conferidos por RPC com rede, bloco/slot e decimais. Cinco deployments sem leitor continuam indisponíveis. Isso não prova exaustividade nem lastro.
- Kamino: **2.126,18158836 ZEC fornecidos**, reserva e mint confirmados. Não somar depósitos ao supply já emitido. O registro público de reservas foi consultado; outros protocolos de empréstimos não foram inventariados exaustivamente.
- 21shares: **65,76272311 ZEC**, resultado de 5.000 títulos × 0,013152544622 ZEC/título, valuation **22/09/2026**.
- Cypherpunk: **326.417,51 ZEC**; soma das nove transações divulgadas confere. A data exibida **31/08/2026** é a última transação ZEC publicada.
- Grayscale: **464.514,8551 ZEC em 08/09/2026**, confirmado na página oficial indexada. Consulta direta retornou 429; manter como informação datada salva, sem afirmar saldo atual. Trust e ETF sucessor não são dois saldos adicionais.

Fontes: [CipherScan supply](https://api.mainnet.cipherscan.app/api/blockchain-info), [labels](https://api.mainnet.cipherscan.app/api/labels), [Coinbase wrapped assets](https://www.coinbase.com/campaigns/wrapped-assets), [OmniBridge registry](https://1click.chaindefuser.com/v0/tokens), [Zenrock](https://docs.zenrocklabs.io/zenrock-litepaper.pdf), [Universal](https://docs.universal.xyz/docs/developers/contract-addresses), [Binance-Peg](https://explorer.bnbchain.org/asset/ZEC-93E), [Kamino registry](https://api.kamino.finance/markets/collateral-reserves), [21shares](https://api.primary.21shares.com/api/product_details/ZCASH), [Cypherpunk](https://www.cypherpunk.com/), [Grayscale](https://www.thezcashetf.com/).

## Pendências e limites para a apresentação

1. **P2 — um saldo do bridge NEAR:** a API respondeu com 499,24113921 ZEC em 31,10 segundos, além do limite local de 30 segundos. A interface conserva a ausência, sem fabricar zero. Proposta: carregar saldos lentos separadamente do caminho principal, mantendo cache e limite por requisição.
2. **Cobertura parcial e conversão USD:** provedores usam janelas e conversões diferentes. Comparações com Binance/Kraken mostraram divergências compatíveis com conversão pelo preço atual versus preço médio executado, além de horários diferentes. Preservar a palavra “reportado”. Não foi feita reconstrução de todos os trades nem auditoria contra wash trading.
3. **Qualidade upstream:** existem preços anômalos que o agregador não marca como outlier (ex.: Pionex ZEC/BTC). Não removemos mercados por critérios improvisados. Para uma série estritamente comparável, definir e documentar política de preços/qualidade e preferir notional direto das exchanges.
4. **P2 latentes:** atribuição de um futuro pool com dois tokens ZEC pode concentrar seu volume em uma linha de token, mantendo o total global correto; ausência futura de todos os labels Grayscale pode cair no fallback zero no texto comparativo. Não se manifestaram nas capturas atuais. Propostas: preservar membros do pool e renderizar ausência explicitamente.
5. Endereços shielded, contratos fora dos registros conhecidos, fundos não divulgados, reservas dos emissores e toda a atividade confidencial não foram verificados. Não declarar “100% de todo ZEC” ou “reservas auditadas”.

## Evidência e reprodutibilidade

Capturas originais, horários, scripts independentes e relatórios técnicos ficam em `/private/tmp/zec-audit-main`, `/private/tmp/zec-audit-spot`, `/private/tmp/zec-audit-wrapped` e `/private/tmp/zec-audit-holdings`. Os arquivos preservam a evidência deste ambiente e não são dependências da aplicação. A metodologia permanente está em `docs/zec-observatory-methodology.md`.

Verificação final: 411 testes passaram, 8 foram ignorados; lint dos arquivos alterados, compilação de produção e verificação de diff passaram. Reconciliação independente com Decimal confirmou cada soma de volume/liquidez por venue e a participação CEX/DEX. Desktop e celular (390×844) foram inspecionados, incluindo navegação, filtros, atualização, expansão dos tokens, mercados e fundos. Nenhum erro de console observado. Expansão final do painel de fontes não exercitada; sem afirmar cobertura completa de estados visuais.

Snapshot final em 23/09/2026 01:17:08 UTC (22/09 22:17 em São Paulo):

| Protocolo/rede | Volume 24h | Liquidez dos pools |
| --- | ---: | ---: |
| PancakeSwap BNB | US$5.366.675,10 | US$2.424.531,50 |
| Uniswap BNB | US$2.608.610,46 | US$2.685.098,69 |
| Uniswap Base | US$145.749,25 | US$535.196,08 |
| PancakeSwap Base | US$12,45 | US$148,69 |

Pancake BNB: 26 pools; Uniswap BNB: cinco pools, incluindo ZEC/UNI recuperado. A amostra completa continha 151 pools únicos. Cobertura continua parcial. Requisições suplementares são espaçadas em um segundo; respostas parciais com falha são tentadas novamente após 60 segundos. Valores mudam com mercado, índice e horário.

P2 adicional de rastreabilidade: o link principal de uma linha agregada pode abrir apenas a primeira fonte/pool, embora seu valor incorpore pools dos dois indexadores. Os URLs individuais continuam no payload; proposta: disponibilizar todos os contribuintes no detalhe.

Os números abaixo contam defeitos abertos por unidades do inventário; 0/N não significa que todas as verificações passaram, nem percentual de acurácia. A evidência incompleta é declarada em cada categoria.

| Category | Observed defects | Assessment |
|---|---|---|
| Utilidade e completude | 1 / 5 | Cinco perguntas cobertas; um saldo NEAR continua indisponível. |
| Clareza analítica | 0 / 31 | Spot, liquidez, supply e dados ilustrativos separados. |
| Visual e interações | 0 / 37 | Desktop e celular amostrados; expansão final das fontes não exercitada. Partial review: 1 scoped item has incomplete or stale evidence (Source/exclusions details). |
| Autoridade das fontes | 0 / 31 | Fontes públicas identificadas; TVL ilustrativo não confirmado independentemente. Partial review: 1 scoped item has incomplete or stale evidence (Confidential TVL). |
| Precisão dos valores | 0 / 31 | Somas e percentuais reconciliados; cinco supplies e TVL ilustrativo não verificados. Partial review: 6 scoped items have incomplete or stale evidence (Confidential TVL; Token uZEC Polygon; Token uZEC World Chain; and 3 more (see review notes)). |
| Gráficos e rótulos | 0 / 31 | Barras, escalas e rótulos conferidos nos estados amostrados. |
| Fontes e definições | 1 / 31 | Datas e metodologia disponíveis; link agregado não enumera todos os pools contribuintes. |
| Consistência entre visões | 0 / 31 | Snapshot reconciliado; capturas ao vivo não simultâneas e supplies ausentes limitam comparação. Partial review: 15 scoped items have incomplete or stale evidence (CEX/DEX spot bars; DEX share; Parity gap; and 12 more (see review notes)). |
| Controles de qualidade | 2 / 37 | Duplicatas e cobertura corrigidas; timeout NEAR afeta custódia e tabela. Partial review: 1 scoped item has incomplete or stale evidence (Source/exclusions details). |
| Sustentação das conclusões | 0 / 31 | Conclusões limitadas a dados reportados e cobertura pública parcial. |
