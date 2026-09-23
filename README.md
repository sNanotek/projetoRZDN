# Raízes do Nordeste

Projeto de front-end feito com HTML, CSS e JavaScript. O site permite consultar o cardápio, montar uma sacola e acompanhar pedidos. O pagamento é simulado e os dados ficam no navegador usado para acessar o projeto.

## Acesso ao projeto

- Site: publicação pendente.
- Repositório: endereço público pendente.

Os dois links serão incluídos após a publicação. O site permite fazer um pedido sem cadastro. Para testar os pontos, crie uma conta com dados fictícios. Não é necessário entrar na conta do autor.

## Como abrir

Abra a pasta no VS Code e use a extensão Live Server no arquivo `index.html`.

Se tiver Python instalado, também pode abrir um terminal nesta pasta e executar:

```sh
python -m http.server 8000
```

Depois, acesse `http://localhost:8000`. No Windows, o comando pode ser `py -m http.server 8000`.

Use um servidor local ou HTTPS. O cadastro depende de recursos de segurança do navegador que podem não funcionar ao abrir o HTML diretamente. Use dados fictícios para testar.

## Organização

- `index.html`: estrutura da página.
- `css/estilo.css`: cores, tamanhos e adaptação para celular.
- `js/dados.js`: unidades e produtos.
- `js/regras.js`: cálculos e validações.
- `js/armazenamento.js`: cadastro, sessão e dados locais.
- `js/principal.js`: ações da interface e atualização das telas.
- `testes/verificar.mjs`: testes automatizados das regras e do armazenamento.
- `testes/registro_manual.md`: tabela para anotar os testes feitos no navegador.

## Testes

Com Node.js instalado, execute na pasta do projeto:

```sh
node testes/verificar.mjs
```

Não é preciso instalar pacotes. Os 32 testes passaram na revisão desta versão; a saída está em `testes/resultados_automatizados.txt`. Eles verificam regras e armazenamento. A conferência visual e dos fluxos completos no navegador ainda está pendente.

Para conferir manualmente: escolha uma unidade, adicione produtos, faça um cadastro, teste o cupom `CHEGUEI10` e simule os resultados do pagamento. Depois, acompanhe o pedido e use as opções da equipe para avançar suas etapas. Confira também a busca, a troca de tema e o uso pelo celular.

Anote o que foi testado em `testes/registro_manual.md`. Os cenários completos estão na seção 11 do PDF. Registre a data, o navegador, o tamanho da tela e o resultado de cada teste realizado. Se encontrar um erro, descreva o que aconteceu.

Guarde prints do cadastro inválido, da busca sem resultados, do pagamento recusado, do pedido aprovado e do site no celular. Confira também os estados de carregamento. Antes da entrega, abra os links em uma janela anônima e atualize no PDF e neste README apenas as verificações que realmente foram concluídas.

## Sobre a demonstração

Os pedidos e cadastros não são compartilhados entre computadores ou navegadores. As telas da equipe servem para demonstrar as funções do projeto. Não há servidor de autenticação, cobrança real ou envio de mensagens.
