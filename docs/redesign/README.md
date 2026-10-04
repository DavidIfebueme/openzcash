# Redesign do OpenZcash — escopo, regras e estado

Registro histórico: as rotas administrativas listadas neste plano e em
`route-coverage.json` foram desativadas depois da revisão. Consulte o
`README.md` da raiz para o modelo de segurança atual.

Este documento substitui o plano de 8 de setembro de 2026 (branch
`michae2xl/redesign-grant-org-structure`), que congelava a primeira tela de cada
app e limitava o redesign às telas internas. A decisão tomada no ambiente de
teste de 17 de setembro foi outra, e é a que vale: o redesign cobre o shell e
todas as telas dos apps, inclusive a home. A sala 3D fica como está; do Monthly
ficam congelados as rotas, os dados e as edições publicadas, enquanto a casca
do leitor (`components/monthly/*.module.css`) segue a paleta de produção desde
20/09/2026 (recolorida por lightness: creme, stone e dourado no lugar do papel,
dos cinza-esverdeados e do ouro antigo).

## 1. Fronteira

**Preservado byte a byte** (a guarda falha se a branch tocar):

| Grupo    | Arquivos                                                                                  |
| -------- | ----------------------------------------------------------------------------------------- |
| Monthly  | `src/app/monthly*/`, `lib/monthly/`, `public/monthly/` (a casca em `components/monthly/` segue o tema) |
| Sala 3D  | `office/scene.tsx`, `office-canvas.tsx`, `proposal-dialog.tsx`, `public/office-assets/`   |

**Do redesign**: `layout.tsx`, `app-shell.tsx`, `shell-gate.tsx`, os primitivos
(`ui.tsx`, `data-table.tsx`, `components/workspace.tsx`), a primeira tela de
cada app (`/zcg`, `/zf`, `/zechub`, `/news`, `/wallets`, …) e todas as telas
internas, inclusive a entrada do office (`office/page.tsx`,
`office-entrance.tsx`).

**Contratos que só mudam de forma aditiva** (a guarda avisa): rotas de
`src/app/api/`, repositórios contábeis (`*-repo.ts`), importadores
(`import-*.ts`), política de publicação D-1, `db/schema.ts` e migrações.

Guarda mecânica: `scripts/redesign-scope-check.sh [base]` (padrão `origin/main`).
Uma exceção aprovada passa por `REDESIGN_ALLOW=caminho`.

Desde 20/09 a home (`src/app/page.tsx`, `treasury-overview.tsx`,
`components/app-launcher.tsx`) também faz parte do redesign: ela vive dentro
do shell e as duas tesourarias ficam fixas no rodapé de todas as páginas.

## 2. Onde vive

- Branch: `michae2xl/redesign-staging` (base `origin/main`). Worktree local:
  `/Users/maiconguimaraes/openzcash-redesign`.
- Push na branch publica em https://zbo-redesign.up.railway.app/design-review
  (Railway, environment `redesign`, banco próprio). IDs, credenciais, política de
  coleta e histórico de validação: [`STAGING.md`](./STAGING.md).
- `route-coverage.json` lista o tratamento de cada rota; `data-parity.json`
  registra a cópia do banco de produção.

## 3. Princípios

Para fichas individuais e novas telas, a evolução aprovada segue o visual do
Coinholder e o [padrão de evidências e créditos](../design-and-credits.md).
Créditos discretos no fim da tela são permitidos; não substituem fontes nem
criam um segundo índice de navegação. Ecosystem agora vem logo após ZCG
no modelo compartilhado, preservando suas páginas.

Direção visual aprovada em 20/09/2026 (referência: Mercury; mockups em
https://claude.ai/artifact/Q8VGqjxTubVq1BaJCNbvZY):

1. Um sistema de tokens em `src/app/theme.css`, carregado por último, com a
   paleta de produção: creme `#faf8f4`, superfícies brancas separadas por
   hairline, texto na escala stone, dourado `#b7791f` como único acento para
   estado, ação e valores monetários nas tabelas. Tema claro é o padrão em
   qualquer sistema; o escuro (preto com gradiente leve de dourado) só pelo
   botão. Nenhuma página define cor: as utilidades Tailwind que as páginas usam
   são remapeadas para os tokens dentro de `.rd-content`.
2. Verde e vermelho só para fluxos reais de caixa (entrada/saída, sobre/sob
   orçamento) e vereditos que os exigem.
3. Número é sempre `.tnum`, ganha destaque por tamanho, não por cor; centavos
   e unidades em tamanho menor.
4. Toda cifra tem fonte. Link interno termina em `→`; link externo em `↗` e abre
   em nova aba (`RelatedLinks` faz isso sozinho).
5. Toda tela começa com `PageHeader`: título (28/400) e um subtítulo de uma
   frase que diz de onde o dado vem. Copy editorial entra em `EditorialIntro`,
   nunca no lugar da proveniência. As estatísticas (`Stat`) formam uma faixa
   única dividida por hairlines, sem cards coloridos.
6. Navegação: o modelo em `src/lib/design-routes.ts` é uma lista de apps com
   Monthly e News no topo, depois ZCG (aberto por padrão), FPF, as
   organizações na ordem Zcash Foundation, ZODL, Shielded Labs, Zakura,
   Tachyon, ZecHub DAO, depois Arborist Calls e Communities. Ecosystem vem
   imediatamente após ZCG e agrupa Development, Project histories, DeFi, Z3 e Wallets como páginas (Manage só para
   admin; Lockbox oculto), cada um com logo oficial quando existe. Zakura, ZODL e Tachyon abrem seus registros
   no Ecosystem (`?project=zakura`, `?org=zodl`, `?org=project-tachyon`).
   A home é a visão geral do ZCG: `/` redireciona para `/zcg`, o banner leva
   para lá e não existe item "Home". As tesourarias vivem só na barra do
   rodapé, cada uma ligando à própria página; a antiga home com o launcher
   de apps foi removida (a sidebar e o ⌘K são o diretório). Os apps "de entrada"
   (Monthly, News, Lockbox) não abrem mais a lista. Tudo deriva dele: a sidebar (app com logo, páginas
   expansíveis, contagens), a trilha "App › Página › Detalhe" no topo, o
   único controle de voltar (detalhe → lista, página → app, app → ZCG) e o
   diálogo ⌘K. Nenhum `‹` inline, nenhuma trilha de páginas irmãs nem rodapé
   de página: a sidebar já é o índice. Links contextuais de escape
   ("Totals →") são permitidos porque não são "voltar".
7. Rótulos de status vêm de `src/lib/zcg/status-labels.ts` (grant, veredito ZCG,
   veredito coinholder). Nenhuma tela define o próprio mapa.
8. Tabelas usam `DataTable`: 25/50/100 linhas ou todas, CSV com o texto exibido,
   `mobileHidden` para colunas secundárias, `statusTabs={false}` quando a página
   já filtra por status na URL.
9. Zero scroll lateral, em qualquer largura: `.rd-body` corta o overflow,
   tabelas ocupam a coluna e quebram o conteúdo das células (`overflow-wrap`),
   o layout de registro cai para uma coluna abaixo de 1100px e a barra de
   tesourarias quebra linha. Verificar `scrollWidth <= innerWidth` em 390,
   1024 e 1440px nas listas, no detalhe de grant e nos desembolsos.
10. Ambiente: `OPENZCASH_ENV=redesign` liga a barra de preview, o `noindex` e a
    guarda de isolamento; `DISABLE_AUTO_REFRESH=true` congela a contabilidade
    (a diligência continua a aquecer). Sem essas variáveis o código se comporta
    como produção.
11. Marcas são sempre PNG e soltas: na sidebar e no diálogo ⌘K cada app
    aparece a 20px sem nenhum fundo atrás, em qualquer tema (`.rd-side-logo`);
    os glifos gerados são tinta e invertem para claro no escuro. Logos oficiais em
    `public/logos/`; para apps sem logo, `scripts/gen-app-icons.mjs` gera o
    glifo em tinta sobre transparente (`public/logos/marks/*.png`) e os glifos
    de página em dourado (`public/logos/glyphs/*.png`). A ZF usa só o emblema
    (cadeado-escudo, seis primeiras formas do SVG oficial), legível a 18px.
    Só os chevrons e o botão de fechar continuam vetoriais.
15. Sem colunas laterais: `RecordLayout` empilha o aside (fatos, registros
    conectados) como um rodapé compacto abaixo do conteúdo. Listas densas de
    back office (News é o modelo: abas de fonte com contagem, uma busca, uma
    linha de meta e linhas de 40px).
14. Apps e páginas podem ser `hidden` no modelo: ficam fora da sidebar e do
    ⌘K mas mantêm rota, trilha e voltar. Hoje: Lockbox (abre pelo pool da
    barra), Stipends e Budget (o comitê já traz os dois). As três telas de
    Copilot usam um só layout mínimo (`components/copilot/`), com marcas de
    agentes do `simple-icons` em PNG.
13. Detox: nada miúdo sem motivo. Sem hambúrguer no desktop, sem blocos de
    destaque que repetem uma página que existe (o cronograma na lista de
    grants, o comitê no fim da lista), sem asides só de links ao lado de
    tabelas (Scheduled e ZF ocupam a coluna inteira; o cronograma mostra os
    meses como faixa de filtros em vez de um card por categoria). A barra
    das tesourarias usa a mesma faixa dourada do banner (`--band`), com o
    nome de cada pool em cima e os valores numa só linha de base.
12. Sidebar sem linhas e acompanhando o tema: painel creme `#f3efe6` no claro
    e quase-preto no escuro (tokens `--side-*` nos dois blocos), sem borda à
    direita, sem guia vertical nas páginas aninhadas, sem separador no rodapé
    e sem trilho de scrollbar. O topo é um banner (`.rd-side-banner`) com a
    marca oficial centralizada a 68px e o nome abaixo; sem tag de ambiente e
    sem frase.

## 4. Estado das trilhas

**Trilha A — grants (o dinheiro).** Concluída: listas com a casca compartilhada,
detalhe de grant com progresso, fatos e registros conectados, detalhe de
recebedor, cronograma de pagamentos futuros (`/zcg/schedule`), KPIs de
desembolsos sobre a população inteira, CSV correto. Paridade com a produção
verificada em 19/09 (subtítulos metodológicos, rodapés, links).

**Trilha B — quem decide.** Concluída em `/zcg/committee`:

1. Assentos: os `MemberCard` de `current-committee.tsx` e a linha de mandatos
   por coorte (`COHORTS` e `membersByCohort()` em `current-committee-data.ts`).
2. Eleições: `ElectionsSection`.
3. Remuneração: resumo total e por membro (`lib/zcg/stipends.ts`, compartilhado
   com `/zcg/stipends`), ex-membros marcados.
4. Atas: as últimas cinco, com link para `/zcg/meetings` e para o fórum.
5. Orçamento próprio: `BudgetCards`, com link para `/zcg/budget`.
6. Quem vota: contagem do ZCAP com link para `/zf`, que continua dono do roster.
7. Fonte única: o office deriva seus assentos de `officeMembers()`; a legenda de
   cada cadeira é o primeiro fato com fonte do membro. Uma troca de comitê é uma
   edição em `current-committee-data.ts`.

**Fora do foco, mas alterados**: `/zcg/methodology` e os três copilots só
receberam a casca nova; o texto das regras não mudou.

## 5. Definição de pronto por tela

- [ ] `scripts/redesign-scope-check.sh` passa.
- [ ] Usa os primitivos de `components/workspace.tsx` (`SectionHeading`,
      `Facts`, `RelatedLinks`, `RecordLayout`, `ProgressRail`, `FeatureLink`,
      `EditorialIntro`, `SourceNote`) e `DataTable`. Exceção conhecida:
      `schedule/page.tsx` renderiza uma `<table>` server-side; migra quando
      houver uma tabela server-side compartilhada.
- [ ] Um único controle de voltar; nenhum `‹` inline.
- [ ] Rótulos de status de `status-labels.ts`.
- [ ] Toda cifra com fonte (`↗` externo, `→` interno) e `.tnum`.
- [ ] Testada a 390px e 1280px.
- [ ] `npm run typecheck && npm test && npm run lint` verdes; `next build` passa.
- [ ] Validação ao vivo no staging depois do deploy (as rotas de
      `route-coverage.json` respondem; os textos e cifras conferem).

## 6. Como trabalhar

```bash
cd /Users/maiconguimaraes/openzcash-redesign
npm run dev                                  # http://localhost:3000
npx tsc --noEmit && npx vitest run && npx eslint src
scripts/redesign-scope-check.sh              # compara com origin/main
git push origin michae2xl/redesign-staging   # publica no Railway
```

O worktree compartilha o `.git` com o repositório principal. O banco local pode
estar atrás do snapshot de produção (falta `zcg_publications`); propostas, FPF e
office se verificam no Railway.

## 7. Caminho para produção

Não há merge automático. Quando o redesign for aprovado: abrir PR de
`michae2xl/redesign-staging` para `main`, manter a configuração de produção (sem
`OPENZCASH_ENV`, sem `DISABLE_AUTO_REFRESH`) e deployar. A guarda de isolamento
só age sob `OPENZCASH_ENV=redesign`; `/design-review` continua acessível por URL,
mas só é linkado do shell no preview. Sem mudança de DNS ou domínio.
