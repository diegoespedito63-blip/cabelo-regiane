// ============================================================
//  CONFIGURAÇÃO DO SITE — edite aqui os dados da Regiane
// ============================================================
window.SITE_CONFIG = {
  nome: "Regiane Paulino",
  titulo: "Cabeleireira & Consultora de Beleza Mary Kay",

  // WhatsApp no formato internacional, só números (ex: 5511999998888).
  // TODO: preencher com o número da Regiane.
  whatsapp: "5519991831556",

  // Instagram da Regiane
  instagram: "https://www.instagram.com/re_paulino82/",
  instagramHandle: "@re_paulino82",

  maryKay: "https://loja.marykay.com.br/minha-vitrine?slug=rehpaulino",

  // Texto livre — aparece no rodapé e na seção de contato.
  endereco: "Atendimento com hora marcada",
  horario: "Seg a Qui · 8h às 18h · Sex · 8h às 17h30",

  // ----------------------------------------------------------
  //  Banco de dados do agendamento online (Supabase).
  //  Deixe vazio para usar o "modo demonstração" (dados só neste navegador).
  //  Use a chave pública (anon / publishable) — NUNCA a service_role.
  // ----------------------------------------------------------
  supabase: {
    url: "https://ikvhnbxvgsdigkiaajnf.supabase.co",
    anonKey: "sb_publishable_-Amp1qUHCjOfpjTSo38cNw_v_JxzcvW"
  },

  // Textos de marketing dos serviços (o que aparece na seção "Especialidades").
  // Duração e preço reais são configurados no painel → Ajustes → Serviços.
  // "duracao" e "preco" abaixo só servem de ponto de partida no modo demonstração.
  servicos: [
    { id: "corte", duracao: 60, preco: 80, nome: "Corte", desc: "Long bob, reto, em camadas ou repicado, desenhado para o formato do rosto e a rotina de cada cliente.", icone: "tesoura" },
    { id: "progressiva", duracao: 180, preco: 250, nome: "Progressiva", desc: "Fios alinhados, brilho intenso e redução de volume com acabamento natural e movimento.", icone: "brilho" },
    { id: "luzes", duracao: 240, preco: 350, nome: "Luzes & Mechas", desc: "Loiros, morena iluminada e balayage com transição suave, preservando a saúde dos fios.", icone: "luz" },
    { id: "coloracao", duracao: 120, preco: 180, nome: "Coloração", desc: "Coloração global, ruivos e vermelhos intensos e retoque de raiz com cobertura uniforme.", icone: "gota" },
    { id: "escova", duracao: 60, preco: 60, nome: "Escova & Babyliss", desc: "Escova modelada e ondas para o dia a dia, eventos e ocasiões especiais.", icone: "onda" },
    { id: "tratamento", duracao: 60, preco: 90, nome: "Tratamentos", desc: "Hidratação, nutrição e reconstrução para devolver força, maciez e brilho.", icone: "folha" }
  ],

  // Galeria — categoria: corte | progressiva | cor
  galeria: [
    { src: "trabalho-1.jpg", titulo: "Long bob", cat: "corte" },
    { src: "trabalho-5.jpg", titulo: "Transformação · morena iluminada", cat: "cor" },
    { src: "trabalho-9.jpg", titulo: "Progressiva e corte", cat: "progressiva" },
    { src: "trabalho-11.jpg", titulo: "Retoque de raiz e progressiva", cat: "cor" },
    { src: "trabalho-3.jpg", titulo: "Corte reto", cat: "corte" },
    { src: "trabalho-12.jpg", titulo: "Luzes e corte", cat: "cor" },
    { src: "trabalho-4.jpg", titulo: "Corte e progressiva", cat: "progressiva" },
    { src: "trabalho-7.jpg", titulo: "Cores & mechas", cat: "cor" },
    { src: "trabalho-2.jpg", titulo: "Corte e babyliss", cat: "corte" },
    { src: "trabalho-13.jpg", titulo: "Mechas iluminadas", cat: "cor" },
    { src: "trabalho-10.jpg", titulo: "Antes e depois", cat: "progressiva" },
    { src: "trabalho-6.jpg", titulo: "Morena iluminada", cat: "cor" },
    { src: "trabalho-8.jpg", titulo: "Loiros & acobreados", cat: "cor" }
  ]
};
