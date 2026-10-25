/* Comum a todas as páginas do Mini Delivery Aterrisse:
   - permite instalar como aplicativo (PWA). O navegador só libera isso em https ou em localhost;
   - envia erros técnicos da tela para o desenvolvedor RMD (sem dados de clientes; o servidor ainda limpa e-mails e números). */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sem app instalável, o site funciona igual */ });
  }

  if (!window.AterrisseBackend) return;
  var api = window.AterrisseBackend.criar(window.ATERRISSE_CONFIG);
  var pagina = (location.pathname.split('/').pop() || 'index.html').slice(0, 60);
  var enviados = {}, total = 0;

  function enviar(mensagem, detalhe) {
    mensagem = String(mensagem || '').slice(0, 300);
    if (!mensagem || enviados[mensagem] || total >= 10) return; // no máximo 10 por visita, sem repetir
    enviados[mensagem] = true; total++;
    try { api.registrarErro(pagina, mensagem, String(detalhe || '').slice(0, 1000)).catch(function () { /* sem rede: deixa para lá */ }); } catch (e) { /* idem */ }
  }

  window.addEventListener('error', function (ev) {
    if (!ev.message) return;
    enviar(ev.message, (ev.filename || '').split('/').pop() + ':' + ev.lineno + ':' + ev.colno);
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason || {};
    if (r.codigo && r.codigo !== 'ERRO') return; // recusas normais do servidor (validação, permissão) não são erro do sistema
    enviar('Promessa recusada: ' + (r.message || r), r.stack ? String(r.stack).split('\n').slice(0, 3).join(' | ') : '');
  });
  window.AterrisseErros = { enviar: enviar };
})();
