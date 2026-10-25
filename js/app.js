/* Permite instalar como aplicativo (PWA). O navegador só libera isso em https ou em localhost. */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').catch(function () { /* sem app instalável, o site funciona igual */ });
}
