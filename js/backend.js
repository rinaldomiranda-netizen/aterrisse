/* Mini Delivery Aterrisse — acesso aos dados.
   Dois jeitos, com as mesmas funções:
   - BackendSupabase: grava de verdade no Supabase (REST, sem biblioteca externa).
   - BackendDemo: MODO DEMONSTRAÇÃO, guarda tudo só neste navegador (localStorage).
     Usa as mesmas regras do servidor, mas NÃO é o servidor: nada chega ao restaurante. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./nucleo.js'), require('./dados-demo.js'));
  else raiz.AterrisseBackend = fabrica(raiz.AterrisseNucleo, raiz.AterrisseDadosDemo);
})(typeof self !== 'undefined' ? self : this, function (N, DadosDemo) {
  'use strict';

  function Erro(mensagem, codigo) {
    var e = new Error(mensagem);
    e.codigo = codigo || 'ERRO';
    return e;
  }

  function guardar(armazem, chave, valor) {
    try { if (valor === null) armazem.removeItem(chave); else armazem.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento */ }
  }
  function ler(armazem, chave) {
    try { var t = armazem.getItem(chave); return t ? JSON.parse(t) : null; } catch (e) { return null; }
  }

  // ================================================================ Supabase

  var CAMPOS_PRODUTO = ['categoria_id', 'nome', 'descricao', 'preco', 'icone', 'imagem_url', 'imagem_ilustrativa', 'disponivel',
    'ativo', 'destaque', 'demonstracao', 'ingredientes_removiveis', 'permite_observacao', 'ordem'];
  var CAMPOS_CATEGORIA = ['slug', 'nome', 'descricao', 'icone', 'ordem', 'ativa'];
  var CAMPOS_LOJA = ['nome', 'logo_url', 'whatsapp', 'aberto', 'aviso', 'horario_funcionamento', 'aceita_entrega', 'aceita_retirada',
    'aceita_local', 'taxa_entrega', 'pedido_minimo', 'mesa_modo', 'previsao_retirada_min', 'previsao_entrega_min', 'previsao_local_min',
    'pagamentos', 'url_publica'];
  var ABERTOS = 'RECEBIDO,ACEITO,EM_PREPARACAO,PRONTO,SAIU_PARA_ENTREGA';

  function escolher(obj, campos) {
    var r = {};
    campos.forEach(function (c) { if (obj[c] !== undefined) r[c] = obj[c]; });
    return r;
  }

  function BackendSupabase(cfg, armazem) {
    this.modo = 'supabase';
    this.url = String(cfg.SUPABASE_URL || '').replace(/\/$/, '');
    this.chave = cfg.SUPABASE_CHAVE_PUBLICA;
    this.armazem = armazem || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  BackendSupabase.prototype._sessao = function () { return this.armazem ? ler(this.armazem, 'aterrisse_sessao') : null; };

  BackendSupabase.prototype._token = async function () {
    var s = this._sessao();
    if (!s) return null;
    if (s.expira_em - Date.now() < 60000) {
      try {
        var r = await this._auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
        s = this._salvarSessao(r);
      } catch (e) { guardar(this.armazem, 'aterrisse_sessao', null); return null; }
    }
    return s.access_token;
  };

  BackendSupabase.prototype._salvarSessao = function (r) {
    var s = { access_token: r.access_token, refresh_token: r.refresh_token, expira_em: Date.now() + (r.expires_in || 3600) * 1000,
      email: r.user && r.user.email, user_id: r.user && r.user.id };
    guardar(this.armazem, 'aterrisse_sessao', s);
    return s;
  };

  BackendSupabase.prototype._auth = async function (caminho, corpo, token) {
    var resp;
    try {
      resp = await fetch(this.url + '/auth/v1/' + caminho, {
        method: 'POST', headers: { apikey: this.chave, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || this.chave) },
        body: JSON.stringify(corpo || {})
      });
    } catch (e) { throw Erro('Sem conexão com o servidor. Verifique a internet.', 'REDE'); }
    var j = await resp.json().catch(function () { return {}; });
    if (!resp.ok) {
      var msg = j.error_description || j.msg || j.message || 'Falha na autenticação.';
      if (/invalid login/i.test(msg)) msg = 'E-mail ou senha incorretos.';
      if (/email not confirmed/i.test(msg)) msg = 'E-mail ainda não confirmado.';
      throw Erro(msg, 'AUTH');
    }
    return j;
  };

  BackendSupabase.prototype._req = async function (metodo, caminho, corpo, prefer) {
    var token = (await this._token()) || this.chave;
    var cab = { apikey: this.chave, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    if (prefer) cab.Prefer = prefer;
    var resp;
    try {
      resp = await fetch(this.url + '/rest/v1/' + caminho, { method: metodo, headers: cab, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    } catch (e) { throw Erro('Sem conexão com o servidor. Verifique a internet e tente de novo.', 'REDE'); }
    if (resp.status === 204) return null;
    var j = await resp.json().catch(function () { return null; });
    if (!resp.ok) {
      j = j || {};
      if (resp.status >= 500 && caminho.indexOf('aterrisse_registrar_erro') < 0) {
        this.registrarErro('servidor', 'Erro ' + resp.status + ' em ' + caminho.split('?')[0], j.message || '').catch(function () {});
      }
      var codigo = j.message || 'ERRO';
      var msg = j.hint || (/permission denied|row-level/i.test(j.message || '') ? 'Sem permissão para isso.' : j.message) || 'Erro no servidor.';
      if (codigo === 'SEM_PERMISSAO' && !j.hint) msg = 'Sem permissão para isso.';
      throw Erro(msg, codigo);
    }
    return j;
  };

  BackendSupabase.prototype._rpc = function (nome, args) { return this._req('POST', 'rpc/' + nome, args || {}); };

  // ---- público
  BackendSupabase.prototype.cardapio = function () { return this._rpc('aterrisse_cardapio'); };
  BackendSupabase.prototype.criarPedido = function (dados) { return this._rpc('aterrisse_criar_pedido', { dados: dados }); };
  BackendSupabase.prototype.acompanhar = function (numero, codigo) { return this._rpc('aterrisse_acompanhar', { p_numero: numero, p_codigo: codigo }); };

  // ---- conta
  BackendSupabase.prototype.entrar = async function (email, senha) {
    var r = await this._auth('token?grant_type=password', { email: email, password: senha });
    return this._salvarSessao(r);
  };
  BackendSupabase.prototype.criarConta = async function (email, senha) {
    var r = await this._auth('signup', { email: email, password: senha });
    if (r.access_token) this._salvarSessao(r);
    return { precisaConfirmar: !r.access_token };
  };
  BackendSupabase.prototype.sair = async function () {
    var s = this._sessao();
    guardar(this.armazem, 'aterrisse_sessao', null);
    if (s) { try { await this._auth('logout', {}, s.access_token); } catch (e) { /* já saiu localmente */ } }
  };
  BackendSupabase.prototype.sessao = function () { return this._sessao(); };
  BackendSupabase.prototype.papel = function () { return this._rpc('aterrisse_papel'); };

  // ---- pedidos
  function normalizarPedido(p) {
    var itens = p.aterrisse_pedido_itens || p.itens || [];
    var hist = (p.aterrisse_pedido_status_hist || p.historico || []).slice().sort(function (a, b) { return String(a.em).localeCompare(String(b.em)); });
    var pag = (p.aterrisse_pagamentos || [])[0];
    var r = {};
    Object.keys(p).forEach(function (k) { if (k.indexOf('aterrisse_') !== 0) r[k] = p[k]; });
    r.itens = itens.map(function (i) { i.preco_unitario = Number(i.preco_unitario); i.total = Number(i.total); return i; });
    r.historico = hist;
    r.pagamento_status = pag ? pag.status : (p.pagamento_status || 'PENDENTE');
    ['subtotal', 'taxa_entrega', 'total', 'troco_para'].forEach(function (k) { if (r[k] !== null && r[k] !== undefined) r[k] = Number(r[k]); });
    return r;
  }

  BackendSupabase.prototype.listarPedidos = async function (dias) {
    var desde = new Date(Date.now() - (dias || 2) * 86400000).toISOString();
    var lista = await this._req('GET', 'aterrisse_pedidos?select=*,aterrisse_pedido_itens(*),aterrisse_pagamentos(status),aterrisse_pedido_status_hist(de,para,motivo,em)' +
      '&or=(criado_em.gte.' + encodeURIComponent(desde) + ',status.in.(' + ABERTOS + '))&order=criado_em.desc&limit=300');
    return lista.map(normalizarPedido);
  };
  BackendSupabase.prototype.mudarStatus = function (id, para, motivo) { return this._rpc('aterrisse_mudar_status', { p_pedido: id, p_para: para, p_motivo: motivo || null }); };
  BackendSupabase.prototype.atribuirEntregador = function (id, entregador) { return this._rpc('aterrisse_atribuir_entregador', { p_pedido: id, p_entregador: entregador || null }); };
  BackendSupabase.prototype.confirmarPagamento = function (id) { return this._rpc('aterrisse_confirmar_pagamento', { p_pedido: id }); };
  BackendSupabase.prototype.filaCozinha = function () { return this._rpc('aterrisse_fila_cozinha'); };
  BackendSupabase.prototype.minhasEntregas = function () { return this._rpc('aterrisse_minhas_entregas'); };
  BackendSupabase.prototype.relatorio = function (inicio, fim) { return this._rpc('aterrisse_relatorio', { p_inicio: inicio, p_fim: fim }); };

  // ---- administração do cardápio
  BackendSupabase.prototype.cardapioCompleto = async function () {
    var r = await Promise.all([
      this._req('GET', 'aterrisse_loja?id=eq.1&select=*'),
      this._req('GET', 'aterrisse_destaques?select=*&order=ordem'),
      this._req('GET', 'aterrisse_categorias?select=*&order=ordem'),
      this._req('GET', 'aterrisse_produtos?select=*,aterrisse_adicionais_grupos(*,aterrisse_adicionais(*))&order=ordem')
    ]);
    var loja = r[0][0] || {};
    loja.taxa_entrega = Number(loja.taxa_entrega || 0); loja.pedido_minimo = Number(loja.pedido_minimo || 0);
    return {
      loja: loja,
      destaques: r[1].map(function (d) { d.inicio = String(d.inicio).slice(0, 5); d.fim = String(d.fim).slice(0, 5); return d; }),
      categorias: r[2],
      produtos: r[3].map(function (p) {
        p.preco = Number(p.preco);
        p.grupos = (p.aterrisse_adicionais_grupos || []).sort(function (a, b) { return a.ordem - b.ordem; }).map(function (g) {
          g.opcoes = (g.aterrisse_adicionais || []).sort(function (a, b) { return a.ordem - b.ordem; })
            .map(function (o) { o.preco = Number(o.preco); delete o.grupo_id; return o; });
          delete g.aterrisse_adicionais; delete g.produto_id;
          return g;
        });
        delete p.aterrisse_adicionais_grupos;
        return p;
      })
    };
  };

  BackendSupabase.prototype.salvarLoja = function (loja) {
    return this._req('PATCH', 'aterrisse_loja?id=eq.1', escolher(loja, CAMPOS_LOJA), 'return=minimal');
  };
  BackendSupabase.prototype.salvarDestaques = async function (lista) {
    for (var i = 0; i < lista.length; i++) {
      var d = lista[i];
      await this._req('PATCH', 'aterrisse_destaques?periodo=eq.' + encodeURIComponent(d.periodo),
        { titulo: d.titulo, inicio: d.inicio, fim: d.fim, categorias: d.categorias, ativo: d.ativo !== false, ordem: d.ordem, atualizado_em: new Date().toISOString() }, 'return=minimal');
    }
  };
  BackendSupabase.prototype.salvarCategoria = async function (c) {
    if (c.id && String(c.id).indexOf('novo') !== 0) return this._req('PATCH', 'aterrisse_categorias?id=eq.' + c.id, escolher(c, CAMPOS_CATEGORIA), 'return=minimal');
    return this._req('POST', 'aterrisse_categorias', escolher(c, CAMPOS_CATEGORIA), 'return=minimal');
  };
  BackendSupabase.prototype.apagarCategoria = function (id) { return this._req('DELETE', 'aterrisse_categorias?id=eq.' + id); };
  BackendSupabase.prototype.alterarProduto = function (id, campos) {
    return this._req('PATCH', 'aterrisse_produtos?id=eq.' + id, escolher(campos, CAMPOS_PRODUTO), 'return=minimal');
  };
  BackendSupabase.prototype.apagarProduto = function (id) { return this._req('DELETE', 'aterrisse_produtos?id=eq.' + id); };

  // Salva o produto com os grupos de adicionais e as opções (cria, altera e remove o que saiu).
  BackendSupabase.prototype.salvarProduto = async function (p) {
    var self = this, novo = !p.id || String(p.id).indexOf('novo') === 0, id = p.id;
    var linha = escolher(p, CAMPOS_PRODUTO);
    linha.atualizado_em = new Date().toISOString();
    if (novo) id = (await this._req('POST', 'aterrisse_produtos?select=id', linha, 'return=representation'))[0].id;
    else await this._req('PATCH', 'aterrisse_produtos?id=eq.' + id, linha, 'return=minimal');

    var antigos = await this._req('GET', 'aterrisse_adicionais_grupos?produto_id=eq.' + id + '&select=id,aterrisse_adicionais(id)');
    var mantidos = (p.grupos || []).filter(function (g) { return g.id && String(g.id).indexOf('novo') !== 0; }).map(function (g) { return g.id; });
    var sairam = antigos.filter(function (g) { return mantidos.indexOf(g.id) < 0; }).map(function (g) { return g.id; });
    if (sairam.length) await this._req('DELETE', 'aterrisse_adicionais_grupos?id=in.(' + sairam.join(',') + ')');

    for (var gi = 0; gi < (p.grupos || []).length; gi++) {
      var g = p.grupos[gi], gid = g.id;
      var gl = { produto_id: id, nome: g.nome, minimo: Number(g.minimo), maximo: Number(g.maximo), ordem: gi + 1 };
      if (!gid || String(gid).indexOf('novo') === 0) gid = (await self._req('POST', 'aterrisse_adicionais_grupos?select=id', gl, 'return=representation'))[0].id;
      else await self._req('PATCH', 'aterrisse_adicionais_grupos?id=eq.' + gid, gl, 'return=minimal');
      var ant = (antigos.filter(function (a) { return a.id === gid; })[0] || { aterrisse_adicionais: [] }).aterrisse_adicionais.map(function (o) { return o.id; });
      var ficam = (g.opcoes || []).filter(function (o) { return o.id && String(o.id).indexOf('novo') !== 0; }).map(function (o) { return o.id; });
      var tirar = ant.filter(function (o) { return ficam.indexOf(o) < 0; });
      if (tirar.length) await self._req('DELETE', 'aterrisse_adicionais?id=in.(' + tirar.join(',') + ')');
      for (var oi = 0; oi < (g.opcoes || []).length; oi++) {
        var o = g.opcoes[oi];
        var ol = { grupo_id: gid, nome: o.nome, preco: Number(o.preco || 0), disponivel: o.disponivel !== false, ordem: oi + 1 };
        if (!o.id || String(o.id).indexOf('novo') === 0) await self._req('POST', 'aterrisse_adicionais', ol, 'return=minimal');
        else await self._req('PATCH', 'aterrisse_adicionais?id=eq.' + o.id, ol, 'return=minimal');
      }
    }
    return id;
  };

  // ---- equipe e entregadores
  BackendSupabase.prototype.listarEquipe = function () { return this._req('GET', 'aterrisse_equipe?select=*&order=nome'); };
  BackendSupabase.prototype.adicionarEquipe = function (email, nome, papel) { return this._rpc('aterrisse_adicionar_equipe', { p_email: email, p_nome: nome, p_papel: papel }); };
  BackendSupabase.prototype.alterarEquipe = function (userId, campos) { return this._req('PATCH', 'aterrisse_equipe?user_id=eq.' + userId, escolher(campos, ['nome', 'papel', 'ativo']), 'return=minimal'); };
  BackendSupabase.prototype.listarEntregadores = function () { return this._req('GET', 'aterrisse_entregadores?select=*&order=nome'); };
  BackendSupabase.prototype.salvarEntregador = function (e) {
    var linha = escolher(e, ['nome', 'telefone', 'ativo']);
    if (e.id) return this._req('PATCH', 'aterrisse_entregadores?id=eq.' + e.id, linha, 'return=minimal');
    return this._req('POST', 'aterrisse_entregadores', linha, 'return=minimal');
  };

  // ---- erros técnicos (qualquer tela) e área do desenvolvedor RMD (sem vendas nem clientes)
  BackendSupabase.prototype.registrarErro = function (pagina, mensagem, detalhe) {
    return this._rpc('aterrisse_registrar_erro', { p_pagina: pagina, p_mensagem: mensagem, p_detalhe: detalhe || null });
  };
  BackendSupabase.prototype.souRmd = function () { return this._rpc('aterrisse_e_rmd'); };
  BackendSupabase.prototype.rmdPainel = function () { return this._rpc('aterrisse_rmd_painel'); };
  BackendSupabase.prototype.rmdControle = function (c) {
    return this._rpc('aterrisse_rmd_controle', { p_liberada: c.liberada, p_motivo: c.motivo_suspensao || null, p_modo: c.modo, p_recursos: c.recursos });
  };
  BackendSupabase.prototype.rmdDarAcesso = function (email, nome, papel) { return this._rpc('aterrisse_rmd_dar_acesso', { p_email: email, p_nome: nome, p_papel: papel }); };
  BackendSupabase.prototype.rmdTirarAcesso = function (userId) { return this._rpc('aterrisse_rmd_tirar_acesso', { p_user: userId }); };
  BackendSupabase.prototype.rmdErros = function (todos) { return this._rpc('aterrisse_rmd_erros', { p_todos: !!todos }); };
  BackendSupabase.prototype.rmdErroResolvido = function (id, resolvido) { return this._rpc('aterrisse_rmd_erro_resolvido', { p_id: id, p_resolvido: resolvido }); };

  // ================================================================ Demonstração (só no navegador)

  var CHAVE_DEMO = 'aterrisse_demo_v1';

  function BackendDemo(armazem, sessaoArmazem) {
    this.modo = 'demo';
    this.armazem = armazem || (typeof localStorage !== 'undefined' ? localStorage : null);
    this.sessaoArmazem = sessaoArmazem || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  }

  BackendDemo.prototype._estado = function () {
    var e = this.armazem ? ler(this.armazem, CHAVE_DEMO) : null;
    if (!e || !e.produtos) {
      e = DadosDemo.criar();
      e.pedidos = []; e.entregadores = []; e.proximoNumero = 1; e.senhaHash = null; e.auditoria = [];
      this._gravar(e);
    }
    return e;
  };
  BackendDemo.prototype._gravar = function (e) { if (this.armazem) guardar(this.armazem, CHAVE_DEMO, e); };
  BackendDemo.prototype._exigirLogin = function () {
    if (!(this.sessaoArmazem && ler(this.sessaoArmazem, 'aterrisse_demo_sessao'))) throw Erro('Entre no painel primeiro.', 'SEM_PERMISSAO');
  };
  BackendDemo.prototype._auditar = function (e, acao) {
    e.auditoria = (e.auditoria || []).concat([{ em: new Date().toISOString(), acao: acao }]).slice(-200);
  };

  function copia(x) { return JSON.parse(JSON.stringify(x)); }
  function novoId() { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  BackendDemo.prototype.cardapio = async function () {
    var e = this._estado();
    var cats = e.categorias.filter(function (c) { return c.ativa !== false; }).sort(function (a, b) { return a.ordem - b.ordem; });
    var ativas = cats.map(function (c) { return c.id; });
    var loja = copia(e.loja);
    loja.pagamentos = loja.pagamentos.filter(function (p) { return p.ativo !== false; });
    return {
      loja: loja,
      destaques: copia(e.destaques.filter(function (d) { return d.ativo !== false; })),
      categorias: copia(cats),
      produtos: copia(e.produtos.filter(function (p) { return p.ativo !== false && ativas.indexOf(p.categoria_id) >= 0; })
        .sort(function (a, b) { return a.ordem - b.ordem; }))
    };
  };

  // Mesmas regras de aterrisse_criar_pedido (servidor).
  BackendDemo.prototype.criarPedido = async function (dados) {
    var e = this._estado();
    var c = await this.cardapio();
    if (!e.loja.aberto) throw Erro('O restaurante não está recebendo pedidos agora.', 'LOJA_FECHADA');
    var erros = N.validarCheckout(dados, c.loja);
    var primeiro = Object.keys(erros)[0];
    if (primeiro) throw Erro(erros[primeiro], 'VALIDACAO');
    if (!dados.itens || !dados.itens.length) throw Erro('Adicione pelo menos um item.', 'SACOLA_VAZIA');
    if (dados.itens.length > 30) throw Erro('No máximo 30 itens por pedido.', 'ITENS_DEMAIS');
    var linhas = [], sub = 0;
    dados.itens.forEach(function (it) {
      var p = N.acharProduto(c, it.produto_id);
      var er = N.validarEscolha(p, it);
      if (er.length) throw Erro(er[0], p && p.disponivel === false ? 'PRODUTO_ESGOTADO' : 'ITEM_INVALIDO');
      var unit = N.precoUnitario(p, it.adicionais);
      sub += Math.round(unit * 100) * it.quantidade;
      linhas.push({
        produto_id: p.id, nome: p.nome, preco_unitario: unit, quantidade: it.quantidade,
        adicionais: N.opcoesEscolhidas(p, it.adicionais).map(function (o) { return { grupo: o.grupo, nome: o.nome, preco: o.preco }; }),
        removidos: it.removidos || [], observacao: String(it.observacao || '').trim() || null, total: Math.round(unit * 100) * it.quantidade / 100
      });
    });
    sub = sub / 100;
    if (sub < Number(e.loja.pedido_minimo || 0)) throw Erro('Pedido mínimo de ' + N.reais(e.loja.pedido_minimo) + '.', 'PEDIDO_MINIMO');
    var taxa = dados.modalidade === 'entrega' ? Number(e.loja.taxa_entrega || 0) : 0;
    var total = Math.round((sub + taxa) * 100) / 100;
    var troco = null;
    if (dados.pagamento === 'dinheiro' && dados.troco_para !== null && dados.troco_para !== undefined && dados.troco_para !== '') {
      troco = Number(dados.troco_para);
      if (!(troco >= total)) throw Erro('O valor para troco deve ser maior ou igual ao total.', 'TROCO_INVALIDO');
    }
    var tel = N.soDigitos(dados.telefone) || null;
    var agora = new Date().toISOString();
    var minutos = { entrega: e.loja.previsao_entrega_min, retirada: e.loja.previsao_retirada_min, local: e.loja.previsao_local_min }[dados.modalidade];
    var prazo = minutos > 0 ? new Date(Date.now() + minutos * 60000).toISOString() : null;
    var pedido = {
      id: novoId(), numero: e.proximoNumero++, acompanhamento: novoId(), nome: String(dados.nome).trim(), telefone: tel,
      modalidade: dados.modalidade,
      endereco: dados.modalidade === 'entrega' ? {
        rua: String(dados.endereco.rua).trim(), numero: String(dados.endereco.numero).trim(), bairro: String(dados.endereco.bairro).trim(),
        complemento: String(dados.endereco.complemento || '').trim(), referencia: String(dados.endereco.referencia || '').trim()
      } : null,
      mesa: dados.modalidade === 'local' && e.loja.mesa_modo !== 'desligado' ? (String(dados.mesa || '').trim() || null) : null,
      observacoes: String(dados.observacoes || '').trim() || null, pagamento: dados.pagamento, troco_para: troco,
      subtotal: sub, taxa_entrega: taxa, total: total, status: 'RECEBIDO', entregador_id: null, pagamento_status: 'PENDENTE',
      criado_em: agora, atualizado_em: agora, itens: linhas, historico: [{ de: null, para: 'RECEBIDO', em: agora }],
      prazo_em: prazo, finalizado_em: null, no_prazo: null
    };
    e.pedidos.push(pedido);
    this._gravar(e);
    return { numero: pedido.numero, acompanhamento: pedido.acompanhamento, status: pedido.status, subtotal: sub, taxa_entrega: taxa, total: total, criado_em: agora, itens: linhas, prazo_em: prazo };
  };

  BackendDemo.prototype.acompanhar = async function (numero, codigo) {
    var p = this._estado().pedidos.filter(function (x) { return x.numero === Number(numero) && x.acompanhamento === codigo; })[0];
    if (!p) return null;
    var ent = (this._estado().entregadores || []).filter(function (x) { return x.id === p.entregador_id; })[0];
    return { numero: p.numero, status: p.status, modalidade: p.modalidade, total: p.total, criado_em: p.criado_em, prazo_em: p.prazo_em || null,
      entregador: ent && ['SAIU_PARA_ENTREGA', 'ENTREGUE'].indexOf(p.status) >= 0 ? ent.nome.split(' ')[0] : null,
      historico: p.historico.map(function (h) { return { status: h.para, em: h.em }; }) };
  };

  // Conta do painel no modo demonstração: senha criada pelo próprio usuário, guardada (hash) só neste navegador.
  async function hashSenha(senha) {
    if (typeof crypto === 'undefined' || !crypto.subtle) throw Erro('Abra o painel por http://localhost ou https para usar a senha.', 'INSEGURO');
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('aterrisse-demo:' + senha));
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  BackendDemo.prototype.temSenhaDemo = function () { return !!this._estado().senhaHash; };
  BackendDemo.prototype.criarConta = async function (_email, senha) {
    var e = this._estado();
    if (e.senhaHash) throw Erro('A senha deste navegador já foi criada.', 'JA_EXISTE');
    if (String(senha || '').length < 6) throw Erro('A senha precisa ter pelo menos 6 caracteres.', 'SENHA_CURTA');
    e.senhaHash = await hashSenha(senha);
    this._gravar(e);
    return this.entrar(null, senha);
  };
  BackendDemo.prototype.entrar = async function (_email, senha) {
    var e = this._estado();
    if (!e.senhaHash) throw Erro('Crie a senha do modo demonstração primeiro.', 'SEM_SENHA');
    if ((await hashSenha(senha)) !== e.senhaHash) throw Erro('Senha incorreta.', 'AUTH');
    var s = { email: 'demonstração', user_id: 'demo' };
    guardar(this.sessaoArmazem, 'aterrisse_demo_sessao', s);
    return s;
  };
  BackendDemo.prototype.sair = async function () { guardar(this.sessaoArmazem, 'aterrisse_demo_sessao', null); };
  BackendDemo.prototype.sessao = function () { return this.sessaoArmazem ? ler(this.sessaoArmazem, 'aterrisse_demo_sessao') : null; };
  BackendDemo.prototype.papel = async function () { return this.sessao() ? 'admin' : null; };

  BackendDemo.prototype.listarPedidos = async function () { this._exigirLogin(); return copia(this._estado().pedidos).reverse(); };
  BackendDemo.prototype.mudarStatus = async function (id, para, motivo) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p) throw Erro('Pedido não encontrado.', 'PEDIDO_INEXISTENTE');
    if (!N.transicaoValida(p.modalidade, p.status, para)) throw Erro('Não é possível passar de ' + p.status + ' para ' + para + '.', 'TRANSICAO_INVALIDA');
    if (para === 'CANCELADO' && String(motivo || '').trim().length < 3) throw Erro('Informe o motivo do cancelamento.', 'MOTIVO_OBRIGATORIO');
    var agora = new Date().toISOString();
    p.historico.push({ de: p.status, para: para, motivo: motivo || null, em: agora });
    p.status = para; p.atualizado_em = agora;
    if (['ENTREGUE', 'CONCLUIDO', 'CANCELADO'].indexOf(para) >= 0) p.finalizado_em = agora;
    p.no_prazo = para === 'CANCELADO' ? null : (['ENTREGUE', 'CONCLUIDO'].indexOf(para) >= 0 && p.prazo_em ? Date.now() <= new Date(p.prazo_em).getTime() : p.no_prazo);
    if (para === 'CANCELADO' && p.pagamento_status === 'PENDENTE') p.pagamento_status = 'CANCELADO';
    this._gravar(e);
    return { id: id, status: para };
  };
  BackendDemo.prototype.atribuirEntregador = async function (id, entregador) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p || p.modalidade !== 'entrega' || ['ENTREGUE', 'CANCELADO'].indexOf(p.status) >= 0) throw Erro('Só pedidos de entrega em andamento.', 'PEDIDO_INVALIDO');
    p.entregador_id = entregador || null;
    this._gravar(e);
  };
  BackendDemo.prototype.confirmarPagamento = async function (id) {
    this._exigirLogin();
    var e = this._estado();
    var p = e.pedidos.filter(function (x) { return x.id === id; })[0];
    if (!p || p.pagamento_status !== 'PENDENTE') throw Erro('Não há pagamento pendente neste pedido.', 'PAGAMENTO_INVALIDO');
    p.pagamento_status = 'CONFIRMADO';
    this._gravar(e);
  };
  BackendDemo.prototype.filaCozinha = async function () {
    this._exigirLogin();
    var ents = this._estado().entregadores || [];
    return this._estado().pedidos.filter(function (p) { return p.status === 'ACEITO' || p.status === 'EM_PREPARACAO'; }).map(function (p) {
      var ent = ents.filter(function (x) { return x.id === p.entregador_id; })[0];
      return { id: p.id, numero: p.numero, status: p.status, modalidade: p.modalidade, mesa: p.mesa, primeiro_nome: p.nome.split(' ')[0],
        observacoes: p.observacoes, criado_em: p.criado_em, itens: p.itens, prazo_em: p.prazo_em || null, entregador: ent ? ent.nome : null };
    });
  };
  BackendDemo.prototype.minhasEntregas = async function () { this._exigirLogin(); return []; };
  BackendDemo.prototype.relatorio = async function (inicio, fim) { this._exigirLogin(); return N.relatorioPedidos(this._estado().pedidos, inicio, fim); };

  BackendDemo.prototype.cardapioCompleto = async function () {
    this._exigirLogin();
    var e = this._estado();
    return copia({ loja: e.loja, destaques: e.destaques, categorias: e.categorias, produtos: e.produtos });
  };
  BackendDemo.prototype.salvarLoja = async function (loja) {
    this._exigirLogin(); var e = this._estado();
    CAMPOS_LOJA.forEach(function (c) { if (loja[c] !== undefined) e.loja[c] = loja[c]; });
    this._auditar(e, 'loja'); this._gravar(e);
  };
  BackendDemo.prototype.salvarDestaques = async function (lista) {
    this._exigirLogin(); var e = this._estado();
    e.destaques = copia(lista); this._auditar(e, 'horarios'); this._gravar(e);
  };
  BackendDemo.prototype.salvarCategoria = async function (c) {
    this._exigirLogin(); var e = this._estado();
    var atual = e.categorias.filter(function (x) { return x.id === c.id; })[0];
    if (atual) CAMPOS_CATEGORIA.forEach(function (k) { if (c[k] !== undefined) atual[k] = c[k]; });
    else { var n = escolher(c, CAMPOS_CATEGORIA); n.id = novoId(); e.categorias.push(n); }
    this._auditar(e, 'categoria'); this._gravar(e);
  };
  BackendDemo.prototype.apagarCategoria = async function (id) {
    this._exigirLogin(); var e = this._estado();
    if (e.produtos.some(function (p) { return p.categoria_id === id; })) throw Erro('A categoria ainda tem produtos. Mova ou apague os produtos antes.', 'EM_USO');
    e.categorias = e.categorias.filter(function (c) { return c.id !== id; }); this._gravar(e);
  };
  BackendDemo.prototype.alterarProduto = async function (id, campos) {
    this._exigirLogin(); var e = this._estado();
    var p = e.produtos.filter(function (x) { return x.id === id; })[0];
    if (!p) throw Erro('Produto não encontrado.', 'NAO_ENCONTRADO');
    CAMPOS_PRODUTO.forEach(function (k) { if (campos[k] !== undefined) p[k] = campos[k]; });
    this._auditar(e, 'produto'); this._gravar(e);
  };
  BackendDemo.prototype.apagarProduto = async function (id) {
    this._exigirLogin(); var e = this._estado();
    e.produtos = e.produtos.filter(function (p) { return p.id !== id; }); this._gravar(e);
  };
  BackendDemo.prototype.salvarProduto = async function (p) {
    this._exigirLogin(); var e = this._estado();
    var n = copia(p);
    if (!n.id || String(n.id).indexOf('novo') === 0) n.id = novoId();
    (n.grupos || []).forEach(function (g) {
      if (!g.id || String(g.id).indexOf('novo') === 0) g.id = novoId();
      (g.opcoes || []).forEach(function (o) { if (!o.id || String(o.id).indexOf('novo') === 0) o.id = novoId(); });
    });
    var i = e.produtos.map(function (x) { return x.id; }).indexOf(n.id);
    if (i >= 0) e.produtos[i] = n; else e.produtos.push(n);
    this._auditar(e, 'produto'); this._gravar(e);
    return n.id;
  };
  BackendDemo.prototype.listarEquipe = async function () { return []; };
  BackendDemo.prototype.adicionarEquipe = async function () { throw Erro('No modo demonstração não há equipe: só a senha deste navegador.', 'DEMO'); };
  BackendDemo.prototype.alterarEquipe = BackendDemo.prototype.adicionarEquipe;
  BackendDemo.prototype.listarEntregadores = async function () { this._exigirLogin(); return copia(this._estado().entregadores || []); };
  BackendDemo.prototype.salvarEntregador = async function (en) {
    this._exigirLogin(); var e = this._estado();
    e.entregadores = e.entregadores || [];
    var atual = e.entregadores.filter(function (x) { return x.id === en.id; })[0];
    if (atual) { atual.nome = en.nome; atual.telefone = en.telefone; atual.ativo = en.ativo !== false; }
    else e.entregadores.push({ id: novoId(), nome: en.nome, telefone: en.telefone || null, ativo: true });
    this._gravar(e);
  };
  BackendDemo.prototype.apagarTudoDemo = function () { if (this.armazem) guardar(this.armazem, CHAVE_DEMO, null); };
  BackendDemo.prototype.registrarErro = async function () { /* no modo navegador não há servidor para guardar erros */ };
  BackendDemo.prototype.souRmd = async function () { return false; };
  ['rmdPainel', 'rmdControle', 'rmdDarAcesso', 'rmdTirarAcesso', 'rmdErros', 'rmdErroResolvido'].forEach(function (n) {
    BackendDemo.prototype[n] = async function () { throw Erro('A área do desenvolvedor só funciona com o banco (MODO supabase).', 'DEMO'); };
  });

  function criar(cfg) {
    cfg = cfg || {};
    if (cfg.MODO === 'supabase' && cfg.SUPABASE_URL && cfg.SUPABASE_CHAVE_PUBLICA) return new BackendSupabase(cfg);
    return new BackendDemo();
  }

  return { criar: criar, BackendSupabase: BackendSupabase, BackendDemo: BackendDemo, Erro: Erro };
});
