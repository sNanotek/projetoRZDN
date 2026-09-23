// Dados da tela e do atendimento atual.
const dados = window.dadosRestaurante;
const regras = window.regrasPedido;
const banco = window.bancoLocal;
const dinheiro = regras.moeda;
const texto = regras.limparTexto;
const erroHtml = '<p class="mensagemErro" role="alert" tabindex="-1" hidden></p>';
const tempoSessao = 30 * 60 * 1000;
const tempoTotem = 3 * 60 * 1000;
const parametroCanal = new URLSearchParams(location.search).get('canal');
const canal = ['web', 'app', 'totem'].includes(parametroCanal) ? parametroCanal : 'web';

let unidade = banco.ler('unidade', 'recife', true);
if (!dados.unidades.some(item => item.id === unidade)) unidade = 'recife';
let carrinho = banco.ler('sacola_' + canal, [], true);
let cupom = banco.ler('cupom_' + canal, '', true);
let usarPontos = false;
let categoria = 'Todos';
let modoConta = 'entrar';
let perfilEquipe = 'cozinha';
let processandoPagamento = false;
let carregando = false;
let numeroCarga = 0;
let tempoAviso;
let ultimaAtividade = Date.now();

function pegar(seletor) {
  return document.querySelector(seletor);
}

function esperar(tempo) {
  return new Promise(resolve => setTimeout(resolve, tempo));
}

function contaAtual() {
  if (canal === 'totem') return null;
  const sessao = banco.ler('sessao', null, true);
  if (!sessao || Date.now() - sessao.inicio >= tempoSessao) return null;
  return banco.ler('contas', []).find(conta => conta.id === sessao.id) || null;
}

function unidadeAtual() {
  return dados.unidades.find(item => item.id === unidade);
}

function pedidosLocais() {
  return banco.ler('pedidos', []);
}

function pedidosTemporarios() {
  return banco.ler('pedidos_' + canal, [], true);
}

function todosPedidos() {
  return [...pedidosLocais(), ...pedidosTemporarios()];
}

function pontosDaConta() {
  const conta = contaAtual();
  let saldo = 0;
  if (!conta) return saldo;
  for (const pedido of pedidosLocais()) {
    if (pedido.clienteId === conta.id) saldo += pedido.pontosGanhos - pedido.pontosUsados;
  }
  return saldo;
}

function campanhaAtiva() {
  return banco.ler('campanhaAtiva', true);
}

function disponibilidade() {
  return banco.ler('disponibilidade', {});
}

function estaDisponivel(produto) {
  return disponibilidade()[unidade + ':' + produto.id] ?? produto.disponivel[unidade];
}

function totais() {
  return regras.calcular(carrinho, cupom, usarPontos, pontosDaConta(), campanhaAtiva());
}

function salvarSacola(itens = carrinho, codigo = cupom) {
  banco.salvar('sacola_' + canal, itens, true);
  banco.salvar('cupom_' + canal, codigo, true);
  carrinho = itens;
  cupom = codigo;
}

function avisar(mensagem) {
  clearTimeout(tempoAviso);
  pegar('#aviso').textContent = mensagem;
  pegar('#aviso').hidden = false;
  tempoAviso = setTimeout(() => { pegar('#aviso').hidden = true; }, 5500);
}

function titulo(nome, descricao = '') {
  return `<div class="tituloTela">
    <h1>${texto(nome)}</h1>
    ${descricao ? `<p>${texto(descricao)}</p>` : ''}
  </div>`;
}

function vazio(nome, descricao, destino = 'cardapio', botao = 'Ver cardápio') {
  return `<div class="caixa vazio">
    <h3>${texto(nome)}</h3><p>${texto(descricao)}</p>
    <a class="principalBotao" href="#${destino}">${texto(botao)}</a>
  </div>`;
}

function erroFormulario(formulario, mensagem) {
  const aviso = formulario.querySelector('.mensagemErro');
  if (!aviso) return avisar(mensagem);
  aviso.textContent = mensagem;
  aviso.hidden = false;
  aviso.focus();
}

function confirmar(nome, mensagem, acao) {
  pegar('#tituloConfirmacao').textContent = nome;
  pegar('#textoConfirmacao').textContent = mensagem;
  pegar('#aceitarConfirmacao').onclick = async () => {
    pegar('#janelaConfirmacao').close();
    try { await acao(); } catch (erro) { avisar(erro.message); }
  };
  pegar('#janelaConfirmacao').showModal();
  pegar('#cancelarConfirmacao').focus();
}

// Cardápio.
function atualizarCabecalho() {
  pegar('#botaoConta').textContent = contaAtual() ? 'Minha conta' : 'Entrar';
  pegar('#unidade').value = unidade;
  pegar('#prazoUnidade').textContent = 'Retirada em ' + unidadeAtual().prazo;
  pegar('#precoDestaque').textContent = dinheiro(dados.produtos[0].precos[unidade]);
  pegar('#quantidadeSacola').textContent = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
  pegar('#botaoCampanha').disabled = !campanhaAtiva();
  pegar('#botaoCampanha').textContent = campanhaAtiva() ? 'Usar cupom' : 'Campanha encerrada';
  pegar('#textoCampanha').textContent = campanhaAtiva()
    ? 'Cupom CHEGUEI10: 10% em pedidos a partir de R$ 30, com desconto de até R$ 15.'
    : 'A campanha CHEGUEI10 está desativada no momento.';
}

async function carregarCardapio() {
  const carga = ++numeroCarga;
  carregando = true;
  pegar('#listaProdutos').setAttribute('aria-busy', 'true');
  pegar('#listaProdutos').innerHTML = '<p class="carregando">Carregando cardápio...</p>';
  await esperar(400);
  if (carga !== numeroCarga) return;
  carregando = false;
  pegar('#listaProdutos').setAttribute('aria-busy', 'false');
  if (banco.ler('falharCardapio', false, true)) {
    banco.remover('falharCardapio', true);
    pegar('#listaProdutos').innerHTML = `<div class="caixa">
      <h3>Não foi possível carregar</h3><p>Falha de conexão simulada.</p>
      <button class="principalBotao" data-acao="recarregar">Tentar novamente</button>
    </div>`;
    return;
  }
  desenharProdutos();
}

function desenharCategorias() {
  pegar('#categorias').innerHTML = dados.categorias.map(nome =>
    `<button data-categoria="${nome}" aria-pressed="${categoria === nome}">${nome}</button>`
  ).join('');
}

function normalizar(valor) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function desenharProdutos() {
  if (carregando) return;
  const busca = normalizar(pegar('#buscaPrato').value.trim());
  const produtos = dados.produtos.filter(produto => {
    const mesmaCategoria = categoria === 'Todos' || produto.categoria === categoria;
    return mesmaCategoria && normalizar(produto.nome + ' ' + produto.descricao).includes(busca);
  });
  if (!produtos.length) {
    pegar('#listaProdutos').innerHTML = `<div class="caixa">
      <h3>Nenhum produto encontrado</h3><p>Tente outro nome ou categoria.</p>
      <button class="secundarioBotao" data-acao="limparBusca">Limpar busca e filtros</button>
    </div>`;
    return;
  }
  pegar('#listaProdutos').innerHTML = produtos.map(produto => {
    const disponivel = estaDisponivel(produto);
    return `<article class="produto ${disponivel ? '' : 'indisponivel'}">
      <span class="categoriaProduto">${produto.categoria}</span>
      <h3>${produto.nome}</h3><p>${produto.descricao}</p>
      <div class="precoProduto">
        <strong>${dinheiro(produto.precos[unidade])}</strong>
        ${disponivel
          ? `<button class="adicionarProduto" data-produto="${produto.id}" aria-label="Adicionar ${produto.nome}">+</button>`
          : '<span class="textoPequeno">Indisponível</span>'}
      </div>
    </article>`;
  }).join('');
}

function abrirProduto(id) {
  const produto = dados.produtos.find(item => item.id === id);
  if (!produto || !estaDisponivel(produto)) return avisar('Produto indisponível nesta unidade.');
  pegar('#detalheProduto').innerHTML = `
    <h2 id="tituloProduto">${produto.nome}</h2>
    <p>${produto.descricao} ${produto.detalhe}</p>
    <p class="textoPequeno">${produto.alergicos}</p>
    <form id="formularioProduto" data-id="${id}" novalidate>
      <div class="campo">
        <label for="quantidadeProduto">Quantidade</label>
        <input id="quantidadeProduto" name="quantidade" type="number" value="1" min="1" max="20" step="1" required>
      </div>
      <div class="campo">
        <label for="observacaoProduto">Observação (opcional)</label>
        <textarea id="observacaoProduto" name="observacao" maxlength="120" placeholder="Ex.: sem coentro"></textarea>
        <small>Até 120 caracteres. Não informe dados pessoais.</small>
      </div>
      ${erroHtml}
      <button class="principalBotao larguraToda" type="submit">Adicionar à sacola - ${dinheiro(produto.precos[unidade])} por unidade</button>
    </form>`;
  pegar('#janelaProduto').showModal();
}

function adicionarProduto(formulario) {
  const produto = dados.produtos.find(item => item.id === formulario.dataset.id);
  const quantidade = Number(formulario.elements.quantidade.value);
  const observacao = formulario.elements.observacao.value.trim();
  if (!produto || !estaDisponivel(produto)) throw new Error('Este produto ficou indisponível.');
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20) {
    throw new Error('Escolha uma quantidade inteira entre 1 e 20.');
  }
  if (observacao.length > 120) throw new Error('Use até 120 caracteres na observação.');

  const itens = carrinho.map(item => ({ ...item }));
  const repetido = itens.find(item => item.produtoId === produto.id && item.observacao === observacao);
  if (repetido) {
    if (repetido.quantidade + quantidade > 20) throw new Error('O limite é de 20 unidades por item.');
    repetido.quantidade += quantidade;
  } else {
    itens.push({ id: banco.id(), produtoId: produto.id, nome: produto.nome,
      preco: produto.precos[unidade], quantidade, observacao });
  }
  salvarSacola(itens);
  pegar('#janelaProduto').close();
  desenharSacolas();
  avisar('Produto adicionado à sacola.');
}

// Sacola. O mesmo conteúdo é usado na lateral e na tela do celular.
function conteudoSacola(sufixo) {
  if (!carrinho.length) return vazio('Sacola vazia', 'Adicione um produto para começar.');
  const total = totais();
  let html = `<div class="caixa"><h2>Sua sacola</h2>
    <p class="textoPequeno">Retirada: ${unidadeAtual().nome}</p><ul class="listaSacola">`;
  for (const item of carrinho) {
    html += `<li class="itemSacola">
      <h3>${texto(item.nome)}</h3>
      ${item.observacao ? `<p>${texto(item.observacao)}</p>` : ''}
      <div class="linhaQuantidade">
        <div class="contador">
          <button data-quantidade="-1" data-item="${item.id}" aria-label="Diminuir ${texto(item.nome)}">-</button>
          <span>${item.quantidade}</span>
          <button data-quantidade="1" data-item="${item.id}" aria-label="Aumentar ${texto(item.nome)}" ${item.quantidade >= 20 ? 'disabled' : ''}>+</button>
        </div>
        <b>${dinheiro(item.preco * item.quantidade)}</b>
      </div>
      <button class="botaoTexto" data-remover="${item.id}">Remover ${texto(item.nome)}</button>
    </li>`;
  }
  html += `</ul><label for="cupom_${sufixo}">Cupom de desconto</label>
    <form class="formularioCupom" data-formulario="cupom">
      <input id="cupom_${sufixo}" name="cupom" maxlength="20" value="${texto(cupom)}">
      <button class="secundarioBotao">Aplicar</button>
    </form>
    ${cupom ? '<button class="botaoTexto" data-acao="removerCupom">Remover cupom</button>' : ''}`;
  if (contaAtual()) {
    html += `<label class="caixaSelecao">
      <input type="checkbox" data-pontos ${usarPontos ? 'checked' : ''}>
      <span>Usar 100 pontos por R$ 10<br><small>Saldo: ${pontosDaConta()} pontos. Pedido mínimo de R$ 20.</small></span>
    </label>`;
  }
  html += `${total.erro ? `<p class="mensagemErro" role="alert">${total.erro}</p>` : ''}
    <div class="linhaResumo"><span>Subtotal</span><span>${dinheiro(total.subtotal)}</span></div>
    <div class="linhaResumo"><span>Desconto</span><span>- ${dinheiro(total.desconto)}</span></div>
    <div class="linhaResumo total"><span>Total</span><span>${dinheiro(total.total)}</span></div>
    <button class="principalBotao larguraToda" data-acao="finalizar" ${total.erro ? 'disabled' : ''}>Continuar para pagamento</button>
    <p class="textoPequeno">Retirada no balcão. Pagamento simulado, sem cobrança.</p>
  </div>`;
  return html;
}

function desenharSacolas() {
  pegar('#carrinhoLateral').innerHTML = conteudoSacola('lateral');
  pegar('#telaCarrinho').innerHTML = titulo('Seu pedido') + conteudoSacola('pagina');
  atualizarCabecalho();
}

function alterarQuantidade(id, variacao) {
  const itens = carrinho.map(item => ({ ...item }));
  const item = itens.find(item => item.id === id);
  if (!item || item.quantidade + variacao > 20) return;
  item.quantidade += variacao;
  salvarSacola(itens.filter(item => item.quantidade > 0));
  desenharSacolas();
}

function aplicarCupom(codigo) {
  const novo = codigo.trim().toUpperCase();
  if (!novo) throw new Error('Digite um código de cupom.');
  const calculo = regras.calcular(carrinho, novo, false, pontosDaConta(), campanhaAtiva());
  if (calculo.erro) throw new Error(calculo.erro);
  salvarSacola(carrinho, novo);
  usarPontos = false;
  desenharSacolas();
  avisar('Cupom aplicado. Desconto de ' + dinheiro(calculo.desconto) + '.');
}

// Conta e pontos.
function desenharConta() {
  const tela = pegar('#telaConta');
  const conta = contaAtual();
  if (canal === 'totem') {
    tela.innerHTML = titulo('Atendimento sem cadastro') + vazio('Pedido por senha', 'Para usar sua conta e seus pontos, acesse pelo seu celular.');
    return;
  }
  if (conta) {
    tela.innerHTML = titulo('Minha conta') + `<div class="caixa">
      <form id="formularioPerfil" novalidate>
        <div class="campo"><label for="nomePerfil">Nome</label>
          <input id="nomePerfil" name="nome" value="${texto(conta.nome)}" minlength="2" maxlength="50" required>
        </div>
        <p>E-mail: ${texto(conta.email)}</p>
        <label class="caixaSelecao"><input type="checkbox" name="marketing" ${conta.marketing ? 'checked' : ''}>
          <span>Receber promoções (opcional). Nenhum e-mail será enviado.</span>
        </label>
        ${erroHtml}<button class="principalBotao">Salvar preferências</button>
      </form>
      <div class="linhaBotoes">
        <button class="secundarioBotao" data-acao="sair">Sair da conta</button>
        <a href="#privacidade">Consultar ou excluir meus dados</a>
      </div>
    </div>`;
    return;
  }
  const cadastro = modoConta === 'cadastro';
  tela.innerHTML = titulo(cadastro ? 'Criar conta' : 'Entrar na conta') + `<div class="caixa">
    <div class="alternarConta">
      <button class="secundarioBotao" data-modo-conta="entrar" aria-pressed="${!cadastro}">Entrar</button>
      <button class="secundarioBotao" data-modo-conta="cadastro" aria-pressed="${cadastro}">Criar conta</button>
    </div>
    <p class="avisoDiscreto">Use dados fictícios e uma senha de teste. O cadastro fica apenas neste navegador.</p>
    <form id="formularioConta" novalidate>
      ${cadastro ? `<div class="campo"><label for="nomeConta">Nome</label>
        <input id="nomeConta" name="nome" minlength="2" maxlength="50" autocomplete="off" required>
      </div>` : ''}
      <div class="campo"><label for="emailConta">E-mail</label>
        <input id="emailConta" name="email" type="email" maxlength="100" autocomplete="off" placeholder="ana@exemplo.com" required>
      </div>
      <div class="campo"><label for="senhaConta">Senha de teste</label>
        <input id="senhaConta" name="senha" type="password" minlength="8" maxlength="64" autocomplete="${cadastro ? 'new-password' : 'current-password'}" aria-describedby="ajudaSenha" required>
        <small id="ajudaSenha">De 8 a 64 caracteres. Não use sua senha pessoal.</small>
      </div>
      ${cadastro ? `<div class="campo"><label for="repetirSenha">Repita a senha</label>
        <input id="repetirSenha" name="repeticao" type="password" maxlength="64" autocomplete="new-password" required>
      </div>
      <label class="caixaSelecao"><input name="ciencia" type="checkbox" required>
        <span>Li o <a href="#privacidade">aviso de privacidade</a>.</span>
      </label>
      <label class="caixaSelecao"><input name="marketing" type="checkbox">
        <span>Receber promoções (opcional). Posso mudar essa escolha depois.</span>
      </label>` : ''}
      ${erroHtml}
      <button class="principalBotao larguraToda" type="submit">${cadastro ? 'Criar minha conta' : 'Entrar na conta'}</button>
    </form>
    ${cadastro ? '' : `<details class="simulador"><summary>Esqueci minha senha</summary>
      <p>Este projeto não envia e-mails de recuperação. Você pode criar outra conta de teste ou apagar os dados em Privacidade.</p>
    </details>`}
  </div><a href="#cardapio">Continuar sem cadastro</a>`;
}

async function enviarConta(formulario) {
  const campos = formulario.elements;
  let erro = '';
  if (modoConta === 'cadastro') {
    erro = regras.validarCadastro(campos.nome.value, campos.email.value, campos.senha.value, campos.repeticao.value, campos.ciencia.checked);
  } else if (!regras.emailValido(campos.email.value.trim()) || !campos.senha.value) {
    erro = 'Informe um e-mail válido e sua senha de teste.';
  }
  if (erro) throw new Error(erro);
  const botao = formulario.querySelector('button[type="submit"]');
  if (botao.disabled) return;
  const legenda = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Aguarde...';
  try {
    let conta;
    if (modoConta === 'cadastro') {
      conta = await banco.cadastrar(campos.nome.value, campos.email.value, campos.senha.value, campos.marketing.checked);
    } else {
      conta = await banco.entrar(campos.email.value, campos.senha.value);
    }
    banco.salvar('sessao', { id: conta.id, inicio: Date.now() }, true);
    formulario.reset();
    desenharSacolas();
    avisar('Acesso realizado.');
    location.hash = carrinho.length ? 'carrinho' : 'clube';
  } finally {
    botao.disabled = false;
    botao.textContent = legenda;
  }
}

function salvarPerfil(formulario) {
  const conta = contaAtual();
  if (!conta) throw new Error('Entre novamente na conta.');
  const nome = formulario.elements.nome.value.trim();
  if (nome.length < 2 || nome.length > 50) throw new Error('Informe um nome entre 2 e 50 caracteres.');
  const marketing = formulario.elements.marketing.checked;
  banco.atualizarConta({ ...conta, nome, marketing,
    consentimentoEm: marketing ? (conta.consentimentoEm || new Date().toISOString()) : null,
    preferenciaAtualizadaEm: new Date().toISOString() });
  desenharConta();
  avisar('Nome e preferências salvos.');
}

function sair() {
  banco.remover('sessao', true);
  banco.remover('pagamento', true);
  usarPontos = false;
  salvarSacola([], '');
  desenharSacolas();
  location.hash = 'conta';
  navegar();
  avisar('Você saiu da conta.');
}

function desenharClube() {
  const saldo = pontosDaConta();
  let html = titulo('Clube Raízes', 'Pontos por pedido aprovado.');
  html += `<div class="caixa"><h2>Como funciona</h2>
    <p>A cada real inteiro pago com conta, você ganha 1 ponto. Por exemplo, R$ 32,90 rende 32 pontos.</p>
    <p>Troque 100 pontos por R$ 10 em pedidos de pelo menos R$ 20. A troca não acumula com cupom.</p>
    <p>Pagamentos recusados não gastam pontos. Nesta demonstração, os pontos não expiram.</p>
  </div>`;
  if (contaAtual()) {
    html += `<div class="caixa"><h2>Seu saldo</h2><p class="saldoPontos">${saldo} pontos</p>
      <progress value="${Math.min(saldo, 100)}" max="100" aria-label="Progresso para 100 pontos"></progress>
      <p>${saldo >= 100 ? 'Você pode usar os pontos na sacola.' : `Faltam ${100 - saldo} pontos para o desconto.`}</p>
      <a class="principalBotao" href="#cardapio">Ver cardápio</a>
    </div>`;
  } else {
    html += vazio('Entre para juntar pontos', canal === 'totem' ? 'No totem, o pedido é feito como visitante.' : 'Entre ou crie uma conta antes de pagar.', canal === 'totem' ? 'cardapio' : 'conta', canal === 'totem' ? 'Ver cardápio' : 'Entrar ou criar conta');
  }
  pegar('#telaClube').innerHTML = html;
}

// Pagamento simulado.
function prepararPagamento() {
  const erro = regras.validarCarrinho(carrinho, dados.produtos, unidade, disponibilidade()) || totais().erro;
  if (erro) throw new Error(erro);
  banco.salvar('pagamento', { id: banco.id() }, true);
  location.hash = 'pagamento';
  desenharPagamento();
}

function desenharPagamento() {
  if (!banco.ler('pagamento', null, true) || !carrinho.length) {
    pegar('#telaPagamento').innerHTML = titulo('Pagamento') + vazio('Nenhum pedido para pagar', 'Adicione produtos à sacola.');
    return;
  }
  const total = totais();
  pegar('#telaPagamento').innerHTML = titulo('Pagamento', 'Confira os itens e o valor antes de continuar.') + `
    <div class="caixa">
      <h2>${unidadeAtual().nome}</h2><p>${unidadeAtual().retirada} - ${unidadeAtual().prazo}</p>
      <ul class="resumoItens">${resumoItens(carrinho)}</ul>
      <div class="linhaResumo"><span>Desconto</span><span>- ${dinheiro(total.desconto)}</span></div>
      <div class="linhaResumo total"><span>Total</span><span>${dinheiro(total.total)}</span></div>
      ${!contaAtual() && canal !== 'totem' ? '<p>Pedido como visitante. Para ganhar pontos, <a href="#conta">entre na conta</a>.</p>' : ''}
      <form id="formularioPagamento" novalidate>
        <fieldset class="escolhasPagamento"><legend>Forma de pagamento</legend>
          <label class="opcaoPagamento"><input type="radio" name="metodo" value="pix" checked> Pix</label>
          <label class="opcaoPagamento"><input type="radio" name="metodo" value="cartao"> Cartão</label>
        </fieldset>
        <p class="avisoDiscreto">Pagamento simulado. Não há cobrança nem coleta de dados de cartão ou Pix.</p>
        <label class="caixaSelecao"><input type="checkbox" name="ciencia" required>
          <span>Conferi a unidade, os itens e o valor.</span>
        </label>
        <div class="campo"><label for="resultadoPagamento">Resultado da simulação</label>
          <select id="resultadoPagamento" name="resultado">
            <option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option>
            <option value="falha">Falha de comunicação</option>
          </select>
        </div>
        ${erroHtml}
        <p id="statusPagamento" role="status" hidden></p>
        <button class="principalBotao larguraToda" type="submit">Simular pagamento de ${dinheiro(total.total)}</button>
        <button class="botaoTexto" type="button" data-acao="voltarSacola">Voltar à sacola</button>
      </form>
    </div>`;
}

function resumoItens(itens) {
  return itens.map(item => `<li><span>${item.quantidade} × ${texto(item.nome)}</span>
    <b>${dinheiro(item.preco * item.quantidade)}</b></li>`).join('');
}

async function pagar(formulario) {
  if (processandoPagamento) return;
  if (!formulario.elements.ciencia.checked) throw new Error('Confirme a revisão do pedido.');
  const erro = regras.validarCarrinho(carrinho, dados.produtos, unidade, disponibilidade()) || totais().erro;
  if (erro) throw new Error(erro);
  const tentativa = banco.ler('pagamento', null, true);
  if (!tentativa) throw new Error('Volte à sacola para conferir o pedido.');
  if (todosPedidos().some(pedido => pedido.id === tentativa.id)) {
    location.hash = 'pedidos';
    return avisar('Este pedido já foi confirmado.');
  }

  const conta = contaAtual();
  const total = totais();
  const pedido = { id: tentativa.id, unidade, itens: carrinho.map(item => ({ ...item })),
    cupom, usarPontos, clienteId: conta ? conta.id : null,
    metodo: formulario.elements.metodo.value, criadoEm: Date.now() };
  const resultado = formulario.elements.resultado.value;
  processandoPagamento = true;
  formulario.querySelectorAll('button, input, select').forEach(campo => { campo.disabled = true; });
  formulario.querySelector('.mensagemErro').hidden = true;
  pegar('#statusPagamento').hidden = false;
  pegar('#statusPagamento').textContent = 'Aguardando resposta do pagamento...';

  try {
    await esperar(1500);
    if (resultado === 'recusado') throw new Error('Pagamento recusado. Sua sacola e seus pontos foram mantidos.');
    if (resultado === 'falha') throw new Error('Falha de comunicação. Nenhum pedido foi confirmado. Tente novamente.');
    const novaConta = contaAtual();
    if ((novaConta ? novaConta.id : null) !== pedido.clienteId) throw new Error('Sua sessão mudou. Revise o pedido.');
    const novoTotal = regras.calcular(pedido.itens, pedido.cupom, pedido.usarPontos, pontosDaConta(), campanhaAtiva());
    const novaValidacao = regras.validarCarrinho(pedido.itens, dados.produtos, pedido.unidade, disponibilidade()) || novoTotal.erro;
    if (novaValidacao) throw new Error(novaValidacao);
    if (novoTotal.total !== total.total) throw new Error('O valor mudou. Volte à sacola e confira novamente.');

    pedido.total = total.total;
    pedido.subtotal = total.subtotal;
    pedido.desconto = total.desconto;
    pedido.pagoEm = Date.now();
    pedido.etapa = 0;
    pedido.canal = canal;
    pedido.pontosGanhos = conta ? total.pontosGanhos : 0;
    pedido.pontosUsados = conta && pedido.usarPontos ? 100 : 0;
    pedido.senha = 'RN-' + pedido.id.slice(0, 6).toUpperCase();

    const temporario = !conta;
    const chave = temporario ? 'pedidos_' + canal : 'pedidos';
    const pedidos = banco.ler(chave, [], temporario);
    // O mesmo número de tentativa não pode criar outro pedido ou duplicar os pontos.
    if (!pedidos.some(item => item.id === pedido.id)) {
      banco.salvar(chave, [...pedidos, pedido], temporario);
    }
    salvarSacola([], '');
    usarPontos = false;
    banco.remover('pagamento', true);
    desenharSacolas();
    avisar('Pedido confirmado. Senha: ' + pedido.senha);
    location.hash = 'pedidos';
  } finally {
    processandoPagamento = false;
    if (formulario.isConnected) {
      formulario.querySelectorAll('button, input, select').forEach(campo => { campo.disabled = false; });
      pegar('#statusPagamento').hidden = true;
    }
  }
}

// Acompanhamento e equipe.
function desenharPedidos() {
  const conta = contaAtual();
  const pedidos = conta ? pedidosLocais().filter(pedido => pedido.clienteId === conta.id) : pedidosTemporarios();
  pedidos.sort((a, b) => b.pagoEm - a.pagoEm);
  let html = titulo('Meus pedidos');
  if (!pedidos.length) html += vazio('Nenhum pedido encontrado', 'Os pedidos aprovados aparecem aqui.');
  else {
    html += `<p class="avisoDiscreto">${banco.ler('preparoAutomatico', true, true)
      ? 'O preparo avança automaticamente em cerca de 30 segundos.'
      : 'A equipe está atualizando o preparo manualmente.'} A retirada é confirmada pelo atendente na Área da equipe.</p>`;
    for (const pedido of pedidos) {
      const nomeUnidade = dados.unidades.find(item => item.id === pedido.unidade).nome;
      html += `<article class="caixa">
        <div class="pedidoCabecalho"><div><h2>Pedido ${texto(pedido.senha)}</h2>
          <p>${nomeUnidade} - ${new Date(pedido.pagoEm).toLocaleString('pt-BR')}</p>
        </div><span class="etiqueta">${dados.etapas[pedido.etapa]}</span></div>
        <ol class="etapas" aria-label="Andamento do pedido">
          ${dados.etapas.map((etapa, i) => `<li class="${i <= pedido.etapa ? 'concluida' : ''}" ${i === pedido.etapa ? 'aria-current="step"' : ''}>
            <span>${i + 1}</span>${etapa}</li>`).join('')}
        </ol>
        ${pedido.etapa === 2 ? `<p class="mensagemSucesso">Pronto! Apresente a senha <b>${texto(pedido.senha)}</b> no balcão.</p>` : ''}
        <ul class="resumoItens">${resumoItens(pedido.itens)}</ul>
        <div class="linhaResumo total"><span>${pedido.metodo === 'pix' ? 'Pix' : 'Cartão'} (simulado)</span><b>${dinheiro(pedido.total)}</b></div>
        <p class="textoPequeno">${pedido.clienteId
          ? `${pedido.pontosGanhos} pontos recebidos e ${pedido.pontosUsados} pontos usados.`
          : 'Pedido como visitante. O histórico fica apenas nesta sessão.'}</p>
      </article>`;
    }
  }
  pegar('#telaPedidos').innerHTML = html;
}

function atualizarEtapasAutomaticas() {
  if (!banco.ler('preparoAutomatico', true, true)) return;
  let mudou = false;
  for (const [chave, temporario] of [['pedidos', false], ['pedidos_' + canal, true]]) {
    const pedidos = banco.ler(chave, [], temporario);
    let mudouLista = false;
    for (const pedido of pedidos) {
      const tempo = Date.now() - pedido.pagoEm;
      const etapa = tempo >= 30000 ? 2 : tempo >= 15000 ? 1 : 0;
      if (pedido.etapa < etapa) {
        pedido.etapa = etapa;
        mudouLista = true;
      }
    }
    if (mudouLista) {
      banco.salvar(chave, pedidos, temporario);
      mudou = true;
    }
  }
  if (mudou && location.hash === '#pedidos') {
    desenharPedidos();
    avisar('O andamento do pedido foi atualizado.');
  }
  if (mudou && location.hash === '#equipe') desenharEquipe();
}

function avancarPedido(id) {
  for (const [chave, temporario] of [['pedidos', false], ['pedidos_' + canal, true]]) {
    const pedidos = banco.ler(chave, [], temporario);
    const pedido = pedidos.find(item => item.id === id && item.unidade === unidade);
    if (!pedido) continue;
    const proxima = regras.proximaEtapa(pedido.etapa, perfilEquipe);
    if (proxima === pedido.etapa) throw new Error('Este perfil não pode avançar o pedido agora.');
    pedido.etapa = proxima;
    banco.salvar(chave, pedidos, temporario);
    avisar('Pedido atualizado: ' + dados.etapas[proxima]);
  }
  desenharEquipe();
}

function desenharEquipe() {
  let html = titulo('Área da equipe', 'Unidade: ' + unidadeAtual().nome);
  html += `<p class="avisoDiscreto">Perfis de demonstração. As ações usam os pedidos deste navegador.</p>
    <div class="caixa"><div class="campo"><label for="perfilEquipe">Perfil</label>
      <select id="perfilEquipe">
        <option value="cozinha" ${perfilEquipe === 'cozinha' ? 'selected' : ''}>Cozinha</option>
        <option value="atendente" ${perfilEquipe === 'atendente' ? 'selected' : ''}>Atendente</option>
        <option value="gerente" ${perfilEquipe === 'gerente' ? 'selected' : ''}>Gerente / Administrador</option>
      </select>
    </div><label class="caixaSelecao">
      <input id="preparoAutomatico" type="checkbox" ${banco.ler('preparoAutomatico', true, true) ? 'checked' : ''}>
      <span>Avançar o preparo automaticamente</span>
    </label></div>`;
  if (perfilEquipe === 'gerente') {
    html += `<div class="caixa"><h2>Produtos da unidade</h2><ul class="listaGerencia">
      ${dados.produtos.map(produto => `<li><span>${produto.nome}<br><small>${dinheiro(produto.precos[unidade])}</small></span>
        <button class="secundarioBotao" data-disponibilidade="${produto.id}" aria-pressed="${estaDisponivel(produto)}">${estaDisponivel(produto) ? 'Disponível' : 'Indisponível'}</button>
      </li>`).join('')}
      </ul><label class="caixaSelecao"><input id="campanhaAtiva" type="checkbox" ${campanhaAtiva() ? 'checked' : ''}>
        <span>Ativar campanha CHEGUEI10 em todas as unidades</span>
      </label>
      <button class="secundarioBotao" data-acao="falharCardapio">Simular falha no cardápio</button>
    </div>`;
  } else {
    const pedidos = todosPedidos().filter(pedido => pedido.unidade === unidade && pedido.etapa < 3);
    if (!pedidos.length) html += vazio('Sem pedidos em andamento', 'Os pedidos aprovados desta unidade aparecem aqui.');
    else {
      html += '<div class="gradeEquipe">';
      for (const pedido of pedidos) {
        const podeAvancar = regras.proximaEtapa(pedido.etapa, perfilEquipe) !== pedido.etapa;
        const botao = perfilEquipe === 'atendente' ? 'Confirmar retirada' : pedido.etapa === 0 ? 'Iniciar preparo' : 'Marcar como pronto';
        html += `<article class="caixa"><h2>${texto(pedido.senha)}</h2><p>${dados.etapas[pedido.etapa]}</p>
          <ul>${pedido.itens.map(item => `<li>${item.quantidade} × ${texto(item.nome)}
            ${item.observacao ? `<br><small>${texto(item.observacao)}</small>` : ''}</li>`).join('')}</ul>
          <button class="principalBotao larguraToda" data-avancar="${pedido.id}" ${podeAvancar ? '' : 'disabled'}>${botao}</button>
        </article>`;
      }
      html += '</div>';
    }
  }
  pegar('#telaEquipe').innerHTML = html;
}

// Privacidade.
function desenharPrivacidade() {
  const conta = contaAtual();
  pegar('#telaPrivacidade').innerHTML = titulo('Privacidade') + `<div class="caixa textoCorrente">
    <h2>Uso dos dados</h2>
    <p>Este é um projeto acadêmico. Use apenas dados fictícios. Não há cobrança nem envio de e-mails.</p>
    <h3>O que é guardado?</h3>
    <p>Nome, e-mail e senha de teste são usados para simular a conta. Os pedidos guardam itens, unidade, valor, andamento e pontos. Não pedimos CPF, telefone, endereço ou dados financeiros.</p>
    <h3>Onde e por quanto tempo?</h3>
    <p>Contas e pedidos de usuários cadastrados ficam neste navegador até serem excluídos. O acesso dura 30 minutos. A sacola e os pedidos de visitantes ficam na sessão da aba. No totem, os dados do atendimento são apagados após 3 minutos sem uso.</p>
    <p>A senha não é salva em texto legível, mas o armazenamento local não oferece a proteção de um sistema real. Limpar os dados do navegador também apaga os registros.</p>
    <h3>Promoções</h3>
    <p>A opção começa desmarcada e é independente da leitura deste aviso. Você pode alterá-la em Minha conta. A escolha e a data são salvas; nenhum e-mail é enviado.</p>
    <h3>Consultar, corrigir e excluir</h3>
    <p>Em Minha conta você consulta o e-mail e altera o nome e as preferências. Abaixo pode exportar os próprios dados ou excluir a conta, seus pedidos e pontos.</p>
    <h3>Serviços externos</h3>
    <p>Os formulários não enviam dados a servidores. O projeto não usa cookies de publicidade. A hospedagem pode registrar dados técnicos de acesso conforme sua política.</p>
  </div><div class="caixa"><h2>Gerenciar dados</h2>
    ${conta ? `<p>Conta: ${texto(conta.nome)}</p><div class="linhaBotoes">
      <button class="secundarioBotao" data-acao="exportar">Exportar meus dados</button>
      <a href="#conta">Corrigir nome e preferências</a>
      <button class="botaoTexto" data-acao="excluirConta">Excluir minha conta e pedidos</button>
    </div>` : '<p>Entre na conta para exportar ou excluir seus dados.</p>'}
    <hr><p>Para recomeçar os testes, apague todos os registros deste projeto neste navegador.</p>
    <button class="secundarioBotao" data-acao="limparTudo">Apagar todos os dados de teste</button>
  </div>`;
}

function exportarDados() {
  const conta = contaAtual();
  if (!conta) throw new Error('Entre na conta para exportar os dados.');
  const { senhaResumo, sal, ...perfil } = conta;
  const conteudo = { perfil, pontos: pontosDaConta(),
    pedidos: pedidosLocais().filter(pedido => pedido.clienteId === conta.id),
    exportadoEm: new Date().toISOString() };
  const arquivo = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = 'meus-dados-raizes.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  avisar('Dados exportados, sem informações da senha.');
}

function excluirConta() {
  const conta = contaAtual();
  if (!conta) throw new Error('Entre na conta primeiro.');
  confirmar('Excluir esta conta?', 'O cadastro, os pedidos e os pontos desta conta serão apagados.', () => {
    banco.salvar('pedidos', pedidosLocais().filter(pedido => pedido.clienteId !== conta.id));
    banco.salvar('contas', banco.ler('contas', []).filter(item => item.id !== conta.id));
    sair();
    avisar('Conta e pedidos excluídos.');
  });
}

function encerrarTotem() {
  if (canal !== 'totem') return;
  banco.remover('pedidos_totem', true);
  banco.remover('pagamento', true);
  salvarSacola([], '');
  usarPontos = false;
  document.querySelectorAll('dialog[open]').forEach(janela => janela.close());
  ultimaAtividade = Date.now();
  banco.salvar('atividadeTotem', ultimaAtividade, true);
  location.hash = 'cardapio';
  desenharSacolas();
  avisar('Atendimento encerrado.');
}

// Troca de telas pelo endereço, por exemplo: #cardapio e #pedidos.
const telas = {
  cardapio: 'telaCardapio', carrinho: 'telaCarrinho', pedidos: 'telaPedidos',
  clube: 'telaClube', conta: 'telaConta', privacidade: 'telaPrivacidade',
  pagamento: 'telaPagamento', equipe: 'telaEquipe'
};

function navegar() {
  if (location.hash === '#conteudo') {
    pegar('#conteudo').focus();
    return;
  }
  let destino = location.hash.slice(1) || 'cardapio';
  if (!telas[destino]) destino = 'cardapio';
  if (processandoPagamento) {
    if (destino !== 'pagamento') {
      location.hash = 'pagamento';
      avisar('Aguarde a resposta do pagamento.');
    }
    return;
  }
  const desenhos = { carrinho: desenharSacolas, pedidos: desenharPedidos,
    clube: desenharClube, conta: desenharConta, privacidade: desenharPrivacidade,
    pagamento: desenharPagamento, equipe: desenharEquipe };
  if (desenhos[destino]) desenhos[destino]();
  document.querySelectorAll('.tela').forEach(tela => { tela.hidden = tela.id !== telas[destino]; });
  document.querySelectorAll('[data-menu]').forEach(link => {
    if (link.dataset.menu === destino) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  atualizarCabecalho();
  const nome = { cardapio: 'Cardápio', carrinho: 'Sacola', pedidos: 'Pedidos', clube: 'Pontos',
    conta: 'Conta', privacidade: 'Privacidade', pagamento: 'Pagamento', equipe: 'Equipe' };
  document.title = nome[destino] + ' | Raízes do Nordeste';
  pegar('#conteudo').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// Botões e formulários.
document.addEventListener('click', evento => {
  const botao = evento.target.closest('button');
  if (!botao || botao.disabled) return;
  try {
    if (processandoPagamento && !botao.closest('#formularioPagamento')) {
      return avisar('Aguarde a resposta do pagamento.');
    }
    if (botao.dataset.fechar) pegar('#' + botao.dataset.fechar).close();
    if (botao.dataset.produto) abrirProduto(botao.dataset.produto);
    if (botao.dataset.categoria) {
      categoria = botao.dataset.categoria;
      desenharCategorias();
      desenharProdutos();
    }
    if (botao.dataset.quantidade) alterarQuantidade(botao.dataset.item, Number(botao.dataset.quantidade));
    if (botao.dataset.remover) {
      salvarSacola(carrinho.filter(item => item.id !== botao.dataset.remover));
      desenharSacolas();
    }
    if (botao.dataset.modoConta) {
      modoConta = botao.dataset.modoConta;
      desenharConta();
    }
    if (botao.dataset.avancar) avancarPedido(botao.dataset.avancar);
    if (botao.dataset.disponibilidade && perfilEquipe === 'gerente') {
      const produto = dados.produtos.find(item => item.id === botao.dataset.disponibilidade);
      const alteracoes = disponibilidade();
      alteracoes[unidade + ':' + produto.id] = !estaDisponivel(produto);
      banco.salvar('disponibilidade', alteracoes);
      desenharEquipe();
      desenharProdutos();
    }
    const acoes = {
      recarregar: carregarCardapio,
      limparBusca: () => {
        pegar('#buscaPrato').value = '';
        categoria = 'Todos';
        desenharCategorias();
        desenharProdutos();
      },
      removerCupom: () => { salvarSacola(carrinho, ''); desenharSacolas(); },
      finalizar: prepararPagamento,
      voltarSacola: () => { location.hash = 'carrinho'; },
      sair, exportar: exportarDados, excluirConta,
      limparTudo: () => confirmar('Apagar todos os dados de teste?', 'Todas as contas e pedidos deste projeto serão apagados deste navegador.', () => {
        banco.limparTudo();
        location.href = location.pathname + '?canal=' + canal;
      }),
      falharCardapio: async () => {
        banco.salvar('falharCardapio', true, true);
        location.hash = 'cardapio';
        await carregarCardapio();
      }
    };
    if (acoes[botao.dataset.acao]) {
      Promise.resolve(acoes[botao.dataset.acao]()).catch(erro => avisar(erro.message));
    }
  } catch (erro) {
    avisar(erro.message);
  }
});

document.addEventListener('submit', async evento => {
  evento.preventDefault();
  const formulario = evento.target;
  if (processandoPagamento) return;
  try {
    if (formulario.id === 'formularioProduto') adicionarProduto(formulario);
    if (formulario.dataset.formulario === 'cupom') aplicarCupom(formulario.elements.cupom.value);
    if (formulario.id === 'formularioConta') await enviarConta(formulario);
    if (formulario.id === 'formularioPagamento') await pagar(formulario);
    if (formulario.id === 'formularioPerfil') salvarPerfil(formulario);
  } catch (erro) {
    erroFormulario(formulario, erro.message);
  }
});

document.addEventListener('change', evento => {
  const campo = evento.target;
  if (processandoPagamento) return;
  try {
    if (campo.matches('[data-pontos]')) {
      if (campo.checked) {
        const total = regras.calcular(carrinho, '', true, pontosDaConta());
        if (total.erro) { campo.checked = false; throw new Error(total.erro); }
        salvarSacola(carrinho, '');
      }
      usarPontos = campo.checked;
      desenharSacolas();
    }
    if (campo.id === 'perfilEquipe') { perfilEquipe = campo.value; desenharEquipe(); }
    if (campo.id === 'preparoAutomatico') banco.salvar('preparoAutomatico', campo.checked, true);
    if (campo.id === 'campanhaAtiva') {
      banco.salvar('campanhaAtiva', campo.checked);
      desenharSacolas();
    }
  } catch (erro) {
    avisar(erro.message);
  }
});

pegar('#unidade').addEventListener('change', evento => {
  const nova = evento.target.value;
  pegar('#unidade').value = unidade;
  if (processandoPagamento) return avisar('Aguarde a resposta do pagamento.');
  function mudar() {
    banco.salvar('unidade', nova, true);
    banco.remover('pagamento', true);
    salvarSacola([], '');
    unidade = nova;
    usarPontos = false;
    document.querySelectorAll('dialog[open]').forEach(janela => janela.close());
    desenharSacolas();
    carregarCardapio().catch(erro => avisar(erro.message));
    if (location.hash === '#equipe') desenharEquipe();
    if (location.hash === '#pagamento') location.hash = 'cardapio';
  }
  if (carrinho.length) confirmar('Trocar de unidade?', 'Os preços podem mudar. Sua sacola será esvaziada.', mudar);
  else {
    try { mudar(); } catch (erro) { avisar(erro.message); }
  }
});

pegar('#canal').addEventListener('change', evento => {
  const novo = evento.target.value;
  pegar('#canal').value = canal;
  if (processandoPagamento) return avisar('Aguarde a resposta do pagamento.');
  confirmar('Mudar o canal?', 'O atendimento atual será encerrado. O totem funciona sem conta pessoal.', () => {
    for (const chave of ['pagamento', 'sessao', 'sacola_' + canal, 'cupom_' + canal, 'pedidos_' + canal]) {
      banco.remover(chave, true);
    }
    location.href = location.pathname + '?canal=' + novo + '#cardapio';
  });
});

function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  const proximo = tema === 'claro' ? 'escuro' : 'claro';
  pegar('#botaoTema').textContent = 'Tema ' + proximo;
  pegar('#botaoTema').setAttribute('aria-label', 'Ativar tema ' + proximo);
}

pegar('#botaoTema').addEventListener('click', () => {
  if (processandoPagamento) return;
  const tema = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
  aplicarTema(tema);
  try { banco.salvar('tema', tema); } catch (erro) { avisar(erro.message); }
});

pegar('#botaoCampanha').addEventListener('click', () => {
  if (processandoPagamento) return;
  try { aplicarCupom('CHEGUEI10'); } catch (erro) { avisar(erro.message); }
});
pegar('#buscaPrato').addEventListener('input', desenharProdutos);
pegar('#cancelarConfirmacao').addEventListener('click', () => pegar('#janelaConfirmacao').close());
pegar('#reiniciarTotem').addEventListener('click', () => {
  if (!processandoPagamento) confirmar('Encerrar atendimento?', 'Anote sua senha antes de encerrar.', encerrarTotem);
});
window.addEventListener('hashchange', navegar);
window.addEventListener('storage', () => {
  if (processandoPagamento) return;
  desenharSacolas();
  desenharProdutos();
  navegar();
});
['pointerdown', 'keydown'].forEach(tipo => document.addEventListener(tipo, () => {
  ultimaAtividade = Date.now();
  if (canal === 'totem') {
    try { banco.salvar('atividadeTotem', ultimaAtividade, true); } catch (erro) { avisar(erro.message); }
  }
}));

// Início da página.
document.body.dataset.canal = canal;
aplicarTema(banco.ler('tema', 'claro'));
pegar('#unidade').innerHTML = dados.unidades.map(item => `<option value="${item.id}">${item.nome}</option>`).join('');
pegar('#canal').value = canal;
pegar('#reiniciarTotem').hidden = canal !== 'totem';
if (canal !== 'web') {
  pegar('#avisoCanal').hidden = false;
  pegar('#avisoCanal').textContent = canal === 'app'
    ? 'Modo App: use o menu inferior. Esta versão funciona no navegador.'
    : 'Totem: pedido sem cadastro. O atendimento encerra após 3 minutos sem uso.';
}
if (canal === 'totem') {
  const atividadeAnterior = banco.ler('atividadeTotem', 0, true);
  if (atividadeAnterior && Date.now() - atividadeAnterior >= tempoTotem) {
    try { encerrarTotem(); } catch (erro) { avisar(erro.message); }
  }
}
desenharCategorias();
desenharSacolas();
navegar();
carregarCardapio().catch(erro => avisar(erro.message));
if (banco.aviso()) {
  pegar('#avisoArmazenamento').hidden = false;
  pegar('#avisoArmazenamento').textContent = banco.aviso();
}
setInterval(() => {
  try {
    atualizarEtapasAutomaticas();
    if (processandoPagamento) return;
    if (canal === 'totem' && Date.now() - ultimaAtividade >= tempoTotem) encerrarTotem();
    const sessao = banco.ler('sessao', null, true);
    if (sessao && Date.now() - sessao.inicio >= tempoSessao) {
      sair();
      avisar('Sua sessão expirou. Entre novamente.');
    }
  } catch (erro) {
    avisar(erro.message);
  }
}, 3000);
