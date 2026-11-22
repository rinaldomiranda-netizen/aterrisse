/* Dados iniciais do MODO DEMONSTRAÇÃO (só no navegador). São os mesmos de
   supabase/002_aterrisse_dados_iniciais.sql:
   - Almoço: preços e opções visíveis no cardápio divulgado (imagem de sábado).
   - Lanches, jantar, batata e bebida: FICTÍCIOS (demonstracao: true). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.AterrisseDadosDemo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var seq = 0;
  function id(prefixo) { seq++; return prefixo + '-' + ('000' + seq).slice(-4); }
  function grupo(nome, minimo, maximo, opcoes) {
    return {
      id: id('g'), nome: nome, minimo: minimo, maximo: maximo,
      opcoes: opcoes.map(function (o) { return { id: id('o'), nome: o[0], preco: o[1] || 0, disponivel: true }; })
    };
  }
  function quentinha() {
    return [
      grupo('Carne', 1, 2, [['Costela de boi'], ['Coxa assada'], ['Carne do sol'], ['Peito de frango acebolado'], ['Toscana'], ['Bisteca']]),
      grupo('Feijão', 0, 1, [['Caldo / tradicional'], ['Tropeiro']]),
      grupo('Acompanhamentos', 0, 3, [['Arroz branco'], ['Macarrão'], ['Farofa']]),
      grupo('Salada', 0, 3, [['Verde'], ['Legumes'], ['Maionese']])
    ];
  }
  function produto(cat, ordem, nome, descricao, preco, icone, demo, extra) {
    var p = {
      id: id('p'), categoria_id: cat, nome: nome, descricao: descricao, preco: preco, icone: icone,
      imagem_url: null, imagem_ilustrativa: true, disponivel: true, ativo: true, destaque: false,
      demonstracao: demo, ingredientes_removiveis: [], permite_observacao: true, ordem: ordem, grupos: []
    };
    Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }

  function criar() {
    seq = 0;
    var cats = [
      { id: 'c-almoco', slug: 'almoco', nome: 'Almoço / Quentinhas', descricao: 'Monte sua quentinha com as opções do dia. As opções podem variar.', icone: '🍛', ordem: 1, ativa: true },
      { id: 'c-lanches', slug: 'lanches', nome: 'Lanches', descricao: 'Hambúrgueres e cachorro-quente.', icone: '🍔', ordem: 2, ativa: true },
      { id: 'c-jantar', slug: 'jantar', nome: 'Jantar nordestino', descricao: 'Cuscuz, macaxeira, carne do sol, tapioca, escondidinho e caldinhos.', icone: '🌽', ordem: 3, ativa: true },
      { id: 'c-acomp', slug: 'acompanhamentos', nome: 'Acompanhamentos', descricao: 'Porções para acompanhar.', icone: '🍟', ordem: 4, ativa: true },
      { id: 'c-bebidas', slug: 'bebidas', nome: 'Bebidas', descricao: 'Bebidas geladas.', icone: '🥤', ordem: 5, ativa: true }
    ];
    var adicLanche = function (lista) { return [grupo('Adicionais', 0, lista.length, lista)]; };
    var produtos = [
      produto('c-almoco', 1, 'Quentinha P', 'Escolha a carne, o feijão, os acompanhamentos e a salada do dia.', 18, '🍱', false, { destaque: true, grupos: quentinha() }),
      produto('c-almoco', 2, 'Quentinha G', 'Escolha a carne, o feijão, os acompanhamentos e a salada do dia.', 20, '🍱', false, { destaque: true, grupos: quentinha() }),
      produto('c-lanches', 1, 'X-Burger Aterrisse', 'Pão, hambúrguer bovino, queijo, presunto, alface, tomate e molho da casa.', 18, '🍔', true,
        { ingredientes_removiveis: ['Alface', 'Tomate', 'Presunto', 'Molho da casa'], grupos: adicLanche([['Bacon', 4], ['Ovo', 2], ['Queijo extra', 3], ['Hambúrguer extra', 6]]) }),
      produto('c-lanches', 2, 'X-Salada', 'Pão, hambúrguer, queijo, alface, tomate, cebola e molho da casa.', 20, '🥗', true,
        { ingredientes_removiveis: ['Alface', 'Tomate', 'Cebola', 'Molho da casa'], grupos: adicLanche([['Bacon', 4], ['Ovo', 2], ['Queijo extra', 3]]) }),
      produto('c-lanches', 3, 'X-Bacon', 'Pão, hambúrguer, queijo, bacon crocante, alface, tomate e molho da casa.', 23, '🥓', true,
        { ingredientes_removiveis: ['Alface', 'Tomate', 'Molho da casa'], grupos: adicLanche([['Ovo', 2], ['Queijo extra', 3]]) }),
      produto('c-lanches', 4, 'Cachorro-quente', 'Pão, salsicha, molho, milho, batata palha e queijo ralado.', 12, '🌭', true,
        { ingredientes_removiveis: ['Milho', 'Batata palha', 'Queijo ralado'] }),
      produto('c-jantar', 1, 'Cuscuz com ovo e queijo', 'Cuscuz de milho com ovo e queijo.', 14, '🌽', true),
      produto('c-jantar', 2, 'Cuscuz com carne do sol e queijo coalho', 'Cuscuz com carne do sol desfiada e queijo coalho.', 24, '🌽', true),
      produto('c-jantar', 3, 'Macaxeira com carne do sol', 'Macaxeira cozida com carne do sol na manteiga.', 28, '🥩', true),
      produto('c-jantar', 4, 'Macaxeira com queijo coalho', 'Macaxeira cozida com queijo coalho.', 18, '🧀', true),
      produto('c-jantar', 5, 'Escondidinho de macaxeira', 'Purê de macaxeira gratinado com o recheio escolhido.', 22, '🥘', true,
        { grupos: [grupo('Recheio', 1, 1, [['Carne do sol'], ['Frango'], ['Charque']])] }),
      produto('c-jantar', 6, 'Caldinho da noite', 'Caldinho do dia (pergunte o sabor).', 10, '🥣', true),
      produto('c-jantar', 7, 'Tapioca recheada', 'Tapioca com o recheio escolhido.', 12, '🫓', true,
        { grupos: [grupo('Recheio', 1, 1, [['Queijo coalho'], ['Carne do sol com queijo', 4], ['Frango com catupiry', 3], ['Coco com leite condensado', 2]])] }),
      produto('c-jantar', 8, 'Baião de dois', 'Arroz, feijão verde, queijo coalho e temperos.', 20, '🍚', true),
      produto('c-acomp', 1, 'Batata frita', 'Porção de batata frita.', 10, '🍟', true),
      produto('c-bebidas', 1, 'Refrigerante em lata', 'Lata 350 ml (pergunte os sabores).', 6, '🥤', true)
    ];
    return {
      loja: {
        nome: 'Restaurante Aterrisse', logo_url: 'assets/marca/selo_256.png', whatsapp: '5579988476641', aberto: true, aviso: null,
        horario_funcionamento: null, aceita_entrega: true, aceita_retirada: true, aceita_local: true,
        taxa_entrega: 0, pedido_minimo: 0, mesa_modo: 'opcional', previsao_retirada_min: 30, previsao_entrega_min: 30, previsao_local_min: 30,
        pagamentos: [
          { id: 'pix', nome: 'Pix (QR Code na tela ou na entrega)', ativo: true },
          { id: 'dinheiro', nome: 'Dinheiro (paga ao entregador ou no balcão)', ativo: true },
          { id: 'cartao', nome: 'Cartão (maquininha na entrega ou no balcão)', ativo: true }
        ],
        url_publica: null, pix_chave: '+5579996899727', pix_nome: 'RESTAURANTE ATERRISSE', pix_cidade: 'ARACAJU'
      },
      destaques: [
        { periodo: 'almoco', titulo: 'Almoço', inicio: '06:00', fim: '14:59', categorias: ['almoco'], ordem: 1, ativo: true },
        { periodo: 'lanches', titulo: 'Lanches', inicio: '15:00', fim: '17:59', categorias: ['lanches', 'acompanhamentos', 'bebidas'], ordem: 2, ativo: true },
        { periodo: 'jantar', titulo: 'Jantar nordestino', inicio: '18:00', fim: '05:59', categorias: ['jantar', 'lanches'], ordem: 3, ativo: true }
      ],
      categorias: cats,
      produtos: produtos
    };
  }

  return { criar: criar };
});
