// =====================================================================
//  Regras de agenda compartilhadas entre o site, o painel e o modo local.
//  Espelham as regras do banco (supabase_schema.sql → _motivo_indisponivel).
// =====================================================================
window.AgendaCore = (function () {
  const TZ = "America/Sao_Paulo";
  const OCUPA = ["pendente", "confirmado", "concluido"];

  const min = (t) => { if (t == null || t === "") return null; const [h, m] = String(t).split(":"); return +h * 60 + +m; };
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const ts = (iso, m = 0) => Date.parse(iso.slice(0, 10) + "T00:00:00Z") + m * 60000; // tempo "de parede"

  function tel(s) {
    let d = String(s || "").replace(/\D/g, "");
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
    return d;
  }
  const telValido = (s) => [10, 11].includes(tel(s).length);
  function telFormatado(s) {
    const d = tel(s);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return s || "";
  }

  // "YYYY-MM-DDTHH:MM" no fuso de São Paulo
  function agora() {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }
  function addDias(iso, n) {
    const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const diaSemana = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").getUTCDay();
  const sobrepoe = (a1, a2, b1, b2) => a1 < b2 && a2 > b1;

  /**
   * disp = { hoje, horarios[], ajustes{}, bloqueios[], ocupados[{data,hora,duracao_min,id?}] }
   * Retorna null se livre, ou uma mensagem explicando o motivo.
   */
  function motivoIndisponivel(disp, data, ini, dur, opts = {}) {
    const a = disp.ajustes, fim = ini + dur, hoje = (disp.hoje || agora()).slice(0, 10);
    const h = disp.horarios.find((x) => +x.dia_semana === diaSemana(data));
    if (!h || !h.ativo) return "Não há atendimento neste dia.";
    if (!opts.painel) {
      if (data < hoje || data > addDias(hoje, a.janela_dias)) return "Data fora do período de agendamento.";
      if (ts(data, ini) < ts(disp.hoje || agora(), min((disp.hoje || agora()).slice(11, 16))) + a.antecedencia_horas * 3600000)
        return "Este horário não está mais disponível.";
    }
    if (ini < min(h.inicio) || fim > min(h.fim)) return "Fora do horário de atendimento.";
    if (h.pausa_inicio && sobrepoe(ini, fim, min(h.pausa_inicio), min(h.pausa_fim))) return "Este horário não está disponível.";
    if (disp.bloqueios.some((b) => data >= b.data_inicio && data <= b.data_fim &&
      (!b.hora_inicio || sobrepoe(ini, fim, min(b.hora_inicio), min(b.hora_fim))))) return "Este horário não está disponível.";
    if (conflito(disp.ocupados, data, ini, dur, opts.ignorar)) return "Esse horário acabou de ser reservado. Por favor, escolha outro.";
    return null;
  }
  function conflito(ocupados, data, ini, dur, ignorar) {
    return ocupados.find((g) => g.data === data && (!g.status || OCUPA.includes(g.status)) && (ignorar == null || g.id !== ignorar) &&
      sobrepoe(ini, ini + dur, min(g.hora), min(g.hora) + g.duracao_min)) || null;
  }
  function slots(disp, data, dur, opts) {
    const h = disp.horarios.find((x) => +x.dia_semana === diaSemana(data));
    if (!h || !h.ativo) return [];
    const passo = disp.ajustes.intervalo_min || 30, out = [];
    for (let t = min(h.inicio); t + dur <= min(h.fim); t += passo)
      if (!motivoIndisponivel(disp, data, t, dur, opts)) out.push(hhmm(t));
    return out;
  }

  const duracaoTexto = (m) => m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
  const dataLonga = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const dataCurta = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" });
  const codigo = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }));

  return { TZ, OCUPA, min, hhmm, tel, telValido, telFormatado, agora, addDias, diaSemana, motivoIndisponivel, conflito, slots,
    duracaoTexto, dataLonga, dataCurta, codigo, uuid };
})();
