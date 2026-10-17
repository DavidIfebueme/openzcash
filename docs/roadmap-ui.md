# OpenZcash — roadmap de interface

## UI-01 — Padronizar botões de links externos em todo o sistema

**Estado:** planejado. Padrão visual aprovado em 17 de outubro de 2026.
**Referência aprovada:** links externos da página Ongoing Test / Crosslink (`/ongoing-test`).
**Implementação atual:** somente a referência local do Crosslink; a adoção global fica para uma próxima entrega.

### Escopo aprovado

Aplicar **apenas o padrão dos botões e links externos** em todas as telas do OpenZcash: fontes, referências, ferramentas, sites de organizações e chamadas para destinos externos.

Este item não inclui replicar o layout do Crosslink, seu menu, seus cards, sua tipografia global ou suas animações. Também não altera links internos, dados, conteúdo ou fluxos de negócio.

### Padrão a reproduzir

- Ícone vetorial próprio de abertura externa, com o dourado do OpenZcash e suporte aos temas claro e escuro.
- Rótulos legíveis e área de clique confortável, mantendo a apresentação compacta.
- Destaques consistentes ao passar o mouse e ao navegar pelo teclado, respeitando a preferência por movimento reduzido.
- Botões discretos para fontes e referências; variações compactas para títulos de ferramentas, marcas e ações principais.
- Domínio de destino na dica do link e indicação acessível de abertura em nova aba.
- Preservação integral do endereço e de seus parâmetros; abertura em nova aba com `rel="noopener noreferrer"` nos links equivalentes à referência, sem criar confirmações intermediárias.

### Próxima entrega

- [ ] Inventariar os links externos de todas as telas, incluindo superfícies com interface própria, e registrar a cobertura por rota.
- [ ] Extrair o padrão aprovado para um componente compartilhado e reutilizar as mesmas variações, sem duplicar estilos entre páginas.
- [ ] Migrar os links externos por superfície, preservando comportamentos específicos como download e protocolos especiais.
- [ ] Validar destinos, abertura em nova aba, foco por teclado, leitores de tela, temas claro/escuro e desktop/mobile.

**Critério de conclusão:** todos os links externos elegíveis seguem o padrão aprovado, com cobertura por rota verificada e eventuais exceções funcionais documentadas. Nenhum redesign geral está incluído nesta entrega.

### Referência de implementação

- Componente `Source`: [crosslink-guide.tsx](../src/app/ongoing-test/crosslink-guide.tsx).
- Estilos `externalLink`, `sourceLink`, `toolLink`, `brandLink` e `primaryLink`: [ongoing-test.module.css](../src/app/ongoing-test/ongoing-test.module.css).
