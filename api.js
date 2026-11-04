// =====================================================================
//  Camada de dados.
//  - Com SITE_CONFIG.supabase preenchido → banco real (Supabase).
//  - Sem ele → "modo demonstração": tudo no localStorage deste navegador.
//  O site e o painel usam exatamente as mesmas funções nos dois modos.
// =====================================================================
window.API = (function () {
  const C = window.SITE_CONFIG, A = window.AgendaCore;
  const SB = C.supabase || {};
  const remoto = !!(SB.url && SB.anonKey);
  const CHAVE_PK = { horarios: "dia_semana", ajustes: "id" };
  const pk = (t) => CHAVE_PK[t] || "id";
  const TABELAS = ["servicos", "horarios", "ajustes", "bloqueios", "clientes", "agendamentos", "produtos", "vendas"];

  // ------------------------------------------------------------------
  //  Supabase (REST puro, sem SDK)
  // ------------------------------------------------------------------
  const SESSAO = "rp_sessao_v1";
  let sessao = null;
  try { sessao = JSON.parse(localStorage.getItem(SESSAO)); } catch { sessao = null; }

  async function sbFetch(caminho, { method = "GET", body, headers = {}, auth = false } = {}) {
    let token = SB.anonKey;
    if (auth) token = await tokenValido();
    const res = await fetch(SB.url.replace(/\/$/, "") + caminho, {
      method,
      headers: { apikey: SB.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const txt = await res.text();
    const json = txt ? JSON.parse(txt) : null;
    if (!res.ok) {
      if (res.status === 401 && auth) { sair(); }
      throw new Error((json && (json.message || json.error_description || json.msg)) || `Erro ${res.status}`);
    }
    return json;
  }
  async function tokenValido() {
    if (!sessao) throw new Error("Sessão expirada. Entre novamente.");
    if (Date.now() < sessao.expira - 60000) return sessao.access_token;
    const r = await fetch(`${SB.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: SB.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: sessao.refresh_token })
    });
    if (!r.ok) { sair(); throw new Error("Sessão expirada. Entre novamente."); }
    guardarSessao(await r.json());
    return sessao.access_token;
  }
  function guardarSessao(j) {
    sessao = { access_token: j.access_token, refresh_token: j.refresh_token, expira: Date.now() + j.expires_in * 1000, email: j.user?.email };
    localStorage.setItem(SESSAO, JSON.stringify(sessao));
  }
  const rpc = (nome, params) => sbFetch(`/rest/v1/rpc/${nome}`, { method: "POST", body: params });

  // ------------------------------------------------------------------
  //  Modo local (demonstração)
  // ------------------------------------------------------------------
  const LOCAL = "rp_db_v2";
  function seed() {
    return {
      servicos: C.servicos.map((s, i) => ({ id: s.id, nome: s.nome, descricao: s.desc, duracao_min: s.duracao || 60, preco: s.preco || 0, ativo: true, ordem: i + 1 }))
        .concat([{ id: "avaliacao", nome: "Avaliação", descricao: "", duracao_min: 30, preco: 0, ativo: true, ordem: 99 }]),
      horarios: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dia_semana: d, ativo: d >= 1 && d <= 5, inicio: "08:00", fim: d === 5 ? "17:30" : "18:00", pausa_inicio: "12:00", pausa_fim: "13:30" })),
      ajustes: [{ id: 1, intervalo_min: 30, antecedencia_horas: 2, janela_dias: 60, cancelamento_horas: 12, confirmacao_automatica: false, mostrar_precos: false }],
      bloqueios: [], clientes: [], agendamentos: [], produtos: [], vendas: []
    };
  }
  function ler() {
    try { const d = JSON.parse(localStorage.getItem(LOCAL)); if (d) return Object.assign(seed(), d); } catch {}
    const d = seed(); gravar(d); return d;
  }
  const gravar = (d) => localStorage.setItem(LOCAL, JSON.stringify(d));
  const erro = (m) => { throw new Error(m); };
  const espera = () => new Promise((r) => setTimeout(r, 120)); // simula rede

  function dispLocal(d) {
    const hoje = A.agora();
    return {
      hoje,
      servicos: d.servicos.filter((s) => s.ativo).sort((a, b) => a.ordem - b.ordem),
      horarios: d.horarios, ajustes: d.ajustes[0],
      bloqueios: d.bloqueios.filter((b) => b.data_fim >= hoje.slice(0, 10)),
      ocupados: d.agendamentos.filter((g) => g.data >= hoje.slice(0, 10) && A.OCUPA.includes(g.status))
        .map((g) => ({ data: g.data, hora: g.hora, duracao_min: g.duracao_min }))
    };
  }
  const publico = (g) => ({ codigo: g.codigo, status: g.status, servico_nome: g.servico_nome, data: g.data, hora: g.hora.slice(0, 5), duracao_min: g.duracao_min, nome: g.nome });

  // ------------------------------------------------------------------
  //  Normalização (o Postgres devolve "09:00:00" e números como texto)
  // ------------------------------------------------------------------
  const HORAS = ["hora", "inicio", "fim", "pausa_inicio", "pausa_fim", "hora_inicio", "hora_fim"];
  const NUM = ["preco", "valor", "custo"];
  function norm(o) {
    if (!o || typeof o !== "object") return o;
    HORAS.forEach((k) => { if (typeof o[k] === "string") o[k] = o[k].slice(0, 5); });
    NUM.forEach((k) => { if (o[k] != null) o[k] = Number(o[k]); });
    return o;
  }
  function normDisp(d) {
    d.horarios.forEach(norm); d.bloqueios.forEach(norm); d.ocupados.forEach(norm); d.servicos.forEach(norm);
    return d;
  }

  // ------------------------------------------------------------------
  //  API pública
  // ------------------------------------------------------------------
  async function disponibilidade() {
    if (remoto) return normDisp(await rpc("disponibilidade", {}));
    await espera(); return dispLocal(ler());
  }

  async function agendar({ servico_id, data, hora, nome, telefone, obs }) {
    if (remoto) return norm(await rpc("agendar", { p_servico: servico_id, p_data: data, p_hora: hora, p_nome: nome, p_telefone: telefone, p_obs: obs || null }));
    await espera();
    const d = ler(), t = A.tel(telefone);
    if ((nome || "").trim().length < 2) erro("Informe seu nome.");
    if (!A.telValido(t)) erro("Informe um WhatsApp válido com DDD.");
    const s = d.servicos.find((x) => x.id === servico_id && x.ativo) || erro("Serviço indisponível.");
    const motivo = A.motivoIndisponivel(dispLocal(d), data, A.min(hora), s.duracao_min);
    if (motivo) erro(motivo);
    const hoje = A.agora().slice(0, 10);
    if (d.agendamentos.filter((g) => g.telefone === t && ["pendente", "confirmado"].includes(g.status) && g.data >= hoje).length >= 3)
      erro("Você já tem agendamentos em aberto. Fale comigo pelo WhatsApp.");
    let cli = d.clientes.find((c) => c.telefone === t);
    if (!cli) { cli = { id: A.uuid(), nome: nome.trim(), telefone: t, criado_em: new Date().toISOString() }; d.clientes.push(cli); }
    const g = {
      id: A.uuid(), codigo: A.codigo(), cliente_id: cli.id, nome: nome.trim(), telefone: t, servico_id: s.id, servico_nome: s.nome,
      data, hora, duracao_min: s.duracao_min, valor: s.preco, status: d.ajustes[0].confirmacao_automatica ? "confirmado" : "pendente",
      origem: "site", obs: (obs || "").trim().slice(0, 500) || null, criado_em: new Date().toISOString()
    };
    d.agendamentos.push(g); gravar(d);
    return publico(g);
  }

  async function consultar(codigo, telefone) {
    if (remoto) { const r = await rpc("consultar_agendamento", { p_codigo: codigo, p_telefone: telefone }); return r ? norm(r) : null; }
    await espera();
    const g = ler().agendamentos.find((x) => x.codigo === String(codigo).trim().toUpperCase() && x.telefone === A.tel(telefone));
    return g ? publico(g) : null;
  }

  async function cancelar(codigo, telefone) {
    if (remoto) return rpc("cancelar_agendamento", { p_codigo: codigo, p_telefone: telefone });
    await espera();
    const d = ler(), a = d.ajustes[0];
    const g = d.agendamentos.find((x) => x.codigo === String(codigo).trim().toUpperCase() && x.telefone === A.tel(telefone))
      || erro("Agendamento não encontrado. Confira o código e o WhatsApp.");
    if (!["pendente", "confirmado"].includes(g.status)) erro("Este agendamento não pode mais ser cancelado.");
    const agora = A.agora();
    const falta = (Date.parse(`${g.data}T${g.hora}:00Z`) - Date.parse(`${agora}:00Z`)) / 3600000;
    if (falta < a.cancelamento_horas) erro(`Cancelamentos online só até ${a.cancelamento_horas} h antes. Fale comigo pelo WhatsApp.`);
    g.status = "cancelado"; g.obs = ((g.obs || "") + " [cancelado pela cliente pelo site]").trim();
    gravar(d);
    return { codigo: g.codigo, status: "cancelado" };
  }

  // ------------------------------------------------------------------
  //  API do painel
  // ------------------------------------------------------------------
  async function entrar(email, senha) {
    if (!remoto) return true;
    const r = await fetch(`${SB.url}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: SB.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: senha })
    });
    const j = await r.json();
    if (!r.ok) {
      const m = j.error_description || j.msg || j.message || "";
      if (/invalid login credentials/i.test(m)) throw new Error("E-mail ou senha incorretos. Confira o usuário em Supabase → Authentication → Users.");
      if (/email not confirmed/i.test(m)) throw new Error("E-mail ainda não confirmado. No Supabase, crie o usuário com \"Auto Confirm User\" marcado (ou confirme pelo e-mail recebido).");
      throw new Error(m || "Não foi possível entrar.");
    }
    guardarSessao(j);
    // confere se este e-mail está liberado na tabela administradores
    const ok = await sbFetch("/rest/v1/rpc/eh_admin", { method: "POST", body: {}, auth: true }).catch(() => null);
    if (ok === false) {
      sair();
      throw new Error(`O e-mail ${email} entrou, mas não está liberado no painel. No Supabase → SQL Editor, rode: insert into administradores (email) values ('${email}');`);
    }
    return true;
  }
  function sair() { sessao = null; localStorage.removeItem(SESSAO); }
  const logado = () => !remoto || !!sessao;

  async function carregarTudo() {
    if (remoto) {
      const partes = await Promise.all(TABELAS.map((t) => sbFetch(`/rest/v1/${t}?select=*`, { auth: true })));
      const db = {}; TABELAS.forEach((t, i) => { db[t] = partes[i].map(norm); });
      if (!db.ajustes.length) db.ajustes = [seed().ajustes[0]];
      return db;
    }
    await espera(); return ler();
  }

  async function salvar(tabela, obj) {
    if (remoto) {
      const r = await sbFetch(`/rest/v1/${tabela}?on_conflict=${pk(tabela)}`, {
        method: "POST", auth: true, body: obj, headers: { Prefer: "resolution=merge-duplicates,return=representation" }
      });
      return norm(r[0]);
    }
    const d = ler(), k = pk(tabela);
    const salvo = { ...obj };
    if (tabela === "agendamentos" && !salvo.codigo) salvo.codigo = A.codigo();
    if (salvo[k] == null) salvo[k] = A.uuid();
    const i = d[tabela].findIndex((x) => x[k] === salvo[k]);
    if (i >= 0) d[tabela][i] = salvo; else d[tabela].push(salvo);
    gravar(d); return salvo;
  }

  async function remover(tabela, chave) {
    if (remoto) return sbFetch(`/rest/v1/${tabela}?${pk(tabela)}=eq.${encodeURIComponent(chave)}`, { method: "DELETE", auth: true });
    const d = ler(), k = pk(tabela);
    d[tabela] = d[tabela].filter((x) => x[k] !== chave); gravar(d);
  }

  // Backup / restauração (restauração só no modo local)
  async function restaurarLocal(dados) {
    if (remoto) throw new Error("No modo online os dados ficam no banco; use o painel do Supabase para restaurar.");
    if (!Array.isArray(dados.agendamentos) || !Array.isArray(dados.clientes)) throw new Error("Arquivo de backup inválido.");
    gravar(Object.assign(seed(), dados));
  }
  function apagarLocal() { if (!remoto) localStorage.removeItem(LOCAL); }

  return {
    modo: remoto ? "supabase" : "local", TABELAS, pk,
    disponibilidade, agendar, consultar, cancelar,
    entrar, sair, logado, email: () => sessao?.email || "",
    carregarTudo, salvar, remover, restaurarLocal, apagarLocal
  };
})();
