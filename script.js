(function () {
  const C = window.SITE_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- Ícones (traço fino) ----------
  const svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICONES = {
    tesoura: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'),
    brilho: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'),
    luz: svg('<path d="m12 3 2.6 5.6L20.5 9l-4.3 4.1 1.1 5.9L12 16.2 6.7 19l1.1-5.9L3.5 9l5.9-.4z"/>'),
    gota: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>'),
    onda: svg('<path d="M3 8c3-3 6 3 9 0s6 3 9 0M3 13c3-3 6 3 9 0s6 3 9 0M3 18c3-3 6 3 9 0s6 3 9 0"/>'),
    folha: svg('<path d="M5 19C5 10 11 5 20 4c-1 9-6 15-15 15z"/><path d="M5 19 13 11"/>'),
    pele: svg('<rect x="8" y="9" width="8" height="12" rx="1.5"/><path d="M10 9V6h4v3M11 3h2v3h-2z"/>'),
    make: svg('<path d="M9 21h6V11H9zM10 11V6l4-3v8"/>'),
    perfume: svg('<rect x="6" y="9" width="12" height="12" rx="2"/><path d="M10 9V6h4v3M12 3v3M9 14h6"/>'),
    corpo: svg('<path d="M12 21c-4 0-7-3-7-7 0-5 7-11 7-11s7 6 7 11c0 4-3 7-7 7z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>')
  };
  const CATEGORIAS = { corte: "Corte", progressiva: "Progressiva", cor: "Cor & mechas" };
  const MK = [
    { i: "pele", t: "Cuidados com a pele", d: "Limpeza, hidratação e tratamento" },
    { i: "make", t: "Maquiagem", d: "Base, batons, olhos e acabamento" },
    { i: "perfume", t: "Fragrâncias", d: "Perfumes femininos e masculinos" },
    { i: "corpo", t: "Corpo & banho", d: "Hidratantes e cuidados diários" }
  ];

  // ---------- Links ----------
  const whatsLink = (msg) => (C.whatsapp ? `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}` : null);
  function setLink(id, href) {
    const el = document.getElementById(id);
    if (!el) return;
    if (href) el.href = href;
    else { el.href = "#"; el.addEventListener("click", (e) => { e.preventDefault(); alert("Link em breve."); }); }
  }
  setLink("link-marykay", C.maryKay);
  setLink("rod-mk", C.maryKay);
  ["rod-insta", "link-insta-galeria", "info-insta"].forEach((id) => setLink(id, C.instagram));
  $("#link-insta-galeria").textContent = "Mais trabalhos no Instagram";
  $("#info-insta").textContent = C.instagramHandle;
  const oi = `Olá, ${C.nome.split(" ")[0]}! Vim pelo seu site.`;
  setLink("rod-whats", whatsLink(oi));
  setLink("whats-flutuante", whatsLink(oi));
  setLink("whats-marykay", whatsLink(`${oi} Gostaria de saber mais sobre os produtos Mary Kay.`));
  $("#info-horario").textContent = C.horario;
  $("#ano").textContent = new Date().getFullYear();

  // ---------- Topo / menu ----------
  const topo = $("#topo"), menu = $(".menu"), menuBtn = $(".menu-btn");
  const marcarTopo = () => topo.classList.toggle("rolou", scrollY > 20);
  marcarTopo(); window.addEventListener("scroll", marcarTopo, { passive: true });
  menuBtn.addEventListener("click", () => {
    const aberto = menu.classList.toggle("aberto");
    menuBtn.setAttribute("aria-expanded", aberto);
    topo.classList.toggle("menu-aberto", aberto);
  });
  $$(".menu a").forEach((a) => a.addEventListener("click", () => {
    menu.classList.remove("aberto"); topo.classList.remove("menu-aberto"); menuBtn.setAttribute("aria-expanded", false);
  }));

  // ---------- Serviços ----------
  $("#lista-servicos").innerHTML = C.servicos.map((s) => `
    <article class="servico revelar">
      ${ICONES[s.icone] || ICONES.brilho}
      <h3>${s.nome}</h3>
      <p>${s.desc}</p>
      <a href="#agendar" data-servico="${s.id}">Agendar</a>
    </article>`).join("");
  $$("[data-servico]").forEach((a) => a.addEventListener("click", () => window.Agendamento && window.Agendamento.escolherServico(a.dataset.servico)));

  // ---------- Mary Kay ----------
  $("#mk-categorias").innerHTML = MK.map((m) => `<li>${ICONES[m.i]}<strong>${m.t}</strong><small>${m.d}</small></li>`).join("");

  // ---------- Portfólio + lightbox ----------
  const grade = $("#lista-galeria");
  let visiveis = C.galeria;
  function renderGaleria(cat) {
    visiveis = cat === "todos" ? C.galeria : C.galeria.filter((g) => g.cat === cat);
    grade.innerHTML = visiveis.map((g, i) => `
      <figure data-i="${i}">
        <div class="quadro"><img src="${g.src}" alt="${g.titulo}" loading="lazy"></div>
        <figcaption><b>${g.titulo}</b>${CATEGORIAS[g.cat] || ""}</figcaption>
      </figure>`).join("");
  }
  renderGaleria("todos");
  $$(".filtro").forEach((b) => b.addEventListener("click", () => {
    $$(".filtro").forEach((x) => x.classList.toggle("ativo", x === b));
    renderGaleria(b.dataset.cat);
  }));

  const lb = $("#lightbox"), lbImg = $("img", lb), lbCap = $("figcaption", lb);
  let atual = 0;
  function abrir(i) {
    atual = (i + visiveis.length) % visiveis.length;
    lbImg.src = visiveis[atual].src; lbImg.alt = visiveis[atual].titulo; lbCap.textContent = visiveis[atual].titulo;
    lb.hidden = false; document.body.style.overflow = "hidden";
  }
  function fechar() { lb.hidden = true; document.body.style.overflow = ""; }
  grade.addEventListener("click", (e) => { const f = e.target.closest("figure"); if (f) abrir(+f.dataset.i); });
  $(".lb-fechar").addEventListener("click", fechar);
  $(".lb-ant").addEventListener("click", () => abrir(atual - 1));
  $(".lb-prox").addEventListener("click", () => abrir(atual + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) fechar(); });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") fechar();
    if (e.key === "ArrowLeft") abrir(atual - 1);
    if (e.key === "ArrowRight") abrir(atual + 1);
  });

  // ---------- Animação de entrada ----------
  const io = "IntersectionObserver" in window && new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("visivel"); io.unobserve(en.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".revelar").forEach((el) => (io ? io.observe(el) : el.classList.add("visivel")));

})();
