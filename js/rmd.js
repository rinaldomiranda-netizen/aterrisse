/* Mini Delivery Aterrisse — área do desenvolvedor RMD.
   Controla liberação da loja, recursos, modo demonstração/real, acessos da equipe e erros técnicos.
   NÃO mostra vendas, valores, pedidos nem dados de clientes (o banco também não entrega isso ao desenvolvedor). */
(function () {
  'use strict';
  var N = window.AterrisseNucleo;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var esc = N.escaparHtml;
  function $(s) { return document.querySelector(s); }

  var RECURSOS = [
    ['entrega', 'Entrega'], ['retirada', 'Retirada no balcão'], ['local', 'Consumo na loja (mesa)'],
    ['cozinha', 'Tela da cozinha'], ['entregadores', 'Entregadores'], ['qrcode', 'QR Code'], ['relatorios', 'Relatórios do restaurante']
  ];
  var PAPEIS = { admin: 'Dono / administrador', atendente: 'Atendente', cozinha: 'Cozinha', entregador: 'Entregador' };
  var st = { painel: null, erros: [], verResolvidos: false };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'aviso-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2800);
  }

  function telaLogin(mensagem) {
    $('#btn-sair').classList.add('oculto');
    var h = '<div class="login caixa"><h2>Área do desenvolvedor RMD</h2>';
    if (api.modo === 'demo') {
      h += '<div class="aviso-caixa">O site está no modo demonstração (só navegador). A área do desenvolvedor só funciona com o banco ligado.</div></div>';
      $('#conteudo').innerHTML = h;
      return;
    }
    if (mensagem) h += '<div class="erro-caixa">' + esc(mensagem) + '</div>';
    h += '<p style="font-size:14px;color:var(--texto-2)">Use a mesma conta de desenvolvedor do RMD Ponto.</p>' +
      '<form id="form-login"><div class="campo"><label for="l-email">Usuário ou e-mail</label><input id="l-email" autocomplete="username" autocapitalize="none" spellcheck="false" required maxlength="120"></div>' +
      '<div class="campo"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>' +
      '<button class="btn btn-ouro btn-bloco" type="submit">Entrar</button></form></div>';
    $('#conteudo').innerHTML = h;
    var f = $('#l-email'); if (f) f.focus();
  }

  async function iniciar() {
    if (api.modo === 'demo' || !api.sessao()) return telaLogin();
    var ok = false;
    try { ok = await api.souRmd(); } catch (e) { return telaLogin(e.codigo === 'REDE' ? e.message : null); }
    $('#btn-sair').classList.remove('oculto');
    $('#quem').textContent = N.usuarioVisivel(api.sessao().email || '') + ' · Restaurante Aterrisse';
    if (!ok) {
      $('#conteudo').innerHTML = '<div class="login caixa"><h2>Sem acesso</h2><p>Esta conta não é de desenvolvedor RMD.</p></div>';
      return;
    }
    await carregar();
  }

  async function carregar() {
    try {
      st.painel = await api.rmdPainel();
      st.erros = await api.rmdErros(st.verResolvidos);
      render();
    } catch (e) {
      $('#conteudo').innerHTML = '<div class="erro-caixa" role="alert">' + esc(e.message) + ' <button class="btn btn-linha btn-peq" type="button" data-acao="recarregar">Tentar de novo</button></div>';
    }
  }

  function render() {
    var p = st.painel, c = p.controle || { liberada: true, modo: 'demo', recursos: {} };
    var h = '<div class="aviso-caixa">Área técnica: liberação, recursos, acessos e erros. Vendas, valores, pedidos e dados de clientes são do restaurante e não aparecem aqui.</div>';

    h += '<div class="caixa"><h2 style="margin-top:0">' + esc(p.loja_nome || 'Restaurante Aterrisse') + '</h2>' +
      '<div class="cartoes-resumo">' +
      '<div class="cartao-num"><span>Situação</span><strong style="color:' + (c.liberada ? 'var(--ok)' : 'var(--erro)') + '">' + (c.liberada ? 'Liberada' : 'Suspensa') + '</strong></div>' +
      '<div class="cartao-num"><span>Modo</span><strong>' + (c.modo === 'real' ? 'Real' : 'Demonstração') + '</strong></div>' +
      '<div class="cartao-num"><span>Recebeu pedidos hoje</span><strong>' + (p.recebeu_pedidos_hoje ? 'Sim' : 'Não') + '</strong></div>' +
      '<div class="cartao-num"><span>Erros em aberto</span><strong style="color:' + (p.erros_abertos ? 'var(--erro)' : 'var(--ok)') + '">' + p.erros_abertos + '</strong></div></div>' +
      (c.atualizado_em ? '<p style="font-size:12px;color:var(--texto-2);margin:0">Última mudança: ' + esc(N.dataHora(c.atualizado_em)) + '</p>' : '') + '</div>';

    h += '<form id="form-controle" class="caixa"><h3 style="margin-top:0">Liberação</h3><div class="opcoes-radio">' +
      '<label class="opcao"><input type="radio" name="liberada" value="1"' + (c.liberada ? ' checked' : '') + '> Loja liberada (cardápio e pedidos funcionando)</label>' +
      '<label class="opcao"><input type="radio" name="liberada" value="0"' + (!c.liberada ? ' checked' : '') + '> Suspender (cardápio mostra “temporariamente indisponível”)</label></div>' +
      '<div class="campo" style="margin-top:10px"><label for="motivo">Motivo da suspensão (interno, o cliente não vê)</label><input id="motivo" maxlength="200" value="' + esc(c.motivo_suspensao || '') + '"></div>' +
      '<h3>Modo</h3><div class="opcoes-radio">' +
      '<label class="opcao"><input type="radio" name="modo" value="demo"' + (c.modo !== 'real' ? ' checked' : '') + '> Demonstração (faixa “versão de demonstração”; pedidos marcados como TESTE)</label>' +
      '<label class="opcao"><input type="radio" name="modo" value="real"' + (c.modo === 'real' ? ' checked' : '') + '> Real (sem faixa; pedidos de teste saem dos números do restaurante)</label></div>' +
      '<h3>Recursos liberados</h3><div style="display:flex;flex-wrap:wrap;gap:4px 16px">' +
      RECURSOS.map(function (r) {
        return '<label class="chk"><input type="checkbox" name="rec" value="' + r[0] + '"' + ((c.recursos || {})[r[0]] !== false ? ' checked' : '') + '> ' + r[1] + '</label>';
      }).join('') + '</div><p style="font-size:12px;color:var(--texto-2)">Recurso desligado some do cardápio/painel e o servidor recusa o uso.</p>' +
      '<button class="btn btn-ouro" type="submit">Salvar liberação</button></form>';

    h += '<div class="caixa"><h3 style="margin-top:0">Acessos do restaurante</h3>' + (p.equipe.length
      ? p.equipe.map(function (m) {
        return '<div class="barra-acoes" style="margin-bottom:6px;align-items:flex-start"><span style="flex:1;min-width:0;overflow-wrap:anywhere"><b>' + esc(m.nome) + '</b> · ' + esc(PAPEIS[m.papel] || m.papel) +
          (m.ativo ? '' : ' (desativado)') + '<br><small style="color:var(--texto-2)">' + esc(m.usuario ? 'usuário: ' + m.usuario : (m.email || '')) + '</small></span>' +
          (m.usuario ? '<button class="btn btn-linha btn-peq" type="button" data-acao="senha" data-id="' + esc(m.user_id) + '" data-nome="' + esc(m.nome) + '">Nova senha</button>' : '') +
          '<button class="btn btn-perigo btn-peq" type="button" data-acao="tirar" data-id="' + esc(m.user_id) + '" data-nome="' + esc(m.nome) + '">Tirar acesso</button></div>';
      }).join('')
      : '<p>Ninguém tem acesso ao painel do restaurante ainda.</p>') +
      '<h3>Criar acesso</h3><p style="font-size:13px;color:var(--texto-2)">Sem e-mail: escolha usuário e senha e passe para a pessoa (normalmente o dono).</p>' +
      '<form id="form-acesso"><div class="linha-2"><div class="campo"><label for="a-usuario">Usuário</label><input id="a-usuario" required minlength="3" maxlength="30" autocapitalize="none" spellcheck="false"></div>' +
      '<div class="campo"><label for="a-senha">Senha (mín. 6)</label><input id="a-senha" type="text" required minlength="6" maxlength="72"></div></div>' +
      '<div class="linha-2"><div class="campo"><label for="a-nome">Nome</label><input id="a-nome" required minlength="2" maxlength="80"></div>' +
      '<div class="campo"><label for="a-papel">Papel</label><select id="a-papel">' + Object.keys(PAPEIS).map(function (k) { return '<option value="' + k + '">' + PAPEIS[k] + '</option>'; }).join('') + '</select></div></div>' +
      '<button class="btn btn-ouro btn-peq" type="submit">Criar acesso</button></form></div>';

    h += '<div class="caixa"><div class="barra-acoes" style="margin:0"><h3 style="margin:0;flex:1">Erros técnicos</h3>' +
      '<label class="chk"><input type="checkbox" data-acao="ver-resolvidos"' + (st.verResolvidos ? ' checked' : '') + '> mostrar resolvidos</label>' +
      '<button class="btn btn-linha btn-peq" type="button" data-acao="recarregar">Atualizar</button></div>' +
      (st.erros.length ? st.erros.map(function (e) {
        return '<div class="resumo-bloco" style="margin-top:10px;overflow-wrap:anywhere"><b>' + esc(e.mensagem) + '</b><br><small style="color:var(--texto-2)">' + esc(e.pagina) + ' · ' + e.vezes + ' vez(es) · último: ' + esc(N.dataHora(e.ultimo_em)) + '</small>' +
          (e.detalhe ? '<div style="font-size:12px;color:var(--texto-2);margin-top:4px">' + esc(e.detalhe) + '</div>' : '') +
          '<div style="margin-top:6px"><button class="btn btn-linha btn-peq" type="button" data-acao="resolver" data-id="' + e.id + '" data-valor="' + (e.resolvido ? '0' : '1') + '">' + (e.resolvido ? 'Reabrir' : 'Marcar resolvido') + '</button></div></div>';
      }).join('') : '<p style="margin:10px 0 0">Nenhum erro ' + (st.verResolvidos ? 'registrado' : 'em aberto') + '. ✔</p>') + '</div>';

    $('#conteudo').innerHTML = h;
  }

  document.addEventListener('click', async function (ev) {
    var el = ev.target.closest('[data-acao]');
    if (!el) return;
    var a = el.dataset.acao;
    if (a === 'sair') { await api.sair(); telaLogin(); }
    else if (a === 'recarregar') carregar();
    else if (a === 'tirar') {
      if (!confirm('Tirar o acesso de ' + el.dataset.nome + ' ao painel do restaurante? (a conta continua existindo, só perde o acesso)')) return;
      try { await api.rmdTirarAcesso(el.dataset.id); toast('Acesso retirado.'); carregar(); } catch (e) { alert(e.message); }
    } else if (a === 'senha') {
      var nova = prompt('Nova senha para ' + el.dataset.nome + ' (mínimo 6 caracteres):');
      if (nova === null) return;
      try { await api.trocarSenha(el.dataset.id, nova); toast('Senha trocada.'); } catch (e) { alert(e.message); }
    } else if (a === 'resolver') {
      try { await api.rmdErroResolvido(Number(el.dataset.id), el.dataset.valor === '1'); carregar(); } catch (e) { alert(e.message); }
    }
  });

  document.addEventListener('change', function (ev) {
    if (ev.target.dataset && ev.target.dataset.acao === 'ver-resolvidos') { st.verResolvidos = ev.target.checked; carregar(); }
  });

  document.addEventListener('submit', async function (ev) {
    var f = ev.target;
    ev.preventDefault();
    if (f.id === 'form-login') {
      try { await api.entrar($('#l-email').value.trim(), $('#l-senha').value); iniciar(); } catch (e) { telaLogin(e.message); }
    } else if (f.id === 'form-controle') {
      var antes = st.painel.controle || {};
      var rec = {};
      RECURSOS.forEach(function (r) { rec[r[0]] = !!f.querySelector('input[name="rec"][value="' + r[0] + '"]').checked; });
      var c = { liberada: f.querySelector('input[name="liberada"]:checked').value === '1', modo: f.querySelector('input[name="modo"]:checked').value,
        motivo_suspensao: $('#motivo').value.trim(), recursos: rec };
      if (!rec.entrega && !rec.retirada && !rec.local) { alert('Deixe pelo menos uma forma de receber pedido (entrega, retirada ou mesa).'); return; }
      if (antes.liberada && !c.liberada && !confirm('Suspender a loja? O cardápio fica indisponível para os clientes.')) return;
      if (antes.modo !== 'real' && c.modo === 'real' && !confirm('Passar para o modo REAL? A faixa de demonstração some e os pedidos de teste saem dos números do restaurante.')) return;
      try { await api.rmdControle(c); toast('Liberação salva.'); carregar(); } catch (e) { alert(e.message); }
    } else if (f.id === 'form-acesso') {
      try { await api.criarAcesso({ nome: $('#a-nome').value.trim(), usuario: N.normalizarUsuario($('#a-usuario').value), senha: $('#a-senha').value, papel: $('#a-papel').value }); toast('Acesso criado.'); carregar(); } catch (e) { alert(e.message); }
    }
  });

  iniciar();
})();
