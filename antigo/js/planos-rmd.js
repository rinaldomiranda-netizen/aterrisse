/* Planos do RMD Delivery e a promoção de lançamento. Usado pela área do desenvolvedor (rmd.js) e pela página de vendas (vendas.js).
   Preços sugeridos pela RMD (pesquisa de mercado de 25/10/2026). Mudou aqui, muda nas duas telas. */
(function (raiz) {
  'use strict';
  // "recursos" = o que o botão "Ligar recursos deste plano" (área do desenvolvedor) deixa ligado na loja.
  var PLANOS = [
    { id: 'essencial', nome: 'Essencial', preco: 79.90, anual: 799.00, para: 'Quem está começando o delivery próprio',
      itens: ['Cardápio online com QR Code e link', 'Pedidos de entrega, retirada e mesa', 'Painel de pedidos com contagem do prazo', 'Logo e cores da loja', 'Pedido também pelo WhatsApp', 'Acessos da equipe com usuário e senha'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, cozinha: false, entregadores: false, relatorios: false } },
    { id: 'profissional', nome: 'Profissional', preco: 149.90, anual: 1499.00, para: 'Restaurante com cozinha e entregadores', destaque: true,
      itens: ['Tudo do Essencial', 'Tela da cozinha', 'Tela do entregador no celular (sem mapa falso)', 'Nome do entregador e prazo em cada pedido', 'Suporte por WhatsApp em horário comercial'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, cozinha: true, entregadores: true, relatorios: false } },
    { id: 'completo', nome: 'Completo', preco: 229.90, anual: 2299.00, para: 'Quem quer controle e números do negócio',
      itens: ['Tudo do Profissional', 'Relatórios de vendas e produtos mais pedidos', 'Cadastro inicial do cardápio feito pela RMD', 'QR Codes impressos das mesas', 'Suporte prioritário'],
      recursos: { entrega: true, retirada: true, local: true, qrcode: true, cozinha: true, entregadores: true, relatorios: true } }
  ];
  // Promoção de lançamento (decisão do Rinaldo, 27/10/2026): os 5 primeiros restaurantes inscritos levam o plano
  // Completo pelo preço do Essencial e, nos 3 primeiros meses, pagam metade disso. Quem conta as vagas é o servidor
  // (supabase/007_vagas_lancamento.sql); se mudar o número de vagas, mudar lá também.
  var PROMOCAO = { vagas: 5, plano: 'completo', pagaComo: 'essencial', mesesMetade: 3 };
  PROMOCAO.preco = PLANOS[0].preco;
  PROMOCAO.precoInicio = Math.round(PLANOS[0].preco * 50) / 100;
  raiz.RmdPlanos = { PLANOS: PLANOS, PROMOCAO: PROMOCAO, IMPLANTACAO: 150, WHATSAPP_RMD: '5579988653766' };
})(typeof self !== 'undefined' ? self : this);
