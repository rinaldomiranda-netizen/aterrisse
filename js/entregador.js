/* Mini Delivery Aterrisse — tela individual do entregador (celular).
   Mostra só as entregas atribuídas a ele, enquanto estão abertas (o banco também só entrega isso).
   Sem mapa próprio nem rastreamento: o botão "Abrir no mapa" só leva o endereço ao Google Maps. */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }
  var st = { entregas: [], timer: null, erro: null };

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
    h += '<form id="form-login"><div class="campo"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required maxlength="120"></div>' +
      '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form>' +
      '<details style="margin-top:16px"><summary>Ainda não tenho conta</summary><p style="font-size:14px;color:var(--texto-2)">Crie a sua conta e peça ao restaurante para liberar você como entregador (Painel → Equipe).</p>' +
      '<form id="form-conta"><div class="campo"><label for="c-email">E-mail</label><input id="c-email" type="email" required maxlength="120"></div>' +
      '<div class="campo"><label for="c-senha">Senha (mínimo 8, com letras e números)</label><input id="c-senha" type="password" autocomplete="new-password" minlength="8" required></div>' +
      '<button class="btn btn-linha btn-bloco" type="submit">Criar minha conta</button></form></details>' +
      '<p style="font-size:13px;color:var(--texto-2);margin-top:14px">Dica: no Chrome, toque em ⋮ → “Adicionar à tela inicial” para abrir como aplicativo.</p></div>';
    $('#conteudo').innerHTML = h;
  }

  async function iniciar() {
    if (api.modo === 'demo' || !api.sessao()) return telaLogin();
    var papel = null;
    try { papel = await api.papel(); } catch (e) { return telaLogin(e.codigo === 'REDE' ? e.message : null); }
    $('#btn-sair').classList.remove('oculto');
    $('#quem').textContent = (api.sessao().email || '') + ' · Restaurante Aterrisse';
    if (papel !== 'entregador') {
      $('#conteudo').innerHTML = '<div class="login caixa"><h2>Sem acesso</h2><p>' + (papel
        ? 'Esta conta é da equipe do restaurante. Use o <a href="painel.html">painel</a>.'
        : 'Sua conta ainda não foi liberada como entregador. Peça ao restaurante (Painel → Equipe).') + '</p></div>';
      return;
    }
    window.AterrissePrazo.aoAtrasar(function (id, numero) { bip(); toast('⚠ Entrega #' + numero + ' passou do prazo!'); });
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
      (troco > 0 ? '<br>Levar troco: <b>' + N.reais(troco) + '</b> (para ' + N.reais(p.troco_para) + ')' : '') + '</div>';
    if (pronta) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="SAIU_PARA_ENTREGA" data-numero="' + esc(p.numero) + '">🛵 Saí para entrega</button>';
    else if (saiu) h += '<button class="btn btn-ouro btn-bloco" style="min-height:58px;font-size:18px" type="button" data-acao="status" data-id="' + esc(p.id) + '" data-para="ENTREGUE" data-numero="' + esc(p.numero) + '">📦 Entregue</button>';
    else h += '<div class="aviso-caixa" style="margin-bottom:0">Ainda em preparo na cozinha. Aguarde ficar “Pronto”.</div>';
    return h + '</article>';
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
    if (el.dataset.acao === 'status') {
      var txt = el.dataset.para === 'ENTREGUE' ? 'Confirmar que a entrega #' + el.dataset.numero + ' foi feita?' : 'Confirmar que saiu com a entrega #' + el.dataset.numero + '?';
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
      try { await api.entrar($('#l-email').value.trim(), $('#l-senha').value); iniciar(); } catch (e) { telaLogin(e.message); }
    } else if (ev.target.id === 'form-conta') {
      var s = $('#c-senha').value;
      if (s.length < 8 || !/[a-z]/i.test(s) || !/\d/.test(s)) { alert('A senha precisa ter 8 ou mais caracteres, com letras e números.'); return; }
      try {
        var r = await api.criarConta($('#c-email').value.trim(), s);
        alert(r.precisaConfirmar ? 'Conta criada. Confirme pelo e-mail e peça ao restaurante para liberar você.' : 'Conta criada. Peça ao restaurante para liberar você como entregador.');
        iniciar();
      } catch (e) { alert(e.message); }
    }
  });

  iniciar();
})();
