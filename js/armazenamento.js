const bancoLocal = {
  mensagem: '',

  ler(chave, padrao, temporario = false) {
    try {
      const local = temporario ? sessionStorage : localStorage;
      const textoSalvo = local.getItem('raizes_' + chave);
      if (!textoSalvo) return padrao;

      const valor = JSON.parse(textoSalvo);
      if (Array.isArray(padrao) && !Array.isArray(valor)) throw new Error('Formato inválido');
      if (padrao !== null && !Array.isArray(padrao)) {
        if (valor === null || typeof valor !== typeof padrao || Array.isArray(valor)) {
          throw new Error('Formato inválido');
        }
      }
      return valor;
    } catch {
      bancoLocal.mensagem = 'Não foi possível ler os dados salvos. Confira o armazenamento do navegador.';
      return padrao;
    }
  },

  salvar(chave, valor, temporario = false) {
    try {
      const local = temporario ? sessionStorage : localStorage;
      local.setItem('raizes_' + chave, JSON.stringify(valor));
    } catch {
      throw new Error('Não foi possível salvar no navegador. Libere espaço ou habilite o armazenamento.');
    }
  },

  remover(chave, temporario = false) {
    try {
      const local = temporario ? sessionStorage : localStorage;
      local.removeItem('raizes_' + chave);
    } catch {
      throw new Error('Não foi possível apagar os dados locais. Confira as configurações do navegador.');
    }
  },

  id() {
    return crypto.randomUUID();
  },

  async cadastrar(nome, email, senha, marketing) {
    email = email.trim().toLowerCase();
    let contas = bancoLocal.ler('contas', []);
    if (contas.some(conta => conta.email === email)) {
      throw new Error('Este e-mail já tem uma conta neste navegador.');
    }

    const sal = converterHex(crypto.getRandomValues(new Uint8Array(16)));
    const conta = {
      id: bancoLocal.id(),
      nome: nome.trim(),
      email,
      sal,
      senhaResumo: await resumirSenha(senha, sal),
      marketing,
      criadoEm: new Date().toISOString(),
      consentimentoEm: marketing ? new Date().toISOString() : null
    };

    contas = bancoLocal.ler('contas', []);
    if (contas.some(cadastrada => cadastrada.email === email)) {
      throw new Error('Este e-mail já tem uma conta neste navegador.');
    }
    contas.push(conta);
    bancoLocal.salvar('contas', contas);
    return conta;
  },

  async entrar(email, senha) {
    email = email.trim().toLowerCase();
    const conta = bancoLocal.ler('contas', []).find(conta => conta.email === email);
    if (!conta || await resumirSenha(senha, conta.sal) !== conta.senhaResumo) {
      throw new Error('E-mail ou senha incorretos.');
    }
    return conta;
  },

  atualizarConta(conta) {
    const contas = bancoLocal.ler('contas', []);
    const indice = contas.findIndex(cadastrada => cadastrada.id === conta.id);
    if (indice < 0) throw new Error('Conta não encontrada. Entre novamente.');
    contas[indice] = conta;
    bancoLocal.salvar('contas', contas);
  },

  limparTudo() {
    try {
      for (const local of [localStorage, sessionStorage]) {
        for (const chave of Object.keys(local)) {
          if (chave.startsWith('raizes_')) local.removeItem(chave);
        }
      }
    } catch {
      throw new Error('Não foi possível apagar os dados locais.');
    }
  },

  aviso() {
    return bancoLocal.mensagem;
  }
};

function converterHex(bytes) {
  return Array.from(bytes, numero => numero.toString(16).padStart(2, '0')).join('');
}

async function resumirSenha(senha, sal) {
  if (!crypto.subtle) throw new Error('Abra o site por HTTPS ou localhost para usar o cadastro.');
  const codificador = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', codificador.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const resultado = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: codificador.encode(sal),
    iterations: 210000,
    hash: 'SHA-256'
  }, chave, 256);
  return converterHex(new Uint8Array(resultado));
}

window.bancoLocal = bancoLocal;
