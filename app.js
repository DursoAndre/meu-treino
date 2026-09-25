const { useState, useEffect, useMemo, useCallback, useRef } = React;

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const SEED_TREINO_PERNAS = {
  id: "fortalecimento-prevencao",
  nome: "Perna — Fortalecimento & Mobilidade",
  duracaoMin: 60,
  notas: "Treino atualizado com a Coach Dayanne em 09/09. Treino muito longo pra fazer 4 séries em tudo — precisa testar antes de fixar o volume definitivo. Iliopsoas ficou sem número de séries definido na conversa (assumi 3, ajustar com a Dayanne). Extensora isométrica: tempo de sustentação a definir. Extensora dinâmica: ângulo a definir.",
  blocos: [
    {
      nome: "Mobilidade (antes do treino)",
      exercicios: [
        { id: "balanco-perna-frente-tras-meio-ajoelhado", nome: "Balanço de perna frente-trás em meio-ajoelhado", series: 1, repeticoes: "8–10 por lado", descricao: "Ajoelhado com uma perna na frente (postura de afonso), balance a perna da frente pra frente e pra trás, mantendo o pé próximo ao corpo.", observacoes: "Mobilidade de tornozelo e quadril, fluido, sem carga." },
        { id: "minhoca-rotacao-cocoras", nome: "Minhoca com rotação até cócoras", series: 1, repeticoes: "8–10 por lado", descricao: "Caminhe as mãos até a prancha (minhoca), leve um pé pro lado de fora da mão e gire o tronco levando o cotovelo em direção ao chão. Em seguida, jogue o quadril pra trás numa passada breve por cócoras.", observacoes: "Mobilidade de quadril — abertura de virilha." },
        { id: "balanco-perna-lateral-meio-ajoelhado", nome: "Balanço de perna lateral em meio-ajoelhado", series: 1, repeticoes: "8–10 por lado", descricao: "Mesma posição do balanço frente-trás, mas jogando a perna pra fora (lateral) em vez de pra frente/trás.", observacoes: "Mobilidade de quadril — abdução." },
        { id: "prancha-assoalho-pelvico", nome: "Prancha (opcional)", series: 2, repeticoes: "20–30s", descricao: "Prancha bem feita, pensando em ativar o assoalho pélvico — não é sobre o joelho, é preventivo geral.", observacoes: "Opcional." },
      ],
    },
    {
      nome: "Força & Isolados",
      exercicios: [
        { id: "gluteo-medio-no-cabo", nome: "Glúteo médio no cabo", series: 4, repeticoes: "15–20", descricao: "", observacoes: "" },
        { id: "iliopsoas-no-cabo", nome: "Iliopsoas no cabo", series: 3, repeticoes: "15–20", descricao: "", observacoes: "Número de séries não veio definido na conversa — assumi 3, confirmar com a Dayanne." },
        { id: "agachamento-mini-band-goblet", nome: "Agachamento com mini band no joelho (goblet squat)", series: 3, repeticoes: "15–20", descricao: "Mini band acima do joelho força a ativação do glúteo e evita a projeção do joelho à frente.", observacoes: "" },
        { id: "pistol-parcial-banco", nome: "Pistol parcial (no banco)", series: 3, repeticoes: "15–20", descricao: "", observacoes: "Obrigatoriamente no banco, não descer mais que isso, postura reta e perfeita." },
        { id: "extensora-unilateral-isometrica", nome: "Cadeira extensora unilateral isométrica", series: 4, repeticoes: "isometria", descricao: "Sustentação isométrica.", observacoes: "Tempo de isometria ainda a definir com a Dayanne." },
        { id: "extensora-unilateral-dinamica", nome: "Cadeira extensora unilateral (dinâmica)", series: 4, repeticoes: "15–20", descricao: "", observacoes: "Ângulo ainda a validar com a Dayanne." },
        { id: "flexora-em-pe-unilateral", nome: "Flexora em pé unilateral", series: 4, repeticoes: "15–20", descricao: "", observacoes: "" },
        { id: "flexora-fitball-unilateral", nome: "Flexora deitado no fitball unilateral", series: 4, repeticoes: "15–20", descricao: "", observacoes: "" },
        { id: "cadeira-adutora", nome: "Cadeira adutora", series: 3, repeticoes: "15–20", descricao: "Superset com abdutora e panturrilha — feito em sequência, sem descanso entre os três.", observacoes: "\"Pra acabar logo\" — segundo a Dayanne." },
        { id: "cadeira-abdutora", nome: "Cadeira abdutora", series: 3, repeticoes: "15–20", descricao: "Superset com adutora e panturrilha — feito em sequência, sem descanso entre os três.", observacoes: "\"Pra acabar logo\" — segundo a Dayanne." },
        { id: "panturrilha-maquina", nome: "Panturrilha na máquina", series: 3, repeticoes: "15–20", descricao: "Superset com adutora e abdutora — feito em sequência, sem descanso entre os três.", observacoes: "\"Pra acabar logo\" — segundo a Dayanne." },
      ],
    },
  ],
};

const SEED_TREINO_OMBRO = {
  id: "ombro-reabilitacao-musculacao",
  nome: "Ombro — Reabilitação + Musculação",
  duracaoMin: 40,
  notas: "Atualizado com a Coach Dayanne em 09/09. Manter esse treino por 3 meses — ela confirmou que a sequência está certa. Frequência mínima 1x/semana; o ideal é 2x/semana, e ela foi enfática: depois de começar, não pode mais parar de fazer toda semana. Não deixar de fazer bastante mobilidade também.",
  blocos: [
    {
      nome: "Mobilidade / Ativação",
      exercicios: [
        { id: "snow-angel", nome: "Snow angel (anjo na parede/chão)", series: 2, repeticoes: "10–15", descricao: "", observacoes: "" },
        { id: "mobilidade-manguito-rotador", nome: "Mobilidade de manguito rotador", series: 1, repeticoes: "protocolo", descricao: "", observacoes: "" },
        { id: "shoulder-tap", nome: "Shoulder tap", series: 2, repeticoes: "10–15 por lado", descricao: "", observacoes: "" },
      ],
    },
    {
      nome: "Manguito Rotador no Cabo",
      exercicios: [
        { id: "manguito-rotacao-externa-cabo", nome: "Manguito rotador — rotação externa no cabo", series: 4, repeticoes: "15", descricao: "Superset com a rotação interna: um lado descansa enquanto o outro trabalha.", observacoes: "Sem intervalo entre as séries — o descanso é a troca de lado." },
        { id: "manguito-rotacao-interna-cabo", nome: "Manguito rotador — rotação interna no cabo", series: 4, repeticoes: "15", descricao: "Superset com a rotação externa: um lado descansa enquanto o outro trabalha.", observacoes: "Sem intervalo entre as séries — o descanso é a troca de lado." },
      ],
    },
    {
      nome: "Face Pull",
      exercicios: [
        { id: "face-pull", nome: "Face pull", series: 3, repeticoes: "15", descricao: "", observacoes: "" },
      ],
    },
    {
      nome: "Crossover A — Plano horizontal",
      exercicios: [
        { id: "crucifixo-reto-no-crossover", nome: "Crucifixo reto no crossover", series: 4, repeticoes: "20", descricao: "Superset com o crucifixo invertido reto, cobrindo o plano horizontal.", observacoes: "~1 min de intervalo entre cada rodada (frente + costas)." },
        { id: "crucifixo-invertido-reto", nome: "Crucifixo invertido reto", series: 4, repeticoes: "20", descricao: "Superset com o crucifixo reto no crossover.", observacoes: "~1 min de intervalo entre cada rodada (frente + costas)." },
      ],
    },
    {
      nome: "Crossover B — Diagonal alta → baixa",
      exercicios: [
        { id: "crucifixo-crossover-cima-para-baixo", nome: "Crucifixo no crossover de cima para baixo", series: 4, repeticoes: "20", descricao: "Superset com o crucifixo invertido no ângulo correspondente.", observacoes: "~1 min de intervalo entre cada rodada (frente + costas)." },
        { id: "crucifixo-invertido-alta-baixa", nome: "Crucifixo invertido — ângulo correspondente (alta → baixa)", series: 4, repeticoes: "20", descricao: "Superset com o crucifixo no crossover de cima para baixo.", observacoes: "~1 min de intervalo entre cada rodada (frente + costas)." },
      ],
    },
    {
      nome: "Crossover C — Diagonal baixa → alta",
      exercicios: [
        { id: "crucifixo-crossover-baixo-para-cima", nome: "Crucifixo no crossover de baixo para cima", series: 4, repeticoes: "20", descricao: "Superset com o crucifixo invertido no ângulo correspondente.", observacoes: "~1 min de intervalo entre cada rodada (frente + costas)." },
        { id: "crucifixo-invertido-baixa-alta", nome: "Crucifixo invertido — ângulo correspondente (baixa → alta)", series: 4, repeticoes: "20", descricao: "Superset com o crucifixo no crossover de baixo para cima.", observacoes: "~1 min de intervalo entre cada rodada (frente + costas)." },
      ],
    },
  ],
};

const SEED_TREINOS = [SEED_TREINO_PERNAS, SEED_TREINO_OMBRO];

const SEED_ATIVIDADES = [
  { id: "volei", nome: "Vôlei de praia" },
  { id: "crossfit", nome: "CrossFit" },
  { id: "hyrox", nome: "Hyrox" },
  { id: "sofa", nome: "Descanso (série no sofá)" },
];

const SEED_SCHEDULE = {
  0: [{ tipo: "atividade", id: "volei" }],
  1: [{ tipo: "atividade", id: "volei" }, { tipo: "treino", id: "fortalecimento-prevencao" }],
  2: [{ tipo: "atividade", id: "crossfit" }],
  3: [{ tipo: "atividade", id: "volei" }, { tipo: "treino", id: "fortalecimento-prevencao" }],
  4: [{ tipo: "atividade", id: "sofa" }],
  5: [{ tipo: "treino", id: "ombro-reabilitacao-musculacao" }, { tipo: "treino", id: "fortalecimento-prevencao" }],
  6: [{ tipo: "atividade", id: "hyrox" }],
};

const EXEMPLO_JSON = `{
  "nome": "Nome do treino",
  "duracaoMin": 60,
  "notas": "Observações gerais (opcional)",
  "blocos": [
    {
      "nome": "Nome do bloco",
      "exercicios": [
        {
          "nome": "Nome do exercício",
          "series": 3,
          "repeticoes": "10-12",
          "descricao": "O que é / para que serve (opcional)",
          "observacoes": "Comentário fixo, ex: cuidado com o joelho (opcional)"
        }
      ]
    }
  ]
}`;

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";
}

function todayISO() { return isoFromDate(new Date()); }
function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoFromDate(dt);
}
function weekdayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}
function parseFirstNumber(str) {
  const match = String(str || "").match(/\d+/);
  return match ? Number(match[0]) : "";
}
function itemKey(item) { return `${item.tipo}:${item.id}`; }

// --- Carga aguda/crônica (ACWR) via sRPE (session RPE, método de Foster) ---
// Carga da sessão = duração (min) × RPE (0-10, esforço percebido).
// Isso dá um número comparável entre qualquer tipo de atividade (academia,
// CrossFit, vôlei, Hyrox), sem precisar comparar peso levantado com "correu
// na areia".
function sessionLoad(entry) {
  if (!entry || entry.duracaoMin == null || entry.rpe == null) return 0;
  const dur = Number(entry.duracaoMin);
  const rpe = Number(entry.rpe);
  if (!dur || !rpe) return 0;
  return dur * rpe;
}

// Soma a carga de todos os itens (treinos + atividades) registrados num dia.
// Fica em session.cargas (separado de session.log) porque session.log tem
// formato diferente para treino (por exercício) e atividade (status/comentário).
function dailyLoadFor(session) {
  if (!session || !session.cargas) return 0;
  return Object.values(session.cargas).reduce((sum, entry) => sum + sessionLoad(entry), 0);
}

// Série diária de carga entre duas datas ISO (inclusive), preenchendo dias
// sem sessão com 0.
function buildDailyLoadSeries(sessions, startIso, endIso) {
  const series = [];
  let cursor = startIso;
  let guard = 0;
  while (cursor <= endIso && guard < 400) {
    series.push({ date: cursor, load: dailyLoadFor(sessions[cursor]) });
    cursor = addDays(cursor, 1);
    guard++;
  }
  return series;
}

// Carga aguda (média móvel simples dos últimos `windowDays` dias, terminando
// em `endIso` inclusive) e carga crônica (mesma ideia, janela maior).
// ACWR = aguda / crônica. Zona considerada segura: 0.8–1.3 (referência comum
// na literatura de ciência do esporte); acima de ~1.5 é zona de risco elevado
// de lesão por pico de carga muito acima do condicionamento de base.
function computeACWR(sessions, endIso, acuteDays = 7, chronicDays = 28) {
  const chronicStart = addDays(endIso, -(chronicDays - 1));
  const series = buildDailyLoadSeries(sessions, chronicStart, endIso);
  const chronicSlice = series;
  const acuteSlice = series.slice(-acuteDays);
  const avg = (arr) => (arr.length ? arr.reduce((s, d) => s + d.load, 0) / arr.length : 0);
  const acute = avg(acuteSlice);
  const chronic = avg(chronicSlice);
  const ratio = chronic > 0 ? acute / chronic : (acute > 0 ? null : 0);
  return { acute, chronic, ratio, series };
}

function acwrZone(ratio) {
  if (ratio == null) return { label: "sem dados suficientes", tone: "neutral" };
  if (ratio < 0.8) return { label: "abaixo do ideal (destreinando)", tone: "info" };
  if (ratio <= 1.3) return { label: "zona ideal", tone: "good" };
  if (ratio <= 1.5) return { label: "atenção — carga subindo rápido", tone: "warn" };
  return { label: "risco alto de lesão", tone: "danger" };
}

// --- Frequência de treino ---
// Um treino de academia é considerado "realizado" num dia se pelo menos um
// exercício foi marcado "feito" (não precisa ter concluído a ficha inteira).
// Uma atividade é considerada "realizada" se o status do dia é "fui".
function parseItemKeyStr(key) {
  const i = key.indexOf(":");
  return { tipo: key.slice(0, i), id: key.slice(i + 1) };
}

function isTreinoLogAttended(treinoLog) {
  if (!treinoLog) return false;
  return Object.values(treinoLog).some((e) => e && e.status === "feito");
}

function isEntryAttended(tipo, entry) {
  if (!entry) return false;
  if (tipo === "treino") return isTreinoLogAttended(entry);
  return entry.status === "fui";
}

// Início da semana (segunda-feira) da data ISO informada, como string ISO.
function weekStartIso(dateIso) {
  const d = new Date(dateIso + "T00:00:00");
  const dow = d.getDay(); // 0=domingo..6=sábado
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday);
  return isoFromDate(d);
}

function monthKeyOf(dateIso) { return dateIso.slice(0, 7); } // "YYYY-MM"

function bucketKeyFor(dateIso, unit) {
  return unit === "mes" ? monthKeyOf(dateIso) : weekStartIso(dateIso);
}

function bucketLabelFor(bucketKey, unit) {
  if (unit === "mes") {
    const [y, m] = bucketKey.split("-");
    const nomesMes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    return `${nomesMes[Number(m) - 1]}/${y.slice(2)}`;
  }
  return `sem. de ${formatDateLabel(bucketKey)}`;
}

// Resolve o intervalo [startIso, endIso] para um período pré-definido.
function periodRange(periodId, todayIso, earliestIso) {
  if (periodId === "7d") return { startIso: addDays(todayIso, -6), endIso: todayIso };
  if (periodId === "30d") return { startIso: addDays(todayIso, -29), endIso: todayIso };
  if (periodId === "12m") return { startIso: addDays(todayIso, -364), endIso: todayIso };
  // "all" — desde o primeiro registro que existir (ou hoje, se não houver nenhum).
  return { startIso: earliestIso || todayIso, endIso: todayIso };
}

// Estatísticas de frequência (contagem, tempo, quebra por tipo e série por
// bucket de tempo) para o intervalo e granularidade informados.
function computeFrequencyStats(sessions, treinos, atividades, startIso, endIso, bucketUnit) {
  const perType = {}; // key -> { nome, tipo, count, minutes }
  const daysAttended = new Set();
  const bucketCounts = {}; // bucketKey -> count
  let totalSessions = 0;
  let totalMinutes = 0;

  const nomeFor = (tipo, id) => {
    if (tipo === "treino") return treinos.find((t) => t.id === id)?.nome || id;
    return atividades.find((a) => a.id === id)?.nome || id;
  };

  Object.entries(sessions).forEach(([date, session]) => {
    if (date < startIso || date > endIso) return;
    const log = session.log || {};
    const cargas = session.cargas || {};
    Object.entries(log).forEach(([key, entry]) => {
      const { tipo, id } = parseItemKeyStr(key);
      if (!isEntryAttended(tipo, entry)) return;
      totalSessions++;
      daysAttended.add(date);
      const bKey = bucketKeyFor(date, bucketUnit);
      bucketCounts[bKey] = (bucketCounts[bKey] || 0) + 1;
      if (!perType[key]) perType[key] = { nome: nomeFor(tipo, id), tipo, count: 0, minutes: 0 };
      perType[key].count++;
      const minutes = Number(cargas[key]?.duracaoMin) || 0;
      perType[key].minutes += minutes;
      totalMinutes += minutes;
    });
  });

  // Série de buckets contígua (sem buracos) entre startIso e endIso, pra o
  // gráfico não pular semanas/meses sem nada.
  const series = [];
  let cursor = bucketUnit === "mes" ? startIso.slice(0, 8) + "01" : weekStartIso(startIso);
  let guard = 0;
  const lastBucket = bucketKeyFor(endIso, bucketUnit);
  while (guard < 400) {
    const bKey = bucketKeyFor(cursor, bucketUnit);
    if (!series.length || series[series.length - 1].key !== bKey) {
      series.push({ key: bKey, label: bucketLabelFor(bKey, bucketUnit), count: bucketCounts[bKey] || 0 });
    }
    if (bKey === lastBucket) break;
    cursor = addDays(cursor, bucketUnit === "mes" ? 28 : 7);
    guard++;
  }

  const perTypeList = Object.values(perType).sort((a, b) => b.count - a.count);
  const numBuckets = series.length || 1;
  const avgPerBucket = totalSessions / numBuckets;

  return {
    totalSessions,
    totalDays: daysAttended.size,
    totalMinutes,
    perTypeList,
    series,
    avgPerBucket,
  };
}

function flattenExercicios(treino) {
  const out = [];
  let pos = 1;
  for (const bloco of treino.blocos) {
    for (const ex of bloco.exercicios) {
      out.push({ ...ex, blocoNome: bloco.nome, posicao: pos });
      pos++;
    }
  }
  return out;
}
function groupByBloco(flat) {
  const map = new Map();
  flat.forEach((ex) => {
    if (!map.has(ex.blocoNome)) map.set(ex.blocoNome, []);
    map.get(ex.blocoNome).push(ex);
  });
  return Array.from(map.entries()).map(([nome, exercicios]) => ({ nome, exercicios }));
}

function normalizeImportedTreino(raw, existingIds) {
  const usedIds = new Set(existingIds);
  const nome = raw.nome || "Treino sem nome";
  let baseId = slugify(nome);
  let id = baseId;
  let i = 2;
  while (usedIds.has(id)) { id = `${baseId}-${i}`; i++; }
  usedIds.add(id);
  const blocos = (raw.blocos || []).map((bloco) => ({
    nome: bloco.nome || "Bloco",
    exercicios: (bloco.exercicios || []).map((ex) => ({
      id: slugify(ex.nome || "exercicio"),
      nome: ex.nome || "Exercício",
      series: Number(ex.series) || 3,
      repeticoes: ex.repeticoes != null ? String(ex.repeticoes) : "",
      descricao: ex.descricao || "",
      observacoes: ex.observacoes || "",
    })),
  }));
  return { id, nome, duracaoMin: Number(raw.duracaoMin) || null, notas: raw.notas || "", blocos };
}

function migrateSchedule(raw) {
  const next = {};
  Object.entries(raw || {}).forEach(([day, val]) => {
    if (typeof val === "string") next[day] = [{ tipo: "treino", id: val }];
    else if (Array.isArray(val)) next[day] = val;
  });
  return next;
}

const APP_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@500&display=swap');
  .gt-root { --bg:#14161A; --surface:#1D2024; --surface-2:#24282E; --border:#2C3038; --text:#F2F3F1; --text-muted:#9AA0A6; --accent:#C6F135; --accent-dim:#8AA324; --warn:#FF5A36; --info:#5AB0FF; --radius:6px;
    background:var(--bg); color:var(--text); font-family:'Inter',system-ui,sans-serif; min-height:100vh; max-width:480px; margin:0 auto; position:relative; padding-bottom:76px; }
  .gt-root * { box-sizing:border-box; }
  .gt-header { padding:20px 18px 14px; border-bottom:1px solid var(--border); }
  .gt-eyebrow { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--accent); letter-spacing:0.04em; }
  .gt-title { font-family:'Oswald',sans-serif; font-size:26px; font-weight:600; margin:2px 0 0; }
  .gt-body { padding:16px 14px 24px; }
  .gt-daynav { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; }
  .gt-daynav button { background:var(--surface); border:1px solid var(--border); color:var(--text); width:36px; height:36px; border-radius:var(--radius); font-size:16px; cursor:pointer; }
  .gt-daynav .gt-day-center { text-align:center; flex:1; }
  .gt-daynav .gt-day-center .wd { font-family:'Oswald',sans-serif; font-size:15px; }
  .gt-daynav .gt-day-center .dt { color:var(--text-muted); font-size:12px; }
  .gt-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px; margin-bottom:12px; }
  .gt-pick-grid { display:flex; flex-direction:column; gap:8px; }
  .gt-pick-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px; text-align:left; cursor:pointer; color:var(--text); display:flex; justify-content:space-between; align-items:center; }
  .gt-pick-card .nm { font-family:'Oswald',sans-serif; font-size:15px; }
  .gt-pick-card .meta { color:var(--text-muted); font-size:11px; margin-top:2px; }
  .gt-item-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:10px; overflow:hidden; }
  .gt-item-card.done { border-color:var(--accent-dim); }
  .gt-item-row { display:flex; align-items:center; gap:10px; padding:13px 12px; cursor:pointer; }
  .gt-item-tag { font-family:'Roboto Mono',monospace; font-size:9px; color:var(--bg); background:var(--info); border-radius:3px; padding:2px 5px; flex-shrink:0; letter-spacing:.03em; }
  .gt-item-tag.treino { background:var(--accent); }
  .gt-item-main { flex:1; min-width:0; }
  .gt-item-nm { font-family:'Oswald',sans-serif; font-size:15px; }
  .gt-item-meta { color:var(--text-muted); font-size:11px; margin-top:2px; font-family:'Roboto Mono',monospace; }
  .gt-chevron { color:var(--text-muted); flex-shrink:0; font-size:12px; }
  .gt-item-extra-x { background:none; border:none; color:var(--warn); font-size:16px; cursor:pointer; padding:0 2px; flex-shrink:0; }
  .gt-item-card.skipped { border-color:var(--warn); opacity:.75; }
  .gt-status-toggle { display:flex; gap:4px; flex-shrink:0; }
  .gt-status-btn { border:1px solid var(--border); background:var(--surface-2); color:var(--text-muted); font-family:'Roboto Mono',monospace; font-size:10px; letter-spacing:.02em; padding:6px 8px; border-radius:4px; cursor:pointer; }
  .gt-status-btn.fui.on { background:var(--accent); border-color:var(--accent); color:#14161A; }
  .gt-status-btn.nao.on { background:var(--warn); border-color:var(--warn); color:#14161A; }
  .gt-hidden-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:2px; margin-bottom:14px; }
  .gt-hidden-row .lbl { font-size:11px; color:var(--text-muted); width:100%; }
  .gt-restore-chip { display:flex; align-items:center; gap:6px; background:var(--surface); border:1px dashed var(--border); border-radius:14px; padding:5px 10px; font-size:11px; color:var(--text-muted); cursor:pointer; }
  .gt-progress-wrap { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .gt-progress-bar { flex:1; height:6px; background:var(--surface-2); border-radius:3px; overflow:hidden; }
  .gt-progress-fill { height:100%; background:var(--accent); transition:width .25s ease; }
  .gt-progress-label { font-family:'Roboto Mono',monospace; font-size:12px; color:var(--text-muted); white-space:nowrap; }
  .gt-bloco { margin:0 12px 14px; }
  .gt-bloco:first-child { margin-top:12px; }
  .gt-bloco-title { font-family:'Roboto Mono',monospace; font-size:11px; letter-spacing:0.03em; color:var(--text-muted); border-left:3px solid var(--accent); padding-left:8px; margin-bottom:8px; }
  .gt-ex { background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:8px; overflow:hidden; }
  .gt-ex.done { border-color:var(--accent-dim); }
  .gt-ex-row { display:flex; align-items:center; gap:10px; padding:12px; cursor:pointer; }
  .gt-ex-pos { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); width:18px; flex-shrink:0; }
  .gt-ex-main { flex:1; min-width:0; }
  .gt-ex-nm { font-size:14px; font-weight:500; line-height:1.3; }
  .gt-ex-target { color:var(--text-muted); font-size:12px; margin-top:2px; font-family:'Roboto Mono',monospace; }
  .gt-check { width:26px; height:26px; border-radius:50%; border:2px solid var(--border); flex-shrink:0; display:flex; align-items:center; justify-content:center; background:none; cursor:pointer; color:var(--text); }
  .gt-check.on { background:var(--accent); border-color:var(--accent); color:#14161A; }
  .gt-check.skipped { background:var(--warn); border-color:var(--warn); color:#14161A; }
  .gt-ex.skipped { border-color:var(--warn); }
  .gt-ex-detail { padding:0 12px 12px; border-top:1px solid var(--border); }
  .gt-ex-desc { color:var(--text-muted); font-size:13px; margin:10px 0; line-height:1.4; }
  .gt-ex-obs { color:var(--warn); font-size:12px; margin-bottom:10px; }
  .gt-sets-table { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
  .gt-sets-header { display:flex; gap:8px; font-size:11px; color:var(--text-muted); font-family:'Roboto Mono',monospace; padding-left:26px; }
  .gt-set-row { display:flex; align-items:center; gap:8px; }
  .gt-set-idx { width:18px; font-family:'Roboto Mono',monospace; font-size:12px; color:var(--text-muted); }
  .gt-set-row input { background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:8px; font-family:'Roboto Mono',monospace; font-size:14px; width:100%; text-align:center; }
  .gt-field-label { font-size:11px; color:var(--text-muted); margin-bottom:6px; letter-spacing:.02em; }
  .gt-comment { width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:9px; font-family:'Inter',sans-serif; font-size:13px; resize:vertical; min-height:48px; }
  .gt-atividade-body { padding:0 12px 14px; border-top:1px solid var(--border); }
  .gt-notes-list { margin-top:12px; }
  .gt-note-item { display:flex; gap:8px; font-size:12px; padding:6px 0; border-bottom:1px solid var(--border); }
  .gt-note-item:last-child { border-bottom:none; }
  .gt-note-item .d { color:var(--text-muted); font-family:'Roboto Mono',monospace; white-space:nowrap; }
  .gt-tabbar { position:fixed; bottom:0; left:0; right:0; max-width:480px; margin:0 auto; background:var(--surface); border-top:1px solid var(--border); display:flex; }
  .gt-tab { flex:1; padding:12px 0 10px; background:none; border:none; color:var(--text-muted); font-family:'Oswald',sans-serif; font-size:13px; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:3px; }
  .gt-tab.active { color:var(--accent); }
  .gt-tab .ic { font-size:17px; }
  .gt-section-title { font-family:'Roboto Mono',monospace; font-size:11px; letter-spacing:.03em; color:var(--text-muted); margin:22px 0 8px; }
  .gt-section-title:first-child { margin-top:0; }
  .gt-treinos-list { display:flex; flex-direction:column; gap:10px; }
  .gt-treino-item { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:14px; }
  .gt-treino-item .th { display:flex; justify-content:space-between; align-items:baseline; }
  .gt-treino-item .nm { font-family:'Oswald',sans-serif; font-size:16px; }
  .gt-treino-item .meta { color:var(--text-muted); font-size:12px; }
  .gt-treino-item .actions { display:flex; gap:14px; margin-top:10px; }
  .gt-treino-item .actions button { background:none; border:none; color:var(--accent); font-size:12px; cursor:pointer; padding:0; }
  .gt-treino-item .actions button.danger { color:var(--warn); }
  .gt-treino-detail { margin-top:10px; border-top:1px solid var(--border); padding-top:10px; }
  .gt-treino-detail .bloco-nm { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); margin:10px 0 4px; }
  .gt-treino-detail .ex-nm { font-size:13px; padding:3px 0; }
  .gt-notas { font-size:12px; color:var(--text-muted); margin-top:10px; padding-top:10px; border-top:1px solid var(--border); }
  .gt-btn { background:var(--accent); color:#14161A; border:none; border-radius:var(--radius); padding:12px; font-family:'Oswald',sans-serif; font-size:14px; font-weight:600; cursor:pointer; width:100%; }
  .gt-btn.secondary { background:var(--surface-2); color:var(--text); border:1px solid var(--border); }
  .gt-btn.small { padding:9px; font-size:12px; width:auto; }
  .gt-modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:flex-end; justify-content:center; z-index:50; }
  .gt-modal { background:var(--surface); border-top:1px solid var(--border); border-radius:12px 12px 0 0; padding:18px; width:100%; max-width:480px; max-height:85vh; overflow-y:auto; }
  .gt-modal h3 { font-family:'Oswald',sans-serif; font-size:18px; margin:0 0 4px; }
  .gt-modal p { color:var(--text-muted); font-size:12px; line-height:1.5; }
  .gt-modal textarea { width:100%; min-height:220px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:10px; font-family:'Roboto Mono',monospace; font-size:12px; margin:10px 0; }
  .gt-modal-actions { display:flex; gap:10px; margin-top:6px; }
  .gt-modal-actions button:first-child { flex:2; }
  .gt-modal-actions button:last-child { flex:1; }
  .gt-error { color:var(--warn); font-size:12px; margin-top:6px; }
  .gt-select { width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:9px; font-family:'Inter',sans-serif; font-size:13px; }
  .gt-agenda-day { margin-bottom:16px; }
  .gt-agenda-day .day-lbl { font-family:'Oswald',sans-serif; font-size:14px; margin-bottom:6px; }
  .gt-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
  .gt-chip { display:flex; align-items:center; gap:6px; background:var(--surface-2); border:1px solid var(--border); border-radius:14px; padding:5px 6px 5px 10px; font-size:12px; }
  .gt-chip .tag { font-family:'Roboto Mono',monospace; font-size:8px; color:var(--accent); }
  .gt-chip button { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:14px; padding:0 2px; }
  .gt-inline-form { display:flex; gap:6px; }
  .gt-inline-form select { flex:1; }
  .gt-atividades-list { display:flex; flex-direction:column; gap:8px; }
  .gt-atividade-row { display:flex; justify-content:space-between; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; }
  .gt-atividade-row .nm { font-size:13px; }
  .gt-atividade-row button { background:none; border:none; color:var(--warn); font-size:12px; cursor:pointer; }
  .gt-add-row { display:flex; gap:6px; margin-top:8px; }
  .gt-add-row input { flex:1; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:9px; font-size:13px; }
  .gt-empty { text-align:center; color:var(--text-muted); font-size:13px; padding:30px 10px; }
  .gt-toast { position:fixed; bottom:84px; left:50%; transform:translateX(-50%); background:var(--surface-2); border:1px solid var(--accent-dim); color:var(--accent); font-size:12px; padding:8px 14px; border-radius:20px; z-index:60; font-family:'Roboto Mono',monospace; }
  .gt-chart-tooltip { background:var(--surface-2); border:1px solid var(--border); padding:8px 10px; border-radius:4px; font-size:12px; }
  .gt-hist-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); font-size:12px; }
  .gt-hist-item:last-child { border-bottom:none; }
  .gt-hist-item .d { color:var(--text-muted); }
  .gt-hist-item .w { font-family:'Roboto Mono',monospace; }
  .gt-evo-tabs { display:flex; gap:8px; margin-bottom:12px; }
  .gt-evo-tabs button { flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text-muted); border-radius:var(--radius); padding:9px; font-family:'Oswald',sans-serif; font-size:13px; cursor:pointer; }
  .gt-evo-tabs button.active { color:var(--accent); border-color:var(--accent-dim); }
  .gt-rpe-modal p { color:var(--text-muted); font-size:12px; margin:0 0 14px; }
  .gt-rpe-duracao { width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:9px; font-family:'Roboto Mono',monospace; font-size:14px; margin-bottom:14px; }
  .gt-rpe-scale { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:8px; }
  .gt-rpe-btn { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:10px 0; font-family:'Roboto Mono',monospace; font-size:14px; cursor:pointer; }
  .gt-rpe-btn.on { background:var(--accent); border-color:var(--accent); color:#14161A; font-weight:700; }
  .gt-rpe-hint { color:var(--text-muted); font-size:11px; margin-bottom:16px; }
  .gt-acwr-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:14px; text-align:center; }
  .gt-acwr-ratio { font-family:'Oswald',sans-serif; font-size:40px; line-height:1; margin-bottom:4px; }
  .gt-acwr-zone { display:inline-block; font-family:'Roboto Mono',monospace; font-size:11px; letter-spacing:.02em; padding:4px 10px; border-radius:20px; margin-top:6px; }
  .gt-acwr-zone.good { background:rgba(198,241,53,.15); color:var(--accent); }
  .gt-acwr-zone.info { background:rgba(90,176,255,.15); color:var(--info); }
  .gt-acwr-zone.warn { background:rgba(255,90,54,.15); color:var(--warn); }
  .gt-acwr-zone.danger { background:rgba(255,90,54,.25); color:var(--warn); }
  .gt-acwr-zone.neutral { background:var(--surface-2); color:var(--text-muted); }
  .gt-acwr-sub { display:flex; justify-content:space-around; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }
  .gt-acwr-sub div { text-align:center; }
  .gt-acwr-sub .lbl { font-size:10px; color:var(--text-muted); letter-spacing:.03em; }
  .gt-acwr-sub .val { font-family:'Roboto Mono',monospace; font-size:16px; margin-top:2px; }
  .gt-acwr-explain { font-size:12px; color:var(--text-muted); line-height:1.5; }
  .gt-freq-periods { display:flex; gap:6px; margin-bottom:14px; overflow-x:auto; }
  .gt-freq-periods button { flex:0 0 auto; background:var(--surface); border:1px solid var(--border); color:var(--text-muted); border-radius:20px; padding:7px 14px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; white-space:nowrap; }
  .gt-freq-periods button.active { color:#14161A; background:var(--accent); border-color:var(--accent); }
  .gt-freq-summary { display:flex; gap:8px; margin-bottom:14px; }
  .gt-freq-stat { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:12px 8px; text-align:center; }
  .gt-freq-stat .val { font-family:'Oswald',sans-serif; font-size:24px; color:var(--accent); }
  .gt-freq-stat .lbl { font-size:9px; color:var(--text-muted); letter-spacing:.02em; margin-top:2px; }
  .gt-freq-avg-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
  .gt-freq-avg-value { font-family:'Oswald',sans-serif; font-size:22px; }
  .gt-freq-avg-value span { font-family:'Inter',sans-serif; font-size:12px; color:var(--text-muted); margin-left:6px; }
  .gt-item-tag.auto-done { background:transparent; border:1px solid var(--accent-dim); color:var(--accent); }
  .gt-focus-root { padding-bottom:0; }
  .gt-focus { display:flex; flex-direction:column; height:100vh; }
  .gt-focus-header { display:flex; align-items:center; gap:12px; padding:16px 14px 10px; flex-shrink:0; }
  .gt-focus-close { background:var(--surface); border:1px solid var(--border); color:var(--text); width:34px; height:34px; border-radius:50%; font-size:15px; cursor:pointer; flex-shrink:0; }
  .gt-focus-title-wrap { flex:1; min-width:0; }
  .gt-focus-title { font-family:'Oswald',sans-serif; font-size:19px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-focus-progress-label { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); margin-top:2px; }
  .gt-focus-progress-bar { flex:0 0 6px; height:6px; margin:0 14px 12px; }
  .gt-focus-body { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .gt-focus-footer { position:sticky; bottom:0; padding:12px 14px calc(12px + env(safe-area-inset-bottom)); background:var(--bg); border-top:1px solid var(--border); flex-shrink:0; }
`;

function App() {
  const [treinos, setTreinos] = useState(SEED_TREINOS);
  const [atividades, setAtividades] = useState(SEED_ATIVIDADES);
  const [schedule, setSchedule] = useState(SEED_SCHEDULE);
  const [sessions, setSessions] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("hoje");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [expandedItem, setExpandedItem] = useState(null);
  const [focusTreino, setFocusTreino] = useState(null);
  const [expandedEx, setExpandedEx] = useState(null);
  const [expandedTreinoId, setExpandedTreinoId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [editingTreinoId, setEditingTreinoId] = useState(null);
  const [toast, setToast] = useState("");
  const [evoTab, setEvoTab] = useState("exercicio");
  const [evoExercicio, setEvoExercicio] = useState("");
  const [evoAtividade, setEvoAtividade] = useState("");
  const [novaAtividade, setNovaAtividade] = useState("");
  const [addingExtra, setAddingExtra] = useState(false);
  const [extraTipo, setExtraTipo] = useState("treino");
  const [extraId, setExtraId] = useState("");
  const [rpeModal, setRpeModal] = useState(null); // { item, date, label, duracaoMin, rpe }
  const [freqPeriod, setFreqPeriod] = useState("30d"); // "7d" | "30d" | "12m" | "all"
  const [freqAvgUnit, setFreqAvgUnit] = useState("semana"); // "semana" | "mes"
  const toastTimer = useRef(null);
  const saveTimer = useRef({});
  const STORAGE_PREFIX = "treino-app:";

  useEffect(() => {
    let t, a, s, ss;
    try { t = localStorage.getItem(STORAGE_PREFIX + "treinos"); } catch (e) {}
    try { a = localStorage.getItem(STORAGE_PREFIX + "atividades"); } catch (e) {}
    try { s = localStorage.getItem(STORAGE_PREFIX + "schedule"); } catch (e) {}
    try { ss = localStorage.getItem(STORAGE_PREFIX + "sessions"); } catch (e) {}
    if (t) { try { setTreinos(JSON.parse(t)); } catch (e) {} }
    else { try { localStorage.setItem(STORAGE_PREFIX + "treinos", JSON.stringify(SEED_TREINOS)); } catch (e) {} }
    if (a) { try { setAtividades(JSON.parse(a)); } catch (e) {} }
    else { try { localStorage.setItem(STORAGE_PREFIX + "atividades", JSON.stringify(SEED_ATIVIDADES)); } catch (e) {} }
    if (s) { try { setSchedule(migrateSchedule(JSON.parse(s))); } catch (e) {} }
    else { try { localStorage.setItem(STORAGE_PREFIX + "schedule", JSON.stringify(SEED_SCHEDULE)); } catch (e) {} }
    if (ss) { try { setSessions(JSON.parse(ss)); } catch (e) {} }
    setLoaded(true);
  }, []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1600);
  }, []);

  const persist = useCallback((key, value, msg) => {
    clearTimeout(saveTimer.current[key]);
    saveTimer.current[key] = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        if (msg) showToast(msg);
      } catch (e) { showToast("Erro ao salvar"); }
    }, 300);
  }, [showToast]);

  const updateTreinos = (next) => { setTreinos(next); persist("treinos", next, "Treino salvo"); };
  const updateAtividades = (next) => { setAtividades(next); persist("atividades", next, "Salvo"); };
  const updateSchedule = (next) => { setSchedule(next); persist("schedule", next, "Agenda salva"); };
  const updateSessions = (next) => { setSessions(next); persist("sessions", next); };


  const treinoById = useCallback((id) => treinos.find((t) => t.id === id), [treinos]);
  const atividadeById = useCallback((id) => atividades.find((a) => a.id === id), [atividades]);

  const weekday = weekdayOf(selectedDate);
  const scheduledItems = schedule[weekday] || [];
  const daySession = sessions[selectedDate] || {};
  const extraItems = daySession.extras || [];
  const removedItems = daySession.removed || [];
  const isRemoved = (item) => removedItems.some((it) => it.tipo === item.tipo && it.id === item.id);
  const dayItems = [...scheduledItems.filter((it) => !isRemoved(it)), ...extraItems];
  const dayLog = daySession.log || {};

  useEffect(() => { setExpandedItem(null); setExpandedEx(null); setAddingExtra(false); }, [selectedDate]);

  function ensureSessionShape() {
    const s = sessions[selectedDate] || { log: {}, extras: [], removed: [] };
    return { log: {}, extras: [], removed: [], cargas: {}, ...s };
  }

  function sessionShapeFor(dateIso) {
    const s = sessions[dateIso] || { log: {}, extras: [], removed: [] };
    return { log: {}, extras: [], removed: [], cargas: {}, ...s };
  }

  function saveCarga(dateIso, item, duracaoMin, rpe) {
    const key = itemKey(item);
    const session = sessionShapeFor(dateIso);
    const nextCargas = { ...session.cargas, [key]: { duracaoMin, rpe, updatedAt: Date.now() } };
    updateSessions({ ...sessions, [dateIso]: { ...session, cargas: nextCargas } });
  }

  function patchItemLog(key, patch) {
    const session = ensureSessionShape();
    const nextLog = { ...session.log, [key]: { ...(session.log[key] || {}), ...patch } };
    updateSessions({ ...sessions, [selectedDate]: { ...session, log: nextLog } });
  }

  function cycleExercicioStatus(item, ex) {
    const key = itemKey(item);
    const treinoLog = dayLog[key] || {};
    const prevExLog = treinoLog[ex.id];
    const order = [undefined, "feito", "pulei"];
    const currentIdx = order.indexOf(prevExLog?.status);
    const status = order[(currentIdx + 1) % order.length];
    let sets = prevExLog?.sets;
    if (status === "feito" && (!sets || sets.length === 0)) {
      const repDefault = parseFirstNumber(ex.repeticoes);
      sets = Array.from({ length: ex.series || 1 }, () => ({ peso: "", reps: repDefault || "" }));
    }
    patchItemLog(key, { [ex.id]: { ...prevExLog, status, sets: sets || [] } });
  }

  function ensureSetsForExpand(item, ex) {
    const key = itemKey(item);
    const treinoLog = dayLog[key] || {};
    const prevExLog = treinoLog[ex.id];
    if (!prevExLog || !prevExLog.sets || prevExLog.sets.length === 0) {
      const repDefault = parseFirstNumber(ex.repeticoes);
      const sets = Array.from({ length: ex.series || 1 }, () => ({ peso: "", reps: repDefault || "" }));
      patchItemLog(key, { [ex.id]: { status: prevExLog?.status, comentario: prevExLog?.comentario || "", sets } });
    }
  }

  function updateSetField(item, ex, idx, field, value) {
    const key = itemKey(item);
    const treinoLog = dayLog[key] || {};
    const prevExLog = treinoLog[ex.id] || { status: undefined, comentario: "", sets: [] };
    const sets = prevExLog.sets.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    patchItemLog(key, { [ex.id]: { ...prevExLog, sets } });
  }

  function updateExComentario(item, ex, value) {
    const key = itemKey(item);
    const treinoLog = dayLog[key] || {};
    const prevExLog = treinoLog[ex.id] || { status: undefined, comentario: "", sets: [] };
    patchItemLog(key, { [ex.id]: { ...prevExLog, comentario: value } });
  }

  function setAtividadeStatus(item, status) {
    const key = itemKey(item);
    const prev = dayLog[key] || { status: undefined, comentario: "" };
    const session = ensureSessionShape();
    const nextStatus = prev.status === status ? undefined : status;
    const nextLog = { ...session.log, [key]: { ...prev, status: nextStatus } };
    updateSessions({ ...sessions, [selectedDate]: { ...session, log: nextLog } });
    if (status === "fui" && prev.status !== "fui") {
      const atividade = atividadeById(item.id);
      setRpeModal({ item, date: selectedDate, label: atividade ? atividade.nome : "atividade", duracaoMin: "", rpe: "" });
    }
  }

  function finishTreino(item, treino) {
    setFocusTreino(null);
    setExpandedEx(null);
    setRpeModal({ item, date: selectedDate, label: treino ? treino.nome : "treino", duracaoMin: "", rpe: "" });
  }

  function saveRpeModal() {
    if (!rpeModal) return;
    const dur = Number(rpeModal.duracaoMin);
    const rpe = Number(rpeModal.rpe);
    if (dur > 0 && rpe > 0) {
      saveCarga(rpeModal.date, rpeModal.item, dur, rpe);
      showToast("Carga registrada");
    }
    setRpeModal(null);
  }

  function updateAtividadeComentario(item, value) {
    const key = itemKey(item);
    const prev = dayLog[key] || { status: undefined, comentario: "" };
    const session = ensureSessionShape();
    const nextLog = { ...session.log, [key]: { ...prev, comentario: value } };
    updateSessions({ ...sessions, [selectedDate]: { ...session, log: nextLog } });
  }

  function addExtraForToday() {
    if (!extraId) return;
    const session = ensureSessionShape();
    const newItem = { tipo: extraTipo, id: extraId };
    const exists = [...scheduledItems.filter((it) => !isRemoved(it)), ...(session.extras || [])].some((it) => it.tipo === newItem.tipo && it.id === newItem.id);
    if (exists) { setAddingExtra(false); setExtraId(""); return; }
    const nextExtras = [...(session.extras || []), newItem];
    updateSessions({ ...sessions, [selectedDate]: { ...session, extras: nextExtras } });
    setAddingExtra(false);
    setExtraId("");
  }

  function removeForToday(item, isExtra) {
    const session = ensureSessionShape();
    if (isExtra) {
      const nextExtras = (session.extras || []).filter((it) => !(it.tipo === item.tipo && it.id === item.id));
      updateSessions({ ...sessions, [selectedDate]: { ...session, extras: nextExtras } });
    } else {
      const nextRemoved = [...(session.removed || []), { tipo: item.tipo, id: item.id }];
      updateSessions({ ...sessions, [selectedDate]: { ...session, removed: nextRemoved } });
    }
  }

  function restoreForToday(item) {
    const session = ensureSessionShape();
    const nextRemoved = (session.removed || []).filter((it) => !(it.tipo === item.tipo && it.id === item.id));
    updateSessions({ ...sessions, [selectedDate]: { ...session, removed: nextRemoved } });
  }

  function notesHistoryFor(atividadeId, excludeDate) {
    const key = `atividade:${atividadeId}`;
    return Object.entries(sessions)
      .filter(([date, s]) => date !== excludeDate && s.log?.[key]?.comentario)
      .map(([date, s]) => ({ date, label: formatDateLabel(date), comentario: s.log[key].comentario }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }

  function handleImport() {
    setImportError("");
    let raw;
    try { raw = JSON.parse(importText); } catch (e) { setImportError("JSON inválido — confira vírgulas e chaves."); return; }
    if (!raw || !Array.isArray(raw.blocos) || raw.blocos.length === 0) {
      setImportError('O JSON precisa ter "nome" e uma lista "blocos" com pelo menos um bloco.');
      return;
    }
    if (editingTreinoId) {
      const normalized = normalizeImportedTreino(raw, treinos.filter((t) => t.id !== editingTreinoId).map((t) => t.id));
      updateTreinos(treinos.map((t) => (t.id === editingTreinoId ? { ...normalized, id: editingTreinoId } : t)));
    } else {
      const normalized = normalizeImportedTreino(raw, treinos.map((t) => t.id));
      updateTreinos([...treinos, normalized]);
    }
    setImportOpen(false); setImportText(""); setEditingTreinoId(null);
  }

  function openImportNew() { setEditingTreinoId(null); setImportText(""); setImportError(""); setImportOpen(true); }
  function openImportEdit(treino) {
    setEditingTreinoId(treino.id); setImportError("");
    setImportText(JSON.stringify({
      nome: treino.nome, duracaoMin: treino.duracaoMin, notas: treino.notas,
      blocos: treino.blocos.map((b) => ({ nome: b.nome, exercicios: b.exercicios.map((e) => ({ nome: e.nome, series: e.series, repeticoes: e.repeticoes, descricao: e.descricao, observacoes: e.observacoes })) })),
    }, null, 2));
    setImportOpen(true);
  }

  function deleteTreino(id) {
    updateTreinos(treinos.filter((t) => t.id !== id));
    const nextSchedule = {};
    Object.entries(schedule).forEach(([day, items]) => { nextSchedule[day] = items.filter((it) => !(it.tipo === "treino" && it.id === id)); });
    updateSchedule(nextSchedule);
    if (expandedTreinoId === id) setExpandedTreinoId(null);
  }

  function addAtividade() {
    const nome = novaAtividade.trim();
    if (!nome) return;
    const id = slugify(nome);
    if (atividades.some((a) => a.id === id)) { setNovaAtividade(""); return; }
    updateAtividades([...atividades, { id, nome }]);
    setNovaAtividade("");
  }

  function deleteAtividade(id) {
    updateAtividades(atividades.filter((a) => a.id !== id));
    const nextSchedule = {};
    Object.entries(schedule).forEach(([day, items]) => { nextSchedule[day] = items.filter((it) => !(it.tipo === "atividade" && it.id === id)); });
    updateSchedule(nextSchedule);
  }

  function addToAgenda(day, tipo, id) {
    if (!id) return;
    const current = schedule[day] || [];
    if (current.some((it) => it.tipo === tipo && it.id === id)) return;
    updateSchedule({ ...schedule, [day]: [...current, { tipo, id }] });
  }
  function removeFromAgenda(day, item) {
    const current = schedule[day] || [];
    updateSchedule({ ...schedule, [day]: current.filter((it) => !(it.tipo === item.tipo && it.id === item.id)) });
  }

  const allExerciseNames = useMemo(() => {
    const map = new Map();
    treinos.forEach((t) => t.blocos.forEach((b) => b.exercicios.forEach((e) => { if (!map.has(e.nome)) map.set(e.nome, e.id); })));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [treinos]);

  useEffect(() => { if (!evoExercicio && allExerciseNames.length > 0) setEvoExercicio(allExerciseNames[0][1]); }, [allExerciseNames, evoExercicio]);
  useEffect(() => { if (!evoAtividade && atividades.length > 0) setEvoAtividade(atividades[0].id); }, [atividades, evoAtividade]);

  const evoData = useMemo(() => {
    if (!evoExercicio) return [];
    const points = [];
    Object.entries(sessions).forEach(([date, session]) => {
      Object.entries(session.log || {}).forEach(([key, log]) => {
        if (!key.startsWith("treino:")) return;
        const entry = log[evoExercicio];
        if (entry?.sets?.some((s) => s.peso !== "" && s.peso != null)) {
          const pesos = entry.sets.map((s) => Number(s.peso)).filter((n) => !isNaN(n));
          if (pesos.length) points.push({ date, pesoMax: Math.max(...pesos), label: formatDateLabel(date), comentario: entry.comentario, sets: entry.sets });
        }
      });
    });
    return points.sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, evoExercicio]);

  const atividadeNotes = useMemo(() => {
    if (!evoAtividade) return [];
    return notesHistoryFor(evoAtividade, null).sort((a, b) => b.date.localeCompare(a.date));
  }, [sessions, evoAtividade]);

  const acwrResult = useMemo(() => computeACWR(sessions, todayISO(), 7, 28), [sessions]);
  const acwrZoneInfo = useMemo(() => acwrZone(acwrResult.ratio), [acwrResult.ratio]);

  const earliestSessionIso = useMemo(() => {
    const dates = Object.keys(sessions).filter((d) => sessions[d]?.log && Object.keys(sessions[d].log).length > 0);
    return dates.length ? dates.sort()[0] : null;
  }, [sessions]);

  const freqRange = useMemo(
    () => periodRange(freqPeriod, todayISO(), earliestSessionIso),
    [freqPeriod, earliestSessionIso]
  );

  const freqStats = useMemo(
    () => computeFrequencyStats(sessions, treinos, atividades, freqRange.startIso, freqRange.endIso, freqAvgUnit),
    [sessions, treinos, atividades, freqRange, freqAvgUnit]
  );

  if (!loaded) return <div className="gt-root"><style>{APP_CSS}</style><div className="gt-empty">Carregando…</div></div>;

  if (focusTreino) {
    const treino = treinoById(focusTreino.id);
    if (treino) {
      const key = itemKey(focusTreino);
      const treinoLog = dayLog[key] || {};
      return (
        <div className="gt-root gt-focus-root">
          <style>{APP_CSS}</style>
          <TreinoFocusView
            treino={treino}
            item={focusTreino}
            treinoLog={treinoLog}
            expandedEx={expandedEx}
            setExpandedEx={setExpandedEx}
            ensureSetsForExpand={ensureSetsForExpand}
            updateSetField={updateSetField}
            updateExComentario={updateExComentario}
            cycleExercicioStatus={cycleExercicioStatus}
            onClose={() => { setFocusTreino(null); setExpandedEx(null); }}
            onFinish={() => finishTreino(focusTreino, treino)}
          />
          {rpeModal && (
            <RpeModal
              rpeModal={rpeModal}
              setRpeModal={setRpeModal}
              onSave={saveRpeModal}
              onSkip={() => setRpeModal(null)}
            />
          )}
          {toast && <div className="gt-toast">{toast}</div>}
        </div>
      );
    }
  }


  return (
    <div className="gt-root">
      <style>{APP_CSS}</style>
      <div className="gt-header">
        <div className="gt-eyebrow">FICHA DE TREINO</div>
        <div className="gt-title">{tab === "hoje" ? "Hoje" : tab === "treinos" ? "Treinos" : "Evolução"}</div>
      </div>

      <div className="gt-body">
        {tab === "hoje" && (
          <div>
            <div className="gt-daynav">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -1))}>‹</button>
              <div className="gt-day-center">
                <div className="wd">{DIAS[weekday]}</div>
                <div className="dt">{formatDateLabel(selectedDate)}{selectedDate === todayISO() ? " · hoje" : ""}</div>
              </div>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))}>›</button>
            </div>

            {dayItems.length === 0 && <div className="gt-empty">Nada na agenda pra este dia.</div>}

            {dayItems.map((item) => {
              const key = itemKey(item);
              const isExtra = !scheduledItems.some((it) => it.tipo === item.tipo && it.id === item.id);
              if (item.tipo === "treino") {
                const treino = treinoById(item.id);
                if (!treino) return null;
                const flat = flattenExercicios(treino);
                const treinoLog = dayLog[key] || {};
                const doneCount = flat.filter((ex) => treinoLog[ex.id]?.status === "feito").length;
                const skippedCount = flat.filter((ex) => treinoLog[ex.id]?.status === "pulei").length;
                const attended = doneCount > 0;
                return (
                  <div className={`gt-item-card ${doneCount === flat.length && flat.length > 0 ? "done" : ""}`} key={key}>
                    <div className="gt-item-row" onClick={() => setFocusTreino(item)}>
                      <span className="gt-item-tag treino">TREINO</span>
                      {attended && <span className="gt-item-tag auto-done" title="Contabilizado na frequência">✓ FEITO</span>}
                      <div className="gt-item-main">
                        <div className="gt-item-nm">{treino.nome}</div>
                        <div className="gt-item-meta">{doneCount}/{flat.length} exercícios{skippedCount > 0 ? ` · ${skippedCount} pulado${skippedCount > 1 ? "s" : ""}` : ""}</div>
                      </div>
                      <div className="gt-chevron">›</div>
                      <button className="gt-item-extra-x" title="Não fiz este treino hoje" onClick={(e) => { e.stopPropagation(); removeForToday(item, isExtra); }}>✕</button>
                    </div>
                  </div>
                );
              } else {
                const atividade = atividadeById(item.id);
                if (!atividade) return null;
                const log = dayLog[key] || {};
                const isOpen = expandedItem === key;
                const notes = notesHistoryFor(item.id, selectedDate);
                return (
                  <div className={`gt-item-card ${log.status === "fui" ? "done" : ""} ${log.status === "nao-fui" ? "skipped" : ""}`} key={key}>
                    <div className="gt-item-row" onClick={() => setExpandedItem(isOpen ? null : key)}>
                      <span className="gt-item-tag">ATIVIDADE</span>
                      <div className="gt-item-main">
                        <div className="gt-item-nm">{atividade.nome}</div>
                        {log.comentario && <div className="gt-item-meta">{log.comentario.slice(0, 40)}{log.comentario.length > 40 ? "…" : ""}</div>}
                      </div>
                      <div className="gt-chevron">{isOpen ? "▲" : "▼"}</div>
                      <div className="gt-status-toggle" onClick={(e) => e.stopPropagation()}>
                        <button className={`gt-status-btn fui ${log.status === "fui" ? "on" : ""}`} onClick={() => setAtividadeStatus(item, "fui")}>FUI</button>
                        <button className={`gt-status-btn nao ${log.status === "nao-fui" ? "on" : ""}`} onClick={() => setAtividadeStatus(item, "nao-fui")}>NÃO FUI</button>
                      </div>
                      <button className="gt-item-extra-x" title="Remover do dia" onClick={(e) => { e.stopPropagation(); removeForToday(item, isExtra); }}>✕</button>
                    </div>
                    {isOpen && (
                      <div className="gt-atividade-body">
                        <div className="gt-field-label" style={{ marginTop: 12 }}>COMENTÁRIO DO DIA</div>
                        <textarea className="gt-comment" placeholder="Ex: usei muito o ombro hoje, senti o joelho…" value={log.comentario || ""} onChange={(e) => updateAtividadeComentario(item, e.target.value)} />
                        {notes.length > 0 && (
                          <div className="gt-notes-list">
                            <div className="gt-field-label">NOTAS ANTERIORES</div>
                            {notes.map((n) => (
                              <div className="gt-note-item" key={n.date}><div className="d">{n.label}</div><div>{n.comentario}</div></div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            })}

            {removedItems.length > 0 && (
              <div className="gt-hidden-row">
                <div className="lbl">Removidos hoje (toque pra voltar):</div>
                {removedItems.map((it) => {
                  const nome = it.tipo === "treino" ? treinoById(it.id)?.nome : atividadeById(it.id)?.nome;
                  if (!nome) return null;
                  return <div className="gt-restore-chip" key={`${it.tipo}-${it.id}`} onClick={() => restoreForToday(it)}>↺ {nome}</div>;
                })}
              </div>
            )}

            {!addingExtra && (
              <button className="gt-btn secondary" onClick={() => { setAddingExtra(true); setExtraTipo("treino"); setExtraId(""); }}>+ Adicionar avulso pra hoje</button>
            )}
            {addingExtra && (
              <div className="gt-card">
                <div className="gt-inline-form" style={{ marginBottom: 8 }}>
                  <select className="gt-select" value={extraTipo} onChange={(e) => { setExtraTipo(e.target.value); setExtraId(""); }}>
                    <option value="treino">Treino</option>
                    <option value="atividade">Atividade</option>
                  </select>
                </div>
                <div className="gt-inline-form">
                  <select className="gt-select" value={extraId} onChange={(e) => setExtraId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {(extraTipo === "treino" ? treinos : atividades).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </div>
                <div className="gt-modal-actions" style={{ marginTop: 10 }}>
                  <button className="gt-btn" onClick={addExtraForToday}>Adicionar</button>
                  <button className="gt-btn secondary" onClick={() => setAddingExtra(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "treinos" && (
          <div>
            <div className="gt-section-title">AGENDA SEMANAL</div>
            {DIAS.map((dia, idx) => (
              <div className="gt-agenda-day" key={idx}>
                <div className="day-lbl">{dia}</div>
                <div className="gt-chips">
                  {(schedule[idx] || []).length === 0 && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>vazio</span>}
                  {(schedule[idx] || []).map((it) => {
                    const nome = it.tipo === "treino" ? treinoById(it.id)?.nome : atividadeById(it.id)?.nome;
                    if (!nome) return null;
                    return (
                      <div className="gt-chip" key={`${it.tipo}-${it.id}`}>
                        <span className="tag">{it.tipo === "treino" ? "T" : "A"}</span>{nome}
                        <button onClick={() => removeFromAgenda(idx, it)}>✕</button>
                      </div>
                    );
                  })}
                </div>
                <AgendaAdder day={idx} treinos={treinos} atividades={atividades} onAdd={addToAgenda} />
              </div>
            ))}

            <div className="gt-section-title">ATIVIDADES EXTERNAS</div>
            <div className="gt-atividades-list">
              {atividades.map((a) => (
                <div className="gt-atividade-row" key={a.id}>
                  <span className="nm">{a.nome}</span>
                  <button onClick={() => deleteAtividade(a.id)}>excluir</button>
                </div>
              ))}
            </div>
            <div className="gt-add-row">
              <input placeholder="Nova atividade (ex: Natação)" value={novaAtividade} onChange={(e) => setNovaAtividade(e.target.value)} />
              <button className="gt-btn small" onClick={addAtividade}>+ Add</button>
            </div>

            <div className="gt-section-title">TREINOS (FICHAS DE ACADEMIA)</div>
            <div className="gt-treinos-list">
              {treinos.length === 0 && <div className="gt-empty">Nenhum treino ainda.</div>}
              {treinos.map((t) => (
                <div className="gt-treino-item" key={t.id}>
                  <div className="th" onClick={() => setExpandedTreinoId(expandedTreinoId === t.id ? null : t.id)} style={{ cursor: "pointer" }}>
                    <div className="nm">{t.nome}</div>
                    <div className="meta">{flattenExercicios(t).length} ex.</div>
                  </div>
                  <div className="meta">{t.duracaoMin ? `~${t.duracaoMin} min` : ""}</div>
                  {expandedTreinoId === t.id && (
                    <div className="gt-treino-detail">
                      {t.blocos.map((b, i) => (
                        <div key={i}>
                          <div className="bloco-nm">{b.nome.toUpperCase()}</div>
                          {b.exercicios.map((e) => <div className="ex-nm" key={e.id}>{e.nome} — {e.series}x {e.repeticoes}</div>)}
                        </div>
                      ))}
                      {t.notas && <div className="gt-notas">{t.notas}</div>}
                    </div>
                  )}
                  <div className="actions">
                    <button onClick={() => openImportEdit(t)}>editar (JSON)</button>
                    <button className="danger" onClick={() => { if (confirm(`Excluir "${t.nome}"?`)) deleteTreino(t.id); }}>excluir</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="gt-btn secondary" onClick={openImportNew}>+ Importar treino (JSON)</button>
            </div>
          </div>
        )}

        {tab === "evolucao" && (
          <div>
            <div className="gt-evo-tabs">
              <button className={evoTab === "exercicio" ? "active" : ""} onClick={() => setEvoTab("exercicio")}>Peso por exercício</button>
              <button className={evoTab === "atividade" ? "active" : ""} onClick={() => setEvoTab("atividade")}>Notas de atividade</button>
              <button className={evoTab === "carga" ? "active" : ""} onClick={() => setEvoTab("carga")}>Carga (ACWR)</button>
              <button className={evoTab === "frequencia" ? "active" : ""} onClick={() => setEvoTab("frequencia")}>Frequência</button>
            </div>

            {evoTab === "exercicio" && (
              <div>
                <div className="gt-card">
                  <div className="gt-field-label" style={{ marginBottom: 8 }}>EXERCÍCIO</div>
                  <select className="gt-select" value={evoExercicio} onChange={(e) => setEvoExercicio(e.target.value)}>
                    {allExerciseNames.map(([nome, id]) => <option key={id} value={id}>{nome}</option>)}
                  </select>
                </div>
                {evoData.length === 0 ? (
                  <div className="gt-empty">Ainda sem registros de peso para este exercício.</div>
                ) : (
                  <div className="gt-card">
                    <SimpleLineChart data={evoData} />
                  </div>
                )}
                {evoData.length > 0 && (
                  <div className="gt-card">
                    <div className="gt-field-label" style={{ marginBottom: 6 }}>HISTÓRICO</div>
                    {evoData.slice().reverse().map((p) => (
                      <div className="gt-hist-item" key={p.date}>
                        <div className="d">{p.label}{p.comentario ? ` — ${p.comentario}` : ""}</div>
                        <div className="w">{p.sets.map((s) => `${s.peso || 0}kg×${s.reps || 0}`).join(" / ")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {evoTab === "atividade" && (
              <div>
                <div className="gt-card">
                  <div className="gt-field-label" style={{ marginBottom: 8 }}>ATIVIDADE</div>
                  <select className="gt-select" value={evoAtividade} onChange={(e) => setEvoAtividade(e.target.value)}>
                    {atividades.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
                {atividadeNotes.length === 0 ? (
                  <div className="gt-empty">Ainda sem notas registradas para esta atividade.</div>
                ) : (
                  <div className="gt-card">
                    <div className="gt-field-label" style={{ marginBottom: 6 }}>NOTAS</div>
                    {atividadeNotes.map((n) => (
                      <div className="gt-hist-item" key={n.date}><div className="d">{n.label}</div><div className="w" style={{ maxWidth: "60%", textAlign: "right" }}>{n.comentario}</div></div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {evoTab === "carga" && (
              <div>
                <div className="gt-acwr-card">
                  <div className="gt-field-label">CARGA AGUDA ÷ CARGA CRÔNICA</div>
                  <div className="gt-acwr-ratio">{acwrResult.ratio == null ? "—" : acwrResult.ratio.toFixed(2)}</div>
                  <div className={`gt-acwr-zone ${acwrZoneInfo.tone}`}>{acwrZoneInfo.label}</div>
                  <div className="gt-acwr-sub">
                    <div>
                      <div className="lbl">AGUDA (7D)</div>
                      <div className="val">{Math.round(acwrResult.acute)}</div>
                    </div>
                    <div>
                      <div className="lbl">CRÔNICA (28D)</div>
                      <div className="val">{Math.round(acwrResult.chronic)}</div>
                    </div>
                  </div>
                </div>
                <div className="gt-card">
                  <LoadChart series={acwrResult.series} acuteDays={7} />
                </div>
                <div className="gt-card gt-acwr-explain">
                  Carga de cada sessão = duração (min) × esforço percebido (RPE 0-10), somando todos os treinos e atividades do dia — assim dá pra comparar academia, vôlei, CrossFit e Hyrox na mesma escala.
                  <br /><br />
                  <b>Zona ideal:</b> 0.8–1.3 (carga aguda condizente com o condicionamento de base).
                  <br />
                  <b>Atenção:</b> 1.3–1.5 (carga subindo rápido demais).
                  <br />
                  <b>Risco alto:</b> acima de 1.5 (pico de carga muito acima do que o corpo está condicionado a aguentar — maior chance de lesão).
                  <br />
                  <b>Abaixo de 0.8:</b> pode indicar destreino (carga recente bem menor que o costume).
                </div>
              </div>
            )}

            {evoTab === "frequencia" && (
              <div>
                <div className="gt-freq-periods">
                  {[["7d", "7 dias"], ["30d", "Mês"], ["12m", "12 meses"], ["all", "Desde sempre"]].map(([id, label]) => (
                    <button key={id} className={freqPeriod === id ? "active" : ""} onClick={() => setFreqPeriod(id)}>{label}</button>
                  ))}
                </div>

                <div className="gt-freq-summary">
                  <div className="gt-freq-stat">
                    <div className="val">{freqStats.totalSessions}</div>
                    <div className="lbl">TREINOS/ATIVIDADES</div>
                  </div>
                  <div className="gt-freq-stat">
                    <div className="val">{freqStats.totalDays}</div>
                    <div className="lbl">DIAS DISTINTOS</div>
                  </div>
                  <div className="gt-freq-stat">
                    <div className="val">{freqStats.totalMinutes ? `${Math.round(freqStats.totalMinutes / 60 * 10) / 10}h` : "—"}</div>
                    <div className="lbl">TEMPO TOTAL</div>
                  </div>
                </div>

                <div className="gt-card">
                  <div className="gt-freq-avg-row">
                    <div className="gt-field-label">MÉDIA POR</div>
                    <div className="gt-evo-tabs" style={{ margin: 0, flex: "0 0 auto" }}>
                      <button className={freqAvgUnit === "semana" ? "active" : ""} onClick={() => setFreqAvgUnit("semana")}>Semana</button>
                      <button className={freqAvgUnit === "mes" ? "active" : ""} onClick={() => setFreqAvgUnit("mes")}>Mês</button>
                    </div>
                  </div>
                  <div className="gt-freq-avg-value">{freqStats.avgPerBucket.toFixed(1)} <span>treinos/{freqAvgUnit === "mes" ? "mês" : "semana"} em média</span></div>
                </div>

                <div className="gt-card">
                  <FrequencyChart series={freqStats.series} unit={freqAvgUnit} />
                </div>

                <div className="gt-card">
                  <div className="gt-field-label" style={{ marginBottom: 6 }}>POR TIPO</div>
                  {freqStats.perTypeList.length === 0 ? (
                    <div className="gt-empty">Nada registrado nesse período ainda.</div>
                  ) : (
                    freqStats.perTypeList.map((p, i) => (
                      <div className="gt-hist-item" key={i}>
                        <div className="d">{p.nome}</div>
                        <div className="w">{p.count}x{p.minutes > 0 ? ` · ${Math.round(p.minutes / 60 * 10) / 10}h` : ""}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="gt-tabbar">
        <button className={`gt-tab ${tab === "hoje" ? "active" : ""}`} onClick={() => setTab("hoje")}><span className="ic">●</span>Hoje</button>
        <button className={`gt-tab ${tab === "treinos" ? "active" : ""}`} onClick={() => setTab("treinos")}><span className="ic">▤</span>Treinos</button>
        <button className={`gt-tab ${tab === "evolucao" ? "active" : ""}`} onClick={() => setTab("evolucao")}><span className="ic">↗</span>Evolução</button>
      </div>

      {toast && <div className="gt-toast">{toast}</div>}

      {rpeModal && (
        <RpeModal
          rpeModal={rpeModal}
          setRpeModal={setRpeModal}
          onSave={saveRpeModal}
          onSkip={() => setRpeModal(null)}
        />
      )}

      {importOpen && (
        <div className="gt-modal-backdrop" onClick={() => { setImportOpen(false); setEditingTreinoId(null); }}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTreinoId ? "Editar treino (JSON)" : "Importar treino (JSON)"}</h3>
            <p>Cole aqui o JSON do treino — pode pedir pro Claude gerar nesse formato:</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={EXEMPLO_JSON} spellCheck={false} />
            {importError && <div className="gt-error">{importError}</div>}
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={handleImport}>{editingTreinoId ? "Salvar alterações" : "Importar"}</button>
              <button className="gt-btn secondary" onClick={() => { setImportOpen(false); setEditingTreinoId(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreinoFocusView({ treino, item, treinoLog, expandedEx, setExpandedEx, ensureSetsForExpand, updateSetField, updateExComentario, cycleExercicioStatus, onClose, onFinish }) {
  const flat = flattenExercicios(treino);
  const doneCount = flat.filter((ex) => treinoLog[ex.id]?.status === "feito").length;
  const skippedCount = flat.filter((ex) => treinoLog[ex.id]?.status === "pulei").length;
  const key = itemKey(item);

  return (
    <div className="gt-focus">
      <div className="gt-focus-header">
        <button className="gt-focus-close" onClick={onClose}>✕</button>
        <div className="gt-focus-title-wrap">
          <div className="gt-focus-title">{treino.nome}</div>
          <div className="gt-focus-progress-label">{doneCount}/{flat.length} exercícios{skippedCount > 0 ? ` · ${skippedCount} pulado${skippedCount > 1 ? "s" : ""}` : ""}</div>
        </div>
      </div>
      <div className="gt-progress-bar gt-focus-progress-bar">
        <div className="gt-progress-fill" style={{ width: `${flat.length ? (doneCount / flat.length) * 100 : 0}%` }} />
      </div>

      <div className="gt-focus-body">
        {groupByBloco(flat).map((bloco) => (
          <div className="gt-bloco" key={bloco.nome}>
            <div className="gt-bloco-title">{bloco.nome.toUpperCase()}</div>
            {bloco.exercicios.map((ex) => {
              const exLog = treinoLog[ex.id];
              const exOpen = expandedEx === `${key}#${ex.id}`;
              return (
                <div className={`gt-ex ${exLog?.status === "feito" ? "done" : ""} ${exLog?.status === "pulei" ? "skipped" : ""}`} key={ex.id}>
                  <div className="gt-ex-row" onClick={() => {
                    const next = exOpen ? null : `${key}#${ex.id}`;
                    setExpandedEx(next);
                    if (!exOpen) ensureSetsForExpand(item, ex);
                  }}>
                    <div className="gt-ex-pos">{String(ex.posicao).padStart(2, "0")}</div>
                    <div className="gt-ex-main">
                      <div className="gt-ex-nm">{ex.nome}</div>
                      <div className="gt-ex-target">{ex.series}x {ex.repeticoes}</div>
                    </div>
                    <div className="gt-chevron">{exOpen ? "▲" : "▼"}</div>
                    <button
                      className={`gt-check ${exLog?.status === "feito" ? "on" : ""} ${exLog?.status === "pulei" ? "skipped" : ""}`}
                      title="Toque pra alternar: feito / pulei / em branco"
                      onClick={(e) => { e.stopPropagation(); cycleExercicioStatus(item, ex); }}
                    >
                      {exLog?.status === "feito" ? "✓" : exLog?.status === "pulei" ? "✕" : ""}
                    </button>
                  </div>
                  {exOpen && (
                    <div className="gt-ex-detail">
                      {ex.descricao && <div className="gt-ex-desc">{ex.descricao}</div>}
                      {ex.observacoes && <div className="gt-ex-obs">⚠ {ex.observacoes}</div>}
                      <div className="gt-field-label">SÉRIES</div>
                      <div className="gt-sets-table">
                        <div className="gt-sets-header"><div style={{ width: 18 }} /><div style={{ flex: 1 }}>Peso (kg)</div><div style={{ flex: 1 }}>Reps</div></div>
                        {(exLog?.sets || []).map((s, idx) => (
                          <div className="gt-set-row" key={idx}>
                            <div className="gt-set-idx">{idx + 1}</div>
                            <input type="number" inputMode="decimal" placeholder="0" value={s.peso} onChange={(e) => updateSetField(item, ex, idx, "peso", e.target.value)} />
                            <input type="number" inputMode="numeric" placeholder="0" value={s.reps} onChange={(e) => updateSetField(item, ex, idx, "reps", e.target.value)} />
                          </div>
                        ))}
                      </div>
                      <div className="gt-field-label">COMENTÁRIO</div>
                      <textarea className="gt-comment" placeholder="Como foi? Alguma dor, ajuste de carga…" value={exLog?.comentario || ""} onChange={(e) => updateExComentario(item, ex, e.target.value)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div style={{ height: 76 }} />
      </div>

      <div className="gt-focus-footer">
        <button className="gt-btn" onClick={onFinish}>Concluir treino</button>
      </div>
    </div>
  );
}

function RpeModal({ rpeModal, setRpeModal, onSave, onSkip }) {
  const rpeOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const canSave = Number(rpeModal.duracaoMin) > 0 && Number(rpeModal.rpe) > 0;
  return (
    <div className="gt-modal-backdrop" onClick={onSkip}>
      <div className="gt-modal gt-rpe-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Como foi "{rpeModal.label}"?</h3>
        <p>Isso alimenta o controle de carga (aguda/crônica) — leva 10 segundos.</p>
        <div className="gt-field-label">DURAÇÃO (MIN)</div>
        <input
          type="number"
          inputMode="numeric"
          placeholder="ex: 60"
          className="gt-rpe-duracao"
          value={rpeModal.duracaoMin}
          onChange={(e) => setRpeModal({ ...rpeModal, duracaoMin: e.target.value })}
        />
        <div className="gt-field-label">ESFORÇO PERCEBIDO (RPE 0-10)</div>
        <div className="gt-rpe-scale">
          {rpeOptions.map((n) => (
            <button
              key={n}
              type="button"
              className={`gt-rpe-btn ${Number(rpeModal.rpe) === n ? "on" : ""}`}
              onClick={() => setRpeModal({ ...rpeModal, rpe: n })}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="gt-rpe-hint">1 = muito leve · 5 = moderado · 10 = esforço máximo</div>
        <div className="gt-modal-actions">
          <button className="gt-btn" disabled={!canSave} onClick={onSave}>Salvar</button>
          <button className="gt-btn secondary" onClick={onSkip}>Pular por agora</button>
        </div>
      </div>
    </div>
  );
}

function AgendaAdder({ day, treinos, atividades, onAdd }) {
  const [tipo, setTipo] = useState("atividade");
  const [id, setId] = useState("");
  const opts = tipo === "treino" ? treinos : atividades;
  return (
    <div className="gt-inline-form">
      <select className="gt-select" style={{ flex: "0 0 90px" }} value={tipo} onChange={(e) => { setTipo(e.target.value); setId(""); }}>
        <option value="atividade">Atividade</option>
        <option value="treino">Treino</option>
      </select>
      <select className="gt-select" value={id} onChange={(e) => { onAdd(day, tipo, e.target.value); setId(""); }}>
        <option value="">+ adicionar…</option>
        {opts.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
      </select>
    </div>
  );
}

function SimpleLineChart({ data }) {
  const W = 320, H = 170, PAD_L = 34, PAD_R = 12, PAD_T = 14, PAD_B = 24;
  const [hover, setHover] = useState(null);
  const values = data.map((d) => d.pesoMax);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const yFor = (v) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);
  const xFor = (i) => data.length === 1 ? (W - PAD_L - PAD_R) / 2 + PAD_L : PAD_L + (i / (data.length - 1)) * (W - PAD_L - PAD_R);
  const points = data.map((d, i) => `${xFor(i)},${yFor(d.pesoMax)}`).join(" ");
  const gridLines = [0, 0.5, 1].map((t) => PAD_T + t * (H - PAD_T - PAD_B));

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180, overflow: "visible" }}>
        {gridLines.map((y, i) => <line key={i} x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#2C3038" strokeWidth="1" />)}
        <text x={4} y={yFor(max) + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">{Math.round(max)}</text>
        <text x={4} y={yFor(min) + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">{Math.round(min)}</text>
        <polyline points={points} fill="none" stroke="#C6F135" strokeWidth="2" />
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xFor(i)} cy={yFor(d.pesoMax)} r={hover === i ? 5 : 3.5} fill="#C6F135"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
              style={{ cursor: "pointer" }}
            />
            {data.length <= 8 && (
              <text x={xFor(i)} y={H - 6} fontSize="9" fill="#9AA0A6" textAnchor="middle" fontFamily="Roboto Mono, monospace">{d.label.split(" ")[0]}</text>
            )}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="gt-chart-tooltip" style={{ display: "inline-block" }}>
          <div>{data[hover].label}</div>
          <div style={{ color: "#C6F135" }}>{data[hover].pesoMax} kg</div>
        </div>
      )}
    </div>
  );
}

function LoadChart({ series, acuteDays = 7 }) {
  const W = 320, H = 170, PAD_L = 34, PAD_R = 12, PAD_T = 14, PAD_B = 24;
  const [hover, setHover] = useState(null);
  const loads = series.map((d) => d.load);
  const max = Math.max(1, ...loads);
  const barW = (W - PAD_L - PAD_R) / series.length;
  const yFor = (v) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const xFor = (i) => PAD_L + i * barW;

  // Linha de carga aguda: média móvel dos últimos `acuteDays` dias, calculada
  // dia a dia ao longo da série (não só o valor final) pra dar contexto visual.
  const acuteLine = series.map((_, i) => {
    const start = Math.max(0, i - acuteDays + 1);
    const slice = series.slice(start, i + 1);
    return slice.reduce((s, d) => s + d.load, 0) / slice.length;
  });
  const linePoints = acuteLine.map((v, i) => `${xFor(i) + barW / 2},${yFor(v)}`).join(" ");

  return (
    <div style={{ width: "100%" }}>
      <div className="gt-field-label" style={{ marginBottom: 8 }}>CARGA DIÁRIA (últimos {series.length} dias) · linha = média móvel {acuteDays}d</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180, overflow: "visible" }}>
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T} y2={PAD_T} stroke="#2C3038" strokeWidth="1" />
        <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#2C3038" strokeWidth="1" />
        <text x={4} y={PAD_T + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">{Math.round(max)}</text>
        <text x={4} y={H - PAD_B + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">0</text>
        {series.map((d, i) => (
          <rect
            key={d.date}
            x={xFor(i) + 1} y={yFor(d.load)} width={Math.max(1, barW - 2)} height={Math.max(0, H - PAD_B - yFor(d.load))}
            fill={hover === i ? "#F2F3F1" : "#3A3F47"}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
            style={{ cursor: "pointer" }}
          />
        ))}
        <polyline points={linePoints} fill="none" stroke="#C6F135" strokeWidth="2" />
      </svg>
      {hover !== null && (
        <div className="gt-chart-tooltip" style={{ display: "inline-block" }}>
          <div>{formatDateLabel(series[hover].date)}</div>
          <div style={{ color: "#C6F135" }}>carga: {Math.round(series[hover].load)}</div>
        </div>
      )}
    </div>
  );
}

function FrequencyChart({ series, unit }) {
  const W = 320, H = 170, PAD_L = 28, PAD_R = 12, PAD_T = 14, PAD_B = 24;
  const [hover, setHover] = useState(null);
  const counts = series.map((d) => d.count);
  const max = Math.max(1, ...counts);
  const barW = series.length ? (W - PAD_L - PAD_R) / series.length : W - PAD_L - PAD_R;
  const yFor = (v) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
  const xFor = (i) => PAD_L + i * barW;

  // Linha de "evolução da média": média móvel de 4 buckets (4 semanas ou 4
  // meses), calculada ponto a ponto ao longo da série — mostra se a
  // consistência está subindo, caindo ou estável, não só a foto do período.
  const rollWindow = 4;
  const rollLine = series.map((_, i) => {
    const start = Math.max(0, i - rollWindow + 1);
    const slice = series.slice(start, i + 1);
    return slice.reduce((s, d) => s + d.count, 0) / slice.length;
  });
  const linePoints = rollLine.map((v, i) => `${xFor(i) + barW / 2},${yFor(v)}`).join(" ");

  return (
    <div style={{ width: "100%" }}>
      <div className="gt-field-label" style={{ marginBottom: 8 }}>
        TREINOS POR {unit === "mes" ? "MÊS" : "SEMANA"} · linha = média móvel de {rollWindow} {unit === "mes" ? "meses" : "semanas"}
      </div>
      {series.length === 0 ? (
        <div className="gt-empty">Sem dados nesse período.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180, overflow: "visible" }}>
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T} y2={PAD_T} stroke="#2C3038" strokeWidth="1" />
          <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#2C3038" strokeWidth="1" />
          <text x={2} y={PAD_T + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">{Math.round(max)}</text>
          <text x={2} y={H - PAD_B + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">0</text>
          {series.map((d, i) => (
            <rect
              key={d.key}
              x={xFor(i) + 1} y={yFor(d.count)} width={Math.max(1, barW - 2)} height={Math.max(0, H - PAD_B - yFor(d.count))}
              fill={hover === i ? "#F2F3F1" : "#3A3F47"}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
              style={{ cursor: "pointer" }}
            />
          ))}
          <polyline points={linePoints} fill="none" stroke="#C6F135" strokeWidth="2" />
        </svg>
      )}
      {hover !== null && (
        <div className="gt-chart-tooltip" style={{ display: "inline-block" }}>
          <div>{series[hover].label}</div>
          <div style={{ color: "#C6F135" }}>{series[hover].count} treino{series[hover].count === 1 ? "" : "s"}</div>
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Erro capturado pelo ErrorBoundary:", error, info);
    if (typeof showBootError === "function") {
      showBootError((error && error.stack) || String(error));
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, fontFamily: "monospace", color: "#FF5A36", background: "#14161A", minHeight: "100vh" }}>
          <div style={{ marginBottom: 10, fontWeight: "bold" }}>Erro ao renderizar o app:</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{String((this.state.error && this.state.error.stack) || this.state.error)}</div>
          <div style={{ marginTop: 16, color: "#9AA0A6", fontSize: 12 }}>Tira um print desta tela inteira e manda pro Claude.</div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById("root");
ReactDOM.createRoot(rootEl).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);


