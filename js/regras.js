const regrasPedido = {
  moeda(valor) {
    return (valor / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  },


  limparTexto(valor) {
    const caracteres = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    };
    return String(valor ?? '').replace(/[&<>"']/g, letra => caracteres[letra]);
  },

  emailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 100;
  },

  validarCadastro(nome, email, senha, repeticao, ciencia) {
    if (nome.trim().length < 2 || nome.trim().length > 50) {
      return 'Informe um nome entre 2 e 50 caracteres.';
    }
    if (!regrasPedido.emailValido(email.trim())) {
      return 'Informe um e-mail válido, como pessoa@exemplo.com.';
    }
    if (senha.length < 8 || senha.length > 64) {
      return 'Use uma senha de teste entre 8 e 64 caracteres.';
    }
    if (senha !== repeticao) return 'As senhas não são iguais.';
    if (!ciencia) return 'Confirme a leitura do aviso de privacidade.';
    return '';
  },

  calcular(carrinho, cupom, usarPontos, pontos, campanhaAtiva = true) {
    let subtotal = 0;
    for (const item of carrinho) {
      subtotal += item.preco * item.quantidade;
    }

    let desconto = 0;
    let erro = '';

    if (cupom && usarPontos) {
      erro = 'Escolha o cupom ou os pontos. Os benefícios não são cumulativos.';
    } else if (cupom) {
      if (cupom !== 'CHEGUEI10' || !campanhaAtiva) {
        erro = 'Cupom inválido ou campanha indisponível.';
      } else if (subtotal < 3000) {
        erro = 'O cupom vale para pedidos a partir de R$ 30,00.';
      } else {
        desconto = Math.min(Math.round(subtotal * 0.1), 1500);
      }
    } else if (usarPontos) {
      if (pontos < 100) {
        erro = 'Você precisa de 100 pontos para usar esta recompensa.';
      } else if (subtotal < 2000) {
        erro = 'A recompensa vale para pedidos a partir de R$ 20,00.';
      } else {
        desconto = 1000;
      }
    }

    const total = Math.max(0, subtotal - desconto);
    return { subtotal, desconto, total, erro, pontosGanhos: Math.floor(total / 100) };
  },

  validarCarrinho(carrinho, produtos, unidade, alteracoes = {}) {
    if (!carrinho.length) return 'Sua sacola está vazia. Escolha um item do cardápio.';

    for (const item of carrinho) {
      const produto = produtos.find(produto => produto.id === item.produtoId);
      if (!produto) return 'Um item ficou indisponível. Revise sua sacola.';

      const disponivel = alteracoes[unidade + ':' + produto.id] ?? produto.disponivel[unidade];
      if (!disponivel) return 'Um item ficou indisponível. Revise sua sacola.';
      if (!Number.isInteger(item.quantidade) || item.quantidade < 1 || item.quantidade > 20) {
        return 'Escolha de 1 a 20 unidades de cada item.';
      }
      if (item.preco !== produto.precos[unidade]) {
        return 'O preço de um item mudou. Remova-o e adicione novamente.';
      }
      if (String(item.observacao || '').length > 120) {
        return 'A observação deve ter até 120 caracteres.';
      }
    }
    return '';
  },

  proximaEtapa(atual, perfil) {
    if (perfil === 'cozinha' && (atual === 0 || atual === 1)) return atual + 1;
    if (perfil === 'atendente' && atual === 2) return 3;
    return atual;
  }
};

window.regrasPedido = regrasPedido;
