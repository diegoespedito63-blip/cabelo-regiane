// =====================================================================
//  Agendamento online — fluxo em etapas (serviço → data → horário → dados)
// =====================================================================
(function () {
  const C = window.SITE_CONFIG, A = window.AgendaCore, api = window.API;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const STATUS = { pendente: "Aguardando confirmação", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Não compareceu" };

  const st = { disp: null, servico: null, data: null, hora: null, mes: null, etapa: 1, pendenteServico: null, resultado: null };

  // ---------------- Carregamento ----------------
  async function carregar() {
    $("#ag-carregando").hidden = false; $("#ag-falha").hidden = true;
    $$(".etapa").forEach((e) => (e.hidden = true));
    try {
      st.disp = await api.disponibilidade();
      $("#ag-carregando").hidden = true;
      renderServicos();
      if (st.pendenteServico) { escolherServico(st.pendenteServico); st.pendenteServico = null; }
      else irPara(st.servico ? st.etapa : 1);
    } catch (e) {
      console.error(e);
      $("#ag-carregando").hidden = true; $("#ag-falha").hidden = false;
    }
  }
  async function recarregarDisp() { try { st.disp = await api.disponibilidade(); } catch {} }
  $("#ag-tentar").addEventListener("click", carregar);

  // ---------------- Navegação entre etapas ----------------
  function irPara(n) {
    st.etapa = n;
    $$(".etapa").forEach((e) => (e.hidden = +e.dataset.etapa !== n));
    $$("#ag-etapas li").forEach((li) => {
      const e = +li.dataset.e;
      li.classList.toggle("atual", e === n);
      li.classList.toggle("feito", e < n || n === 5);
    });
    $("#ag-voltar").hidden = n === 1 || n === 5;
    if (n === 2) renderCalendario();
    if (n === 3) renderSlots();
    if (n === 4) setTimeout(() => $("#ag-form").nome.focus(), 50);
    renderResumo();
  }
  $("#ag-voltar").addEventListener("click", () => irPara(Math.max(1, st.etapa - 1)));
  $$("#ag-etapas li").forEach((li) => li.addEventListener("click", () => {
    const e = +li.dataset.e;
    if (st.etapa === 5 || e >= st.etapa) return;
    irPara(e);
  }));

  function renderResumo() {
    const s = st.servico;
    $("#rs-servico").textContent = s ? s.nome : "—";
    $("#rs-duracao").textContent = s ? A.duracaoTexto(s.duracao_min) : "—";
    const mostraPreco = st.disp?.ajustes?.mostrar_precos && s && s.preco > 0;
    $("#rs-preco-l").hidden = !mostraPreco;
    if (mostraPreco) $("#rs-preco").textContent = brl(s.preco);
    $("#rs-data").textContent = st.data ? A.dataLonga(st.data) : "—";
    $("#rs-hora").textContent = st.hora ? `${st.hora} às ${A.hhmm(A.min(st.hora) + s.duracao_min)}` : "—";
  }

  // ---------------- 1. Serviço ----------------
  function renderServicos() {
    const precos = st.disp.ajustes.mostrar_precos;
    $("#ag-servicos").innerHTML = st.disp.servicos.map((s) => `
      <button type="button" class="op-servico${st.servico?.id === s.id ? " sel" : ""}" data-id="${esc(s.id)}">
        <strong>${esc(s.nome)}</strong>
        <span>${A.duracaoTexto(s.duracao_min)}${precos && s.preco > 0 ? ` · a partir de ${brl(s.preco)}` : ""}</span>
      </button>`).join("") || `<p class="vazio-ag">Nenhum serviço disponível para agendamento online no momento.</p>`;
  }
  $("#ag-servicos").addEventListener("click", (e) => {
    const b = e.target.closest(".op-servico"); if (b) escolherServico(b.dataset.id, false);
  });
  function escolherServico(id, rolar = true) {
    if (!st.disp) { st.pendenteServico = id; return; }
    const s = st.disp.servicos.find((x) => x.id === id); if (!s) return irPara(1);
    if (st.servico?.id !== s.id) { st.hora = null; }
    st.servico = s; renderServicos();
    if (st.data && !A.slots(st.disp, st.data, s.duracao_min).length) st.data = null;
    irPara(2);
    if (rolar) $("#agendar").scrollIntoView({ behavior: "smooth" });
  }

  // ---------------- 2. Calendário ----------------
  function limites() {
    const hoje = st.disp.hoje.slice(0, 10);
    return { hoje, ultimo: A.addDias(hoje, st.disp.ajustes.janela_dias) };
  }
  function renderCalendario() {
    const { hoje, ultimo } = limites();
    if (!st.mes) st.mes = (st.data || primeiroDiaLivre() || hoje).slice(0, 7);
    const [ano, mes] = st.mes.split("-").map(Number);
    $("#cal-mes").textContent = `${MESES[mes - 1]} ${ano}`;
    $("#cal-ant").disabled = st.mes <= hoje.slice(0, 7);
    $("#cal-prox").disabled = st.mes >= ultimo.slice(0, 7);
    const primeiro = `${st.mes}-01`, offset = A.diaSemana(primeiro);
    const nDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    let html = "<span></span>".repeat(offset);
    for (let d = 1; d <= nDias; d++) {
      const iso = `${st.mes}-${String(d).padStart(2, "0")}`;
      const fora = iso < hoje || iso > ultimo;
      const livres = fora ? 0 : A.slots(st.disp, iso, st.servico.duracao_min).length;
      const cls = ["dia", livres ? "livre" : "off", iso === hoje ? "hoje" : "", iso === st.data ? "sel" : ""].join(" ");
      html += `<button type="button" class="${cls}" data-d="${iso}" ${livres ? "" : "disabled"} aria-label="${A.dataLonga(iso)}${livres ? `, ${livres} horários` : ", indisponível"}">${d}</button>`;
    }
    $("#cal-dias").innerHTML = html;
  }
  function primeiroDiaLivre() {
    const { hoje } = limites();
    for (let i = 0; i <= st.disp.ajustes.janela_dias; i++) {
      const d = A.addDias(hoje, i);
      if (A.slots(st.disp, d, st.servico.duracao_min).length) return d;
    }
    return null;
  }
  function mudarMes(n) {
    const [a, m] = st.mes.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    st.mes = d.toISOString().slice(0, 7); renderCalendario();
  }
  $("#cal-ant").addEventListener("click", () => mudarMes(-1));
  $("#cal-prox").addEventListener("click", () => mudarMes(1));
  $("#cal-dias").addEventListener("click", (e) => {
    const b = e.target.closest(".dia.livre"); if (!b) return;
    st.data = b.dataset.d; st.hora = null; irPara(3);
  });

  // ---------------- 3. Horários ----------------
  function renderSlots(aviso) {
    $("#ag-dia-tit").textContent = A.dataLonga(st.data);
    const lista = A.slots(st.disp, st.data, st.servico.duracao_min);
    const grupos = [["Manhã", (h) => A.min(h) < 720], ["Tarde", (h) => A.min(h) >= 720 && A.min(h) < 1080], ["Noite", (h) => A.min(h) >= 1080]];
    $("#ag-slots").innerHTML = (aviso ? `<p class="form-erro">${esc(aviso)}</p>` : "") + (lista.length ? grupos.map(([nome, f]) => {
      const hs = lista.filter(f); if (!hs.length) return "";
      return `<div class="slot-grupo"><h4>${nome}</h4><div class="slots">${hs.map((h) =>
        `<button type="button" class="slot${h === st.hora ? " sel" : ""}" data-h="${h}">${h}</button>`).join("")}</div></div>`;
    }).join("") : `<p class="vazio-ag">Os horários deste dia acabaram de ser preenchidos. <button type="button" class="lnk" data-voltar>Escolher outro dia</button></p>`);
  }
  $("#ag-slots").addEventListener("click", (e) => {
    if (e.target.closest("[data-voltar]")) return irPara(2);
    const b = e.target.closest(".slot"); if (!b) return;
    st.hora = b.dataset.h; irPara(4);
  });

  // ---------------- 4. Dados ----------------
  const form = $("#ag-form"), erro = $("#ag-erro");
  function mascara(input) {
    input.addEventListener("input", () => {
      const d = input.value.replace(/\D/g, "").slice(0, 11);
      input.value = d.length > 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
        : d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
        : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
    });
  }
  mascara(form.telefone);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.textContent = "";
    const nome = form.nome.value.trim(), telefone = form.telefone.value, obs = form.obs.value.trim();
    if (nome.length < 2) return falha("Informe seu nome completo.", form.nome);
    if (!A.telValido(telefone)) return falha("Informe um WhatsApp válido com DDD.", form.telefone);
    if (!form.aceite.checked) return falha("Para continuar, marque a autorização de contato.", form.aceite);
    const btn = $("#ag-enviar"); btn.disabled = true; btn.textContent = "Reservando…";
    try {
      st.resultado = await api.agendar({ servico_id: st.servico.id, data: st.data, hora: st.hora, nome, telefone, obs });
      sucesso();
      recarregarDisp();
    } catch (err) {
      const msg = err.message || "Não foi possível concluir o agendamento.";
      if (/reservado|disponível|antecedência/i.test(msg)) {
        await recarregarDisp(); st.hora = null; irPara(3); renderSlots(msg);
      } else falha(msg);
    } finally { btn.disabled = false; btn.textContent = "Confirmar agendamento"; }
  });
  function falha(msg, campo) { erro.textContent = msg; campo?.focus(); }

  // ---------------- 5. Sucesso ----------------
  function sucesso() {
    const r = st.resultado, conf = r.status === "confirmado";
    const primeiroNome = r.nome.split(" ")[0];
    $("#ok-titulo").textContent = conf ? `Horário confirmado, ${primeiroNome}!` : `Solicitação recebida, ${primeiroNome}!`;
    $("#ok-texto").innerHTML = `<strong>${esc(r.servico_nome)}</strong> · ${esc(A.dataLonga(r.data))}, às ${esc(r.hora)}.<br>` +
      (conf ? "Te espero no horário marcado." : "Vou confirmar seu horário pelo WhatsApp em breve.");
    $("#ok-codigo").textContent = r.codigo;
    $("#ok-google").href = linkGoogle(r);
    const wa = C.whatsapp && `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(
      `Olá, ${C.nome.split(" ")[0]}! Acabei de agendar pelo site.\n\nCódigo: ${r.codigo}\nServiço: ${r.servico_nome}\nData: ${A.dataLonga(r.data)}\nHorário: ${r.hora}\nNome: ${r.nome}`)}`;
    $("#ok-whats").hidden = !wa; if (wa) $("#ok-whats").href = wa;
    form.reset();
    irPara(5);
    $("#agendar").scrollIntoView({ behavior: "smooth" });
  }
  const fmtCal = (data, hora) => data.replace(/-/g, "") + "T" + hora.replace(":", "") + "00";
  function linkGoogle(r) {
    const fim = A.hhmm(A.min(r.hora) + r.duracao_min);
    const p = new URLSearchParams({
      action: "TEMPLATE", text: `${r.servico_nome} · ${C.nome}`,
      dates: `${fmtCal(r.data, r.hora)}/${fmtCal(r.data, fim)}`, ctz: A.TZ,
      details: `Código do agendamento: ${r.codigo}`
    });
    return `https://calendar.google.com/calendar/render?${p}`;
  }
  $("#ok-ics").addEventListener("click", () => {
    const r = st.resultado, fim = A.hhmm(A.min(r.hora) + r.duracao_min);
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Regiane Paulino//Agenda//PT-BR", "BEGIN:VEVENT",
      `UID:${r.codigo}@regianepaulino`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;TZID=${A.TZ}:${fmtCal(r.data, r.hora)}`, `DTEND;TZID=${A.TZ}:${fmtCal(r.data, fim)}`,
      `SUMMARY:${r.servico_nome} · ${C.nome}`, `DESCRIPTION:Código do agendamento: ${r.codigo}`,
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Lembrete do seu horário", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `agendamento-${r.codigo}.ics`; a.click(); URL.revokeObjectURL(a.href);
  });
  $("#ok-novo").addEventListener("click", () => {
    st.servico = null; st.data = null; st.hora = null; st.mes = null; st.resultado = null;
    renderServicos(); irPara(1);
  });

  // ---------------- Consultar / cancelar ----------------
  const dlg = $("#consulta"), cForm = $("#consulta-form"), cErro = $("#consulta-erro"), cRes = $("#consulta-resultado");
  mascara(cForm.telefone);
  $("#abrir-consulta").addEventListener("click", () => { cErro.textContent = ""; cRes.innerHTML = ""; dlg.showModal(); cForm.codigo.focus(); });
  $(".consulta-fechar").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  cForm.addEventListener("submit", async (e) => {
    e.preventDefault(); cErro.textContent = ""; cRes.innerHTML = "";
    const codigo = cForm.codigo.value.trim(), tel = cForm.telefone.value;
    if (codigo.length < 6 || !A.telValido(tel)) { cErro.textContent = "Informe o código de 6 caracteres e o WhatsApp com DDD."; return; }
    const btn = $("#consulta-buscar"); btn.disabled = true;
    try {
      const r = await api.consultar(codigo, tel);
      if (!r) { cErro.textContent = "Agendamento não encontrado. Confira o código e o WhatsApp."; return; }
      mostrarConsulta(r, tel);
    } catch (err) { cErro.textContent = err.message; }
    finally { btn.disabled = false; }
  });
  function mostrarConsulta(r, tel) {
    const podeCancelar = ["pendente", "confirmado"].includes(r.status);
    cRes.innerHTML = `<div class="consulta-card">
        <span class="status-tag s-${r.status}">${STATUS[r.status] || r.status}</span>
        <strong>${esc(r.servico_nome)}</strong>
        <p>${esc(A.dataLonga(r.data))}, às ${esc(r.hora)} · ${A.duracaoTexto(r.duracao_min)}</p>
        ${podeCancelar ? `<button type="button" class="lnk perigo" id="consulta-cancelar">Cancelar este agendamento</button>` : ""}
      </div>`;
    const b = $("#consulta-cancelar");
    if (b) b.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja cancelar este agendamento?")) return;
      b.disabled = true;
      try { await api.cancelar(r.codigo, tel); r.status = "cancelado"; mostrarConsulta(r, tel); recarregarDisp(); }
      catch (err) { cErro.textContent = err.message; b.disabled = false; }
    });
  }

  window.Agendamento = { escolherServico };
  carregar();
})();
