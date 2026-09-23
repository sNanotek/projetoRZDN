# Raízes do Nordeste

Projeto de front-end feito com HTML, CSS e JavaScript para a atividade de Análise e Desenvolvimento de Sistemas. Permite escolher uma unidade, consultar o cardápio, montar a sacola e acompanhar pedidos para retirada.

## Acesso

- Site: https://snanotek.github.io/projetoRZDN/
- Código: https://github.com/sNanotek/projetoRZDN

O pedido pode ser feito sem cadastro. Para testar os pontos, crie uma conta com dados fictícios e uma senha de teste. O pagamento é simulado: não há cobrança nem coleta de dados de cartão ou Pix.

## Como usar

1. Escolha a unidade e adicione um prato.
2. Abra a sacola e confira os itens e o total.
3. Se quiser, teste o cupom `CHEGUEI10`: ele dá 10% de desconto em pedidos a partir de R$ 30, com limite de R$ 15.
4. Continue para o pagamento, confirme o resumo e escolha o resultado da simulação: aprovado, recusado ou falha de comunicação.
5. Confira o pedido em **Meus pedidos**. A retirada é confirmada pelo perfil de atendente em **Área da equipe**, depois de o pedido ficar pronto.

O seletor de canal permite ver as adaptações para Web, App e Totem. O canal App funciona no navegador. No Totem, o pedido é feito sem conta.

## Executar no computador

Na pasta do projeto, execute:

```sh
python -m http.server 8000
```

Depois, abra http://localhost:8000. No Windows, o comando também pode ser `py -m http.server 8000`. Outra opção é usar a extensão Live Server do VS Code no arquivo `index.html`.

Use HTTPS ou um servidor local. O cadastro depende de recursos do navegador que podem não funcionar ao abrir o arquivo HTML diretamente.

## Organização dos arquivos

- `index.html`: estrutura da página.
- `css/estilo.css`: estilos, temas e adaptação das telas.
- `js/dados.js`: unidades e produtos fictícios.
- `js/regras.js`: cálculos e validações.
- `js/armazenamento.js`: contas e dados salvos no navegador.
- `js/principal.js`: navegação, formulários e ações da interface.
- `testes/verificar.mjs`: testes automáticos.
- `testes/resultados_automatizados.txt`: saída dos testes automáticos.
- `testes/registro_manual.md`: roteiro de registro dos testes manuais.

## Testes

Com Node.js instalado, execute:

```sh
node testes/verificar.mjs
```

Não é preciso instalar pacotes. As 32 verificações de regras e armazenamento passaram na revisão da versão entregue.

O PDF reúne seis capturas: cadastro com senhas diferentes, cadastro sem confirmação de leitura do aviso de privacidade, login vazio, acesso inválido, pedido recebido e cardápio no celular. Elas mostram resultados de parte do plano de testes, sem comprovar todas as etapas dos 21 cenários manuais.

Busca vazia, carregamento e pagamento recusado podem ser simulados no projeto, mas não têm captura no PDF. Também não há resultado registrado para teclado, leitor de tela, zoom, desempenho e todos os tamanhos de tela previstos.

## Dados e limites

Use apenas dados fictícios. Contas e pedidos de usuários cadastrados ficam no `localStorage`. Sessão, sacola e pedidos de visitantes usam `sessionStorage`. Os dados não são compartilhados entre dispositivos ou navegadores.

O projeto não pede CPF, telefone ou endereço. A leitura do aviso de privacidade é separada da opção de receber promoções, que começa desmarcada. A conta permite mudar preferências, exportar os próprios dados e excluir os registros.

A senha de teste não fica salva em texto legível, mas isso não transforma o acesso local em autenticação real. A sessão dura 30 minutos e o Totem encerra o atendimento após 3 minutos sem uso.

As telas da equipe demonstram as ações de cada perfil. Não há servidor de autenticação, banco de dados compartilhado, cobrança real ou envio de e-mails.
