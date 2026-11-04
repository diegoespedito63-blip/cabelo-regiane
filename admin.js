(function () {
  "use strict";
  const C = window.SITE_CONFIG, A = window.AgendaCore, api = window.API;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const hoje = () => A.agora().slice(0, 10);
  const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const STATUS = { pendente: "Aguardando", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado", faltou: "Faltou" };
  const IC = {
    whats: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'
  };

  let db = null;

  // ---------------- utilidades ----------------
  function toast(msg, erro) {
    const t = $("#toast"); t.textContent = msg; t.classList.toggle("erro", !!erro); t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), erro ? 4500 : 2200);
  }
  function whats(tel, msg) {
    const n = A.tel(tel); if (!n) return null;
    return `https://wa.me/55${n}?text=${encodeURIComponent(msg)}`;
  }
  const abrirWhats = (tel, msg) => { const l = whats(tel, msg); if (l) window.open(l, "_blank"); else toast("Cliente sem WhatsApp cadastrado.", true); };
  const porId = (t, id) => db[t].find((x) => x[api.pk(t)] === id);
  const nomeCliente = (id) => porId("clientes", id)?.nome || "Cliente";
  const ajustes = () => db.ajustes[0];
  const primeiro = (n) => String(n || "").split(" ")[0];
  const fimHora = (g) => A.hhmm(A.min(g.hora) + g.duracao_min);

  async function salvar(tabela, obj, msg) {
    try {
      const r = await api.salvar(tabela, obj);
      const k = api.pk(tabela), i = db[tabela].findIndex((x) => x[k] === r[k]);
      if (i >= 0) db[tabela][i] = r; else db[tabela].push(r);
      if (msg) toast(msg);
      return r;
    } catch (e) { toast(e.message, true); throw e; }
  }
  async function remover(tabela, chave) {
    try { await api.remover(tabela, chave); db[tabela] = db[tabela].filter((x) => x[api.pk(tabela)] !== chave); toast("Excluído"); }
    catch (e) { toast(e.message, true); throw e; }
  }

  // ---------------- inicialização / login ----------------
  async function iniciar() {
    $("#modo").textContent = api.modo === "supabase" ? "Online" : "Demonstração";
    $("#modo").classList.toggle("demo", api.modo !== "supabase");
    $("#aj-sair").hidden = api.modo !== "supabase";
    $("#aj-importar-l").hidden = api.modo === "supabase";
    $("#aj-apagar").hidden = api.modo === "supabase";
    $("#aj-dados-ajuda").textContent = api.modo === "supabase"
      ? `Conectado ao banco de dados online${api.email() ? ` como ${api.email()}` : ""}. Os dados ficam salvos com segurança e aparecem em qualquer aparelho.`
      : "Modo demonstração: os dados ficam só neste navegador. Configure o Supabase (README) para usar online.";
    if (!api.logado()) { $("#carregando").hidden = true; $("#login").hidden = false; return; }
    $("#carregando").hidden = false;
    try {
      db = await api.carregarTudo();
      $("#login").hidden = true;
      render();
    } catch (e) {
      if (/sess|jwt|token/i.test(e.message)) { api.sair(); $("#login").hidden = false; }
      toast(e.message, true);
    } finally { $("#carregando").hidden = true; }
  }
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; $("#login-erro").textContent = "";
    try { await api.entrar(f.email.value.trim(), f.senha.value); f.senha.value = ""; iniciar(); }
    catch (err) { $("#login-erro").textContent = err.message; }
  });
  $("#aj-sair").addEventListener("click", () => { api.sair(); location.reload(); });

  // Atualiza sozinho a cada 60 s (novas reservas do site)
  setInterval(async () => {
    if (!db || $("#modal").open || document.hidden) return;
    try {
      const novo = await api.carregarTudo();
      const antes = db.agendamentos.filter((g) => g.status === "pendente").length;
      db = novo; render();
      const depois = db.agendamentos.filter((g) => g.status === "pendente").length;
      if (depois > antes) toast("Nova solicitação de agendamento!");
    } catch {}
  }, 60000);

  // ---------------- navegação ----------------
  $$(".a-nav button").forEach((b) => b.addEventListener("click", () => {
    $$(".a-nav button").forEach((x) => x.classList.toggle("ativa", x === b));
    $$(".view").forEach((v) => v.classList.toggle("ativa", v.id === "v-" + b.dataset.view));
    render(); scrollTo(0, 0);
  }));
  $$("#v-mk .aba").forEach((b) => b.addEventListener("click", () => {
    $$("#v-mk .aba").forEach((x) => x.classList.toggle("ativa", x === b));
    $$("#v-mk .sub").forEach((s) => s.classList.toggle("ativa", s.id === "mk-" + b.dataset.sub));
  }));

  // ---------------- modal genérico ----------------
  const modal = $("#modal"), mForm = $("#modal-form");
  let mSalvar = null, mExcluir = null;
  function campoHTML(f, v) {
    const cls = f.meia ? ' class="meia"' : "";
    const req = f.req ? " required" : "";
    const val = v ?? f.padrao ?? "";
    if (f.tipo === "select")
      return `<label${cls}>${f.rotulo}<select name="${f.k}"${req}>${f.opcoes.map((o) => `<option value="${esc(o.v)}"${String(o.v) === String(val) ? " selected" : ""}>${esc(o.t)}</option>`).join("")}</select></label>`;
    if (f.tipo === "textarea") return `<label${cls}>${f.rotulo}<textarea name="${f.k}" rows="2">${esc(val)}</textarea></label>`;
    if (f.tipo === "check") return `<label class="check${f.meia ? " meia" : ""}"><input type="checkbox" name="${f.k}"${val ? " checked" : ""}> ${f.rotulo}</label>`;
    const extra = f.tipo === "number" ? ` step="${f.passo || "0.01"}" min="${f.min ?? 0}"` : "";
    return `<label${cls}>${f.rotulo}<input name="${f.k}" type="${f.tipo || "text"}" value="${esc(val)}"${req}${extra}${f.ph ? ` placeholder="${esc(f.ph)}"` : ""}></label>`;
  }
  function abrirModal({ titulo, campos, valores = {}, onSalvar, onExcluir, aoMudar, extra = "", textoSalvar = "Salvar" }) {
    $("#modal-titulo").textContent = titulo;
    $("#modal-aviso").hidden = true;
    $("#modal-campos").innerHTML = campos.map((f) => campoHTML(f, valores[f.k])).join("");
    $("#modal-extra").innerHTML = extra;
    $("#modal-salvar").textContent = textoSalvar;
    mSalvar = async () => {
      const d = {};
      campos.forEach((f) => {
        const el = mForm.elements[f.k];
        d[f.k] = f.tipo === "check" ? el.checked : f.tipo === "number" ? (el.value === "" ? 0 : parseFloat(el.value)) : el.value.trim();
      });
      return onSalvar(d);
    };
    mExcluir = onExcluir || null;
    $("#modal-excluir").hidden = !onExcluir;
    if (aoMudar) aoMudar(mForm);
    modal.showModal();
  }
  const avisoModal = (msg) => { const a = $("#modal-aviso"); a.innerHTML = msg; a.hidden = false; a.scrollIntoView({ block: "nearest" }); };
  mForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!mForm.reportValidity()) return;
    const b = $("#modal-salvar"); b.disabled = true;
    try { if ((await mSalvar()) !== false) { modal.close(); render(); } }
    catch {} finally { b.disabled = false; }
  });
  $("#modal-cancelar").addEventListener("click", () => modal.close());
  $("#modal-excluir").addEventListener("click", async () => {
    if (!mExcluir || !confirm("Excluir este registro?")) return;
    try { await mExcluir(); modal.close(); render(); } catch {}
  });

  const opcClientes = () => [{ v: "", t: "Selecione…" }, { v: "__novo", t: "+ Nova cliente" },
    ...[...db.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => ({ v: c.id, t: c.nome + (c.telefone ? ` · ${A.telFormatado(c.telefone)}` : "") }))];
  const opcServicos = () => [...db.servicos].sort((a, b) => a.ordem - b.ordem)
    .map((s) => ({ v: s.id, t: `${s.nome} · ${A.duracaoTexto(s.duracao_min)} · ${brl(s.preco)}${s.ativo ? "" : " (inativo)"}` }));
  const camposNovaCliente = [
    { k: "novoNome", rotulo: "Nome da nova cliente", meia: true },
    { k: "novoTel", rotulo: "WhatsApp", tipo: "tel", meia: true, ph: "(11) 99999-9999" }
  ];
  function toggleNovaCliente(form) {
    const sel = form.elements.cliente_id;
    const atualiza = () => ["novoNome", "novoTel"].forEach((k) => { form.elements[k].closest("label").style.display = sel.value === "__novo" ? "" : "none"; });
    sel.addEventListener("change", atualiza); atualiza();
  }
  async function resolverCliente(d) {
    if (d.cliente_id !== "__novo") return porId("clientes", d.cliente_id);
    if (!d.novoNome) { avisoModal("Digite o nome da nova cliente."); return null; }
    const tel = A.tel(d.novoTel);
    const existe = tel && db.clientes.find((c) => c.telefone === tel);
    if (existe) return existe;
    return salvar("clientes", { id: A.uuid(), nome: d.novoNome, telefone: tel || null });
  }

  // ---------------- formulários ----------------
  const forms = {
    agendamento(item, padrao = {}) {
      const novo = !item;
      const s0 = db.servicos.find((s) => s.ativo) || db.servicos[0];
      let confirmouConflito = false;
      abrirModal({
        titulo: novo ? "Novo agendamento" : `Agendamento · ${item.codigo || ""}`,
        valores: item || { data: diaAtual, servico_id: s0?.id, duracao_min: s0?.duracao_min, valor: s0?.preco, status: "confirmado", cliente_id: "", ...padrao },
        campos: [
          { k: "cliente_id", rotulo: "Cliente", tipo: "select", opcoes: opcClientes(), req: true },
          ...camposNovaCliente,
          { k: "servico_id", rotulo: "Serviço", tipo: "select", opcoes: opcServicos() },
          { k: "data", rotulo: "Data", tipo: "date", meia: true, req: true },
          { k: "hora", rotulo: "Início", tipo: "time", meia: true, req: true },
          { k: "duracao_min", rotulo: "Duração (min)", tipo: "number", passo: "5", min: 5, meia: true },
          { k: "valor", rotulo: "Valor (R$)", tipo: "number", meia: true },
          { k: "status", rotulo: "Status", tipo: "select", opcoes: Object.entries(STATUS).map(([v, t]) => ({ v, t })) },
          { k: "obs", rotulo: "Observações", tipo: "textarea" }
        ],
        extra: item ? `<p class="ajuda meta">${item.origem === "site" ? "Agendado pelo site" : "Agendado pelo painel"}${item.telefone ? ` · ${A.telFormatado(item.telefone)}` : ""}</p>` : "",
        aoMudar(form) {
          toggleNovaCliente(form);
          form.elements.servico_id.addEventListener("change", (e) => {
            const s = porId("servicos", e.target.value);
            if (s) { form.elements.valor.value = s.preco; form.elements.duracao_min.value = s.duracao_min; }
          });
          ["data", "hora", "duracao_min"].forEach((k) => form.elements[k].addEventListener("input", () => { confirmouConflito = false; }));
        },
        async onSalvar(d) {
          const cli = await resolverCliente(d); if (!cli) return false;
          const s = porId("servicos", d.servico_id);
          const dur = Math.max(5, Math.round(d.duracao_min || s?.duracao_min || 60));
          // conflito com outro horário?
          if (["pendente", "confirmado"].includes(d.status) && !confirmouConflito) {
            const c = A.conflito(db.agendamentos, d.data, A.min(d.hora), dur, item?.id);
            const motivo = A.motivoIndisponivel(dispPainel(), d.data, A.min(d.hora), dur, { painel: true, ignorar: item?.id });
            if (c || motivo) {
              confirmouConflito = true;
              avisoModal(c ? `<b>Atenção:</b> conflita com ${esc(c.nome)} (${c.hora}–${fimHora(c)}). Toque em Salvar de novo para manter assim mesmo.`
                : `<b>Atenção:</b> ${esc(motivo)} Toque em Salvar de novo para manter assim mesmo.`);
              return false;
            }
          }
          const reg = {
            ...(item || { id: A.uuid(), origem: "painel" }),
            cliente_id: cli.id, nome: cli.nome, telefone: cli.telefone || null,
            servico_id: s?.id || null, servico_nome: s?.nome || item?.servico_nome || "Serviço",
            data: d.data, hora: d.hora, duracao_min: dur, valor: d.valor, status: d.status, obs: d.obs || null
          };
          delete reg.criado_em;
          await salvar("agendamentos", reg, "Agendamento salvo");
          diaAtual = d.data;
        },
        onExcluir: novo ? null : () => remover("agendamentos", item.id)
      });
    },
    cliente(item) {
      const novo = !item;
      let extra = "";
      if (item) {
        const hist = db.agendamentos.filter((g) => g.cliente_id === item.id).sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora)).slice(0, 8);
        extra = `<h4 class="hist-tit">Histórico</h4>` + (hist.length ? `<ul class="hist">${hist.map((g) =>
          `<li><span>${A.dataCurta(g.data)} · ${g.hora}</span>${esc(g.servico_nome)}<em class="st st-${g.status}">${STATUS[g.status]}</em></li>`).join("")}</ul>`
          : `<p class="ajuda">Nenhum atendimento ainda.</p>`);
      }
      abrirModal({
        titulo: novo ? "Nova cliente" : item.nome,
        valores: item ? { ...item, telefone: A.telFormatado(item.telefone) } : {},
        campos: [
          { k: "nome", rotulo: "Nome", req: true },
          { k: "telefone", rotulo: "WhatsApp", tipo: "tel", ph: "(11) 99999-9999" },
          { k: "nascimento", rotulo: "Aniversário", tipo: "date", meia: true },
          { k: "pele", rotulo: "Tipo de pele (Mary Kay)", meia: true, ph: "Mista, oleosa…" },
          { k: "obs", rotulo: "Anotações (química, fórmula da cor, preferências…)", tipo: "textarea" }
        ],
        extra,
        async onSalvar(d) {
          const tel = A.tel(d.telefone) || null;
          if (tel && db.clientes.some((c) => c.telefone === tel && c.id !== item?.id)) { avisoModal("Já existe uma cliente com esse WhatsApp."); return false; }
          const reg = { ...(item || { id: A.uuid() }), nome: d.nome, telefone: tel, nascimento: d.nascimento || null, pele: d.pele || null, obs: d.obs || null };
          delete reg.criado_em;
          await salvar("clientes", reg, "Cliente salva");
        },
        onExcluir: novo ? null : () => remover("clientes", item.id)
      });
    },
    produto(item) {
      const novo = !item;
      abrirModal({
        titulo: novo ? "Novo produto" : "Editar produto",
        valores: item || { estoque: 0, minimo: 1 },
        campos: [
          { k: "nome", rotulo: "Produto", req: true, ph: "Ex.: Base TimeWise 3D" },
          { k: "custo", rotulo: "Custo (R$)", tipo: "number", meia: true },
          { k: "preco", rotulo: "Preço de venda (R$)", tipo: "number", meia: true },
          { k: "estoque", rotulo: "Estoque", tipo: "number", passo: "1", min: -999, meia: true },
          { k: "minimo", rotulo: "Avisar abaixo de", tipo: "number", passo: "1", meia: true }
        ],
        async onSalvar(d) {
          await salvar("produtos", { ...(item || { id: A.uuid() }), ...d, estoque: Math.round(d.estoque), minimo: Math.round(d.minimo) }, "Produto salvo");
        },
        onExcluir: novo ? null : () => remover("produtos", item.id)
      });
    },
    venda(item) {
      const novo = !item;
      if (!db.produtos.length) { toast("Cadastre um produto em Estoque primeiro.", true); return; }
      const p0 = db.produtos[0];
      abrirModal({
        titulo: novo ? "Nova venda Mary Kay" : "Editar venda",
        valores: item || { data: hoje(), qtd: 1, produto_id: p0.id, valor: p0.preco, pago: true, cliente_id: "" },
        campos: [
          { k: "cliente_id", rotulo: "Cliente", tipo: "select", opcoes: opcClientes(), req: true },
          ...camposNovaCliente,
          { k: "produto_id", rotulo: "Produto", tipo: "select", opcoes: db.produtos.map((p) => ({ v: p.id, t: `${p.nome} · ${brl(p.preco)} (${p.estoque} em estoque)` })) },
          { k: "qtd", rotulo: "Quantidade", tipo: "number", passo: "1", min: 1, meia: true },
          { k: "valor", rotulo: "Total (R$)", tipo: "number", meia: true },
          { k: "data", rotulo: "Data", tipo: "date", meia: true, req: true },
          { k: "pago", rotulo: "Já foi pago", tipo: "check", meia: true }
        ],
        aoMudar(form) {
          toggleNovaCliente(form);
          const recalc = () => { const p = porId("produtos", form.elements.produto_id.value); form.elements.valor.value = ((p?.preco || 0) * (parseFloat(form.elements.qtd.value) || 0)).toFixed(2); };
          form.elements.produto_id.addEventListener("change", recalc);
          form.elements.qtd.addEventListener("input", recalc);
        },
        async onSalvar(d) {
          const cli = await resolverCliente(d); if (!cli) return false;
          const qtd = Math.max(1, Math.round(d.qtd));
          // devolve estoque da versão anterior e baixa a nova
          if (!novo) { const ant = porId("produtos", item.produto_id); if (ant) await salvar("produtos", { ...ant, estoque: ant.estoque + item.qtd }); }
          const p = porId("produtos", d.produto_id);
          if (p) await salvar("produtos", { ...p, estoque: p.estoque - qtd });
          await salvar("vendas", { ...(item || { id: A.uuid() }), cliente_id: cli.id, produto_id: d.produto_id, qtd, valor: d.valor, data: d.data, pago: d.pago });
          toast(p && p.estoque - qtd < 0 ? "Venda salva — estoque ficou negativo!" : "Venda salva");
        },
        onExcluir: novo ? null : async () => {
          const p = porId("produtos", item.produto_id); if (p) await salvar("produtos", { ...p, estoque: p.estoque + item.qtd });
          await remover("vendas", item.id);
        }
      });
    },
    servico(item) {
      const novo = !item;
      abrirModal({
        titulo: novo ? "Novo serviço" : "Editar serviço",
        valores: item || { duracao_min: 60, ativo: true, ordem: db.servicos.length + 1 },
        campos: [
          { k: "nome", rotulo: "Serviço", req: true },
          { k: "duracao_min", rotulo: "Duração (min)", tipo: "number", passo: "5", min: 10, meia: true },
          { k: "preco", rotulo: "Preço (R$)", tipo: "number", meia: true },
          { k: "ordem", rotulo: "Ordem no site", tipo: "number", passo: "1", meia: true },
          { k: "ativo", rotulo: "Disponível no site", tipo: "check", meia: true },
          { k: "descricao", rotulo: "Descrição (opcional)", tipo: "textarea" }
        ],
        async onSalvar(d) {
          const id = item?.id || d.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 5);
          await salvar("servicos", { ...(item || {}), id, ...d, duracao_min: Math.round(d.duracao_min), ordem: Math.round(d.ordem), descricao: d.descricao || null }, "Serviço salvo");
        },
        onExcluir: novo ? null : () => remover("servicos", item.id)
      });
    },
    horario(h) {
      abrirModal({
        titulo: DIAS[h.dia_semana],
        valores: h,
        campos: [
          { k: "ativo", rotulo: "Atendo neste dia", tipo: "check" },
          { k: "inicio", rotulo: "Abre às", tipo: "time", meia: true, req: true },
          { k: "fim", rotulo: "Fecha às", tipo: "time", meia: true, req: true },
          { k: "pausa_inicio", rotulo: "Pausa (início)", tipo: "time", meia: true },
          { k: "pausa_fim", rotulo: "Pausa (fim)", tipo: "time", meia: true }
        ],
        async onSalvar(d) {
          if (A.min(d.fim) <= A.min(d.inicio)) { avisoModal("O horário de fechamento precisa ser depois da abertura."); return false; }
          if (!!d.pausa_inicio !== !!d.pausa_fim || (d.pausa_inicio && A.min(d.pausa_fim) <= A.min(d.pausa_inicio))) { avisoModal("Preencha início e fim da pausa (ou deixe os dois vazios)."); return false; }
          await salvar("horarios", { dia_semana: h.dia_semana, ativo: d.ativo, inicio: d.inicio, fim: d.fim, pausa_inicio: d.pausa_inicio || null, pausa_fim: d.pausa_fim || null }, "Horário atualizado");
        }
      });
    },
    bloqueio(item) {
      const novo = !item;
      abrirModal({
        titulo: novo ? "Bloquear período" : "Editar bloqueio",
        valores: item ? { ...item, diaInteiro: !item.hora_inicio } : { data_inicio: diaAtual, data_fim: diaAtual, diaInteiro: true },
        campos: [
          { k: "data_inicio", rotulo: "De", tipo: "date", meia: true, req: true },
          { k: "data_fim", rotulo: "Até", tipo: "date", meia: true, req: true },
          { k: "diaInteiro", rotulo: "Dia inteiro", tipo: "check" },
          { k: "hora_inicio", rotulo: "Das", tipo: "time", meia: true },
          { k: "hora_fim", rotulo: "Às", tipo: "time", meia: true },
          { k: "motivo", rotulo: "Motivo (só você vê)", ph: "Ex.: férias, feriado, curso" }
        ],
        aoMudar(form) {
          const t = () => ["hora_inicio", "hora_fim"].forEach((k) => { form.elements[k].closest("label").style.display = form.elements.diaInteiro.checked ? "none" : ""; });
          form.elements.diaInteiro.addEventListener("change", t); t();
        },
        async onSalvar(d) {
          if (d.data_fim < d.data_inicio) { avisoModal("A data final precisa ser igual ou depois da inicial."); return false; }
          if (!d.diaInteiro && (!d.hora_inicio || !d.hora_fim || A.min(d.hora_fim) <= A.min(d.hora_inicio))) { avisoModal("Informe o horário de início e fim do bloqueio."); return false; }
          const afetados = db.agendamentos.filter((g) => ["pendente", "confirmado"].includes(g.status) && g.data >= d.data_inicio && g.data <= d.data_fim &&
            (d.diaInteiro || (A.min(g.hora) < A.min(d.hora_fim) && A.min(g.hora) + g.duracao_min > A.min(d.hora_inicio))));
          await salvar("bloqueios", {
            ...(item || { id: A.uuid() }), data_inicio: d.data_inicio, data_fim: d.data_fim,
            hora_inicio: d.diaInteiro ? null : d.hora_inicio, hora_fim: d.diaInteiro ? null : d.hora_fim, motivo: d.motivo || null
          }, "Período bloqueado");
          if (afetados.length) toast(`Atenção: ${afetados.length} agendamento(s) já marcados nesse período.`, true);
        },
        onExcluir: novo ? null : () => remover("bloqueios", item.id)
      });
    },
    regras() {
      abrirModal({
        titulo: "Regras do agendamento online",
        valores: ajustes(),
        campos: [
          { k: "intervalo_min", rotulo: "Horários a cada (min)", tipo: "number", passo: "5", min: 5, meia: true },
          { k: "antecedencia_horas", rotulo: "Antecedência mínima (h)", tipo: "number", passo: "1", meia: true },
          { k: "janela_dias", rotulo: "Agenda aberta por (dias)", tipo: "number", passo: "1", min: 1, meia: true },
          { k: "cancelamento_horas", rotulo: "Cancelar online até (h antes)", tipo: "number", passo: "1", meia: true },
          { k: "confirmacao_automatica", rotulo: "Confirmar reservas automaticamente (sem eu aprovar)", tipo: "check" },
          { k: "mostrar_precos", rotulo: "Mostrar preços no site", tipo: "check" }
        ],
        async onSalvar(d) {
          await salvar("ajustes", { id: 1, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "number" ? Math.round(v) : v])) }, "Regras atualizadas");
        }
      });
    }
  };
  $$("[data-novo]").forEach((b) => b.addEventListener("click", () => forms[b.dataset.novo]()));

  // ---------------- agenda ----------------
  let diaAtual = hoje();
  const dispPainel = () => ({ hoje: A.agora(), horarios: db.horarios, ajustes: ajustes(), bloqueios: db.bloqueios, ocupados: db.agendamentos });
  $$("[data-dia]").forEach((b) => b.addEventListener("click", () => { diaAtual = A.addDias(diaAtual, +b.dataset.dia); render(); }));
  $("#ag-hoje").addEventListener("click", () => { diaAtual = hoje(); render(); });

  function renderAgenda() {
    // pendentes
    const pend = db.agendamentos.filter((g) => g.status === "pendente" && g.data >= hoje()).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    $("#badge-pend").hidden = !pend.length; $("#badge-pend").textContent = pend.length;
    $("#ag-pendentes").innerHTML = pend.length ? `<div class="pendentes">
      <h3>Aguardando sua confirmação <b>${pend.length}</b></h3>
      ${pend.map((g) => `<div class="item pend" data-id="${g.id}">
        <div class="corpo"><div class="t1">${esc(g.nome)}</div>
        <div class="t2">${esc(g.servico_nome)} · ${A.dataCurta(g.data)} · ${g.hora}–${fimHora(g)}</div></div>
        <button class="mini rec" data-acao="recusar" title="Recusar">${IC.x}</button>
        <button class="mini conf" data-acao="confirmar" title="Confirmar">${IC.ok}</button>
      </div>`).join("")}</div>` : "";

    // título e semana
    const d = new Date(diaAtual + "T12:00:00Z");
    const tit = d.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long" });
    $("#ag-titulo").textContent = diaAtual === hoje() ? "Hoje, " + tit.split(", ")[1] : tit;
    const ini = A.addDias(diaAtual, -A.diaSemana(diaAtual));
    $("#ag-semana").innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const dia = A.addDias(ini, i);
      const n = db.agendamentos.filter((g) => g.data === dia && g.status !== "cancelado").length;
      const h = db.horarios.find((x) => x.dia_semana === i);
      return `<button class="sd${dia === diaAtual ? " sel" : ""}${dia === hoje() ? " hoje" : ""}${h?.ativo ? "" : " fechado"}" data-d="${dia}">
        <small>${DIAS[i].slice(0, 3)}</small><b>${+dia.slice(8)}</b><i>${n ? "•".repeat(Math.min(n, 4)) : ""}</i></button>`;
    }).join("");

    // lista do dia
    const doDia = db.agendamentos.filter((g) => g.data === diaAtual).sort((a, b) => a.hora.localeCompare(b.hora));
    const ativos = doDia.filter((g) => !["cancelado", "faltou"].includes(g.status));
    const h = db.horarios.find((x) => x.dia_semana === A.diaSemana(diaAtual));
    const bloq = db.bloqueios.filter((b) => diaAtual >= b.data_inicio && diaAtual <= b.data_fim);
    const livres = A.slots(dispPainel(), diaAtual, 60, { painel: true }).length;
    $("#ag-resumo").innerHTML = `<span class="pill"><b>${ativos.length}</b> atendimento(s)</span>
      <span class="pill">Previsto <b>${brl(ativos.reduce((s, g) => s + g.valor, 0))}</b></span>
      <span class="pill">${h?.ativo ? `${h.inicio}–${h.fim}` : "Fechado"}</span>
      ${h?.ativo ? `<span class="pill">${livres} horário(s) livres de 1h</span>` : ""}
      ${bloq.map((b) => `<span class="pill bloq">Bloqueado ${b.hora_inicio ? `${b.hora_inicio}–${b.hora_fim}` : "o dia todo"}${b.motivo ? ` · ${esc(b.motivo)}` : ""}</span>`).join("")}`;
    $("#ag-lista").innerHTML = doDia.length ? doDia.map((g) => `
      <div class="item ${g.status}" data-id="${g.id}">
        <div class="hora">${g.hora}<small>${fimHora(g)}</small></div>
        <div class="corpo"><div class="t1">${esc(g.nome)}${g.origem === "site" ? ' <span class="tag-site">site</span>' : ""}</div>
          <div class="t2">${esc(g.servico_nome)} · ${brl(g.valor)} <span class="st st-${g.status}">${STATUS[g.status]}</span></div></div>
        ${g.status === "pendente" ? `<button class="mini conf" data-acao="confirmar" title="Confirmar">${IC.ok}</button>` : ""}
        ${g.status === "confirmado" && g.telefone ? `<button class="mini" data-acao="lembrar" title="Enviar lembrete">${IC.whats}</button>` : ""}
        ${g.status === "confirmado" ? `<button class="mini conf" data-acao="concluir" title="Marcar como concluído">${IC.ok}</button>` : ""}
      </div>`).join("")
      : `<div class="vazio">${h?.ativo ? "Nenhum horário marcado neste dia." : "Dia sem atendimento."}<br>Toque em <b>+ Agendar</b> para adicionar.</div>`;
  }
  $("#ag-semana").addEventListener("click", (e) => { const b = e.target.closest(".sd"); if (b) { diaAtual = b.dataset.d; render(); } });

  async function acaoAgenda(e) {
    const el = e.target.closest(".item"); if (!el) return;
    const g = porId("agendamentos", el.dataset.id);
    const acao = e.target.closest("[data-acao]")?.dataset.acao;
    const quando = `${A.dataLonga(g.data)}, às ${g.hora}`;
    if (acao === "confirmar") {
      await salvar("agendamentos", { ...g, status: "confirmado" }, "Agendamento confirmado");
      render();
      if (g.telefone && confirm("Enviar a confirmação para a cliente pelo WhatsApp?"))
        abrirWhats(g.telefone, `Olá, ${primeiro(g.nome)}! Seu horário de ${g.servico_nome} está confirmado para ${quando}. Código: ${g.codigo}. Qualquer imprevisto, me avise por aqui. Até lá! 💖`);
      return;
    }
    if (acao === "recusar") {
      if (!confirm(`Recusar o pedido de ${g.nome}?`)) return;
      await salvar("agendamentos", { ...g, status: "cancelado" }, "Pedido recusado");
      render();
      if (g.telefone && confirm("Avisar a cliente pelo WhatsApp?"))
        abrirWhats(g.telefone, `Olá, ${primeiro(g.nome)}! Infelizmente não vou conseguir te atender em ${quando}. Podemos combinar outro horário? 💖`);
      return;
    }
    if (acao === "concluir") { await salvar("agendamentos", { ...g, status: "concluido" }, "Atendimento concluído"); render(); return; }
    if (acao === "lembrar") { abrirWhats(g.telefone, `Oi, ${primeiro(g.nome)}! Passando para lembrar do seu horário de ${g.servico_nome} ${quando}. Te espero! 💖`); return; }
    forms.agendamento(g);
  }
  $("#ag-lista").addEventListener("click", acaoAgenda);
  $("#ag-pendentes").addEventListener("click", acaoAgenda);

  // ---------------- clientes ----------------
  $("#cli-busca").addEventListener("input", renderClientes);
  function renderClientes() {
    const q = $("#cli-busca").value.trim().toLowerCase(), qn = A.tel(q);
    const lista = db.clientes.filter((c) => !q || c.nome.toLowerCase().includes(q) || (qn && (c.telefone || "").includes(qn)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    $("#cli-lista").innerHTML = lista.length ? lista.map((c) => {
      const visitas = db.agendamentos.filter((g) => g.cliente_id === c.id && g.status === "concluido").sort((a, b) => b.data.localeCompare(a.data));
      const prox = db.agendamentos.filter((g) => g.cliente_id === c.id && ["pendente", "confirmado"].includes(g.status) && g.data >= hoje()).sort((a, b) => a.data.localeCompare(b.data))[0];
      const fiado = db.vendas.filter((v) => v.cliente_id === c.id && !v.pago).reduce((s, v) => s + v.valor, 0);
      return `<div class="item" data-id="${c.id}">
        <div class="corpo"><div class="t1">${esc(c.nome)}</div>
        <div class="t2">${visitas.length} visita(s)${visitas[0] ? ` · última ${A.dataCurta(visitas[0].data)}` : ""}${prox ? ` · próxima ${A.dataCurta(prox.data)}` : ""}${fiado ? ` · <span class="st st-fiado">deve ${brl(fiado)}</span>` : ""}</div></div>
        ${c.telefone ? `<button class="mini" data-acao="whats" title="WhatsApp">${IC.whats}</button>` : ""}
      </div>`;
    }).join("") : `<div class="vazio">${q ? "Nenhuma cliente encontrada." : "Nenhuma cliente cadastrada ainda. Quem agenda pelo site entra aqui automaticamente."}</div>`;
  }
  $("#cli-lista").addEventListener("click", (e) => {
    const el = e.target.closest(".item"); if (!el) return;
    const c = porId("clientes", el.dataset.id);
    if (e.target.closest("[data-acao=whats]")) return abrirWhats(c.telefone, `Oi, ${primeiro(c.nome)}! `);
    forms.cliente(c);
  });

  // ---------------- Mary Kay ----------------
  function renderMK() {
    const vendas = [...db.vendas].sort((a, b) => b.data.localeCompare(a.data));
    $("#mk-lista-vendas").innerHTML = vendas.length ? vendas.map((v) => `
      <div class="item" data-id="${v.id}">
        <div class="corpo"><div class="t1">${esc(nomeCliente(v.cliente_id))}</div>
        <div class="t2">${v.qtd}× ${esc(porId("produtos", v.produto_id)?.nome || "Produto")} · ${A.dataCurta(v.data)}</div></div>
        <div class="valor">${brl(v.valor)}<br><span class="st st-${v.pago ? "pago" : "fiado"}">${v.pago ? "pago" : "a receber"}</span></div>
      </div>`).join("") : `<div class="vazio">Nenhuma venda registrada.</div>`;
    const prods = [...db.produtos].sort((a, b) => a.nome.localeCompare(b.nome));
    $("#mk-lista-produtos").innerHTML = prods.length ? prods.map((p) => `
      <div class="item" data-id="${p.id}">
        <div class="corpo"><div class="t1">${esc(p.nome)}</div>
        <div class="t2">${brl(p.preco)}${p.custo ? ` · lucro ${brl(p.preco - p.custo)}` : ""}</div></div>
        <div class="valor">${p.estoque} un.${p.estoque <= (p.minimo || 0) ? `<br><span class="st st-baixo">repor</span>` : ""}</div>
      </div>`).join("") : `<div class="vazio">Cadastre os produtos Mary Kay que você tem em mãos.</div>`;
  }
  $("#mk-lista-vendas").addEventListener("click", (e) => { const el = e.target.closest(".item"); if (el) forms.venda(porId("vendas", el.dataset.id)); });
  $("#mk-lista-produtos").addEventListener("click", (e) => { const el = e.target.closest(".item"); if (el) forms.produto(porId("produtos", el.dataset.id)); });

  // ---------------- financeiro ----------------
  let periodo = "mes";
  $$("#fin-periodo .aba").forEach((b) => b.addEventListener("click", () => {
    periodo = b.dataset.p; $$("#fin-periodo .aba").forEach((x) => x.classList.toggle("ativa", x === b)); renderFin();
  }));
  function intervalo() {
    const fim = hoje();
    if (periodo === "hoje") return [fim, fim];
    if (periodo === "semana") return [A.addDias(fim, -6), fim];
    if (periodo === "mes") return [fim.slice(0, 8) + "01", fim];
    return [fim.slice(0, 5) + "01-01", fim];
  }
  function renderFin() {
    const [ini, fim] = intervalo(), dentro = (d) => d >= ini && d <= fim;
    const atend = db.agendamentos.filter((g) => g.status === "concluido" && dentro(g.data));
    const faltas = db.agendamentos.filter((g) => g.status === "faltou" && dentro(g.data)).length;
    const vendas = db.vendas.filter((v) => dentro(v.data));
    const totServ = atend.reduce((s, g) => s + g.valor, 0);
    const totMK = vendas.reduce((s, v) => s + v.valor, 0);
    const lucroMK = vendas.reduce((s, v) => s + v.valor - (porId("produtos", v.produto_id)?.custo || 0) * v.qtd, 0);
    const site = db.agendamentos.filter((g) => g.origem === "site" && dentro(g.data)).length;
    $("#fin-kpis").innerHTML = `
      <div class="kpi destaque"><small>Faturamento total</small><strong>${brl(totServ + totMK)}</strong></div>
      <div class="kpi"><small>Serviços (${atend.length})</small><strong>${brl(totServ)}</strong></div>
      <div class="kpi"><small>Mary Kay (${vendas.length})</small><strong>${brl(totMK)}</strong></div>
      <div class="kpi"><small>Lucro Mary Kay</small><strong>${brl(lucroMK)}</strong></div>
      <div class="kpi"><small>Ticket médio</small><strong>${brl(atend.length ? totServ / atend.length : 0)}</strong></div>
      <div class="kpi"><small>Agendados pelo site</small><strong>${site}</strong></div>
      <div class="kpi"><small>Faltas</small><strong>${faltas}</strong></div>`;
    const cont = {};
    atend.forEach((g) => { const k = g.servico_nome; cont[k] = cont[k] || { n: 0, v: 0 }; cont[k].n++; cont[k].v += g.valor; });
    const top = Object.entries(cont).sort((a, b) => b[1].n - a[1].n);
    $("#fin-top").innerHTML = top.length ? top.map(([nome, x]) => `<div class="item"><div class="corpo"><div class="t1">${esc(nome)}</div><div class="t2">${x.n} atendimento(s)</div></div><div class="valor">${brl(x.v)}</div></div>`).join("")
      : `<div class="vazio">Nenhum atendimento concluído no período.</div>`;
    const receber = db.vendas.filter((v) => !v.pago);
    $("#fin-receber").innerHTML = receber.length ? receber.map((v) => `
      <div class="item" data-id="${v.id}"><div class="corpo"><div class="t1">${esc(nomeCliente(v.cliente_id))}</div>
      <div class="t2">${esc(porId("produtos", v.produto_id)?.nome || "")} · ${A.dataCurta(v.data)}</div></div>
      <div class="valor">${brl(v.valor)}</div>
      <button class="mini" data-acao="cobrar" title="Cobrar no WhatsApp">${IC.whats}</button>
      <button class="mini conf" data-acao="pago" title="Marcar como pago">${IC.ok}</button></div>`).join("")
      : `<div class="vazio">Nada a receber.</div>`;
  }
  $("#fin-receber").addEventListener("click", async (e) => {
    const el = e.target.closest(".item"); if (!el) return;
    const v = porId("vendas", el.dataset.id), acao = e.target.closest("[data-acao]")?.dataset.acao;
    if (acao === "pago") { await salvar("vendas", { ...v, pago: true }, "Pagamento registrado"); render(); return; }
    if (acao === "cobrar") {
      const c = porId("clientes", v.cliente_id);
      return abrirWhats(c?.telefone, `Oi, ${primeiro(c?.nome)}! Tudo bem? Passando para lembrar do valor de ${brl(v.valor)} referente ao ${porId("produtos", v.produto_id)?.nome || "produto Mary Kay"}. Obrigada! 💖`);
    }
    forms.venda(v);
  });

  // ---------------- ajustes ----------------
  function renderAjustes() {
    $("#aj-horarios").innerHTML = [...db.horarios].sort((a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)).map((h) => `
      <div class="item" data-dia="${h.dia_semana}"><div class="corpo"><div class="t1">${DIAS[h.dia_semana]}</div>
      <div class="t2">${h.ativo ? `${h.inicio} às ${h.fim}${h.pausa_inicio ? ` · pausa ${h.pausa_inicio}–${h.pausa_fim}` : ""}` : "Fechado"}</div></div>
      <span class="st ${h.ativo ? "st-confirmado" : "st-cancelado"}">${h.ativo ? "aberto" : "fechado"}</span></div>`).join("");
    const bl = db.bloqueios.filter((b) => b.data_fim >= hoje()).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
    $("#aj-bloqueios").innerHTML = bl.length ? bl.map((b) => `
      <div class="item" data-id="${b.id}"><div class="corpo"><div class="t1">${A.dataCurta(b.data_inicio)}${b.data_fim !== b.data_inicio ? ` a ${A.dataCurta(b.data_fim)}` : ""}</div>
      <div class="t2">${b.hora_inicio ? `${b.hora_inicio}–${b.hora_fim}` : "Dia inteiro"}${b.motivo ? ` · ${esc(b.motivo)}` : ""}</div></div></div>`).join("")
      : `<div class="vazio">Nenhuma folga ou bloqueio programado.</div>`;
    const a = ajustes();
    $("#aj-regras").innerHTML = `<div class="item" id="aj-regras-item"><div class="corpo">
      <div class="t1">${a.confirmacao_automatica ? "Confirmação automática" : "Eu confirmo cada reserva"}</div>
      <div class="t2">Horários a cada ${a.intervalo_min} min · antecedência ${a.antecedencia_horas} h · agenda aberta ${a.janela_dias} dias · cancelamento até ${a.cancelamento_horas} h antes · preços ${a.mostrar_precos ? "visíveis" : "ocultos"}</div></div></div>`;
    $("#aj-servicos").innerHTML = [...db.servicos].sort((x, y) => x.ordem - y.ordem).map((s) => `
      <div class="item${s.ativo ? "" : " cancelado"}" data-id="${s.id}"><div class="corpo"><div class="t1">${esc(s.nome)}</div>
      <div class="t2">${A.duracaoTexto(s.duracao_min)}${s.ativo ? "" : " · fora do site"}</div></div><div class="valor">${brl(s.preco)}</div></div>`).join("");
  }
  $("#aj-horarios").addEventListener("click", (e) => { const el = e.target.closest(".item"); if (el) forms.horario(db.horarios.find((h) => h.dia_semana === +el.dataset.dia)); });
  $("#aj-bloqueios").addEventListener("click", (e) => { const el = e.target.closest(".item"); if (el) forms.bloqueio(porId("bloqueios", el.dataset.id)); });
  $("#aj-regras").addEventListener("click", () => forms.regras());
  $("#aj-servicos").addEventListener("click", (e) => { const el = e.target.closest(".item"); if (el) forms.servico(porId("servicos", el.dataset.id)); });

  $("#aj-exportar").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }));
    a.download = `backup-regiane-${hoje()}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $("#aj-importar").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const dados = JSON.parse(await f.text());
      if (!confirm("Isso vai substituir os dados atuais pelos do backup. Continuar?")) return;
      await api.restaurarLocal(dados); db = await api.carregarTudo(); render(); toast("Backup restaurado");
    } catch (err) { toast(err.message || "Arquivo inválido.", true); }
    e.target.value = "";
  });
  $("#aj-apagar").addEventListener("click", async () => {
    if (!confirm("Apagar TODOS os dados deste navegador (agenda, clientes, vendas, estoque)?")) return;
    if (prompt("Digite APAGAR para confirmar") !== "APAGAR") return;
    api.apagarLocal(); db = await api.carregarTudo(); render(); toast("Dados apagados");
  });

  function render() { if (!db) return; renderAgenda(); renderClientes(); renderMK(); renderFin(); renderAjustes(); }
  iniciar();
})();
