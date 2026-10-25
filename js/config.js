/* Configuração do Mini Delivery Aterrisse.
   Aqui só entram dados PÚBLICOS: o endereço do Supabase e a chave publicável
   (feita para ficar no navegador; quem protege os dados são as regras RLS do banco).
   NUNCA coloque aqui a service_role, senha de banco, token de WhatsApp ou chave de pagamento.

   MODO:
     'demo'     -> modo demonstração: tudo fica só neste navegador (nada chega ao restaurante).
     'supabase' -> pedidos gravados no Supabase beta-cloud. Só ligue DEPOIS de aplicar
                   supabase/001_aterrisse_delivery.sql e 002_aterrisse_dados_iniciais.sql. */
window.ATERRISSE_CONFIG = {
  MODO: 'demo',
  SUPABASE_URL: 'https://cxzzutbijljjteapowuv.supabase.co',
  SUPABASE_CHAVE_PUBLICA: 'sb_publishable_aMDO3LAivnM7dSonKxzOKg_3eLGaNwy'
};
