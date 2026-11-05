# Créditos e recursos

Mecha Arena é um projeto pessoal de Victor, criado a partir de suas regras de jogo de tabuleiro, com desenvolvimento assistido pelo Codex. Os bots usam políticas programadas e não fazem chamadas a modelos de linguagem durante as partidas.

## Ícones

`dist/icons.js` registra as fontes dos desenhos incorporados:

| Recurso | Origem | Avisos preservados |
| --- | --- | --- |
| Mira, avanço, escudo, ímã e construção | Lucide; inclui a atribuição herdada de Feather | [Lucide/ISC e Feather/MIT](../dist/assets/lucide-LICENSE.txt) |
| Parafuso usado como marca de sucata, com rotação | Pictogrammers / Material Design, `screw-flat-top` | [Pictogrammers](../dist/assets/pictogrammers-LICENSE.txt) e [Apache 2.0](../dist/assets/Apache-2.0.txt) |

Os avisos são parte dos recursos e devem acompanhar sua redistribuição. As licenças desses ícones não definem uma licença geral para o restante do projeto.

## Imagens

Os três cenários `phase-shop.png`, `phase-workshop.png` e `phase-arena.png` foram gerados para o projeto; os prompts e o processo estão em [CENARIOS.md](CENARIOS.md). As imagens são usadas diretamente pela interface e permanecem entre os arquivos necessários ao jogo.

`arena-robot.png` e `mode-arena.png` também já fazem parte da versão pública. O material versionado consultado nesta revisão não contém uma ficha de origem e licença específica para essas duas imagens. Elas foram preservadas sem alteração; a licença de um pacote de ícones não deve ser atribuída a elas.

## Escopo de publicação

O código está disponível publicamente para apresentação do projeto. Ainda não foi definida uma licença geral de reutilização para o código e as artes próprias. Esta revisão não acrescenta uma licença nem amplia permissões sobre os recursos de terceiros.

As dependências de desenvolvimento estão identificadas em `package.json` e `pnpm-lock.yaml`; suas instalações e arquivos de distribuição não são incluídos no repositório.
