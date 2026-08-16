# Old Dragon 2: Qualidade de Vida

Módulo comunitário para Foundry VTT que reúne automações opcionais para o sistema **Old Dragon 2ª Edição**.

## Conjuntos de regras

Cada conjunto pode ser ativado ou desativado em **Configurações do jogo → Configurar ajustes → Configurações de módulo**.

### Automação de combate

- Intercepta ataques das fichas de personagens e monstros.
- Compara o ataque com a CA do alvo e registra acerto ou erro no chat.
- Rola e aplica dano, com ajustes de fraqueza e resistência.
- Trata acertos e erros críticos pelas opções do LB1/LB2.
- Solicita confirmação do Mestre quando o jogador não pode alterar o alvo.
- Resume criaturas derrotadas e distribui XP ao encerrar o combate.

As opções de dano automático, alvo único e permissão para jogadores permanecem configuráveis separadamente.

### Equipamentos em recipientes

- Arraste equipamentos sobre Barris, Mochilas e outros itens do tipo `container` para guardá-los.
- Recipientes podem ser aninhados, com proteção contra ciclos.
- A ficha do recipiente permite reservar moedas, que continuam compondo o saldo disponível do personagem.
- Ao transferir um recipiente para outro personagem ou ajudante, toda a árvore de itens e as moedas guardadas são movidas em conjunto.
- Cada equipamento possui um ícone de transferência ao lado dos controles de edição; itens equipados precisam ser desequipados antes da transferência.
- **Esvaziar recipiente** devolve todos os itens à lista principal e mantém as moedas com o personagem.
- A exclusão de um recipiente preenchido exige confirmação e remove seu conteúdo em conjunto.

### Monstros carregam itens

- Adiciona a aba **Equipamentos** às fichas de monstros.
- Permite arrastar equipamentos dos compêndios ou de outras fichas para o inventário do monstro.
- O Mestre pode transferir itens entre monstros, personagens e ajudantes.
- Itens podem ser equipados, abertos e excluídos diretamente pela aba.
- Monstros possuem uma carteira própria de PO, PP e PC, mesmo que a função de recipientes esteja desativada.
- Com **Equipamentos em recipientes** ativo, recipientes mantêm itens aninhados e moedas durante todas as transferências; monstros recebem uma carteira própria do módulo.

### Tomo de Magia

- Incorpora os compêndios de magias arcanas, divinas, selvagens, de missão e cooperativas do [Tomo de Magia OD2](https://github.com/rangelsardinha/tomo-de-magia-od2).
- Inclui navegador com filtros por círculo, escola e esfera no diretório de Itens.
- Disponibiliza tabelas, regras e PDFs de consulta do Tomo de Magia.
- Automatiza a variação de nível e os surtos ao lançar Magias Selvagens.
- Pode ser habilitado ou desabilitado independentemente das demais funções do QdV.
- Ao usar esta versão incorporada, desative o módulo separado `tomo-de-magia-od2` para evitar duplicidades.

### Gerador de pergaminhos

- Adiciona **Gerar Pergaminho** ao diretório de Itens para o Mestre.
- Permite escolher tradição arcana, divina ou ambas e definir o círculo máximo.
- Usa magias do SRD; com **Tomo de Magia** habilitado, permite escolher SRD, Tomo ou ambas as fontes.
- Oferece modo manual, no qual o Mestre arrasta magias específicas para dentro do pergaminho.
- Sorteia uma magia em 80% dos resultados, duas em 15% e três em 5%.
- O Mestre escolhe entre maldição aleatória (10%), pergaminho amaldiçoado (caótico) ou não amaldiçoado.
- O efeito da maldição fica marcado no item, mas só é exibido na interface do Mestre.
- Cada magia possui link para seu documento e um botão **Usar**; o uso publica o cartão da magia no chat e consome o pergaminho.
- Ao usar um pergaminho amaldiçoado, o efeito é enviado por mensagem privada somente aos Mestres.
- O resultado pode ser transferido diretamente para um personagem ou ajudante.

## Compatibilidade

- Foundry VTT mínimo 13, máximo 14 e verificado no Foundry VTT 14.
- Sistema `olddragon2e` 2.0.0 ou mais recente.

Para instalar localmente, copie a pasta para `Data/modules/old-dragon-2-qualidade-de-vida`, reinicie o Foundry e ative o módulo no mundo.

## Desenvolvimento

Cada automação fica isolada em `scripts/features/<nome>`. Para adicionar um novo conjunto, crie sua pasta, importe seu ponto de entrada em `module.json` e registre uma configuração `enable...` em `scripts/main.js`.

Execute as verificações com:

```sh
npm run check
```

## Licenciamento e atribuição

[Old Dragon 2ª Edição](https://olddragon.com.br), da **Old Dragon Editora**, está licenciado sob [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). É uma criação de Antonio Sá Neto, Dan Ramos e Fabiano Neme, baseada nos originais de Gary Gygax e Dave Arneson.

Este módulo usa apenas regras abertas do [SRD do Old Dragon 2](https://olddragon.com.br/livros/srd), segue as [diretrizes oficiais de licenciamento](https://olddragon.com.br/licenciamento) e é distribuído sob CC BY-SA 4.0. É um projeto independente da comunidade, não oficial e não endossado pela Old Dragon Editora. O projeto não usa o logotipo oficial nem imagens proprietárias dos livros.

A implementação inicial foi consolidada a partir de [OD2 Automação de Combate](https://github.com/rangelsardinha/od2-combat-automation), de Rangel Sardinha.
