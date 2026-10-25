/* Configuração do Mini Delivery Aterrisse.
   Aqui só entram dados PÚBLICOS: o endereço do Supabase e a chave publicável
   (feita para ficar no navegador; quem protege os dados são as regras RLS do banco).
   NUNCA coloque aqui a service_role, senha de banco, token de WhatsApp ou chave de pagamento.

   MODO:
     'demo'     -> modo demonstração: tudo fica só neste navegador (nada chega ao restaurante).
     'supabase' -> pedidos gravados no Supabase beta-cloud. Só ligue DEPOIS de aplicar
                   supabase/001_aterrisse_delivery.sql e 002_aterrisse_dados_iniciais.sql. */
window.ATERRISSE_CONFIG = {
  MODO: 'supabase',
  SUPABASE_URL: 'https://cxzzutbijljjteapowuv.supabase.co',
  SUPABASE_CHAVE_PUBLICA: 'sb_publishable_aMDO3LAivnM7dSonKxzOKg_3eLGaNwy'
};

// Vitrine para apresentar ao cliente: abra qualquer tela com ?demo=1 (ex.: painel.html?demo=1).
// Usa dados de exemplo só neste aparelho, sem senha e sem tocar no banco real. ?demo=0 volta ao normal.
(function () {
  try {
    var q = location.search;
    if (/[?&]demo=0\b/.test(q)) sessionStorage.removeItem('aterrisse_vitrine');
    else if (/[?&]demo=1\b/.test(q)) sessionStorage.setItem('aterrisse_vitrine', '1');
    if (sessionStorage.getItem('aterrisse_vitrine') === '1') { window.ATERRISSE_CONFIG.MODO = 'demo'; window.ATERRISSE_CONFIG.VITRINE = true; }
  } catch (e) { /* sem armazenamento: segue normal */ }
})();
