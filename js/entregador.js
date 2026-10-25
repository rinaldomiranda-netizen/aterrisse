/* Mini Delivery Aterrisse — tela individual do entregador (celular).
   Mostra só as entregas atribuídas a ele, enquanto estão abertas (o banco também só entrega isso).
   Sem mapa próprio nem rastreamento: o botão "Abrir no mapa" só leva o endereço ao Google Maps. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }
  var st = { entregas: [], timer: null, erro: null, loja: null, pixAberto: {} };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'aviso-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
  }
  function bip() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 660; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.15;
      o.start(); o.stop(ctx.currentTime + 0.3);
    } catch (e) { /* sem som */ }
  }

  function telaLogin(mensagem) {
    $('#btn-sair').classList.add('oculto');
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    var h = '<div class="login caixa"><h2>Entrar</h2>';
    if (api.modo === 'demo') {
      $('#conteudo').innerHTML = h + '<div class="aviso-caixa">O site está no modo demonstração (só navegador). A tela do entregador só funciona com o banco ligado.</div></div>';
      return;
    }
    if (mensagem) h += '<div class="erro-caixa">' + esc(mensagem) + '</div>';
    h += '<form id="form-login">' + '<div class="campo"><label for="l-usuario">Usuário</label><input id="l-usuario" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="120"></div>' +
      '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form>' +
      '<p style="font-size:14px;color:var(--texto-2);margin-top:14px">Sem acesso ou esqueceu a senha? Peça ao restaurante: o dono cria o seu usuário e a senha no painel.</p>' +
      '<p style="font-size:13px;color:var(--texto-2);margin-top:14px">Dica: no Chrome, toque em ⋮ → “Adicionar à tela inicial” para abrir como aplicativo.</p></div>';
    $('#conteudo').innerHTML = h;
  }

  async function iniciar() {
    if ((api.modo === 'demo' && !api.vitrine) || !api.sessao()) return telaLogin();
    var papel = null;
    try { papel = await api.papel(); } catch (e) { return telaLogin(e.codigo === 'REDE' ? e.message : null); }
    $('#btn-sair').classList.remove('oculto');
    $('#quem').textContent = N.usuarioVisivel(api.sessao().email || '') + ' · Restaurante Aterrisse';
    if (papel !== 'entregador' && !api.vitrine) { // na vitrine a tela mostra as entregas do entregador de exemplo
      $('#conteudo').innerHTML = '<div class="login caixa"><h2>Sem acesso</h2><p>' + (papel
        ? 'Esta conta é da equipe do restaurante. Use o <a href="painel.html">painel</a>.'
        : 'Sua conta ainda não foi liberada como entregador. Peça ao restaurante (Painel → Equipe).') + '</p></div>';
      return;
    }
    window.AterrissePrazo.aoAtrasar(function (id, numero) { bip(); toast('⚠ Entrega #' + numero + ' passou do prazo!'); });
    try { st.loja = (await api.cardapio()).loja; } catch (e) { /* sem a loja: o QR do Pix não aparece */ }
    await carregar();
    if (st.timer) clearInterval(st.timer);
    st.timer = setInterval(carregar, 15000);
  }

  async function carregar() {
    try {
      var novas = await api.minhasEntregas();
      var antes = st.entregas.map(function (e) { return e.id; });
      if (antes.length && novas.some(function (e) { return antes.indexOf(e.id) < 0; })) { bip(); toast('Nova entrega para você!'); }
      st.entregas = novas; st.erro = null;
    } catch (e) { st.erro = e.message; }
    render();
  }

  function cartao(p) {
    var e = p.endereco || {};
    var pronta = p.status === 'PRONTO', saiu = p.status === 'SAIU_PARA_ENTREGA';
    var troco = p.troco_para ? Number(p.troco_para) - Number(p.total) : 0;
    var h = '<article class="caixa" style="overflow-wrap:anywhere">' +
      '<div class="barra-acoes" style="margin:0 0 6px;justify-content:space-between"><h3 style="margin:0;font-size:22px">#' + esc(p.numero) + '</h3>' + window.AterrissePrazo.html(p) + '</div>' +
      '<div style="margin-bottom:8px"><span class="status st-' + p.status + '">' + N.STATUS_NOMES[p.status] + '</span>' + (p.teste ? ' <span class="status st-TESTE">TESTE</span>' : '') +
      (p.prazo_em ? ' <small style="color:var(--texto-2)">prazo até ' + esc(N.horaCurta(p.prazo_em)) + '</small>' : '') + '</div>' +
      '<div style="font-size:17px"><b>' + esc(p.nome) + '</b></div>' +
      '<div style="font-size:17px;margin:4px 0">📍 ' + esc((e.rua || '') + ', ' + (e.numero || '') + ' — ' + (e.bairro || '')) + '</div>' +
      (e.complemento ? '<div>' + esc(e.complemento) + '</div>' : '') +
      (e.referencia ? '<div><b>Referência:</b> ' + esc(e.referencia) + '</div>' : '') +
      '<div class="barra-acoes" style="margin:10px 0">' +
      '<a class="btn btn-linha" href="' + esc(N.linkMapa(e)) + '" target="_blank" rel="noopener">🗺️ Abrir no mapa</a>' +
      (p.telefone ? '<a class="btn btn-linha" href="tel:+' + esc(N.normalizarTelefone(p.telefone)) + '">📞 Ligar</a>' : '') + '</div>' +
      '<div class="resumo-bloco"><b>Itens</b><ul style="margin:6px 0;padding-left:18px">' + (p.itens || []).map(function (i) {
        var d = (i.adicionais || []).map(function (a) { return a.nome; }).join(', ');
        return '<li>' + i.quantidade + '× ' + esc(i.nome) + (d ? ' <small>(' + esc(d) + ')</small>' : '') + '</li>';
      }).join('') + '</ul>' + (p.observacoes ? '<div style="color:var(--aviso)">Obs.: ' + esc(p.observacoes) + '</div>' : '') + '</div>' +
      '<div class="resumo-bloco" style="font-size:17px">Receber: <b>' + N.reais(p.total) + '</b> · ' + esc(nomePagamento(p.pagamento)) +
      (troco > 0 ? '<br>Levar troco: <b>' + N.reais(troco) + '</b> (para ' + N.reais(p.troco_para) + ')' : '') + htmlPagamento(p) + '</div>';
    if (pronta) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="SAIU_PARA_ENTREGA" data-numero="' + esc(p.numero) + '">🛵 Saí para entrega</button>';
    else if (saiu) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="ENTREGUE" data-numero="' + esc(p.numero) + '">📦 Entregue</button>';
    else h += '<div class="aviso-caixa" style="margin-bottom:0">Ainda em preparo na cozinha. Aguarde ficar “Pronto”.</div>';
    return h + '</article>';
  }

  // Pagamento recebido pessoalmente: o entregador confirma e o painel do restaurante vê na hora.
  function htmlPagamento(p) {
    if (p.pagamento_status === 'CONFIRMADO') return '<div class="ok-caixa" style="margin:8px 0 0">✔ Pagamento recebido' + (p.pago_como ? ' (' + esc(nomePagamento(p.pago_como)) + ')' : '') + '</div>';
    if (p.pagamento_status === 'CANCELADO') return '';
    var h = '';
    if (st.loja && st.loja.pix_chave) {
      h += '<button class="btn btn-linha btn-bloco" style="margin-top:8px" type="button" data-acao="pix" data-id="' + esc(p.id) + '">' + (st.pixAberto[p.id] ? 'Esconder QR do Pix' : '📱 Mostrar QR do Pix ao cliente') + '</button>';
      if (st.pixAberto[p.id]) h += window.AterrissePix.bloco(st.loja, Number(p.total), p.numero, 'O cliente lê com o app do banco. Confira o Pix recebido antes de confirmar.');
    }
    if (p.status !== 'SAIU_PARA_ENTREGA') return h + '<div style="font-size:13px;color:var(--texto-2);margin-top:6px">Confirme o pagamento depois de sair para a entrega.</div>';
    return h + '<div style="margin-top:10px;font-size:14px;font-weight:800">Recebi o pagamento em:</div><div class="barra-acoes" style="margin:6px 0 0">' +
      [['dinheiro', '💵 Dinheiro'], ['cartao', '💳 Cartão'], ['pix', '📱 Pix']].map(function (f) {
        return '<button class="btn btn-linha" style="flex:1;min-width:90px" type="button" data-acao="pago" data-id="' + esc(p.id) + '" data-forma="' + f[0] + '" data-numero="' + esc(p.numero) + '">' + f[1] + '</button>';
      }).join('') + '</div>';
  }

  function nomePagamento(id) {
    return { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão' }[id] || id;
  }

  function render() {
    var h = st.erro ? '<div class="erro-caixa" role="alert">Falha de comunicação: ' + esc(st.erro) + '</div>' : '';
    if (!st.entregas.length) h += '<div class="vazio">Nenhuma entrega com você agora.<br><small>A lista atualiza sozinha.</small></div>';
    else h += st.entregas.map(cartao).join('');
    $('#conteudo').innerHTML = h;
  }

  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    if (el.dataset.acao === 'sair') { await api.sair(); telaLogin(); return; }
    if (el.dataset.acao === 'pix') { st.pixAberto[el.dataset.id] = !st.pixAberto[el.dataset.id]; render(); return; }
    if (el.dataset.acao === 'pago') {
      if (!confirm('Confirmar que recebeu o pagamento da entrega #' + el.dataset.numero + ' em ' + nomePagamento(el.dataset.forma) + '?')) return;
      el.disabled = true;
      try { await api.confirmarPagamento(el.dataset.id, el.dataset.forma); toast('Pagamento registrado ✔'); st.pixAberto[el.dataset.id] = false; }
      catch (e) { alert(e.message); }
      carregar();
      return;
    }
    if (el.dataset.acao === 'status') {
      var pedido = st.entregas.filter(function (x) { return x.id === el.dataset.id; })[0];
      var txt = el.dataset.para === 'ENTREGUE' ? 'Confirmar que a entrega #' + el.dataset.numero + ' foi feita?' : 'Confirmar que saiu com a entrega #' + el.dataset.numero + '?';
      if (el.dataset.para === 'ENTREGUE' && pedido && pedido.pagamento_status === 'PENDENTE') txt = 'O pagamento da entrega #' + el.dataset.numero + ' ainda NÃO foi marcado como recebido. Marcar como entregue mesmo assim?';
      if (!confirm(txt)) return;
      el.disabled = true;
      try { await api.mudarStatus(el.dataset.id, el.dataset.para); toast(el.dataset.para === 'ENTREGUE' ? 'Entrega concluída ✔' : 'Boa entrega! 🛵'); }
      catch (e) { alert(e.message); }
      carregar();
    }
  });

  document.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    if (ev.target.id === 'form-login') {
      try { await api.entrar($('#l-usuario').value.trim(), $('#l-senha').value); iniciar(); } catch (e) { telaLogin(e.message); }
    }
  });

  iniciar();
})();
