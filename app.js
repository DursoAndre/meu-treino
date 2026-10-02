const { useState, useEffect, useMemo, useCallback, useRef } = React;

// --- Supabase (login + sincronização em nuvem) ---
// A URL e a chave "publishable" (antiga "anon key") são seguras de expor no
// frontend — o acesso real aos dados é controlado pelas políticas de RLS no
// banco, não pelo sigilo dessa chave.
const SUPABASE_URL = "https://wgdhjkebfvcmgokxscvb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_W0cKrWrtCwCp1XjNl1JFqQ_myok_WPk";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Único e-mail que enxerga a tela de "Uso" (admin) em Configurações. As
// funções admin_usage_stats/admin_client_errors no banco também conferem
// isso do lado do servidor — não é só um "esconder botão".
const ADMIN_EMAIL = "ardurso@gmail.com";

// --- Strava (sincronização opcional de atividades) ---
// Client ID é público (identificador OAuth padrão, seguro de expor). O
// Client Secret NUNCA entra aqui — ele mora só como variável de ambiente
// nas Edge Functions do Supabase (strava-connect/strava-sync).
const STRAVA_CLIENT_ID = "282598";
function stravaAuthorizeUrl() {
  const redirectUri = window.location.origin + window.location.pathname;
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read_all",
  });
  return "https://www.strava.com/oauth/authorize?" + params.toString();
}

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
          "observacoes": "Comentário fixo, ex: cuidado com o joelho (opcional)",
          "videoUrl": "Link do YouTube demonstrando o exercício (opcional)"
        }
      ]
    }
  ]
}`;

const PROMPT_FORMATO_TREINO = `Gere uma ficha de treino no formato JSON abaixo (sem comentários, sem texto fora do JSON). Não inclua "id" em nada — o app gera sozinho a partir do nome. Pode ter quantos blocos e exercícios forem necessários.

Formato (um treino só):
${EXEMPLO_JSON}

Se eu pedir mais de um treino (ex: treino de perna e treino de costas), gere uma LISTA com um objeto desses pra cada treino, assim: [ {...treino 1}, {...treino 2} ].

Sobre "videoUrl": tente buscar e incluir, mesmo que eu não peça, um link do YouTube demonstrando cada exercício — isso ajuda bastante. Mas só preencha quando for um exercício bem conhecido e você tiver certeza de que o vídeo é real e realmente mostra esse exercício específico (ex: "agachamento livre", "supino reto com halteres"). Se não tiver certeza, se o exercício for muito específico/incomum, ou se você não conseguir confirmar um vídeo de verdade pra ele, deixe "videoUrl" vazio ("") ou não inclua o campo — não invente ou chute um link. Prefiro sem vídeo a um link errado; eu adiciono manualmente depois se quiser.

Treino(s) que eu quero (descreva aqui: nome de cada treino, os blocos/grupos musculares, e pra cada exercício o nome, séries, repetições, e observações se tiver):
`;

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "item";
}

// Aceita qualquer formato comum de link do YouTube (watch?v=, youtu.be/,
// shorts/, embed/, com ou sem par\u00e2metros extras como &t= ou &list=) e
// devolve s\u00f3 o ID do v\u00eddeo, pra montar o player embutido. Devolve null se
// n\u00e3o reconhecer o link (o app ent\u00e3o some com o bot\u00e3o de v\u00eddeo).
function extractYoutubeId(url) {
  if (!url) return null;
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{6,15})/);
  return m ? m[1] : null;
}
// Remove acentos e baixa a caixa, pra buscar "triceps" e achar "Tríceps" —
// a maioria dos teclados de celular não digita acento por padrão.
function normalizeSearch(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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
function dayOfMonth(iso) { return Number(iso.split("-")[2]); }

// --- Usado na tira de dias da semana e no resumo de sequência: um dia
// "teve atividade" se pelo menos um exercício de treino foi marcado
// "feito", ou uma atividade foi marcada "fui" naquele dia. Atividades
// marcadas como "descanso" (ex: dia de rest) ficam registradas no dia
// mas não contam pra sequência nem pra "dias ativos" — são o oposto de
// um dia ativo, não mais um. ---
function dayHasActivity(sessions, dateIso, atividadeById) {
  const log = (sessions[dateIso] && sessions[dateIso].log) || {};
  return Object.keys(log).some((k) => {
    const v = log[k];
    if (!v) return false;
    if (k.indexOf("treino:") === 0) return Object.values(v).some((ex) => ex && ex.status === "feito");
    if (v.status !== "fui") return false;
    if (atividadeById && k.indexOf("atividade:") === 0) {
      const atividade = atividadeById(k.slice("atividade:".length));
      if (atividade && atividade.descanso) return false;
    }
    return true;
  });
}

// --- Sequência atual: conta dias consecutivos com atividade, terminando
// hoje (se já tiver algo) ou ontem (se hoje ainda não foi registrado —
// a sequência continua "viva" até o dia acabar). ---
function computeStreak(sessions, todayIso, atividadeById) {
  let streak = 0;
  let cursor = todayIso;
  if (dayHasActivity(sessions, todayIso, atividadeById)) {
    streak = 1;
    cursor = addDays(todayIso, -1);
  } else {
    cursor = addDays(todayIso, -1);
  }
  while (dayHasActivity(sessions, cursor, atividadeById)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// --- Status de um dia pra tira da semana: "rest" (nada agendado/avulso),
// "pending" (tem coisa marcada mas nada feito ainda), "partial" (algumas
// coisas feitas) ou "done" (tudo feito). ---
function dayStripStatus(dateIso, schedule, sessions, treinoById, atividadeById) {
  const wd = weekdayOf(dateIso);
  const daySession = sessions[dateIso] || {};
  const removed = daySession.removed || [];
  const isRemoved = (item) => removed.some((it) => it.tipo === item.tipo && it.id === item.id);
  const scheduled = (schedule[wd] || []).filter((it) => !isRemoved(it));
  const extras = daySession.extras || [];
  const items = [...scheduled, ...extras];
  if (items.length === 0) return "rest";
  const log = daySession.log || {};
  let doneCount = 0;
  items.forEach((item) => {
    const key = itemKey(item);
    if (item.tipo === "treino") {
      const treino = treinoById(item.id);
      if (!treino) return;
      const flat = flattenExercicios(treino);
      const exLog = log[key] || {};
      if (flat.some((ex) => exLog[ex.id]?.status === "feito")) doneCount++;
    } else {
      if ((log[key] || {}).status === "fui") doneCount++;
    }
  });
  if (doneCount === 0) return "pending";
  if (doneCount === items.length) return "done";
  return "partial";
}

// --- Marca Movo: três barras crescentes + ponto de destaque (a mesma forma
// do ícone do app), usada em qualquer lugar que precise do logo. ---
function MovoIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="36" y="126" width="44" height="74" rx="14" fill="currentColor" />
      <rect x="98" y="86" width="44" height="114" rx="14" fill="currentColor" />
      <rect x="160" y="46" width="44" height="154" rx="14" fill="currentColor" />
      <circle cx="182" cy="25" r="13" fill="currentColor" />
    </svg>
  );
}
function MovoLockup({ size = 18, big = false }) {
  return (
    <div className={big ? "gt-brand lg" : "gt-brand"}>
      <MovoIcon size={size} />
      <span className="gt-brand-name">movo</span>
    </div>
  );
}

// Marca simplificada (não é o vetor oficial) só pra dar identidade visual
// de "isso é integração com o Strava" nos botões de conectar/sincronizar.
function StravaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M13.1 2L6.6 14.8h3.9l2.6-5.1 2.6 5.1h3.9L13.1 2z" fill="#FC4C02" />
      <path d="M11.3 14.8l-1.9 3.7h3l1.9-3.7z" fill="#FC4C02" />
    </svg>
  );
}

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

// Média de "dor pós-sessão" (0-10, opcional — sugestão do fisio do Andre)
// entre os itens registrados num dia. Retorna null (não number) quando
// ninguém registrou dor naquele dia, pra distinguir de "dor = 0".
function dailyDorFor(session) {
  if (!session || !session.cargas) return null;
  const dores = Object.values(session.cargas)
    .map((e) => (e && e.dor != null && e.dor !== "" ? Number(e.dor) : null))
    .filter((d) => d != null && !isNaN(d));
  if (!dores.length) return null;
  return dores.reduce((s, d) => s + d, 0) / dores.length;
}

// Série diária de carga (+ dor, quando registrada) entre duas datas ISO
// (inclusive), preenchendo dias sem sessão com carga 0 / dor null.
function buildDailyLoadSeries(sessions, startIso, endIso) {
  const series = [];
  let cursor = startIso;
  let guard = 0;
  while (cursor <= endIso && guard < 400) {
    series.push({ date: cursor, load: dailyLoadFor(sessions[cursor]), dor: dailyDorFor(sessions[cursor]) });
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
  // chronic cobre os mesmos dias que acute (28d engloba os últimos 7d), então
  // chronic só é 0 quando não há NENHUMA carga registrada na janela toda —
  // nesse caso o ratio é "sem dados", não zero (zero daria a entender que a
  // pessoa está destreinando, quando na verdade ela nunca registrou nada).
  const ratio = chronic > 0 ? acute / chronic : null;
  return { acute, chronic, ratio, series };
}

function acwrZone(ratio) {
  if (ratio == null) return { label: "sem dados ainda", tone: "neutral" };
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
  const bucketCountsByType = {}; // key -> { bucketKey -> count }
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
      if (!bucketCountsByType[key]) bucketCountsByType[key] = {};
      bucketCountsByType[key][bKey] = (bucketCountsByType[key][bKey] || 0) + 1;
      if (!perType[key]) perType[key] = { key, nome: nomeFor(tipo, id), tipo, count: 0, minutes: 0 };
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

  // Mesma série de buckets, mas uma por tipo — pra dar de comer ao gráfico
  // de evolução quando o usuário escolhe um treino/atividade específico.
  const perTypeSeries = {};
  Object.keys(perType).forEach((key) => {
    const counts = bucketCountsByType[key] || {};
    perTypeSeries[key] = series.map((b) => ({ key: b.key, label: b.label, count: counts[b.key] || 0 }));
  });

  const perTypeList = Object.values(perType).sort((a, b) => b.count - a.count);
  const numBuckets = series.length || 1;
  const avgPerBucket = totalSessions / numBuckets;

  return {
    totalSessions,
    totalDays: daysAttended.size,
    totalMinutes,
    perTypeList,
    perTypeSeries,
    series,
    avgPerBucket,
  };
}

// Versão parametrizada de notesHistoryFor, pra dar pra usar em cima de um
// dataset que não é o do usuário logado (ex: relatório compartilhado).
function notesHistoryForData(sessions, atividadeId, limit = 5) {
  const key = `atividade:${atividadeId}`;
  return Object.entries(sessions)
    .filter(([, s]) => s.log?.[key]?.comentario)
    .map(([date, s]) => ({ date, label: formatDateLabel(date), comentario: s.log[key].comentario }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// Acha os últimos sets registrados (com peso preenchido) pra um exercício,
// olhando sessões anteriores à data informada, da mais recente pra trás —
// usado pra pré-preencher peso/reps quando o exercício é aberto de novo.
function lastLoggedSetsForExercise(sessions, exId, beforeDate) {
  const dates = Object.keys(sessions).filter((d) => d < beforeDate).sort().reverse();
  for (const date of dates) {
    const log = sessions[date]?.log || {};
    for (const key of Object.keys(log)) {
      if (!key.startsWith("treino:")) continue;
      const exLog = log[key][exId];
      if (exLog && exLog.sets && exLog.sets.some((s) => s.peso !== "" && s.peso != null)) {
        return exLog.sets;
      }
    }
  }
  return null;
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
      videoUrl: ex.videoUrl || "",
    })),
  }));
  return { id, nome, duracaoMin: Number(raw.duracaoMin) || null, notas: raw.notas || "", blocos };
}

// --- Configuração inicial (onboarding): treinos-padrão de musculação por
// frequência semanal escolhida, e montagem da agenda a partir das respostas
// do questionário (musculação + outras atividades). Tudo aqui é genérico —
// não usa nenhum dado pessoal do Andre — pra servir de ponto de partida
// razoável pra qualquer pessoa nova que abrir o app. ---
function tplExercicio(nome, series, repeticoes, videoUrl) {
  return { id: slugify(nome), nome, series, repeticoes, descricao: "", observacoes: "", videoUrl: videoUrl || "" };
}
function tplBloco(nome, exercicios) {
  return { nome, exercicios };
}
function tplTreino(nome, duracaoMin, blocos) {
  return { id: slugify(nome), nome, duracaoMin, notas: "", blocos };
}

const TPL_EX = {
  peito: [
    tplExercicio("Supino reto com halteres", 4, "10-12", "https://www.youtube.com/watch?v=Cjh2fIMQHk0"),
    tplExercicio("Supino inclinado com halteres", 3, "10-12", "https://www.youtube.com/watch?v=ZaNyRjpoki8"),
    tplExercicio("Crucifixo no cross-over", 3, "12-15", "https://www.youtube.com/watch?v=_hdQD_E3deE"),
  ],
  costas: [
    tplExercicio("Puxada frente na polia", 4, "10-12", "https://www.youtube.com/watch?v=oF-RqXrkZHU"),
    tplExercicio("Remada baixa na polia", 3, "10-12", "https://www.youtube.com/watch?v=6ml0iz19DPw"),
    tplExercicio("Remada curvada com barra ou halteres", 3, "10-12", "https://www.youtube.com/watch?v=e53vSzibkO0"),
  ],
  ombro: [
    tplExercicio("Desenvolvimento com halteres", 3, "10-12", "https://www.youtube.com/watch?v=DFXtzdXN_iY"),
    tplExercicio("Elevação lateral com halteres", 3, "12-15", "https://www.youtube.com/watch?v=ot9nwSC1JnA"),
  ],
  biceps: [tplExercicio("Rosca direta com barra ou halteres", 3, "10-12", "https://www.youtube.com/watch?v=dc330H9yN3Y")],
  triceps: [tplExercicio("Tríceps na polia (corda)", 3, "12-15", "https://www.youtube.com/watch?v=-QGC1cL6ETE")],
  quad: [
    tplExercicio("Agachamento livre ou na máquina", 4, "10-12", "https://www.youtube.com/watch?v=iGLzCCZr_Xw"),
    tplExercicio("Leg press 45°", 3, "10-12", "https://www.youtube.com/watch?v=DQ4-HXFlKXI"),
    tplExercicio("Cadeira extensora", 3, "12-15", "https://www.youtube.com/watch?v=u68RNdfZymA"),
  ],
  posterior: [
    tplExercicio("Mesa flexora", 3, "12-15", "https://www.youtube.com/watch?v=IXg1PQ_5gmw"),
    tplExercicio("Stiff com halteres ou barra", 3, "10-12", "https://youtu.be/NP548KPEpMw"),
  ],
  gluteoPant: [
    tplExercicio("Cadeira adutora", 2, "15-20", "https://www.youtube.com/watch?v=XbhmXUYp8hs"),
    tplExercicio("Cadeira abdutora", 2, "15-20", "https://www.youtube.com/watch?v=nabhYLtz8Gg"),
    tplExercicio("Panturrilha em pé", 3, "15-20", "https://www.youtube.com/watch?v=EILF4iyBxSQ"),
  ],
  abdomen: [
    tplExercicio("Prancha", 3, "30-45s", "https://www.youtube.com/watch?v=ffHr8a6DRvU"),
    tplExercicio("Abdominal na polia ou máquina", 3, "15-20", "https://www.youtube.com/watch?v=zp6uK1aE1Lc"),
  ],
};

// --- Exercícios extras só pro catálogo do modo manual / fichas sugeridas
// (não usados no gerador de treino da configuração inicial, que depende do
// TAMANHO exato dos arrays acima em TPL_EX — por isso ficam separados aqui
// em vez de dentro de TPL_EX). ---
const TPL_EX_CATALOG_EXTRA = {
  peito: [
    tplExercicio("Supino reto com barra", 4, "8-10", "https://www.youtube.com/watch?v=UHa9U-O09_U"),
    tplExercicio("Supino declinado com halteres", 3, "10-12", "https://www.youtube.com/watch?v=Pf1nDoqx_1A"),
    tplExercicio("Flexão de braço", 3, "Até a falha", "https://www.youtube.com/watch?v=0pkjOk0EiAk"),
    tplExercicio("Peck deck (voador)", 3, "12-15", "https://www.youtube.com/watch?v=fgXSA2-o0NM"),
  ],
  costas: [
    tplExercicio("Barra fixa (pull-up)", 3, "Até a falha", "https://www.youtube.com/watch?v=hxIF6qwBr2M"),
    tplExercicio("Remada unilateral com halteres", 3, "10-12", "https://www.youtube.com/watch?v=dFzUjzfih7k"),
    tplExercicio("Puxada com pegada supinada", 3, "10-12", "https://www.youtube.com/watch?v=ZWlG30BZfEo"),
    tplExercicio("Remada cavalinho (T-bar)", 3, "10-12", "https://www.youtube.com/watch?v=8pR3JoZ0iBU"),
    tplExercicio("Hiperextensão lombar", 3, "12-15", "https://www.youtube.com/watch?v=ivDB23Kcv-A"),
    tplExercicio("Retração escapular (remada isométrica)", 3, "12-15", "https://www.youtube.com/watch?v=kJm_DqqRoL0"),
  ],
  ombro: [
    tplExercicio("Elevação frontal com halteres", 3, "12-15", "https://www.youtube.com/watch?v=GqZRmCow0rw"),
    tplExercicio("Desenvolvimento militar com barra", 3, "8-10", "https://www.youtube.com/watch?v=Y5xpE2K660s"),
    tplExercicio("Remada alta", 3, "10-12", "https://www.youtube.com/watch?v=U-KG4oahSLA"),
    tplExercicio("Face pull na polia", 3, "12-15", "https://www.youtube.com/watch?v=0Po47vvj9g4"),
    tplExercicio("Rotação externa de ombro com faixa elástica", 3, "15-20", "https://www.youtube.com/watch?v=IVR_xKHr7so"),
    tplExercicio("Elevação lateral de ombro com faixa elástica", 3, "15", "https://www.youtube.com/watch?v=54H6OG-99EQ"),
    tplExercicio("Wall slide (deslize na parede)", 3, "10-12", "https://www.youtube.com/watch?v=i_0zLUcE-zk"),
  ],
  biceps: [
    tplExercicio("Rosca alternada com halteres", 3, "10-12", "https://www.youtube.com/watch?v=LpM7dGNzMTo"),
    tplExercicio("Rosca martelo", 3, "10-12", "https://www.youtube.com/watch?v=vm0zV_WQerE"),
    tplExercicio("Rosca Scott (concentrada)", 3, "10-12", "https://www.youtube.com/watch?v=7ixqAPO6JvU"),
  ],
  triceps: [
    tplExercicio("Tríceps testa (com barra ou halteres)", 3, "10-12", "https://www.youtube.com/watch?v=cIqScmVpqnc"),
    tplExercicio("Tríceps francês", 3, "10-12", "https://www.youtube.com/watch?v=b_r_LW4HEcM"),
    tplExercicio("Mergulho no banco (dips)", 3, "Até a falha", "https://www.youtube.com/watch?v=0326dy_-CzM"),
  ],
  quad: [
    tplExercicio("Afundo (avanço) com halteres", 3, "10-12 cada perna", "https://www.youtube.com/watch?v=rltJymhFtHg"),
    tplExercicio("Agachamento búlgaro", 3, "8-10 cada perna", "https://www.youtube.com/watch?v=Fmjj7wFJWRE"),
    tplExercicio("Agachamento sumô", 3, "10-12", "https://www.youtube.com/watch?v=vBA3vyOxJv0"),
    tplExercicio("Leg press unilateral", 3, "10-12 cada perna", "https://www.youtube.com/watch?v=LbKwZIbVYZI"),
    tplExercicio("Extensão de joelho sentado (isometria)", 3, "12-15 cada perna", "https://www.youtube.com/watch?v=Pv5L4V5EezM"),
    tplExercicio("Terminal knee extension com faixa", 3, "15 cada perna", "https://www.youtube.com/watch?v=3d4pIE9iG04"),
  ],
  posterior: [
    tplExercicio("Elevação pélvica (hip thrust)", 3, "10-12", "https://www.youtube.com/watch?v=pUdIL5x0fWg"),
    tplExercicio("Good morning", 3, "10-12", "https://www.youtube.com/watch?v=YA-h3n9L4YU"),
    tplExercicio("Mesa flexora unilateral", 3, "10-12 cada perna", "https://www.youtube.com/watch?v=Y1dQUd6OKHk"),
  ],
  gluteoPant: [
    tplExercicio("Glúteo na polia (coice)", 3, "12-15 cada perna", "https://www.youtube.com/watch?v=SqO-VUEak2M"),
    tplExercicio("Step up", 3, "10-12 cada perna", "https://www.youtube.com/watch?v=5qjqDHOUh-A"),
    tplExercicio("Panturrilha sentado", 3, "15-20", "https://www.youtube.com/watch?v=ar8nav0jGoE"),
    tplExercicio("Ponte de glúteo (glute bridge)", 3, "15", "https://www.youtube.com/watch?v=1satDE63Bwc"),
    tplExercicio("Clamshell (concha) com mini band", 3, "15 cada lado", "https://www.youtube.com/watch?v=XgKzdYhJp1w"),
  ],
  abdomen: [
    tplExercicio("Abdominal supra (crunch)", 3, "15-20", "https://www.youtube.com/watch?v=MKq4WH-eBAQ"),
    tplExercicio("Elevação de pernas", 3, "12-15", "https://www.youtube.com/watch?v=PBTChAcDnZ4"),
    tplExercicio("Prancha lateral", 3, "20-30s cada lado", "https://www.youtube.com/watch?v=x2gzR9zzSCw"),
    tplExercicio("Abdominal bicicleta", 3, "15-20", "https://www.youtube.com/watch?v=OnQNhK0Ekgk"),
  ],
  cardio: [
    tplExercicio("Esteira (caminhada/corrida)", 1, "15-20 min", "https://www.youtube.com/watch?v=gC-eX9k2DIw"),
    tplExercicio("Bicicleta ergométrica", 1, "15-20 min", "https://www.youtube.com/watch?v=TY0f2mgR3GI"),
    tplExercicio("Elíptico", 1, "15-20 min", "https://www.youtube.com/watch?v=Lf2u8UMvI68"),
    tplExercicio("Pular corda", 3, "1-2 min", "https://www.youtube.com/watch?v=_7cpagB7WUg"),
    tplExercicio("Remo ergômetro", 1, "10-15 min", "https://www.youtube.com/watch?v=A-35F9TR0OA"),
    tplExercicio("HIIT em circuito", 4, "30s forte / 30s leve", "https://www.youtube.com/watch?v=9v1hhlsGnJ4"),
  ],
  mobilidade: [
    tplExercicio("Alongamento de posterior de coxa", 2, "30s cada lado", "https://www.youtube.com/watch?v=GHb1xKvO3NY"),
    tplExercicio("Alongamento de peitoral", 2, "30s cada lado", "https://www.youtube.com/watch?v=u7AFpzWV2I8"),
    tplExercicio("Mobilidade de quadril (90/90)", 2, "8-10 cada lado", "https://www.youtube.com/watch?v=FM7-7-a0FLg"),
    tplExercicio("Gato-camelo (mobilidade de coluna)", 2, "10-12", "https://www.youtube.com/watch?v=2of247Kt0tU"),
    tplExercicio("Alongamento de panturrilha", 2, "30s cada lado", "https://www.youtube.com/watch?v=7SO6QzfBRaE"),
    tplExercicio("Rotação de ombro com bastão", 2, "10-12", "https://www.youtube.com/watch?v=YW20zO__f_c"),
    tplExercicio("Mobilidade de tornozelo (dorsiflexão na parede)", 3, "10 cada lado", "https://www.youtube.com/watch?v=_3dMj5JYqQw"),
  ],
};

function buildMusculacaoSplit(n) {
  let treinos;
  if (n === 2) {
    treinos = [
      tplTreino("Full Body A", 55, [
        tplBloco("Peito & Costas", [TPL_EX.peito[0], TPL_EX.costas[0]]),
        tplBloco("Pernas", [TPL_EX.quad[0], TPL_EX.posterior[0]]),
        tplBloco("Ombro & Braços", [TPL_EX.ombro[0], TPL_EX.biceps[0], TPL_EX.triceps[0]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[0]]),
      ]),
      tplTreino("Full Body B", 55, [
        tplBloco("Peito & Costas", [TPL_EX.peito[1], TPL_EX.costas[1]]),
        tplBloco("Pernas", [TPL_EX.quad[1], TPL_EX.gluteoPant[2]]),
        tplBloco("Ombro & Braços", [TPL_EX.ombro[1], TPL_EX.biceps[0], TPL_EX.triceps[0]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[1]]),
      ]),
    ];
  } else if (n === 3) {
    treinos = [
      tplTreino("Push — Peito, Ombro & Tríceps", 55, [
        tplBloco("Peito", TPL_EX.peito),
        tplBloco("Ombro", TPL_EX.ombro),
        tplBloco("Tríceps", TPL_EX.triceps),
      ]),
      tplTreino("Pull — Costas & Bíceps", 55, [
        tplBloco("Costas", [...TPL_EX.costas, TPL_EX_CATALOG_EXTRA.costas[0]]),
        tplBloco("Bíceps", [...TPL_EX.biceps, TPL_EX_CATALOG_EXTRA.biceps[0]]),
      ]),
      tplTreino("Legs — Pernas & Posterior", 55, [
        tplBloco("Pernas", [...TPL_EX.quad, ...TPL_EX.posterior]),
        tplBloco("Panturrilha", [TPL_EX.gluteoPant[2]]),
      ]),
    ];
  } else if (n === 4) {
    treinos = [
      tplTreino("Superior A — Peito & Tríceps", 55, [
        tplBloco("Peito", TPL_EX.peito),
        tplBloco("Ombro", [TPL_EX.ombro[0]]),
        tplBloco("Tríceps", TPL_EX.triceps),
      ]),
      tplTreino("Inferior A — Quadríceps", 50, [
        tplBloco("Pernas", TPL_EX.quad),
        tplBloco("Abdômen", [TPL_EX.abdomen[0]]),
      ]),
      tplTreino("Superior B — Costas & Bíceps", 55, [
        tplBloco("Costas", TPL_EX.costas),
        tplBloco("Ombro", [TPL_EX.ombro[1]]),
        tplBloco("Bíceps", TPL_EX.biceps),
      ]),
      tplTreino("Inferior B — Posterior & Glúteo", 50, [
        tplBloco("Posterior & Glúteo", [...TPL_EX.posterior, ...TPL_EX.gluteoPant]),
        tplBloco("Abdômen", [TPL_EX.abdomen[1]]),
      ]),
    ];
  } else if (n === 5) {
    treinos = [
      tplTreino("Push — Peito, Ombro & Tríceps", 55, [
        tplBloco("Peito", TPL_EX.peito),
        tplBloco("Ombro", TPL_EX.ombro),
        tplBloco("Tríceps", TPL_EX.triceps),
      ]),
      tplTreino("Pull — Costas & Bíceps", 55, [
        tplBloco("Costas", [...TPL_EX.costas, TPL_EX_CATALOG_EXTRA.costas[0]]),
        tplBloco("Bíceps", [...TPL_EX.biceps, TPL_EX_CATALOG_EXTRA.biceps[0]]),
      ]),
      tplTreino("Legs — Pernas & Posterior", 55, [
        tplBloco("Pernas", [...TPL_EX.quad, ...TPL_EX.posterior]),
        tplBloco("Panturrilha", [TPL_EX.gluteoPant[2]]),
      ]),
      tplTreino("Superior — Volume extra", 45, [
        tplBloco("Peito & Costas", [TPL_EX.peito[2], TPL_EX.costas[2]]),
        tplBloco("Ombro & Braços", [TPL_EX.ombro[0], TPL_EX.biceps[0], TPL_EX.triceps[0]]),
      ]),
      tplTreino("Inferior — Volume extra", 40, [
        tplBloco("Pernas", [TPL_EX.quad[2], TPL_EX.posterior[1]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[0]]),
      ]),
    ];
  } else if (n === 6) {
    treinos = [
      tplTreino("Push A — Peito, Ombro & Tríceps", 55, [
        tplBloco("Peito", [TPL_EX.peito[0], TPL_EX.peito[1]]),
        tplBloco("Ombro", [TPL_EX.ombro[0]]),
        tplBloco("Tríceps", TPL_EX.triceps),
      ]),
      tplTreino("Pull A — Costas & Bíceps", 50, [
        tplBloco("Costas", [TPL_EX.costas[0], TPL_EX.costas[1]]),
        tplBloco("Bíceps", TPL_EX.biceps),
      ]),
      tplTreino("Legs A — Quadríceps & Abdômen", 50, [
        tplBloco("Pernas", TPL_EX.quad),
        tplBloco("Abdômen", [TPL_EX.abdomen[0]]),
      ]),
      tplTreino("Push B — Peito & Ombro", 50, [
        tplBloco("Peito", [TPL_EX.peito[2]]),
        tplBloco("Ombro", [TPL_EX.ombro[1]]),
        tplBloco("Tríceps", TPL_EX.triceps),
      ]),
      tplTreino("Pull B — Costas & Bíceps", 50, [
        tplBloco("Costas", [TPL_EX.costas[2]]),
        tplBloco("Bíceps", TPL_EX.biceps),
      ]),
      tplTreino("Legs B — Posterior & Glúteo", 50, [
        tplBloco("Posterior & Glúteo", [...TPL_EX.posterior, ...TPL_EX.gluteoPant]),
        tplBloco("Abdômen", [TPL_EX.abdomen[1]]),
      ]),
    ];
  } else {
    treinos = [];
  }
  // Clona tudo — os blocos reaproveitam os mesmos objetos de exercício-modelo
  // (TPL_EX) entre splits diferentes, e cada ficha gerada deve ser
  // independente na hora de editar/persistir.
  return JSON.parse(JSON.stringify(treinos));
}

const ONBOARDING_ATIVIDADES_SUGESTOES = ["Vôlei", "Corrida", "Natação", "Ciclismo", "CrossFit", "Hyrox", "Pilates", "Yoga"];

// --- Catálogo de exercícios pro modo "Montar manualmente": reaproveita o
// TPL_EX acima (mesmos exercícios usados na configuração inicial), só
// organizado com um rótulo de exibição por grupo, pra virar as abas do
// seletor de exercícios. ---
// "kind" separa grupos musculares de verdade das demais categorias (cardio,
// mobilidade, reabilitação) — elas aparecem numa seção visual à parte na
// busca, em vez de ficarem misturadas como se fossem "músculos".
const CATALOG_GRUPOS = [
  { key: "peito", label: "Peito", kind: "muscular" },
  { key: "costas", label: "Costas", kind: "muscular" },
  { key: "ombro", label: "Ombro", kind: "muscular" },
  { key: "biceps", label: "Bíceps", kind: "muscular" },
  { key: "triceps", label: "Tríceps", kind: "muscular" },
  { key: "quad", label: "Quadríceps", kind: "muscular" },
  { key: "posterior", label: "Posterior de coxa", kind: "muscular" },
  { key: "gluteoPant", label: "Glúteo & Panturrilha", kind: "muscular" },
  { key: "abdomen", label: "Abdômen", kind: "muscular" },
  { key: "cardio", label: "Cardio", kind: "outro" },
  { key: "mobilidade", label: "Mobilidade", kind: "outro" },
];

function buildExerciseCatalogFlat() {
  const flat = [];
  CATALOG_GRUPOS.forEach(({ key, label }) => {
    [...(TPL_EX[key] || []), ...(TPL_EX_CATALOG_EXTRA[key] || [])].forEach((ex) => {
      flat.push({ ...ex, grupo: label });
    });
  });
  return flat;
}
const EXERCISE_CATALOG_FLAT = buildExerciseCatalogFlat();

const CATALOG_GRUPOS_MUSCULARES = CATALOG_GRUPOS.filter((g) => g.kind === "muscular");
const CATALOG_GRUPOS_OUTROS = CATALOG_GRUPOS.filter((g) => g.kind === "outro");
const CATALOG_GRUPO_COUNTS = (() => {
  const counts = {};
  EXERCISE_CATALOG_FLAT.forEach((ex) => { counts[ex.grupo] = (counts[ex.grupo] || 0) + 1; });
  return counts;
})();

// Modal de busca/seleção de exercício do catálogo, reaproveitado pelo
// builder manual (App) e pelo editor de treino do onboarding — mesma
// mecânica (busca livre + chips de grupo), uma única implementação.
function ExercisePickerModal({ search, setSearch, grupo, setGrupo, isAdded, onAdd, onClose }) {
  const q = normalizeSearch(search);
  const filtered = EXERCISE_CATALOG_FLAT.filter((ex) => (q
    ? normalizeSearch(ex.nome).includes(q)
    : ex.grupo === grupo));

  function renderChips(grupos) {
    return (
      <div className="gt-grupo-chips">
        {grupos.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`gt-grupo-chip ${grupo === g.label ? "active" : ""}`}
            onClick={() => setGrupo(g.label)}
          >
            {g.label} <span className="gt-grupo-chip-count">{CATALOG_GRUPO_COUNTS[g.label] || 0}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="gt-modal-backdrop" onClick={onClose}>
      <div className="gt-modal gt-exercise-picker" onClick={(e) => e.stopPropagation()}>
        <h3>Adicionar exercício</h3>
        <input
          className="gt-input"
          placeholder="Buscar exercício…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!search.trim() && (
          <>
            <div className="gt-grupo-chips-label">GRUPO MUSCULAR</div>
            {renderChips(CATALOG_GRUPOS_MUSCULARES)}
            <div className="gt-grupo-chips-label">OUTRAS CATEGORIAS</div>
            {renderChips(CATALOG_GRUPOS_OUTROS)}
          </>
        )}
        <div className="gt-exercise-list">
          {filtered.length === 0 && (
            <div className="gt-empty">
              Nenhum exercício encontrado{search.trim() ? ` pra "${search.trim()}"` : ""}. Tenta outro termo ou escolhe um grupo acima.
            </div>
          )}
          {filtered.map((ex, i) => {
            const added = isAdded(ex);
            return (
              <button
                type="button"
                key={`${ex.nome}-${i}`}
                className={`gt-exercise-row ${added ? "added" : ""}`}
                onClick={() => (added ? null : onAdd(ex))}
              >
                <div className="gt-exercise-row-main">
                  <div className="gt-exercise-row-nome">{ex.nome}</div>
                  <div className="gt-exercise-row-meta">{ex.grupo} · {ex.series}x {ex.repeticoes}{ex.videoUrl ? " · 🎥" : ""}</div>
                </div>
                <div className="gt-exercise-row-add">{added ? "✓" : "+"}</div>
              </button>
            );
          })}
        </div>
        <div className="gt-modal-actions">
          <button className="gt-btn" onClick={onClose}>Concluir</button>
        </div>
      </div>
    </div>
  );
}

// --- Fichas sugeridas prontas (modo "Usar sugestão pronta"): combinações
// comuns de treino, pensadas pra caber entre 45min e 1h. Cada uma vira uma
// pré-visualização editável (reaproveita o mesmo editor do modo manual)
// antes de salvar — nada é adicionado sem o usuário confirmar. ---
const TEMPLATE_ROUTINES = [
  {
    id: "full-body",
    nome: "Full Body Expresso",
    subtitulo: "Corpo todo numa sessão só · ~55min",
    treinos: [
      tplTreino("Full Body Expresso", 55, [
        tplBloco("Peito", [TPL_EX.peito[0]]),
        tplBloco("Costas", [TPL_EX.costas[0]]),
        tplBloco("Pernas", [TPL_EX.quad[0]]),
        tplBloco("Ombro", [TPL_EX.ombro[0]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[0]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[3], TPL_EX_CATALOG_EXTRA.mobilidade[4]]),
      ]),
    ],
  },
  {
    id: "peito-triceps",
    nome: "Peito & Tríceps",
    subtitulo: "~55min",
    treinos: [
      tplTreino("Peito & Tríceps", 55, [
        tplBloco("Peito", [TPL_EX.peito[0], TPL_EX.peito[1], TPL_EX_CATALOG_EXTRA.peito[0]]),
        tplBloco("Tríceps", [TPL_EX.triceps[0], TPL_EX_CATALOG_EXTRA.triceps[0], TPL_EX_CATALOG_EXTRA.triceps[1]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[1]]),
      ]),
    ],
  },
  {
    id: "costas-biceps",
    nome: "Costas & Bíceps",
    subtitulo: "~55min",
    treinos: [
      tplTreino("Costas & Bíceps", 55, [
        tplBloco("Costas", [TPL_EX.costas[0], TPL_EX.costas[1], TPL_EX_CATALOG_EXTRA.costas[0], TPL_EX_CATALOG_EXTRA.costas[1]]),
        tplBloco("Bíceps", [TPL_EX.biceps[0], TPL_EX_CATALOG_EXTRA.biceps[0]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[3], TPL_EX_CATALOG_EXTRA.mobilidade[5]]),
      ]),
    ],
  },
  {
    id: "pernas-completo",
    nome: "Pernas Completo",
    subtitulo: "Quadríceps, posterior e glúteo · ~60min",
    treinos: [
      tplTreino("Pernas Completo", 60, [
        tplBloco("Quadríceps", [TPL_EX.quad[0], TPL_EX.quad[1], TPL_EX_CATALOG_EXTRA.quad[0]]),
        tplBloco("Posterior de coxa", [TPL_EX.posterior[0], TPL_EX.posterior[1]]),
        tplBloco("Glúteo & Panturrilha", [TPL_EX.gluteoPant[0], TPL_EX.gluteoPant[2]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[2], TPL_EX_CATALOG_EXTRA.mobilidade[0]]),
      ]),
    ],
  },
  {
    id: "ombro-abdomen",
    nome: "Ombro & Abdômen",
    subtitulo: "~50min",
    treinos: [
      tplTreino("Ombro & Abdômen", 50, [
        tplBloco("Ombro", [TPL_EX.ombro[0], TPL_EX.ombro[1], TPL_EX_CATALOG_EXTRA.ombro[0]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[0], TPL_EX_CATALOG_EXTRA.abdomen[0], TPL_EX_CATALOG_EXTRA.abdomen[1]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[5]]),
      ]),
    ],
  },
  {
    id: "core-expresso",
    nome: "Core Expresso",
    subtitulo: "Sessão curta de abdômen · ~25min",
    treinos: [
      tplTreino("Core Expresso", 25, [
        tplBloco("Abdômen", [TPL_EX.abdomen[0], TPL_EX.abdomen[1], TPL_EX_CATALOG_EXTRA.abdomen[0], TPL_EX_CATALOG_EXTRA.abdomen[2], TPL_EX_CATALOG_EXTRA.abdomen[3]]),
      ]),
    ],
  },
  {
    id: "reab-ombro",
    nome: "Reabilitação de Ombro",
    subtitulo: "Fortalecimento leve · ~30min",
    treinos: [
      { ...tplTreino("Reabilitação de Ombro", 30, [
        tplBloco("Ombro (leve)", [TPL_EX_CATALOG_EXTRA.ombro[4], TPL_EX_CATALOG_EXTRA.ombro[5], TPL_EX_CATALOG_EXTRA.ombro[6], TPL_EX_CATALOG_EXTRA.costas[5]]),
      ]), notas: "Sessão de baixo impacto pra fortalecimento e mobilidade. Consulte um fisioterapeuta antes de iniciar, principalmente se tiver dor ativa." },
    ],
  },
  {
    id: "reab-joelho",
    nome: "Reabilitação de Joelho",
    subtitulo: "Fortalecimento leve · ~30min",
    treinos: [
      { ...tplTreino("Reabilitação de Joelho", 30, [
        tplBloco("Joelho (leve)", [TPL_EX_CATALOG_EXTRA.quad[4], TPL_EX_CATALOG_EXTRA.quad[5], TPL_EX_CATALOG_EXTRA.gluteoPant[3], TPL_EX_CATALOG_EXTRA.gluteoPant[4], TPL_EX_CATALOG_EXTRA.mobilidade[6]]),
      ]), notas: "Sessão de baixo impacto pra fortalecimento e mobilidade. Consulte um fisioterapeuta antes de iniciar, principalmente se tiver dor ativa." },
    ],
  },
  {
    id: "upper-lower",
    nome: "Upper / Lower",
    subtitulo: "2 treinos · ~55min cada",
    treinos: [
      tplTreino("Upper — Superior", 60, [
        tplBloco("Peito", [TPL_EX.peito[0], TPL_EX_CATALOG_EXTRA.peito[0]]),
        tplBloco("Costas", [TPL_EX.costas[0], TPL_EX_CATALOG_EXTRA.costas[0]]),
        tplBloco("Ombro", [TPL_EX.ombro[0]]),
        tplBloco("Bíceps & Tríceps", [TPL_EX.biceps[0], TPL_EX.triceps[0]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[5]]),
      ]),
      tplTreino("Lower — Inferior", 60, [
        tplBloco("Quadríceps", [TPL_EX.quad[0], TPL_EX.quad[1]]),
        tplBloco("Posterior & Glúteo", [TPL_EX.posterior[0], TPL_EX.gluteoPant[0]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[0]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[2]]),
      ]),
    ],
  },
  {
    id: "ppl",
    nome: "Push / Pull / Legs",
    subtitulo: "3 treinos · ~55min cada",
    treinos: buildMusculacaoSplit(3),
  },
];

// atividadesConfig: [{ nome, dias: [weekdayIndex,...] }, ...]
function buildOnboardingData(musculacaoDias, musculacaoWeekdays, atividadesConfig) {
  const treinosList = musculacaoDias > 0 ? buildMusculacaoSplit(musculacaoDias) : [];
  const usedIds = new Set();
  const atividadesList = (atividadesConfig || []).map((a) => {
    let baseId = slugify(a.nome);
    let id = baseId;
    let i = 2;
    while (usedIds.has(id)) { id = `${baseId}-${i}`; i++; }
    usedIds.add(id);
    return { id, nome: a.nome };
  });
  const schedule = {};
  for (let d = 0; d < 7; d++) schedule[d] = [];
  (atividadesConfig || []).forEach((a, idx) => {
    const item = atividadesList[idx];
    (a.dias || []).forEach((d) => { schedule[d].push({ tipo: "atividade", id: item.id }); });
  });
  const sortedWeekdays = [...(musculacaoWeekdays || [])].sort((a, b) => a - b);
  sortedWeekdays.forEach((d, idx) => {
    const treino = treinosList[idx];
    if (treino) schedule[d].push({ tipo: "treino", id: treino.id });
  });
  // "Descanso" já vem pronta pra usar (dia de rest avulso ou na agenda),
  // sem precisar cadastrar na mão — ninguém escolhe ela no questionário.
  let descansoId = "descanso";
  let i = 2;
  while (usedIds.has(descansoId)) { descansoId = `descanso-${i}`; i++; }
  atividadesList.push({ id: descansoId, nome: "Descanso", descanso: true });
  return { treinos: treinosList, atividades: atividadesList, schedule };
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
  /* Tela principal (Hoje/Treinos/Evolução): trava na altura da tela e só
     deixa rolar o miolo (gt-body), não a página inteira — cabeçalho e
     abas ficam fixos, e um dia com pouca coisa não sobra espaço rolável à
     toa. Só afeta essa tela: login, onboarding e boot continuam soltos
     (podem crescer e rolar a página normalmente se precisar). */
  .gt-shell { height:100vh; height:100dvh; padding-bottom:0; display:flex; flex-direction:column; overflow:hidden; }
  .gt-shell > .gt-header { flex-shrink:0; }
  .gt-shell > .gt-body { flex:1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .gt-shell > .gt-tabbar { position:static; flex-shrink:0; margin:0 auto; width:100%; }
  .gt-header { padding:20px 18px 14px; border-bottom:1px solid var(--border); }
  .gt-header-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
  .gt-logout { background:none; border:1px solid var(--border); color:var(--text-muted); border-radius:20px; padding:6px 14px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; margin-top:2px; flex-shrink:0; }
  .gt-login { padding:60px 20px 20px; max-width:400px; margin:0 auto; }
  .gt-eyebrow { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--accent); letter-spacing:0.04em; }
  .gt-brand { display:flex; align-items:center; gap:7px; color:var(--accent); margin-bottom:2px; }
  .gt-brand-name { font-family:'Oswald',sans-serif; font-weight:600; font-size:13px; letter-spacing:0.02em; color:var(--text-muted); }
  .gt-brand.lg { gap:12px; margin-bottom:14px; }
  .gt-brand.lg .gt-brand-name { font-size:24px; font-weight:700; color:var(--text); }
  .gt-boot { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; min-height:100vh; color:var(--accent); }
  .gt-boot-label { font-family:'Roboto Mono',monospace; font-size:12px; color:var(--text-muted); }
  .gt-title { font-family:'Oswald',sans-serif; font-size:26px; font-weight:600; margin:2px 0 0; }
  .gt-body { padding:16px 14px 24px; }
  .gt-week-nav { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .gt-week-nav button { background:none; border:none; color:var(--text-muted); font-size:18px; padding:4px 10px; cursor:pointer; line-height:1; }
  .gt-week-label { font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.03em; text-align:center; flex:1; }
  .gt-week-strip { display:flex; gap:4px; margin-bottom:12px; }
  .gt-week-day { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:8px 2px 7px; cursor:pointer; color:var(--text); font-family:inherit; }
  .gt-week-day .wd { font-family:'Roboto Mono',monospace; font-size:9px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.02em; }
  .gt-week-day .num { font-family:'Oswald',sans-serif; font-size:15px; margin-top:1px; }
  .gt-week-day .dot { width:5px; height:5px; border-radius:50%; margin-top:3px; background:transparent; border:1px solid var(--border); }
  .gt-week-day .dot.pending { border-color:var(--text-muted); }
  .gt-week-day .dot.partial { background:var(--accent-dim); border-color:var(--accent-dim); }
  .gt-week-day .dot.done { background:var(--accent); border-color:var(--accent); }
  .gt-week-day.today { border-color:var(--accent-dim); }
  .gt-week-day.selected { background:var(--surface-2); border-color:var(--accent); }
  .gt-week-day.selected .num { color:var(--accent); }
  .gt-day-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
  .gt-day-heading .wd { font-family:'Oswald',sans-serif; font-size:15px; }
  .gt-today-chip { background:var(--surface-2); border:1px solid var(--accent-dim); color:var(--accent); border-radius:20px; padding:5px 12px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; flex-shrink:0; }
  .gt-streak-row { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }
  .gt-stat-chip { background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:6px 12px; font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); }
  .gt-add-extra-card { display:flex; align-items:center; justify-content:center; gap:8px; width:100%; background:transparent; border:1.5px dashed var(--border); border-radius:var(--radius); color:var(--text-muted); padding:13px 12px; font-family:'Oswald',sans-serif; font-size:14px; cursor:pointer; margin-bottom:10px; }
  .gt-add-extra-card:active { border-color:var(--accent-dim); color:var(--accent); }
  .gt-add-extra-card .plus { font-size:17px; line-height:1; color:var(--accent); font-family:'Inter',sans-serif; }
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
  .gt-text-muted { color:var(--text-muted); }
  .gt-item-carga-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 14px 10px; border-top:1px solid var(--border); font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); }
  .gt-item-carga-edit { background:none; border:none; color:var(--accent); font-size:11px; font-family:'Roboto Mono',monospace; cursor:pointer; padding:0; flex-shrink:0; }
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
  .gt-ex-video-wrap { margin-bottom:12px; }
  .gt-ex-video-toggle { background:var(--surface); border:1px solid var(--border); color:var(--accent); border-radius:20px; padding:6px 14px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; }
  .gt-ex-video-frame { position:relative; width:100%; padding-top:56.25%; margin-top:10px; border-radius:var(--radius); overflow:hidden; background:#000; }
  .gt-ex-video-frame iframe { position:absolute; top:0; left:0; width:100%; height:100%; border:0; }
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
  .gt-treino-item .actions button.gt-link-muted { color:var(--text-muted); }
  .gt-treino-detail { margin-top:10px; border-top:1px solid var(--border); padding-top:10px; }
  .gt-treino-detail .bloco-nm { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); margin:10px 0 4px; }
  .gt-treino-detail .ex-nm { font-size:13px; padding:3px 0; }
  .gt-notas { font-size:12px; color:var(--text-muted); margin-top:10px; padding-top:10px; border-top:1px solid var(--border); }
  .gt-btn { background:var(--accent); color:#14161A; border:none; border-radius:var(--radius); padding:12px; font-family:'Oswald',sans-serif; font-size:14px; font-weight:600; cursor:pointer; width:100%; display:flex; align-items:center; justify-content:center; gap:7px; }
  .gt-btn:disabled { opacity:0.6; cursor:default; }
  .gt-btn.secondary { background:var(--surface-2); color:var(--text); border:1px solid var(--border); }
  .gt-btn.small { padding:9px; font-size:12px; width:auto; }
  .gt-modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:flex-end; justify-content:center; z-index:50; }
  .gt-modal { background:var(--surface); border-top:1px solid var(--border); border-radius:12px 12px 0 0; padding:18px; width:100%; max-width:480px; max-height:85vh; overflow-y:auto; }
  .gt-modal h3 { font-family:'Oswald',sans-serif; font-size:18px; margin:0 0 4px; }
  .gt-modal p { color:var(--text-muted); font-size:12px; line-height:1.5; }
  .gt-modal textarea { width:100%; min-height:220px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:10px; font-family:'Roboto Mono',monospace; font-size:12px; margin:10px 0; }
  .gt-copy-prompt-btn { padding:9px; font-size:12px; margin-top:4px; }
  .gt-modal-actions { display:flex; gap:10px; margin-top:6px; }
  .gt-modal-actions button:first-child { flex:2; }
  .gt-modal-actions button:last-child { flex:1; }
  .gt-modal-actions.gt-modal-actions-col { flex-direction:column; }
  .gt-modal-actions.gt-modal-actions-col button { flex:none; width:100%; }
  .gt-header-actions { display:flex; gap:8px; flex-shrink:0; }
  .gt-help-content { display:flex; flex-direction:column; gap:12px; font-size:12.5px; line-height:1.5; color:var(--text); max-height:50vh; overflow-y:auto; margin:10px 0 16px; }
  .gt-help-item b { color:var(--accent); }
  .gt-strava-box-actions { display:flex; gap:8px; flex-wrap:wrap; }
  .gt-strava-box-actions .gt-btn { width:auto; flex:1; }
  .gt-btn.ghost { background:transparent; border:1px solid rgba(255,90,54,0.4); color:#FF5A36; }
  .gt-settings-group { margin:0 0 18px; }
  .gt-settings-group:last-child { margin-bottom:0; }
  .gt-settings-group-title { font-family:'Oswald',sans-serif; font-size:11px; letter-spacing:0.09em; text-transform:uppercase; color:var(--text-muted); opacity:0.75; margin:0 0 8px 2px; }
  .gt-settings-card { background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:13px 14px; margin-bottom:8px; }
  .gt-settings-card:last-child { margin-bottom:0; }
  .gt-settings-label-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .gt-settings-label { display:flex; align-items:center; gap:6px; font-family:'Oswald',sans-serif; font-size:13px; letter-spacing:0.04em; text-transform:uppercase; color:var(--text); }
  .gt-info-btn { flex-shrink:0; width:19px; height:19px; border-radius:50%; border:1px solid var(--border); background:transparent; color:var(--text-muted); font-family:'Oswald',sans-serif; font-style:italic; font-size:12px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; }
  .gt-info-btn.active { color:var(--accent); border-color:var(--accent-dim); }
  .gt-settings-hint { font-size:12px; color:var(--text-muted); line-height:1.5; margin:8px 0 10px; padding:8px 10px; background:var(--surface); border-radius:8px; border:1px solid var(--border); }
  .gt-settings-body { margin-top:10px; }
  .gt-strava-sync-btn { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; background:var(--surface-2); color:var(--text); border:1px solid var(--border); border-radius:var(--radius); padding:10px; font-family:'Oswald',sans-serif; font-size:13px; font-weight:600; cursor:pointer; margin:10px 0; }
  .gt-strava-sync-btn:disabled { opacity:0.6; cursor:default; }
  .gt-strava-sync-btn.teaser { background:transparent; border:1px dashed var(--border); color:var(--text-muted); }
  .gt-admin-summary { font-family:'Oswald',sans-serif; font-size:13px; color:var(--text-muted); margin:8px 0; }
  .gt-admin-list { display:flex; flex-direction:column; gap:8px; max-height:32vh; overflow-y:auto; margin-bottom:8px; }
  .gt-admin-user-card, .gt-admin-error-item { background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
  .gt-admin-user-email { font-family:'Oswald',sans-serif; font-size:13px; margin-bottom:4px; }
  .gt-admin-user-row { font-size:11.5px; color:var(--text-muted); line-height:1.5; }
  .gt-admin-user-card .gt-btn.small { margin-top:8px; }
  .gt-input { width:100%; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:10px; font-family:'Inter',sans-serif; font-size:13px; box-sizing:border-box; }
  .gt-onb-root { padding-bottom:40px; }
  .gt-onb-chips { display:flex; flex-wrap:wrap; gap:8px; margin:10px 0 4px; }
  .gt-onb-chips button { flex:0 0 auto; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:20px; padding:8px 14px; font-family:'Roboto Mono',monospace; font-size:12px; cursor:pointer; }
  .gt-onb-chips button.active { background:var(--accent); border-color:var(--accent); color:#14161A; }
  .gt-onb-week-grid { display:grid; grid-template-columns:repeat(7, 1fr); gap:6px; margin:10px 0; }
  .gt-onb-week-grid button { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:8px 0; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; }
  .gt-onb-week-grid button.active { background:var(--accent); border-color:var(--accent); color:#14161A; }
  .gt-onb-week-grid.small button { padding:6px 0; font-size:10px; }
  .gt-onb-ativ-block { border-top:1px solid var(--border); padding-top:10px; margin-top:10px; }
  .gt-onb-ativ-header { display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:6px; }
  .gt-onb-ativ-header button { background:none; border:none; color:var(--warn); font-size:14px; cursor:pointer; padding:0 4px; }
  .gt-onb-resumo-intro { font-size:12px; color:var(--text-muted); margin:-4px 0 12px; line-height:1.5; }
  .gt-onb-resumo-dia { display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); font-size:12px; }
  .gt-onb-resumo-dia:last-child { border-bottom:none; }
  .gt-onb-resumo-dia .wd { color:var(--text-muted); font-family:'Roboto Mono',monospace; font-size:11px; flex-shrink:0; width:40px; padding-top:2px; }
  .gt-onb-resumo-dia .items { text-align:right; flex:1; display:flex; flex-direction:column; gap:4px; }
  .gt-onb-resumo-item { line-height:1.4; }
  .gt-onb-resumo-meta { color:var(--text-muted); font-size:11px; }
  button.gt-onb-resumo-item-edit { background:none; border:none; color:inherit; font-family:inherit; text-align:right; padding:0; cursor:pointer; display:block; width:100%; }
  button.gt-onb-resumo-item-edit .gt-onb-resumo-meta { color:var(--accent); }
  .gt-onb-skip { display:block; width:100%; background:none; border:none; color:var(--text-muted); text-decoration:underline; font-size:12px; text-align:center; margin-top:16px; cursor:pointer; }
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
  .gt-checkbox-row { display:flex; align-items:center; gap:7px; margin-top:8px; font-size:12px; color:var(--text-muted); }
  .gt-descanso-badge { display:inline-block; margin-left:7px; padding:2px 7px; border-radius:10px; background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); font-size:10px; text-transform:uppercase; letter-spacing:.03em; }
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
  .gt-rpe-btn.dor.on { background:#FF5A36; border-color:#FF5A36; color:#14161A; }
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
  .gt-freq-type-row { cursor:pointer; padding:8px 6px; margin:0 -6px; border-radius:4px; }
  .gt-freq-type-row.active { background:var(--surface-2); }
  .gt-freq-type-row.active .d { color:var(--accent); }
  .gt-focus-root { padding-bottom:0; }
  /* .gt-focus é a tela de foco (execução de treino, builder, editor de ficha
     existente). Precisa cobrir a tela inteira de verdade — fixo no viewport,
     acima de tudo que tiver embaixo (abas, conteúdo da tela anterior) — em
     vez de só "height:100vh" no fluxo normal, que deixava esse bloco cair
     dentro do layout onde ele foi montado (ex: dentro do onboarding) e
     sobrepor visualmente a tela de trás, com a barra de abas ainda aparecendo
     por cima. Largura segue o mesmo frame de 480px do resto do app. */
  .gt-focus { position:fixed; inset:0; z-index:40; display:flex; flex-direction:column; height:100vh; height:100dvh; width:100%; max-width:480px; margin:0 auto; background:var(--bg); }
  .gt-focus-header { display:flex; align-items:center; gap:12px; padding:16px 14px 10px; flex-shrink:0; }
  .gt-focus-close { background:var(--surface); border:1px solid var(--border); color:var(--text); width:34px; height:34px; border-radius:50%; font-size:15px; cursor:pointer; flex-shrink:0; }
  .gt-focus-title-wrap { flex:1; min-width:0; }
  .gt-focus-title { font-family:'Oswald',sans-serif; font-size:19px; line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-focus-progress-label { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); margin-top:2px; }
  .gt-focus-date.not-today { color:var(--accent); }
  .gt-focus-progress-bar { flex:0 0 6px; height:6px; margin:0 14px 12px; }
  .gt-focus-body { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .gt-focus-footer { position:sticky; bottom:0; padding:12px 14px calc(12px + env(safe-area-inset-bottom)); background:var(--bg); border-top:1px solid var(--border); flex-shrink:0; }

  /* Escolha do modo de criar treino (manual / sugestão / IA) */
  .gt-choice-cards { display:flex; flex-direction:column; gap:10px; margin:14px 0; }
  .gt-choice-card { display:flex; flex-direction:column; align-items:flex-start; gap:3px; text-align:left; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:14px; cursor:pointer; color:var(--text); font-family:inherit; }
  .gt-choice-card:active { border-color:var(--accent-dim); }
  .gt-choice-icon { font-size:20px; margin-bottom:2px; }
  .gt-choice-title { font-family:'Oswald',sans-serif; font-size:15px; }
  .gt-choice-desc { color:var(--text-muted); font-size:12px; line-height:1.4; }

  /* Lista de fichas sugeridas */
  .gt-template-list { display:flex; flex-direction:column; gap:8px; margin:14px 0; }
  .gt-template-card { display:flex; flex-direction:column; gap:2px; text-align:left; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px; cursor:pointer; color:var(--text); font-family:inherit; }
  .gt-template-card:active { border-color:var(--accent-dim); }
  .gt-template-nome { font-family:'Oswald',sans-serif; font-size:14.5px; }
  .gt-template-sub { color:var(--text-muted); font-size:11.5px; font-family:'Roboto Mono',monospace; }

  /* Montar treino manualmente */
  .gt-builder-steps { display:flex; gap:6px; overflow-x:auto; padding:0 14px 10px; flex-shrink:0; }
  .gt-builder-step { flex-shrink:0; background:var(--surface); border:1px solid var(--border); color:var(--text-muted); border-radius:20px; padding:6px 14px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; white-space:nowrap; }
  .gt-builder-step.active { border-color:var(--accent); color:var(--accent); }
  .gt-builder-body { padding:0 14px; }
  .gt-builder-ex-row { display:flex; align-items:center; gap:8px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:9px 10px; margin-bottom:6px; }
  .gt-builder-ex-main { flex:1; min-width:0; }
  .gt-builder-ex-nome { font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-builder-ex-fields { display:flex; align-items:center; gap:6px; margin-top:5px; }
  .gt-builder-ex-input { width:44px; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:4px; padding:4px 6px; font-family:'Roboto Mono',monospace; font-size:12px; text-align:center; }
  .gt-builder-ex-input.wide { width:64px; }
  .gt-builder-ex-x { color:var(--text-muted); font-size:12px; }
  .gt-builder-ex-actions { display:flex; flex-direction:column; gap:3px; flex-shrink:0; }
  .gt-builder-ex-actions button { background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); width:26px; height:22px; border-radius:4px; font-size:10px; cursor:pointer; }
  .gt-builder-ex-actions button:disabled { opacity:0.35; }
  .gt-builder-ex-actions button.danger { color:var(--danger, #e05a4e); }
  .gt-builder-footer { display:flex; gap:8px; }
  .gt-builder-footer .gt-btn { flex:1; }

  /* Seletor de exercícios do catálogo */
  .gt-exercise-picker { max-height:88vh; display:flex; flex-direction:column; }
  .gt-grupo-chips-label { font-family:'Roboto Mono',monospace; font-size:10px; letter-spacing:0.04em; color:var(--text-muted); margin:10px 0 4px; }
  .gt-grupo-chips-label:first-of-type { margin-top:10px; }
  .gt-grupo-chips { display:flex; gap:6px; overflow-x:auto; margin:0 0 4px; padding-bottom:2px; }
  .gt-grupo-chip { flex-shrink:0; background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); border-radius:20px; padding:6px 13px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; white-space:nowrap; }
  .gt-grupo-chip.active { border-color:var(--accent); color:var(--accent); }
  .gt-grupo-chip-count { opacity:0.6; font-size:10px; }
  .gt-exercise-list { flex:1; overflow-y:auto; margin:8px 0; display:flex; flex-direction:column; gap:6px; }
  .gt-exercise-row { display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:11px 12px; cursor:pointer; text-align:left; color:var(--text); font-family:inherit; }
  .gt-exercise-row.added { border-color:var(--accent-dim); opacity:0.75; }
  .gt-exercise-row-main { min-width:0; }
  .gt-exercise-row-nome { font-size:13.5px; }
  .gt-exercise-row-meta { color:var(--text-muted); font-size:11px; font-family:'Roboto Mono',monospace; margin-top:2px; }
  .gt-exercise-row-add { flex-shrink:0; font-size:16px; color:var(--accent); width:22px; text-align:center; }
`;

function App() {
  const [treinos, setTreinos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [sessions, setSessions] = useState({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingIsRedo, setOnboardingIsRedo] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState(null);
  const [adminErrors, setAdminErrors] = useState(null);
  const [myShares, setMyShares] = useState([]);
  const [sharedWithMe, setSharedWithMe] = useState([]);
  const [shareEmailInput, setShareEmailInput] = useState("");
  const [shareFlags, setShareFlags] = useState({ frequencia: true, carga: true, peso_notas: false, treinos: false });
  const [viewingShare, setViewingShare] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
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
  const [novoTreinoChooserOpen, setNovoTreinoChooserOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [builderTreinos, setBuilderTreinos] = useState(null); // array de {nome,duracaoMin,notas,blocos} em edição, ou null se fechado
  const [builderIndex, setBuilderIndex] = useState(0);
  const [builderEditingId, setBuilderEditingId] = useState(null); // id do treino existente sendo editado, ou null se for criação
  const [builderSnapshot, setBuilderSnapshot] = useState(null); // JSON do estado inicial, pra saber se tem algo não salvo ao fechar
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exercisePickerGrupo, setExercisePickerGrupo] = useState(CATALOG_GRUPOS[0].label);
  const [exercisePickerSearch, setExercisePickerSearch] = useState("");
  const [toast, setToast] = useState("");
  const [evoTab, setEvoTab] = useState("frequencia");
  const [evoExercicio, setEvoExercicio] = useState("");
  const [evoAtividade, setEvoAtividade] = useState("");
  const [novaAtividade, setNovaAtividade] = useState("");
  const [novaAtividadeDescanso, setNovaAtividadeDescanso] = useState(false);
  const [addingExtra, setAddingExtra] = useState(false);
  const [extraTipo, setExtraTipo] = useState("treino");
  const [extraId, setExtraId] = useState("");
  const [rpeModal, setRpeModal] = useState(null); // { item, date, label, duracaoMin, rpe }
  const [freqPeriod, setFreqPeriod] = useState("30d"); // "7d" | "30d" | "12m" | "all"
  const [freqAvgUnit, setFreqAvgUnit] = useState("semana"); // "semana" | "mes"
  const [freqSelectedType, setFreqSelectedType] = useState("");
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaConnecting, setStravaConnecting] = useState(false);
  const [stravaSyncing, setStravaSyncing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [shareOwnerNames, setShareOwnerNames] = useState({}); // { [owner_user_id]: nome }
  const [friends, setFriends] = useState([]); // [{ id: user_id, nome, email }]
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendEmailInput, setFriendEmailInput] = useState("");
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState("semana"); // "semana" | "mes" | "ano"
  const [leaderboardMetric, setLeaderboardMetric] = useState("dias"); // "dias" | "treinos" | "minutos"
  const [infoOpen, setInfoOpen] = useState({});
  const toastTimer = useRef(null);
  const saveTimer = useRef({});
  const STORAGE_PREFIX = "treino-app:";
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const cloudSyncedRef = useRef(false);
  cloudSyncedRef.current = cloudSynced;
  const dataRef = useRef({});
  dataRef.current = { treinos, atividades, schedule, sessions };

  // --- Autenticação: verifica sessão existente e escuta mudanças (login,
  // logout, ou o clique no link mágico do e-mail). ---
  useEffect(() => {
    let mounted = true;
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setAuthChecked(true);
    });
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (!session) setCloudSynced(false); }, [session]);

  // --- Registra um "acesso" de verdade (uma linha por abertura do app,
  // não por treino salvo) pra dar pro admin um número real de uso, em vez
  // de inferir isso a partir de dias com treino logado (que confunde com
  // dias importados retroativamente do Strava). Uma vez por sessão aberta. ---
  const appOpenLoggedRef = useRef(false);
  useEffect(() => {
    if (!session || appOpenLoggedRef.current) return;
    appOpenLoggedRef.current = true;
    supabaseClient.from("app_opens").insert({ user_id: session.user.id }).then(({ error }) => {
      if (error) logClientError("app_open_log", error.message);
    });
  }, [session]);

  // --- Sincronização inicial: ao logar, ou puxa os dados já existentes na
  // nuvem, ou (primeira vez) sobe o que já está salvo neste aparelho. ---
  useEffect(() => {
    if (!session || !loaded || cloudSynced) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabaseClient
          .from("app_data")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) { showToast("Erro ao sincronizar"); logClientError("cloud_sync_select", error.message); return; }
        if (data) {
          const cloudTreinos = data.treinos || [];
          const cloudAtividades = data.atividades || [];
          const cloudSchedule = data.schedule && Object.keys(data.schedule).length ? migrateSchedule(data.schedule) : {};
          const cloudSessions = data.sessions || {};
          setTreinos(cloudTreinos);
          setAtividades(cloudAtividades);
          setSchedule(cloudSchedule);
          setSessions(cloudSessions);
          setDisplayName(data.display_name || "");
          try {
            localStorage.setItem(STORAGE_PREFIX + "treinos", JSON.stringify(cloudTreinos));
            localStorage.setItem(STORAGE_PREFIX + "atividades", JSON.stringify(cloudAtividades));
            localStorage.setItem(STORAGE_PREFIX + "schedule", JSON.stringify(cloudSchedule));
            localStorage.setItem(STORAGE_PREFIX + "sessions", JSON.stringify(cloudSessions));
          } catch (e) {}
          if (cloudTreinos.length === 0 && cloudAtividades.length === 0 && Object.keys(cloudSchedule).length === 0) {
            setNeedsOnboarding(true);
          }
        } else {
          // Conta nova de verdade — sem linha na nuvem ainda. Não sobe mais
          // as fichas pessoais do Andre como "padrão" (SEED_*): começa vazio
          // e deixa o questionário de configuração inicial montar a agenda
          // certa pra essa pessoa. A linha na nuvem é criada quando ela
          // termina (ou pula) o questionário.
          setTreinos([]);
          setAtividades([]);
          setSchedule({});
          setSessions({});
          try {
            localStorage.setItem(STORAGE_PREFIX + "treinos", JSON.stringify([]));
            localStorage.setItem(STORAGE_PREFIX + "atividades", JSON.stringify([]));
            localStorage.setItem(STORAGE_PREFIX + "schedule", JSON.stringify({}));
            localStorage.setItem(STORAGE_PREFIX + "sessions", JSON.stringify({}));
          } catch (e) {}
          setNeedsOnboarding(true);
        }
        if (!cancelled) setCloudSynced(true);
      } catch (e) {
        if (!cancelled) { showToast("Erro ao sincronizar"); logClientError("cloud_sync_exception", e && e.message); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, loaded]);

  // --- Strava: recarrega treinos/atividades/schedule/sessions da nuvem
  // (usado depois de um sync, já que ele pode ter mudado atividades/sessions
  // direto no banco, por baixo do estado local). ---
  const refreshFromCloud = useCallback(async () => {
    if (!sessionRef.current) return;
    const { data, error } = await supabaseClient
      .from("app_data")
      .select("*")
      .eq("user_id", sessionRef.current.user.id)
      .maybeSingle();
    if (error || !data) return;
    const nextTreinos = data.treinos || [];
    const nextAtividades = data.atividades || [];
    const nextSchedule = data.schedule && Object.keys(data.schedule).length ? migrateSchedule(data.schedule) : {};
    const nextSessions = data.sessions || {};
    setTreinos(nextTreinos);
    setAtividades(nextAtividades);
    setSchedule(nextSchedule);
    setSessions(nextSessions);
    setDisplayName(data.display_name || "");
    try {
      localStorage.setItem(STORAGE_PREFIX + "treinos", JSON.stringify(nextTreinos));
      localStorage.setItem(STORAGE_PREFIX + "atividades", JSON.stringify(nextAtividades));
      localStorage.setItem(STORAGE_PREFIX + "schedule", JSON.stringify(nextSchedule));
      localStorage.setItem(STORAGE_PREFIX + "sessions", JSON.stringify(nextSessions));
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Compartilhamento de relatórios e amigos: recarrega toda vez que abre
  // Configurações, pra sempre mostrar o estado atual. ---
  useEffect(() => {
    if (settingsOpen) { loadShares(); loadFriends(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  // --- Ranking: recarrega ao abrir a aba ou trocar o período. ---
  useEffect(() => {
    if (evoTab === "ranking" && session) { loadFriends(); loadLeaderboard(leaderboardPeriod); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evoTab, leaderboardPeriod, session]);

  // --- Strava: verifica se o usuário já tem uma conexão salva (assim que
  // loga / sincroniza), pra mostrar "Conectado" no lugar de "Conectar". ---
  useEffect(() => {
    if (!session || !cloudSynced) return;
    let cancelled = false;
    supabaseClient
      .from("strava_connections")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setStravaConnected(!!data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [session, cloudSynced]);

  // --- Strava: se acabamos de voltar do redirect de autorização (a URL tem
  // ?code=...), troca o código pelo token via Edge Function e limpa a URL. ---
  useEffect(() => {
    if (!session) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    let cancelled = false;
    setStravaConnecting(true);
    supabaseClient.functions
      .invoke("strava-connect", { body: { code } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.error) {
          showToast("Erro ao conectar com o Strava");
          logClientError("strava_connect", (error && error.message) || (data && data.error) || "unknown");
        } else {
          setStravaConnected(true);
          showToast("Strava conectado");
        }
      })
      .catch((e) => { if (!cancelled) { showToast("Erro ao conectar com o Strava"); logClientError("strava_connect_exception", e && e.message); } })
      .finally(() => {
        if (cancelled) return;
        setStravaConnecting(false);
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("scope");
        url.searchParams.delete("state");
        window.history.replaceState({}, "", url.toString());
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function handleStravaConnect() {
    window.location.href = stravaAuthorizeUrl();
  }

  async function handleStravaSync() {
    setStravaSyncing(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("strava-sync", { body: {} });
      if (error || !data || data.error) {
        showToast("Erro ao sincronizar com o Strava");
        logClientError("strava_sync", (error && error.message) || (data && data.error) || "unknown");
      } else {
        await refreshFromCloud();
        const n = data.imported || 0;
        showToast(n > 0 ? `${n} atividade${n === 1 ? "" : "s"} importada${n === 1 ? "" : "s"}` : "Nada novo pra importar");
      }
    } catch (e) {
      showToast("Erro ao sincronizar com o Strava");
      logClientError("strava_sync_exception", e && e.message);
    }
    setStravaSyncing(false);
  }

  async function handleStravaDisconnect() {
    if (!session) return;
    if (!confirm("Desconectar do Strava? As atividades já importadas continuam salvas, mas novas atividades não vão mais sincronizar sozinhas.")) return;
    const { error } = await supabaseClient.from("strava_connections").delete().eq("user_id", session.user.id);
    if (error) showToast("Erro ao desconectar");
    else { setStravaConnected(false); showToast("Strava desconectado"); }
  }

  async function handleSendMagicLink(e) {
    e.preventDefault();
    if (!authEmail) return;
    setAuthLoading(true);
    setAuthError("");
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: window.location.href },
    });
    setAuthLoading(false);
    if (error) setAuthError(error.message);
    else setAuthSent(true);
  }

  function handleLogout() {
    supabaseClient.auth.signOut();
  }

  async function loadShares() {
    if (!session) return;
    const [mineRes, withMeRes, namesRes] = await Promise.all([
      supabaseClient.from("report_shares").select("*").eq("owner_user_id", session.user.id).is("revoked_at", null),
      supabaseClient.from("report_shares").select("*").eq("viewer_email", session.user.email).is("revoked_at", null),
      supabaseClient.rpc("get_share_owner_names"),
    ]);
    setMyShares(mineRes.error ? [] : mineRes.data || []);
    setSharedWithMe(withMeRes.error ? [] : withMeRes.data || []);
    if (!namesRes.error && namesRes.data) {
      const map = {};
      namesRes.data.forEach((r) => { map[r.owner_user_id] = r.nome; });
      setShareOwnerNames(map);
    }
  }

  async function handleAddShare() {
    const email = shareEmailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) { showToast("Digite um e-mail válido"); return; }
    const { error } = await supabaseClient.from("report_shares").upsert(
      {
        owner_user_id: session.user.id,
        owner_email: session.user.email,
        viewer_email: email,
        share_frequencia: shareFlags.frequencia,
        share_carga: shareFlags.carga,
        share_peso_notas: shareFlags.peso_notas,
        share_treinos: shareFlags.treinos,
        revoked_at: null,
      },
      { onConflict: "owner_user_id,viewer_email" }
    );
    if (error) { showToast("Erro ao compartilhar"); logClientError("report_share_add", error.message); return; }
    setShareEmailInput("");
    showToast(`Relatórios liberados pra ${email}`);
    loadShares();
  }

  async function handleRevokeShare(id) {
    const { error } = await supabaseClient.from("report_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) { showToast("Erro ao revogar"); return; }
    showToast("Acesso revogado");
    loadShares();
  }

  async function handleViewSharedReport(share) {
    setViewingShare(share);
    setViewingLoading(true);
    setViewingReport(null);
    const { data, error } = await supabaseClient.rpc("get_shared_report", { p_owner_user_id: share.owner_user_id });
    if (error) { showToast("Erro ao carregar relatório"); logClientError("get_shared_report", error.message); setViewingLoading(false); return; }
    setViewingReport(data);
    setViewingLoading(false);
  }

  function closeSharedReport() {
    setViewingShare(null);
    setViewingReport(null);
  }

  // --- Nome de exibição: mostrado no lugar do e-mail pros amigos e no
  // ranking. Salva na mesma coluna flat de app_data, com o "persist" já
  // existente (debounce de 300ms, sobe pra nuvem se estiver logado). ---
  function handleSaveDisplayName(value) {
    setDisplayName(value);
    persist("display_name", value, "Nome salvo");
  }

  function toggleInfo(key) {
    setInfoOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // --- Amigos: pedido por e-mail, precisa aceite (não é automático). O
  // ranking só mostra quem está na tabela friendships (pedido aceito). ---
  async function loadFriends() {
    if (!session) return;
    const [reqRes, friendsRes] = await Promise.all([
      supabaseClient.from("friend_requests").select("*").or(`from_user_id.eq.${session.user.id},to_email.eq.${session.user.email}`),
      supabaseClient.rpc("get_friend_leaderboard", { p_period: "ano" }), // reaproveita a função só pra listar quem já é amigo, com nome/email
    ]);
    if (!reqRes.error && reqRes.data) {
      setIncomingRequests(reqRes.data.filter((r) => r.to_email === session.user.email && r.status === "pendente"));
      setOutgoingRequests(reqRes.data.filter((r) => r.from_user_id === session.user.id && r.status === "pendente"));
    }
    if (!friendsRes.error && friendsRes.data) {
      setFriends(friendsRes.data.filter((r) => !r.is_me).map((r) => ({ id: r.user_id, nome: r.nome, email: r.email })));
    }
  }

  async function handleSendFriendRequest() {
    const email = friendEmailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) { showToast("Digite um e-mail válido"); return; }
    if (email === session.user.email) { showToast("Esse é o seu próprio e-mail"); return; }
    setFriendActionLoading(true);
    const { error } = await supabaseClient.rpc("send_friend_request", { p_to_email: email });
    setFriendActionLoading(false);
    if (error) {
      const msg = (error.message || "").includes("user_not_found")
        ? "Essa pessoa ainda não tem conta no Movo"
        : (error.message || "").includes("already_friends")
        ? "Vocês já são amigos"
        : (error.message || "").includes("cannot_add_self")
        ? "Esse é o seu próprio e-mail"
        : "Erro ao enviar pedido";
      showToast(msg);
      logClientError("friend_request_send", error.message);
      return;
    }
    setFriendEmailInput("");
    showToast(`Pedido enviado pra ${email}`);
    loadFriends();
  }

  async function handleRespondFriendRequest(requestId, accept) {
    const { error } = await supabaseClient.rpc("respond_friend_request", { p_request_id: requestId, p_accept: accept });
    if (error) { showToast("Erro ao responder pedido"); logClientError("friend_request_respond", error.message); return; }
    showToast(accept ? "Amizade aceita!" : "Pedido recusado");
    loadFriends();
    if (accept) loadLeaderboard(leaderboardPeriod);
  }

  async function handleRemoveFriend(friendId) {
    if (!confirm("Remover essa amizade? O ranking deixa de mostrar essa pessoa.")) return;
    const me = session.user.id;
    const { error } = await supabaseClient
      .from("friendships")
      .delete()
      .or(`and(user_a.eq.${me},user_b.eq.${friendId}),and(user_a.eq.${friendId},user_b.eq.${me})`);
    if (error) { showToast("Erro ao remover"); logClientError("friend_remove", error.message); return; }
    showToast("Amizade removida");
    loadFriends();
    loadLeaderboard(leaderboardPeriod);
  }

  // --- Ranking entre amigos, estilo GymRats: dá pra ver por dias ativos,
  // número de treinos ou minutos treinados, na semana/mês/ano. ---
  async function loadLeaderboard(period) {
    if (!session) return;
    setLeaderboardLoading(true);
    const { data, error } = await supabaseClient.rpc("get_friend_leaderboard", { p_period: period });
    if (error) { logClientError("friend_leaderboard", error.message); setLeaderboard([]); setLeaderboardLoading(false); return; }
    setLeaderboard(data || []);
    setLeaderboardLoading(false);
  }

  async function loadAdminData() {
    setAdminLoading(true);
    const [usersRes, errorsRes] = await Promise.all([
      supabaseClient.rpc("admin_usage_stats"),
      supabaseClient.rpc("admin_client_errors", { limit_n: 50 }),
    ]);
    setAdminUsers(usersRes.error ? [] : usersRes.data || []);
    setAdminErrors(errorsRes.error ? [] : errorsRes.data || []);
    setAdminLoading(false);
  }

  function openAdmin() {
    setAdminOpen(true);
    loadAdminData();
  }

  // --- Log de erros: registra falhas silenciosas (que hoje só viram um
  // toast que some) numa tabela, pra dar pra ver depois sem depender de
  // alguém avisar. Não bloqueia nada se a escrita falhar. ---
  function logClientError(context, message) {
    try {
      supabaseClient
        .from("client_errors")
        .insert({
          user_id: sessionRef.current ? sessionRef.current.user.id : null,
          context,
          message: message ? String(message).slice(0, 2000) : null,
        })
        .then(() => {});
    } catch (e) {}
  }

  function handleOnboardingComplete(data) {
    setTreinos(data.treinos);
    setAtividades(data.atividades);
    setSchedule(data.schedule);
    persist("treinos", data.treinos);
    persist("atividades", data.atividades);
    persist("schedule", data.schedule);
    setNeedsOnboarding(false);
    setOnboardingIsRedo(false);
    showToast("Configuração inicial salva");
  }

  // --- Onboarding + Strava: como o "Conectar" redireciona pro Strava (a
  // página inteira sai daqui), não dá pra confiar no persist() debounced
  // (300ms) — a navegação pode acontecer antes dele terminar de salvar.
  // Por isso aqui o upsert é direto e aguardado antes de sair da página. ---
  async function handleOnboardingCompleteAndConnectStrava(data) {
    setTreinos(data.treinos);
    setAtividades(data.atividades);
    setSchedule(data.schedule);
    try {
      localStorage.setItem(STORAGE_PREFIX + "treinos", JSON.stringify(data.treinos));
      localStorage.setItem(STORAGE_PREFIX + "atividades", JSON.stringify(data.atividades));
      localStorage.setItem(STORAGE_PREFIX + "schedule", JSON.stringify(data.schedule));
    } catch (e) {}
    setNeedsOnboarding(false);
    setOnboardingIsRedo(false);
    if (sessionRef.current) {
      const payload = {
        user_id: sessionRef.current.user.id,
        treinos: data.treinos,
        atividades: data.atividades,
        schedule: data.schedule,
        sessions: sessions,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseClient.from("app_data").upsert(payload);
      if (error) {
        showToast("Erro ao salvar, tenta de novo");
        logClientError("onboarding_strava_upsert", error.message);
        return;
      }
    }
    window.location.href = stravaAuthorizeUrl();
  }

  function handleOnboardingSkip() {
    setNeedsOnboarding(false);
    setOnboardingIsRedo(false);
  }

  function handleOnboardingCancel() {
    setNeedsOnboarding(false);
    setOnboardingIsRedo(false);
  }

  function openOnboardingRedo() {
    setSettingsOpen(false);
    setOnboardingIsRedo(true);
    setNeedsOnboarding(true);
  }

  useEffect(() => {
    let t, a, s, ss;
    try { t = localStorage.getItem(STORAGE_PREFIX + "treinos"); } catch (e) {}
    try { a = localStorage.getItem(STORAGE_PREFIX + "atividades"); } catch (e) {}
    try { s = localStorage.getItem(STORAGE_PREFIX + "schedule"); } catch (e) {}
    try { ss = localStorage.getItem(STORAGE_PREFIX + "sessions"); } catch (e) {}
    if (t) { try { setTreinos(JSON.parse(t)); } catch (e) {} }
    else { try { localStorage.setItem(STORAGE_PREFIX + "treinos", JSON.stringify([])); } catch (e) {} }
    if (a) { try { setAtividades(JSON.parse(a)); } catch (e) {} }
    else { try { localStorage.setItem(STORAGE_PREFIX + "atividades", JSON.stringify([])); } catch (e) {} }
    if (s) { try { setSchedule(migrateSchedule(JSON.parse(s))); } catch (e) {} }
    else { try { localStorage.setItem(STORAGE_PREFIX + "schedule", JSON.stringify({})); } catch (e) {} }
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
      if (sessionRef.current && cloudSyncedRef.current) {
        const payload = {
          user_id: sessionRef.current.user.id,
          ...dataRef.current,
          [key]: value,
          updated_at: new Date().toISOString(),
        };
        supabaseClient.from("app_data").upsert(payload).then(({ error }) => {
          if (error) { console.error("Erro ao sincronizar com a nuvem:", error); logClientError("persist_upsert", error.message); }
        });
      }
    }, 300);
  }, [showToast]);

  const updateTreinos = (next) => { setTreinos(next); persist("treinos", next, "Treino salvo"); };
  const updateAtividades = (next) => { setAtividades(next); persist("atividades", next, "Salvo"); };
  const updateSchedule = (next) => { setSchedule(next); persist("schedule", next, "Agenda salva"); };
  const updateSessions = (next) => { setSessions(next); persist("sessions", next); };


  const treinoById = useCallback((id) => treinos.find((t) => t.id === id), [treinos]);
  const atividadeById = useCallback((id) => atividades.find((a) => a.id === id), [atividades]);

  // --- Migração pra contas que já passaram do onboarding antes da opção de
  // "Descanso" existir: adiciona ela uma vez só (feature nova não pode
  // obrigar redo do questionário). Usa uma flag própria em vez de só
  // checar se já existe, pra não recriar depois que a pessoa excluir. ---
  useEffect(() => {
    if (!loaded) return;
    if (session && !cloudSynced) return;
    if (needsOnboarding) return;
    let seeded = false;
    try { seeded = localStorage.getItem(STORAGE_PREFIX + "descansoSeeded") === "1"; } catch (e) {}
    if (seeded) return;
    try { localStorage.setItem(STORAGE_PREFIX + "descansoSeeded", "1"); } catch (e) {}
    if (!atividades.some((a) => a.descanso)) {
      let id = "descanso";
      let i = 2;
      while (atividades.some((a) => a.id === id)) { id = `descanso-${i}`; i++; }
      updateAtividades([...atividades, { id, nome: "Descanso", descanso: true }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, cloudSynced, session, needsOnboarding]);

  const weekday = weekdayOf(selectedDate);
  const scheduledItems = schedule[weekday] || [];
  const daySession = sessions[selectedDate] || {};
  const extraItems = daySession.extras || [];
  const removedItems = daySession.removed || [];
  const isRemoved = (item) => removedItems.some((it) => it.tipo === item.tipo && it.id === item.id);
  const dayItems = [...scheduledItems.filter((it) => !isRemoved(it)), ...extraItems];
  const dayLog = daySession.log || {};

  // --- Tira de 7 dias (semana de domingo a sábado que contém o dia
  // selecionado) com um indicador de status por dia, pra dar contexto da
  // semana sem precisar trocar de aba. ---
  const weekStripDays = useMemo(() => {
    const weekStartIso = addDays(selectedDate, -weekday);
    return Array.from({ length: 7 }, (_, i) => {
      const iso = addDays(weekStartIso, i);
      return {
        iso,
        wd: i,
        isToday: iso === todayISO(),
        isSelected: iso === selectedDate,
        status: dayStripStatus(iso, schedule, sessions, treinoById, atividadeById),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, weekday, schedule, sessions, treinos, atividades]);

  // --- Resumo rápido: sequência de dias seguidos com atividade, e quantos
  // dias da semana ATUAL (não da semana em navegação) já tiveram algo
  // registrado — preenche o topo do dia com algo útil em vez de vazio. ---
  const streakInfo = useMemo(() => {
    const today = todayISO();
    const todayWd = weekdayOf(today);
    const weekStartIso = addDays(today, -todayWd);
    let activeDaysThisWeek = 0;
    for (let i = 0; i <= todayWd; i++) {
      if (dayHasActivity(sessions, addDays(weekStartIso, i), atividadeById)) activeDaysThisWeek++;
    }
    return { streak: computeStreak(sessions, today, atividadeById), activeDaysThisWeek };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, atividades]);

  useEffect(() => { setExpandedItem(null); setExpandedEx(null); setAddingExtra(false); }, [selectedDate]);

  function ensureSessionShape() {
    const s = sessions[selectedDate] || { log: {}, extras: [], removed: [] };
    return { log: {}, extras: [], removed: [], cargas: {}, ...s };
  }

  function sessionShapeFor(dateIso) {
    const s = sessions[dateIso] || { log: {}, extras: [], removed: [] };
    return { log: {}, extras: [], removed: [], cargas: {}, ...s };
  }

  function saveCarga(dateIso, item, duracaoMin, rpe, dor) {
    const key = itemKey(item);
    const session = sessionShapeFor(dateIso);
    const entry = { duracaoMin, rpe, updatedAt: Date.now() };
    if (dor != null && dor !== "") entry.dor = Number(dor);
    const nextCargas = { ...session.cargas, [key]: entry };
    updateSessions({ ...sessions, [dateIso]: { ...session, cargas: nextCargas } });
  }

  // Reabre o popup de duração/esforço/dor pra um item já registrado (ou nunca
  // preenchido), pré-preenchido com o que já existe — saveCarga por cima
  // sobrescreve o registro daquele dia, então dá pra corrigir depois.
  function openRpeModalFor(item, dateIso, label) {
    const session = sessions[dateIso] || {};
    const existing = (session.cargas || {})[itemKey(item)];
    setRpeModal({
      item, date: dateIso, label,
      duracaoMin: existing ? String(existing.duracaoMin) : "",
      rpe: existing ? String(existing.rpe) : "",
      dor: existing && existing.dor != null ? existing.dor : null,
    });
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
      const lastSets = lastLoggedSetsForExercise(sessions, ex.id, selectedDate);
      sets = Array.from({ length: ex.series || 1 }, (_, i) => ({
        peso: lastSets && lastSets[i] ? lastSets[i].peso : "",
        reps: (lastSets && lastSets[i] ? lastSets[i].reps : "") || repDefault || "",
      }));
    }
    patchItemLog(key, { [ex.id]: { ...prevExLog, status, sets: sets || [] } });
  }

  function ensureSetsForExpand(item, ex) {
    const key = itemKey(item);
    const treinoLog = dayLog[key] || {};
    const prevExLog = treinoLog[ex.id];
    if (!prevExLog || !prevExLog.sets || prevExLog.sets.length === 0) {
      const repDefault = parseFirstNumber(ex.repeticoes);
      const lastSets = lastLoggedSetsForExercise(sessions, ex.id, selectedDate);
      const sets = Array.from({ length: ex.series || 1 }, (_, i) => ({
        peso: lastSets && lastSets[i] ? lastSets[i].peso : "",
        reps: (lastSets && lastSets[i] ? lastSets[i].reps : "") || repDefault || "",
      }));
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
    const atividade = atividadeById(item.id);
    // Descanso não tem duração/esforço pra registrar — marca "fui" direto,
    // sem abrir o modal de RPE (não faz sentido pedir isso de um dia de folga).
    if (status === "fui" && prev.status !== "fui" && !(atividade && atividade.descanso)) {
      setRpeModal({ item, date: selectedDate, label: atividade ? atividade.nome : "atividade", duracaoMin: "", rpe: "", dor: null });
    }
  }

  function finishTreino(item, treino) {
    setFocusTreino(null);
    setExpandedEx(null);
    setRpeModal({ item, date: selectedDate, label: treino ? treino.nome : "treino", duracaoMin: "", rpe: "", dor: null });
  }

  function saveRpeModal() {
    if (!rpeModal) return;
    const dur = Number(rpeModal.duracaoMin);
    const rpe = Number(rpeModal.rpe);
    if (dur > 0 && rpe > 0) {
      saveCarga(rpeModal.date, rpeModal.item, dur, rpe, rpeModal.dor);
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

  // Adiciona imediatamente ao escolher o item (sem botão "Adicionar" separado)
  // — mesmo padrão de interação do AgendaAdder (agenda semanal recorrente),
  // pra não ter dois jeitos diferentes de fazer a mesma coisa no app.
  function addExtraForToday(tipo, id) {
    if (!id) return;
    const session = ensureSessionShape();
    const newItem = { tipo, id };
    const exists = [...scheduledItems.filter((it) => !isRemoved(it)), ...(session.extras || [])].some((it) => it.tipo === newItem.tipo && it.id === newItem.id);
    setAddingExtra(false);
    setExtraId("");
    if (exists) { showToast(`${tipo === "treino" ? "Esse treino" : "Essa atividade"} já tá na agenda de hoje`); return; }
    const nextExtras = [...(session.extras || []), newItem];
    updateSessions({ ...sessions, [selectedDate]: { ...session, extras: nextExtras } });
    showToast("Adicionado a hoje");
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

  // Adiciona um ou mais treinos novos de uma vez, cuidando pra não colidir
  // id/nome entre eles nem com os treinos já existentes. Usado tanto pelo
  // import JSON (lista) quanto pelo modo manual e pelas fichas sugeridas.
  function commitTreinosBatch(rawTreinos) {
    const usedIds = treinos.map((t) => t.id);
    const novos = [];
    rawTreinos.forEach((t) => {
      const normalized = normalizeImportedTreino(t, [...usedIds, ...novos.map((n) => n.id)]);
      novos.push(normalized);
    });
    updateTreinos([...treinos, ...novos]);
    return novos;
  }

  function handleImport() {
    setImportError("");
    let raw;
    try { raw = JSON.parse(importText); } catch (e) { setImportError("JSON inválido — confira vírgulas e chaves."); return; }

    if (Array.isArray(raw)) {
      if (editingTreinoId) {
        setImportError("Pra editar um treino existente, cole só um treino (objeto), não uma lista.");
        return;
      }
      if (raw.length === 0) {
        setImportError("A lista está vazia — inclua pelo menos um treino.");
        return;
      }
      const invalidIdx = raw.findIndex((t) => !t || !Array.isArray(t.blocos) || t.blocos.length === 0);
      if (invalidIdx !== -1) {
        setImportError(`Treino #${invalidIdx + 1} da lista está incompleto — precisa de "nome" e uma lista "blocos" com pelo menos um bloco.`);
        return;
      }
      const novos = commitTreinosBatch(raw);
      setImportOpen(false); setImportText(""); setEditingTreinoId(null);
      showToast(`${novos.length} treinos importados`);
      return;
    }

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

  // --- Modo "Novo treino": escolher entre manual / sugestão pronta / IA ---
  function openNovoTreinoChooser() { setNovoTreinoChooserOpen(true); }

  function startManualBuilderBlank() {
    setNovoTreinoChooserOpen(false);
    setBuilderEditingId(null);
    const inicial = [{ nome: "", duracaoMin: null, notas: "", blocos: [] }];
    setBuilderTreinos(inicial);
    setBuilderSnapshot(JSON.stringify(inicial));
    setBuilderIndex(0);
  }

  function openTemplates() { setNovoTreinoChooserOpen(false); setTemplatesOpen(true); }

  function startBuilderFromTemplate(template) {
    // clona fundo — os treinos do template reaproveitam os mesmos objetos de
    // exercício-modelo (TPL_EX) entre fichas diferentes, e cada uma editada
    // aqui precisa ser independente.
    const cloned = JSON.parse(JSON.stringify(template.treinos));
    setTemplatesOpen(false);
    setBuilderEditingId(null);
    setBuilderTreinos(cloned);
    setBuilderSnapshot(JSON.stringify(cloned));
    setBuilderIndex(0);
  }

  // Abre o builder visual pra editar uma ficha JÁ SALVA (em vez de criar uma
  // nova) — reaproveita a mesma UI de montagem manual (catálogo, reordenar,
  // ajustar séries/reps), preservando descricao/observacoes/videoUrl de cada
  // exercício que não for removido/re-adicionado.
  function startBuilderEditExisting(treino) {
    const cloned = JSON.parse(JSON.stringify([treino]));
    setBuilderEditingId(treino.id);
    setBuilderTreinos(cloned);
    setBuilderSnapshot(JSON.stringify(cloned));
    setBuilderIndex(0);
  }

  function closeBuilder(skipConfirm) {
    const mudou = !skipConfirm && builderTreinos && JSON.stringify(builderTreinos) !== builderSnapshot;
    if (mudou && !confirm("Fechar sem salvar as alterações?")) return;
    setBuilderTreinos(null);
    setBuilderIndex(0);
    setBuilderEditingId(null);
    setBuilderSnapshot(null);
    setExercisePickerOpen(false);
  }

  function updateBuilderCurrent(fn) {
    setBuilderTreinos((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[builderIndex] = fn(next[builderIndex]);
      return next;
    });
  }

  function builderSetNome(nome) { updateBuilderCurrent((t) => ({ ...t, nome })); }
  function builderSetDuracao(duracaoMin) { updateBuilderCurrent((t) => ({ ...t, duracaoMin })); }

  // Adiciona um exercício do catálogo, agrupando automaticamente por grupo
  // muscular (cada grupo vira um bloco, sem a pessoa precisar nomear nada).
  function builderAddExercicio(catalogEx) {
    updateBuilderCurrent((t) => {
      const blocos = t.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      const exercicio = {
        nome: catalogEx.nome, series: catalogEx.series, repeticoes: catalogEx.repeticoes,
        descricao: catalogEx.descricao || "", observacoes: "", videoUrl: catalogEx.videoUrl || "",
      };
      const blocoExistente = blocos.find((b) => b.nome === catalogEx.grupo);
      if (blocoExistente) {
        blocoExistente.exercicios.push(exercicio);
      } else {
        blocos.push({ nome: catalogEx.grupo, exercicios: [exercicio] });
      }
      return { ...t, blocos };
    });
    showToast(`${catalogEx.nome} adicionado`);
  }

  function builderIsAdded(catalogEx) {
    const t = builderTreinos && builderTreinos[builderIndex];
    if (!t) return false;
    return t.blocos.some((b) => b.exercicios.some((ex) => ex.nome === catalogEx.nome));
  }

  function builderRemoveExercicio(blocoIdx, exIdx) {
    updateBuilderCurrent((t) => {
      const blocos = t.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      blocos[blocoIdx].exercicios.splice(exIdx, 1);
      const blocosLimpos = blocos.filter((b) => b.exercicios.length > 0);
      return { ...t, blocos: blocosLimpos };
    });
  }

  function builderMoveExercicio(blocoIdx, exIdx, dir) {
    updateBuilderCurrent((t) => {
      const blocos = t.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      const list = blocos[blocoIdx].exercicios;
      const target = exIdx + dir;
      if (target < 0 || target >= list.length) return t;
      [list[exIdx], list[target]] = [list[target], list[exIdx]];
      return { ...t, blocos };
    });
  }

  function builderUpdateExField(blocoIdx, exIdx, field, value) {
    updateBuilderCurrent((t) => {
      const blocos = t.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      blocos[blocoIdx].exercicios[exIdx] = { ...blocos[blocoIdx].exercicios[exIdx], [field]: value };
      return { ...t, blocos };
    });
  }

  function builderGoNext() {
    if (builderIndex < builderTreinos.length - 1) setBuilderIndex(builderIndex + 1);
  }
  function builderGoPrev() {
    if (builderIndex > 0) setBuilderIndex(builderIndex - 1);
  }

  function builderValidate() {
    const semNome = builderTreinos.findIndex((t) => !t.nome || !t.nome.trim());
    if (semNome !== -1) return `Dá um nome pro treino ${builderTreinos.length > 1 ? `#${semNome + 1}` : ""}`.trim();
    const semExercicio = builderTreinos.findIndex((t) => t.blocos.length === 0);
    if (semExercicio !== -1) return `Adiciona pelo menos um exercício no treino "${builderTreinos[semExercicio].nome}"`;
    return null;
  }

  function builderSave() {
    const erro = builderValidate();
    if (erro) { showToast(erro); return; }
    if (builderEditingId) {
      const normalized = normalizeImportedTreino(builderTreinos[0], treinos.filter((t) => t.id !== builderEditingId).map((t) => t.id));
      updateTreinos(treinos.map((t) => (t.id === builderEditingId ? { ...normalized, id: builderEditingId } : t)));
      showToast("Treino atualizado");
    } else {
      const novos = commitTreinosBatch(builderTreinos);
      showToast(novos.length > 1 ? `${novos.length} treinos criados` : "Treino criado");
    }
    closeBuilder(true);
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT_FORMATO_TREINO);
      showToast("Prompt copiado");
    } catch (e) {
      setImportError("Não consegui copiar automaticamente — segura o dedo no texto de exemplo (cinza, dentro da caixa) pra selecionar e copiar manualmente.");
    }
  }
  function openImportEdit(treino) {
    setEditingTreinoId(treino.id); setImportError("");
    setImportText(JSON.stringify({
      nome: treino.nome, duracaoMin: treino.duracaoMin, notas: treino.notas,
      blocos: treino.blocos.map((b) => ({ nome: b.nome, exercicios: b.exercicios.map((e) => ({ nome: e.nome, series: e.series, repeticoes: e.repeticoes, descricao: e.descricao, observacoes: e.observacoes, videoUrl: e.videoUrl || "" })) })),
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
    if (atividades.some((a) => a.id === id)) { setNovaAtividade(""); setNovaAtividadeDescanso(false); return; }
    updateAtividades([...atividades, novaAtividadeDescanso ? { id, nome, descanso: true } : { id, nome }]);
    setNovaAtividade("");
    setNovaAtividadeDescanso(false);
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
  const avgDor7d = useMemo(() => {
    const dores = acwrResult.series.slice(-7).map((d) => d.dor).filter((d) => d != null);
    if (!dores.length) return null;
    return dores.reduce((s, d) => s + d, 0) / dores.length;
  }, [acwrResult.series]);

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

  useEffect(() => {
    if (freqStats.perTypeList.length === 0) return;
    if (!freqStats.perTypeList.some((p) => p.key === freqSelectedType)) {
      setFreqSelectedType(freqStats.perTypeList[0].key);
    }
  }, [freqStats.perTypeList]);

  if (!loaded || !authChecked) {
    return (
      <div className="gt-root">
        <style>{APP_CSS}</style>
        <div className="gt-boot">
          <MovoIcon size={40} />
          <div className="gt-boot-label">Carregando…</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="gt-root">
        <style>{APP_CSS}</style>
        <div className="gt-login">
          <MovoLockup size={34} big />
          <div className="gt-title" style={{ marginBottom: 18 }}>Entrar</div>
          {authSent ? (
            <div className="gt-card">
              <div>Manda um link de acesso pro <b>{authEmail}</b>.</div>
              <div className="gt-field-label" style={{ marginTop: 10 }}>Abre o e-mail nesse mesmo aparelho e toca no link.</div>
            </div>
          ) : (
            <form className="gt-card" onSubmit={handleSendMagicLink}>
              <div className="gt-field-label" style={{ marginBottom: 8 }}>SEU E-MAIL</div>
              <input
                className="gt-select"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
              {authError && <div className="gt-error">{authError}</div>}
              <button className="gt-btn" style={{ marginTop: 14 }} type="submit" disabled={authLoading}>
                {authLoading ? "Enviando…" : "Enviar link de acesso"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <OnboardingWizard
        isRedo={onboardingIsRedo}
        onComplete={handleOnboardingComplete}
        onCompleteWithStrava={handleOnboardingCompleteAndConnectStrava}
        onSkip={handleOnboardingSkip}
        onCancel={handleOnboardingCancel}
      />
    );
  }

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
            selectedDate={selectedDate}
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
    <div className="gt-root gt-shell">
      <style>{APP_CSS}</style>
      <div className="gt-header">
        <div className="gt-header-row">
          <div>
            <MovoLockup size={16} />
            <div className="gt-title">{tab === "hoje" ? "Hoje" : tab === "treinos" ? "Treinos" : "Evolução"}</div>
          </div>
          <div className="gt-header-actions">
            <button className="gt-logout" onClick={() => setSettingsOpen(true)} title="Configurações">⚙️</button>
            <button className="gt-logout" onClick={() => setHelpOpen(true)} title="Ajuda">?</button>
            <button className="gt-logout" onClick={handleLogout} title={session.user.email}>Sair</button>
          </div>
        </div>
      </div>

      <div className="gt-body">
        {tab === "hoje" && (
          <div>
            <div className="gt-week-nav">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -7))}>‹</button>
              <div className="gt-week-label">{formatDateLabel(weekStripDays[0].iso)} – {formatDateLabel(weekStripDays[6].iso)}</div>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 7))}>›</button>
            </div>

            <div className="gt-week-strip">
              {weekStripDays.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  className={`gt-week-day ${d.isSelected ? "selected" : ""} ${d.isToday ? "today" : ""}`}
                  onClick={() => setSelectedDate(d.iso)}
                >
                  <div className="wd">{DIAS_ABREV[d.wd]}</div>
                  <div className="num">{dayOfMonth(d.iso)}</div>
                  <div className={`dot ${d.status}`} />
                </button>
              ))}
            </div>

            <div className="gt-day-heading">
              <div className="wd">{DIAS[weekday]}, {formatDateLabel(selectedDate)}</div>
              {selectedDate !== todayISO() && (
                <button className="gt-today-chip" onClick={() => setSelectedDate(todayISO())}>↺ Hoje</button>
              )}
            </div>

            {(streakInfo.streak > 0 || streakInfo.activeDaysThisWeek > 0) && (
              <div className="gt-streak-row">
                {streakInfo.streak > 0 && (
                  <div className="gt-stat-chip">🔥 {streakInfo.streak} dia{streakInfo.streak > 1 ? "s" : ""} seguido{streakInfo.streak > 1 ? "s" : ""}</div>
                )}
                <div className="gt-stat-chip">{streakInfo.activeDaysThisWeek}/{weekdayOf(todayISO()) + 1} dias essa semana</div>
              </div>
            )}

            {stravaConnected ? (
              <button className="gt-strava-sync-btn" disabled={stravaSyncing} onClick={handleStravaSync}>
                <StravaIcon size={15} />
                {stravaSyncing ? "Sincronizando…" : "Sincronizar Strava"}
              </button>
            ) : (
              <button className="gt-strava-sync-btn teaser" onClick={() => setSettingsOpen(true)}>
                <StravaIcon size={15} />
                Conectar com o Strava
              </button>
            )}

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
                    {attended && (
                      <div className="gt-item-carga-row">
                        {(() => {
                          const carga = (sessions[selectedDate]?.cargas || {})[key];
                          return carga
                            ? <span>{carga.duracaoMin}min · RPE {carga.rpe}{carga.dor != null ? ` · dor ${carga.dor}` : ""}</span>
                            : <span className="gt-text-muted">Duração/esforço não registrados</span>;
                        })()}
                        <button type="button" className="gt-item-carga-edit" onClick={() => openRpeModalFor(item, selectedDate, treino.nome)}>editar ✎</button>
                      </div>
                    )}
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
                      <span className="gt-item-tag">{atividade.descanso ? "DESCANSO" : "ATIVIDADE"}</span>
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
                        {log.status === "fui" && atividade.descanso && (
                          <div className="gt-item-carga-row">
                            <span className="gt-text-muted">Dia de descanso registrado — não conta como dia ativo nem entra na carga.</span>
                          </div>
                        )}
                        {log.status === "fui" && !atividade.descanso && (
                          <div className="gt-item-carga-row">
                            {(() => {
                              const carga = (sessions[selectedDate]?.cargas || {})[key];
                              return carga
                                ? <span>{carga.duracaoMin}min · RPE {carga.rpe}{carga.dor != null ? ` · dor ${carga.dor}` : ""}</span>
                                : <span className="gt-text-muted">Duração/esforço não registrados</span>;
                            })()}
                            <button type="button" className="gt-item-carga-edit" onClick={() => openRpeModalFor(item, selectedDate, atividade.nome)}>editar ✎</button>
                          </div>
                        )}
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
              <button className="gt-add-extra-card" onClick={() => { setAddingExtra(true); setExtraTipo("treino"); setExtraId(""); }}>
                <span className="plus">+</span> Adicionar avulso pra hoje
              </button>
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
                  <select className="gt-select" value={extraId} onChange={(e) => addExtraForToday(extraTipo, e.target.value)}>
                    <option value="">+ adicionar…</option>
                    {(extraTipo === "treino" ? treinos : atividades).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                  </select>
                </div>
                <div className="gt-modal-actions" style={{ marginTop: 10 }}>
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
                  <span className="nm">{a.nome}{a.descanso && <span className="gt-descanso-badge">descanso</span>}</span>
                  <button onClick={() => { if (confirm(`Excluir "${a.nome}"? Isso tira ela da agenda de todos os dias também.`)) deleteAtividade(a.id); }}>excluir</button>
                </div>
              ))}
            </div>
            <div className="gt-add-row">
              <input placeholder="Nova atividade (ex: Natação)" value={novaAtividade} onChange={(e) => setNovaAtividade(e.target.value)} />
              <button className="gt-btn small" onClick={addAtividade}>+ Add</button>
            </div>
            <label className="gt-checkbox-row">
              <input type="checkbox" checked={novaAtividadeDescanso} onChange={(e) => setNovaAtividadeDescanso(e.target.checked)} />
              É um dia de descanso (não conta como dia ativo na sequência)
            </label>

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
                    <button onClick={() => startBuilderEditExisting(t)}>editar</button>
                    <button className="gt-link-muted" onClick={() => openImportEdit(t)} title="Editar via JSON — pra campos avançados (descrição, observações, notas)">avançado (JSON)</button>
                    <button className="danger" onClick={() => { if (confirm(`Excluir "${t.nome}"?`)) deleteTreino(t.id); }}>excluir</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <button className="gt-btn secondary" onClick={openNovoTreinoChooser}>+ Novo treino</button>
            </div>
          </div>
        )}

        {tab === "evolucao" && (
          <div>
            <div className="gt-evo-tabs">
              <button className={evoTab === "frequencia" ? "active" : ""} onClick={() => setEvoTab("frequencia")}>Frequência</button>
              <button className={evoTab === "carga" ? "active" : ""} onClick={() => setEvoTab("carga")}>Carga (ACWR)</button>
              <button className={evoTab === "exercicio" ? "active" : ""} onClick={() => setEvoTab("exercicio")}>Peso por exercício</button>
              <button className={evoTab === "atividade" ? "active" : ""} onClick={() => setEvoTab("atividade")}>Notas de atividade</button>
              <button className={evoTab === "ranking" ? "active" : ""} onClick={() => setEvoTab("ranking")}>Ranking</button>
            </div>

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
                    freqStats.perTypeList.map((p) => (
                      <div
                        className={`gt-hist-item gt-freq-type-row ${freqSelectedType === p.key ? "active" : ""}`}
                        key={p.key}
                        onClick={() => setFreqSelectedType(p.key)}
                      >
                        <div className="d">{p.nome}</div>
                        <div className="w">{p.count}x{p.minutes > 0 ? ` · ${Math.round(p.minutes / 60 * 10) / 10}h` : ""}</div>
                      </div>
                    ))
                  )}
                </div>

                {freqStats.perTypeList.length > 0 && (
                  <div className="gt-card">
                    <div className="gt-field-label" style={{ marginBottom: 8 }}>EVOLUÇÃO — {freqStats.perTypeList.find((p) => p.key === freqSelectedType)?.nome || ""}</div>
                    <FrequencyChart series={freqStats.perTypeSeries[freqSelectedType] || []} unit={freqAvgUnit} />
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
                    {avgDor7d != null && (
                      <div>
                        <div className="lbl">DOR MÉDIA (7D)</div>
                        <div className="val" style={{ color: "#FF5A36" }}>{avgDor7d.toFixed(1)}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="gt-card">
                  <LoadChart series={acwrResult.series} acuteDays={7} />
                </div>
                <div className="gt-card gt-acwr-explain">
                  <b>ACWR</b> (do inglês <i>Acute:Chronic Workload Ratio</i>, "razão de carga aguda por crônica") compara o quanto você treinou nos últimos 7 dias com a sua média dos últimos 28 dias — é como sentir se o ritmo recente tá muito acima ou abaixo do que o seu corpo já tá acostumado.
                  <br /><br />
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

            {evoTab === "ranking" && (
              <div>
                <div className="gt-evo-tabs">
                  {[["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([id, label]) => (
                    <button key={id} className={leaderboardPeriod === id ? "active" : ""} onClick={() => setLeaderboardPeriod(id)}>{label}</button>
                  ))}
                </div>
                <div className="gt-evo-tabs" style={{ marginTop: 8 }}>
                  {[["dias", "Dias ativos"], ["treinos", "Nº treinos"], ["minutos", "Minutos"]].map(([id, label]) => (
                    <button key={id} className={leaderboardMetric === id ? "active" : ""} onClick={() => setLeaderboardMetric(id)}>{label}</button>
                  ))}
                </div>

                {!session && <div className="gt-empty" style={{ marginTop: 12 }}>Entre com sua conta pra ver o ranking com seus amigos.</div>}

                {session && friends.length === 0 && (
                  <div className="gt-empty" style={{ marginTop: 12 }}>
                    Você ainda não tem amigos adicionados. Vá em Configurações → Amigos pra convidar alguém pelo e-mail.
                  </div>
                )}

                {session && friends.length > 0 && leaderboardLoading && <div className="gt-empty" style={{ marginTop: 12 }}>Carregando…</div>}

                {session && friends.length > 0 && !leaderboardLoading && leaderboard && (() => {
                  const metricKey = leaderboardMetric === "dias" ? "dias_ativos" : leaderboardMetric === "treinos" ? "numero_treinos" : "minutos_totais";
                  const sorted = [...leaderboard].sort((a, b) => b[metricKey] - a[metricKey]);
                  const maxVal = Math.max(1, ...sorted.map((r) => r[metricKey]));
                  return (
                    <div className="gt-card" style={{ marginTop: 12 }}>
                      {sorted.map((r, i) => (
                        <div key={r.user_id} className="gt-rank-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <div style={{ width: 22, textAlign: "center", fontFamily: "'Oswald',sans-serif", color: i === 0 ? "var(--accent)" : "var(--text-muted)" }}>{i + 1}º</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: r.is_me ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nome}{r.is_me ? " (você)" : ""}</div>
                            <div style={{ background: "var(--border)", borderRadius: 4, height: 5, marginTop: 4, overflow: "hidden" }}>
                              <div style={{ background: "var(--accent)", height: "100%", width: `${(r[metricKey] / maxVal) * 100}%` }} />
                            </div>
                          </div>
                          <div style={{ fontFamily: "'Oswald',sans-serif", minWidth: 36, textAlign: "right" }}>
                            {leaderboardMetric === "minutos" ? `${r[metricKey]}min` : r[metricKey]}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
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

      {novoTreinoChooserOpen && (
        <div className="gt-modal-backdrop" onClick={() => setNovoTreinoChooserOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Novo treino</h3>
            <p>Como você quer criar essa ficha?</p>
            <div className="gt-choice-cards">
              <button type="button" className="gt-choice-card" onClick={startManualBuilderBlank}>
                <div className="gt-choice-icon">🏋️</div>
                <div className="gt-choice-title">Montar manualmente</div>
                <div className="gt-choice-desc">Escolha exercícios de um catálogo e monte a ficha do seu jeito.</div>
              </button>
              <button type="button" className="gt-choice-card" onClick={openTemplates}>
                <div className="gt-choice-icon">📋</div>
                <div className="gt-choice-title">Usar sugestão pronta</div>
                <div className="gt-choice-desc">Full body, core, reabilitação de ombro/joelho, push/pull/legs e outras — ajuste antes de salvar.</div>
              </button>
              <button type="button" className="gt-choice-card" onClick={() => { setNovoTreinoChooserOpen(false); openImportNew(); }}>
                <div className="gt-choice-icon">✨</div>
                <div className="gt-choice-title">Gerar com IA</div>
                <div className="gt-choice-desc">Descreva o treino que quer pro Claude (ou outra IA) e cole o resultado em JSON.</div>
              </button>
            </div>
            <div className="gt-modal-actions">
              <button className="gt-btn secondary" onClick={() => setNovoTreinoChooserOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {templatesOpen && (
        <div className="gt-modal-backdrop" onClick={() => setTemplatesOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Fichas sugeridas</h3>
            <p>Escolha uma pra começar — dá pra revisar e ajustar tudo antes de salvar.</p>
            <div className="gt-template-list">
              {TEMPLATE_ROUTINES.map((tpl) => (
                <button type="button" key={tpl.id} className="gt-template-card" onClick={() => startBuilderFromTemplate(tpl)}>
                  <div className="gt-template-nome">{tpl.nome}</div>
                  <div className="gt-template-sub">{tpl.subtitulo}</div>
                </button>
              ))}
            </div>
            <div className="gt-modal-actions">
              <button className="gt-btn secondary" onClick={() => setTemplatesOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {builderTreinos && (
        <div className="gt-focus gt-builder">
          <div className="gt-focus-header">
            <button className="gt-focus-close" onClick={closeBuilder}>✕</button>
            <div className="gt-focus-title-wrap">
              <div className="gt-focus-title">{builderTreinos.length > 1 ? `Treino ${builderIndex + 1} de ${builderTreinos.length}` : (builderEditingId ? "Editar treino" : "Novo treino")}</div>
            </div>
          </div>

          {builderTreinos.length > 1 && (
            <div className="gt-builder-steps">
              {builderTreinos.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gt-builder-step ${i === builderIndex ? "active" : ""}`}
                  onClick={() => setBuilderIndex(i)}
                >
                  {t.nome || `Treino ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          <div className="gt-focus-body gt-builder-body">
            <div className="gt-field-label">NOME DO TREINO</div>
            <input
              className="gt-input"
              placeholder="Ex: Treino de Pernas"
              value={builderTreinos[builderIndex].nome}
              onChange={(e) => builderSetNome(e.target.value)}
            />
            <div className="gt-field-label" style={{ marginTop: 14 }}>DURAÇÃO ESTIMADA (MIN, OPCIONAL)</div>
            <input
              className="gt-input"
              type="number"
              inputMode="numeric"
              placeholder="Ex: 50"
              value={builderTreinos[builderIndex].duracaoMin ?? ""}
              onChange={(e) => builderSetDuracao(e.target.value ? Number(e.target.value) : null)}
            />

            <div className="gt-field-label" style={{ marginTop: 18 }}>EXERCÍCIOS</div>
            {builderTreinos[builderIndex].blocos.length === 0 && (
              <div className="gt-empty" style={{ marginTop: 8 }}>Nenhum exercício ainda — adiciona pelo catálogo abaixo.</div>
            )}
            {builderTreinos[builderIndex].blocos.map((bloco, blocoIdx) => (
              <div className="gt-bloco" key={bloco.nome}>
                <div className="gt-bloco-title">{bloco.nome.toUpperCase()}</div>
                {bloco.exercicios.map((ex, exIdx) => (
                  <div className="gt-builder-ex-row" key={`${bloco.nome}-${exIdx}`}>
                    <div className="gt-builder-ex-main">
                      <div className="gt-builder-ex-nome">{ex.nome}</div>
                      <div className="gt-builder-ex-fields">
                        <input type="number" inputMode="numeric" className="gt-builder-ex-input" value={ex.series} onChange={(e) => builderUpdateExField(blocoIdx, exIdx, "series", Number(e.target.value) || 0)} />
                        <span className="gt-builder-ex-x">x</span>
                        <input type="text" className="gt-builder-ex-input wide" value={ex.repeticoes} onChange={(e) => builderUpdateExField(blocoIdx, exIdx, "repeticoes", e.target.value)} />
                      </div>
                    </div>
                    <div className="gt-builder-ex-actions">
                      <button type="button" onClick={() => builderMoveExercicio(blocoIdx, exIdx, -1)} disabled={exIdx === 0}>▲</button>
                      <button type="button" onClick={() => builderMoveExercicio(blocoIdx, exIdx, 1)} disabled={exIdx === bloco.exercicios.length - 1}>▼</button>
                      <button type="button" className="danger" onClick={() => builderRemoveExercicio(blocoIdx, exIdx)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <button className="gt-add-extra-card" type="button" onClick={() => setExercisePickerOpen(true)}>
              <span className="plus">+</span> Adicionar exercício
            </button>
            <div style={{ height: 76 }} />
          </div>

          <div className="gt-focus-footer gt-builder-footer">
            {builderIndex > 0 && <button className="gt-btn secondary" onClick={builderGoPrev}>◀ Anterior</button>}
            {builderIndex < builderTreinos.length - 1
              ? <button className="gt-btn" onClick={builderGoNext}>Próximo treino ▶</button>
              : <button className="gt-btn" onClick={builderSave}>{builderTreinos.length > 1 ? `Salvar ${builderTreinos.length} treinos` : (builderEditingId ? "Salvar alterações" : "Salvar treino")}</button>}
          </div>

          {exercisePickerOpen && (
            <ExercisePickerModal
              search={exercisePickerSearch}
              setSearch={setExercisePickerSearch}
              grupo={exercisePickerGrupo}
              setGrupo={setExercisePickerGrupo}
              isAdded={builderIsAdded}
              onAdd={builderAddExercicio}
              onClose={() => setExercisePickerOpen(false)}
            />
          )}
        </div>
      )}

      {importOpen && (
        <div className="gt-modal-backdrop" onClick={() => { setImportOpen(false); setEditingTreinoId(null); }}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTreinoId ? "Editar treino (JSON)" : "Gerar treino com IA (JSON)"}</h3>
            <p>
              Cole aqui o JSON do treino — pode pedir pro Claude gerar nesse formato.
              {!editingTreinoId && " Pra importar vários treinos de uma vez (ex: perna e costas), cole uma lista: [ {treino 1}, {treino 2} ]."}
            </p>
            <button className="gt-btn secondary gt-copy-prompt-btn" type="button" onClick={handleCopyPrompt}>📋 Copiar prompt de formato</button>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={EXEMPLO_JSON} spellCheck={false} />
            {importError && <div className="gt-error">{importError}</div>}
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={handleImport}>{editingTreinoId ? "Salvar alterações" : "Importar"}</button>
              <button className="gt-btn secondary" onClick={() => { setImportOpen(false); setEditingTreinoId(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="gt-modal-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Como usar o app</h3>
            <div className="gt-help-content">
              <div className="gt-help-item"><b>Hoje</b> — o que está na agenda do dia selecionado (treinos e atividades). Marque cada exercício como feito/pulado, e a atividade como "fui" ou "não fui". Use as setas ou "Voltar pra hoje" pra navegar entre os dias.</div>
              <div className="gt-help-item"><b>Ajustar só o dia</b> — na aba Hoje, dá pra adicionar um treino ou atividade avulsa só naquele dia ("+ Adicionar avulso"), sem mexer na agenda fixa da semana.</div>
              <div className="gt-help-item"><b>Treinos</b> — a lista das suas fichas de academia. Toque numa ficha e em "Editar" pra mudar séries, exercícios etc. de forma permanente (isso é o treino-padrão, vale pra sempre que ele aparecer na agenda).</div>
              <div className="gt-help-item"><b>Novo treino</b> — em Treinos, "+ Novo treino" abre 3 jeitos de criar: montar na mão escolhendo exercícios de um catálogo, usar uma ficha pronta (full body, core, reabilitação de ombro/joelho, etc. — dá pra ajustar antes de salvar), ou colar um JSON gerado por IA. Use "Copiar prompt de formato" pra levar um texto pronto pro Claude (ou outra IA) gerar o JSON certo. Dá pra importar vários treinos de uma vez (ex: perna e costas juntos) colando uma lista em vez de um treino só. Também dá pra incluir um link do YouTube por exercício ("videoUrl") — ele fica escondido, aparecendo só um botão "Ver vídeo" dentro do exercício, que toca o vídeo ali mesmo no app.</div>
              <div className="gt-help-item"><b>Duração, esforço (RPE) e dor</b> — ao concluir um treino ou atividade, o app pergunta quanto tempo durou e o quão puxado foi (0 a 10). É o que alimenta o cálculo de carga aguda/crônica (ACWR) na aba Evolução — a métrica mais importante pra saber se você está treinando pesado demais, de menos, ou numa faixa saudável, e evitar lesão por excesso de carga. Também dá pra registrar, opcionalmente, a dor pós-sessão (0 a 10) — aparece como uma linha junto do gráfico de carga.</div>
              <div className="gt-help-item"><b>Frequência</b> — também em Evolução: quantos treinos/dias você fez num período (semana, mês, 12 meses ou desde sempre), com médias e o total por tipo de atividade.</div>
              <div className="gt-help-item"><b>Integrações</b> — conecte com o Strava pra importar suas atividades de lá (corrida, pedalada, etc.) direto pra agenda, sem digitar nada. A importação é manual: você decide quando sincronizar. Configura em "⚙️ Configurações", no cabeçalho.</div>
            </div>
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={() => setHelpOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="gt-modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Configurações</h3>

            <div className="gt-settings-group">
              <div className="gt-settings-group-title">Perfil</div>
              <div className="gt-settings-card">
                <div className="gt-settings-label-row">
                  <div className="gt-settings-label">Nome de exibição</div>
                  <button type="button" className={`gt-info-btn ${infoOpen.profile ? "active" : ""}`} onClick={() => toggleInfo("profile")}>i</button>
                </div>
                {infoOpen.profile && (
                  <div className="gt-settings-hint">Esse nome aparece pros seus amigos no ranking e em relatórios compartilhados, no lugar do seu e-mail.</div>
                )}
                <div className="gt-settings-body">
                  <input
                    className="gt-input"
                    type="text"
                    placeholder="Seu nome (ex: Andre)"
                    defaultValue={displayName}
                    onBlur={(e) => { if (e.target.value.trim() !== displayName) handleSaveDisplayName(e.target.value.trim()); }}
                  />
                </div>
              </div>
            </div>

            <div className="gt-settings-group">
              <div className="gt-settings-group-title">Integrações</div>
              <div className="gt-settings-card">
                <div className="gt-settings-label-row">
                  <div className="gt-settings-label"><StravaIcon size={16} /> Strava</div>
                  <button type="button" className={`gt-info-btn ${infoOpen.strava ? "active" : ""}`} onClick={() => toggleInfo("strava")}>i</button>
                </div>
                {infoOpen.strava && (
                  <div className="gt-settings-hint">
                    {stravaConnected
                      ? 'Conectado. A importação é manual — use "Sincronizar Strava" na aba Hoje sempre que quiser trazer atividades novas.'
                      : "Conecte pra importar corridas, pedaladas e outras atividades direto do Strava pra sua agenda."}
                  </div>
                )}
                <div className="gt-settings-body">
                  {stravaConnected ? (
                    <div className="gt-strava-box-actions">
                      <button className="gt-btn secondary" disabled={stravaSyncing} onClick={handleStravaSync}>
                        <StravaIcon size={14} /> {stravaSyncing ? "Sincronizando…" : "Sincronizar agora"}
                      </button>
                      <button className="gt-btn ghost" onClick={handleStravaDisconnect}>Desconectar</button>
                    </div>
                  ) : (
                    <button className="gt-btn secondary" disabled={stravaConnecting} onClick={handleStravaConnect}>
                      <StravaIcon size={14} /> {stravaConnecting ? "Conectando…" : "Conectar com o Strava"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="gt-settings-group">
              <div className="gt-settings-group-title">Compartilhamento</div>
              <div className="gt-settings-card">
                <div className="gt-settings-label-row">
                  <div className="gt-settings-label">Meus relatórios</div>
                  <button type="button" className={`gt-info-btn ${infoOpen.share_out ? "active" : ""}`} onClick={() => toggleInfo("share_out")}>i</button>
                </div>
                {infoOpen.share_out && (
                  <div className="gt-settings-hint">Libere pra alguém (ex: seu personal/fisio) ver seus relatórios. A pessoa precisa ter (ou criar) uma conta no Movo com esse e-mail — ela vê só o que você marcar aqui, e você pode revogar quando quiser.</div>
                )}
                <div className="gt-settings-body">
                  {myShares.length > 0 && (
                    <div className="gt-admin-list" style={{ marginBottom: 10 }}>
                      {myShares.map((s) => (
                        <div className="gt-admin-user-card" key={s.id}>
                          <div className="gt-admin-user-email">{s.viewer_email}</div>
                          <div className="gt-admin-user-row">
                            {[s.share_frequencia && "Frequência", s.share_carga && "Carga", s.share_peso_notas && "Peso e notas", s.share_treinos && "Treinos completos"].filter(Boolean).join(" · ") || "Nenhuma categoria"}
                          </div>
                          <button className="gt-btn ghost small" onClick={() => handleRevokeShare(s.id)}>Revogar</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    className="gt-input"
                    type="email"
                    placeholder="e-mail de quem vai ver (ex: fisio@email.com)"
                    value={shareEmailInput}
                    onChange={(e) => setShareEmailInput(e.target.value)}
                  />
                  <div className="gt-onb-chips" style={{ margin: "8px 0" }}>
                    {[
                      ["frequencia", "Frequência"],
                      ["carga", "Carga/ACWR"],
                      ["peso_notas", "Peso e notas"],
                      ["treinos", "Treinos completos"],
                    ].map(([k, label]) => (
                      <button
                        key={k}
                        type="button"
                        className={shareFlags[k] ? "active" : ""}
                        onClick={() => setShareFlags((prev) => ({ ...prev, [k]: !prev[k] }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button className="gt-btn secondary" onClick={handleAddShare}>Compartilhar</button>
                </div>
              </div>
              {sharedWithMe.length > 0 && (
                <div className="gt-settings-card">
                  <div className="gt-settings-label-row">
                    <div className="gt-settings-label">Compartilhados comigo</div>
                    <button type="button" className={`gt-info-btn ${infoOpen.share_in ? "active" : ""}`} onClick={() => toggleInfo("share_in")}>i</button>
                  </div>
                  {infoOpen.share_in && (
                    <div className="gt-settings-hint">Relatórios que outras pessoas liberaram pra você ver.</div>
                  )}
                  <div className="gt-settings-body">
                    <div className="gt-admin-list">
                      {sharedWithMe.map((s) => (
                        <div className="gt-admin-user-card" key={s.id}>
                          <div className="gt-admin-user-email">{shareOwnerNames[s.owner_user_id] || s.owner_email}</div>
                          <button className="gt-btn secondary small" onClick={() => { setSettingsOpen(false); handleViewSharedReport(s); }}>Ver relatórios</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="gt-settings-group">
              <div className="gt-settings-group-title">Amigos e ranking</div>
              <div className="gt-settings-card">
                <div className="gt-settings-label-row">
                  <div className="gt-settings-label">Amigos</div>
                  <button type="button" className={`gt-info-btn ${infoOpen.friends ? "active" : ""}`} onClick={() => toggleInfo("friends")}>i</button>
                </div>
                {infoOpen.friends && (
                  <div className="gt-settings-hint">Convide amigos pelo e-mail pra comparar frequência e treinos no ranking (aba Evolução → Ranking). Os dois precisam ter conta no Movo, e o pedido só vira amizade depois de aceito.</div>
                )}
                <div className="gt-settings-body">
                  {incomingRequests.length > 0 && (
                    <div className="gt-admin-list" style={{ marginBottom: 10 }}>
                      {incomingRequests.map((r) => (
                        <div className="gt-admin-user-card" key={r.id}>
                          <div className="gt-admin-user-email">{r.from_email} quer ser seu amigo</div>
                          <div className="gt-strava-box-actions">
                            <button className="gt-btn secondary small" onClick={() => handleRespondFriendRequest(r.id, true)}>Aceitar</button>
                            <button className="gt-btn ghost small" onClick={() => handleRespondFriendRequest(r.id, false)}>Recusar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {friends.length > 0 && (
                    <div className="gt-admin-list" style={{ marginBottom: 10 }}>
                      {friends.map((f) => (
                        <div className="gt-admin-user-card" key={f.id}>
                          <div className="gt-admin-user-email">{f.nome}</div>
                          <button className="gt-btn ghost small" onClick={() => handleRemoveFriend(f.id)}>Remover</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {outgoingRequests.length > 0 && (
                    <div className="gt-settings-hint" style={{ marginBottom: 10 }}>
                      Pedido(s) enviado(s), aguardando: {outgoingRequests.map((r) => r.to_email).join(", ")}
                    </div>
                  )}
                  <input
                    className="gt-input"
                    type="email"
                    placeholder="e-mail do amigo"
                    value={friendEmailInput}
                    onChange={(e) => setFriendEmailInput(e.target.value)}
                  />
                  <button className="gt-btn secondary" style={{ marginTop: 8 }} disabled={friendActionLoading} onClick={handleSendFriendRequest}>
                    {friendActionLoading ? "Enviando…" : "Adicionar amigo"}
                  </button>
                </div>
              </div>
            </div>

            <div className="gt-settings-group">
              <div className="gt-settings-group-title">Conta</div>
              <div className="gt-settings-card">
                <div className="gt-settings-label-row">
                  <div className="gt-settings-label">Configuração inicial</div>
                  <button type="button" className={`gt-info-btn ${infoOpen.onboarding ? "active" : ""}`} onClick={() => toggleInfo("onboarding")}>i</button>
                </div>
                {infoOpen.onboarding && (
                  <div className="gt-settings-hint">Refaz o questionário de setup e substitui os treinos/agenda atuais (com aviso antes de confirmar).</div>
                )}
                <div className="gt-settings-body">
                  <button className="gt-btn secondary" onClick={openOnboardingRedo}>🔄 Refazer configuração inicial</button>
                </div>
              </div>
              {session.user.email === ADMIN_EMAIL && (
                <div className="gt-settings-card">
                  <div className="gt-settings-label-row">
                    <div className="gt-settings-label">Uso (admin)</div>
                    <button type="button" className={`gt-info-btn ${infoOpen.admin ? "active" : ""}`} onClick={() => toggleInfo("admin")}>i</button>
                  </div>
                  {infoOpen.admin && (
                    <div className="gt-settings-hint">Quantas pessoas usam o Movo, engajamento e erros recentes.</div>
                  )}
                  <div className="gt-settings-body">
                    <button className="gt-btn secondary" onClick={() => { setSettingsOpen(false); openAdmin(); }}>📊 Ver uso</button>
                  </div>
                </div>
              )}
            </div>

            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={() => setSettingsOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {adminOpen && (
        <div className="gt-modal-backdrop" onClick={() => setAdminOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Uso do Movo</h3>
            {adminLoading && <div className="gt-empty">Carregando…</div>}
            {!adminLoading && adminUsers && (
              <>
                <div className="gt-admin-summary">{adminUsers.length} usuário{adminUsers.length === 1 ? "" : "s"}</div>
                <div className="gt-admin-list">
                  {adminUsers.map((u) => (
                    <div className="gt-admin-user-card" key={u.user_id}>
                      <div className="gt-admin-user-email">{u.nome ? `${u.nome} (${u.email})` : u.email}</div>
                      <div className="gt-admin-user-row">Cadastrou: {u.cadastrou_em ? new Date(u.cadastrou_em).toLocaleDateString("pt-BR") : "—"} · Último login: {u.ultimo_login ? new Date(u.ultimo_login).toLocaleDateString("pt-BR") : "—"}</div>
                      <div className="gt-admin-user-row">Onboarding: {u.fez_onboarding ? "sim" : "não"} · Strava: {u.conectou_strava ? "conectado" : "não"}</div>
                      <div className="gt-admin-user-row">Acessos ao app: {u.acessos_7d ?? 0} (7d) · {u.acessos_30d ?? 0} (30d) · {u.dias_com_acesso_7d ?? 0} dias diferentes (7d)</div>
                      <div className="gt-admin-user-row">Dias com treino logado*: {u.dias_ativos_7d ?? 0} (7d) · {u.dias_ativos_30d ?? 0} (30d)</div>
                    </div>
                  ))}
                  {adminUsers.length === 0 && <div className="gt-empty">Nenhum usuário ainda.</div>}
                </div>
                <div className="gt-settings-hint" style={{ marginTop: -2 }}>* Dias com treino logado conta a data do treino, não quando ele foi salvo — sincronizar o Strava pela primeira vez importa até 30 dias pra trás de uma vez, então esse número pode subir bastante sem a pessoa ter aberto o app naqueles dias. "Acessos ao app" é o número real de vezes que o app foi aberto.</div>
                <div className="gt-settings-label" style={{ marginTop: 16 }}>Erros recentes</div>
                <div className="gt-admin-list">
                  {(adminErrors || []).map((e, i) => (
                    <div className="gt-admin-error-item" key={i}>
                      <div className="gt-admin-user-row">{new Date(e.created_at).toLocaleString("pt-BR")} · {e.email || "—"}</div>
                      <div className="gt-admin-user-row"><b>{e.context}</b>{e.message ? ` — ${e.message}` : ""}</div>
                    </div>
                  ))}
                  {(adminErrors || []).length === 0 && <div className="gt-empty">Nenhum erro registrado.</div>}
                </div>
              </>
            )}
            <div className="gt-modal-actions">
              <button className="gt-btn secondary" onClick={loadAdminData}>🔄 Atualizar</button>
              <button className="gt-btn" onClick={() => setAdminOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {viewingShare && (
        <div className="gt-modal-backdrop" onClick={closeSharedReport}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Relatórios de {(viewingReport && (viewingReport.owner_display_name || viewingReport.owner_email)) || shareOwnerNames[viewingShare.owner_user_id] || viewingShare.owner_email}</h3>
            {viewingLoading && <div className="gt-empty">Carregando…</div>}
            {!viewingLoading && viewingReport && (() => {
              const flags = viewingReport.flags || {};
              const freq = flags.frequencia
                ? computeFrequencyStats(viewingReport.sessions, viewingReport.treinos, viewingReport.atividades, addDays(todayISO(), -29), todayISO(), "semana")
                : null;
              const acwr = flags.carga ? computeACWR(viewingReport.sessions, todayISO()) : null;
              const zone = acwr ? acwrZone(acwr.ratio) : null;
              const avgDor7d = acwr
                ? (() => {
                    const dores = acwr.series.slice(-7).map((d) => d.dor).filter((d) => d != null);
                    return dores.length ? dores.reduce((s, d) => s + d, 0) / dores.length : null;
                  })()
                : null;
              const pesoList = [];
              if (flags.peso_notas) {
                (viewingReport.treinos || []).forEach((t) => {
                  (t.blocos || []).forEach((b) => {
                    (b.exercicios || []).forEach((ex) => {
                      const sets = lastLoggedSetsForExercise(viewingReport.sessions, ex.id, addDays(todayISO(), 1));
                      if (sets && sets.length) {
                        pesoList.push({ nome: ex.nome, resumo: sets.map((s) => `${s.peso || 0}kg×${s.reps || 0}`).join(" / ") });
                      }
                    });
                  });
                });
              }
              const notas = flags.peso_notas
                ? (viewingReport.atividades || [])
                    .flatMap((a) => notesHistoryForData(viewingReport.sessions, a.id, 3).map((n) => ({ ...n, atividadeNome: a.nome })))
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 8)
                : [];
              return (
                <div className="gt-help-content">
                  {flags.frequencia && freq && (
                    <div className="gt-help-item">
                      <b>Frequência (últimos 30 dias)</b>
                      <div>{freq.totalSessions} sessões em {freq.totalDays} dias{freq.totalMinutes ? ` · ${freq.totalMinutes} min no total` : ""}</div>
                      {freq.perTypeList.map((p) => (
                        <div key={p.key} className="gt-admin-user-row">{p.nome}: {p.count}x{p.minutes ? ` · ${p.minutes} min` : ""}</div>
                      ))}
                      {freq.perTypeList.length === 0 && <div className="gt-admin-user-row">Sem registros nos últimos 30 dias.</div>}
                    </div>
                  )}
                  {flags.carga && acwr && (
                    <div className="gt-help-item">
                      <b>Carga / ACWR</b>
                      <div>Razão atual: {acwr.ratio != null ? acwr.ratio.toFixed(2) : "—"} — {zone.label}</div>
                      {avgDor7d != null && <div style={{ color: "#FF5A36" }}>Dor média (7 dias): {avgDor7d.toFixed(1)}</div>}
                      <div style={{ marginTop: 8 }}><LoadChart series={acwr.series} acuteDays={7} /></div>
                    </div>
                  )}
                  {flags.peso_notas && (
                    <div className="gt-help-item">
                      <b>Peso por exercício (mais recente)</b>
                      {pesoList.length === 0 && <div className="gt-admin-user-row">Sem registros ainda.</div>}
                      {pesoList.map((p, i) => (<div key={i} className="gt-admin-user-row">{p.nome}: {p.resumo}</div>))}
                    </div>
                  )}
                  {flags.peso_notas && (
                    <div className="gt-help-item">
                      <b>Notas recentes</b>
                      {notas.length === 0 && <div className="gt-admin-user-row">Nenhuma nota ainda.</div>}
                      {notas.map((n, i) => (<div key={i} className="gt-admin-user-row">{n.label} ({n.atividadeNome}): {n.comentario}</div>))}
                    </div>
                  )}
                  {flags.treinos && (
                    <div className="gt-help-item">
                      <b>Fichas de treino</b>
                      {(viewingReport.treinos || []).map((t) => (
                        <div key={t.id} className="gt-admin-user-row">
                          <b>{t.nome}</b>
                          {(t.blocos || []).map((b, bi) => (
                            <div key={bi}>{(b.exercicios || []).map((ex) => ex.nome).join(", ")}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={closeSharedReport}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OnboardingWizard({ onComplete, onCompleteWithStrava, onSkip, onCancel, isRedo }) {
  const [step, setStep] = useState(isRedo ? 0 : 1);
  const [musDias, setMusDias] = useState(3);
  const [musWeekdays, setMusWeekdays] = useState([]);
  const [ativConfig, setAtivConfig] = useState([]);
  const [novaNome, setNovaNome] = useState("");
  const [connectingStrava, setConnectingStrava] = useState(false);

  function toggleAtividade(nome) {
    setAtivConfig((prev) =>
      prev.some((a) => a.nome === nome) ? prev.filter((a) => a.nome !== nome) : [...prev, { nome, dias: [] }]
    );
  }
  function toggleAtividadeDia(nome, dia) {
    setAtivConfig((prev) =>
      prev.map((a) => (a.nome !== nome ? a : { ...a, dias: a.dias.includes(dia) ? a.dias.filter((d) => d !== dia) : [...a.dias, dia] }))
    );
  }
  function addCustomAtividade() {
    const nome = novaNome.trim();
    if (!nome) return;
    if (ativConfig.some((a) => a.nome.toLowerCase() === nome.toLowerCase())) { setNovaNome(""); return; }
    setAtivConfig((prev) => [...prev, { nome, dias: [] }]);
    setNovaNome("");
  }
  function removeAtividade(nome) {
    setAtivConfig((prev) => prev.filter((a) => a.nome !== nome));
  }

  const preview = useMemo(() => buildOnboardingData(musDias, musWeekdays, ativConfig), [musDias, musWeekdays, ativConfig]);

  // Permite ajustar os exercícios de cada treino sugerido direto no resumo,
  // antes de concluir — sem isso a pessoa só via o treino "pronto" depois de
  // já estar dentro do app. As edições ficam por id de treino; se o split
  // muda (musDias), os ids mudam junto e as edições antigas somem sozinhas.
  const [treinoEdits, setTreinoEdits] = useState({});
  const [editingTreino, setEditingTreino] = useState(null);
  const [editingTreinoSnapshot, setEditingTreinoSnapshot] = useState(null);
  const [onbPickerOpen, setOnbPickerOpen] = useState(false);
  const [onbPickerGrupo, setOnbPickerGrupo] = useState(CATALOG_GRUPOS[0].label);
  const [onbPickerSearch, setOnbPickerSearch] = useState("");

  useEffect(() => { setTreinoEdits({}); }, [musDias]);

  // Trocar o número de dias refaz a divisão de treinos do zero, então
  // qualquer ajuste manual feito nas fichas (passo 4) seria descartado em
  // silêncio — avisa antes, só quando isso de fato tem algo a perder.
  function handleMusDiasChange(n) {
    if (n !== musDias && Object.keys(treinoEdits).length > 0) {
      if (!confirm("Mudar os dias de musculação vai descartar os ajustes que você já fez nas fichas. Continuar?")) return;
    }
    setMusDias(n);
    setMusWeekdays([]);
  }

  const previewTreinos = preview.treinos.map((t) => treinoEdits[t.id] || t);

  function openEditTreino(treino) {
    const cloned = JSON.parse(JSON.stringify(treino));
    setEditingTreino(cloned);
    setEditingTreinoSnapshot(JSON.stringify(cloned));
    setOnbPickerOpen(false);
    setOnbPickerSearch("");
  }
  function closeEditTreino(skipConfirm) {
    const mudou = !skipConfirm && editingTreino && JSON.stringify(editingTreino) !== editingTreinoSnapshot;
    if (mudou && !confirm("Fechar sem salvar as alterações dessa ficha?")) return;
    setEditingTreino(null);
    setEditingTreinoSnapshot(null);
    setOnbPickerOpen(false);
    setOnbPickerSearch("");
  }
  function saveEditTreino() {
    setTreinoEdits((prev) => ({ ...prev, [editingTreino.id]: editingTreino }));
    closeEditTreino(true);
  }
  function onbIsAdded(catalogEx) {
    if (!editingTreino) return false;
    return editingTreino.blocos.some((b) => b.exercicios.some((ex) => ex.nome === catalogEx.nome));
  }
  function onbAddExercicio(catalogEx) {
    setEditingTreino((prev) => {
      const blocos = prev.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      const exercicio = { id: catalogEx.id, nome: catalogEx.nome, series: catalogEx.series, repeticoes: catalogEx.repeticoes, descricao: catalogEx.descricao || "", observacoes: "", videoUrl: catalogEx.videoUrl || "" };
      const blocoExistente = blocos.find((b) => b.nome === catalogEx.grupo);
      if (blocoExistente) blocoExistente.exercicios.push(exercicio);
      else blocos.push({ nome: catalogEx.grupo, exercicios: [exercicio] });
      return { ...prev, blocos };
    });
  }
  function onbRemoveExercicio(blocoIdx, exIdx) {
    setEditingTreino((prev) => {
      const blocos = prev.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      blocos[blocoIdx].exercicios.splice(exIdx, 1);
      return { ...prev, blocos: blocos.filter((b) => b.exercicios.length > 0) };
    });
  }
  function onbMoveExercicio(blocoIdx, exIdx, dir) {
    setEditingTreino((prev) => {
      const blocos = prev.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      const list = blocos[blocoIdx].exercicios;
      const target = exIdx + dir;
      if (target < 0 || target >= list.length) return prev;
      [list[exIdx], list[target]] = [list[target], list[exIdx]];
      return { ...prev, blocos };
    });
  }
  function onbUpdateExField(blocoIdx, exIdx, field, value) {
    setEditingTreino((prev) => {
      const blocos = prev.blocos.map((b) => ({ ...b, exercicios: b.exercicios.slice() }));
      blocos[blocoIdx].exercicios[exIdx] = { ...blocos[blocoIdx].exercicios[exIdx], [field]: value };
      return { ...prev, blocos };
    });
  }
  function finishOnboarding(fn) {
    fn({ ...preview, treinos: previewTreinos });
  }

  return (
    <div className="gt-root">
      <style>{APP_CSS}</style>
      <div className="gt-login gt-onb-root">
        <MovoLockup size={34} big />
        <div className="gt-title" style={{ marginBottom: 18 }}>{isRedo ? "Refazer configuração" : "Vamos configurar seu treino"}</div>

        {step === 0 && (
          <div className="gt-card">
            <p>Isso vai substituir seu treino-base e a agenda semanal atuais pelos novos, gerados a partir das próximas respostas. O histórico de treinos e atividades já registrados não é apagado.</p>
            <div className="gt-modal-actions" style={{ marginTop: 16 }}>
              <button className="gt-btn" onClick={() => setStep(1)}>Continuar</button>
              <button className="gt-btn secondary" onClick={onCancel}>Cancelar</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="gt-card">
            <div className="gt-field-label">MUSCULAÇÃO</div>
            <p>Quantos dias por semana você treina (ou pretende treinar) musculação?</p>
            <div className="gt-onb-chips">
              {[0, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={musDias === n ? "active" : ""}
                  onClick={() => handleMusDiasChange(n)}
                >
                  {n === 0 ? "Não treino" : `${n}x por semana`}
                </button>
              ))}
            </div>
            <button className="gt-btn" style={{ marginTop: 16 }} onClick={() => setStep(musDias > 0 ? 2 : 3)}>Continuar</button>
            {!isRedo && (
              <button type="button" className="gt-onb-skip" onClick={onSkip}>Pular, prefiro configurar manualmente depois</button>
            )}
          </div>
        )}

        {step === 2 && musDias > 0 && (
          <div className="gt-card">
            <div className="gt-field-label">DIAS DE MUSCULAÇÃO</div>
            <p>Escolha {musDias} dias da semana pra musculação.</p>
            <div className="gt-onb-week-grid">
              {DIAS_ABREV.map((label, idx) => {
                const on = musWeekdays.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={on ? "active" : ""}
                    onClick={() => {
                      if (on) setMusWeekdays(musWeekdays.filter((d) => d !== idx));
                      else if (musWeekdays.length < musDias) setMusWeekdays([...musWeekdays, idx]);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="gt-field-label">{musWeekdays.length} de {musDias} selecionados</div>
            <div className="gt-modal-actions" style={{ marginTop: 16 }}>
              <button className="gt-btn" disabled={musWeekdays.length !== musDias} onClick={() => setStep(3)}>Continuar</button>
              <button className="gt-btn secondary" onClick={() => setStep(1)}>Voltar</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="gt-card">
            <div className="gt-field-label">OUTRAS ATIVIDADES</div>
            <p>Além da musculação, quais outras atividades você faz?</p>
            <div className="gt-onb-chips">
              {ONBOARDING_ATIVIDADES_SUGESTOES.map((nome) => {
                const on = ativConfig.some((a) => a.nome === nome);
                return (
                  <button key={nome} type="button" className={on ? "active" : ""} onClick={() => toggleAtividade(nome)}>
                    {nome}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                className="gt-select"
                placeholder="Outra atividade..."
                value={novaNome}
                onChange={(e) => setNovaNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomAtividade(); } }}
              />
              <button className="gt-btn small" type="button" onClick={addCustomAtividade}>+</button>
            </div>

            {ativConfig.map((a) => (
              <div key={a.nome} className="gt-onb-ativ-block">
                <div className="gt-onb-ativ-header">
                  <span>{a.nome}</span>
                  <button type="button" onClick={() => removeAtividade(a.nome)}>✕</button>
                </div>
                <div className="gt-onb-week-grid small">
                  {DIAS_ABREV.map((label, idx) => {
                    const on = a.dias.includes(idx);
                    return (
                      <button key={idx} type="button" className={on ? "active" : ""} onClick={() => toggleAtividadeDia(a.nome, idx)}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="gt-modal-actions" style={{ marginTop: 16 }}>
              <button className="gt-btn" onClick={() => setStep(4)}>Continuar</button>
              <button className="gt-btn secondary" onClick={() => setStep(musDias > 0 ? 2 : 1)}>Voltar</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="gt-card">
            <div className="gt-field-label">RESUMO DA SEMANA</div>
            <p className="gt-onb-resumo-intro">Isso é um ponto de partida baseado no que você respondeu — nada é definitivo. Você pode trocar exercícios, ajustar séries/duração ou criar um treino do zero quando quiser, direto em cada ficha.</p>
            {DIAS.map((nomeDia, idx) => {
              const items = preview.schedule[idx] || [];
              return (
                <div key={idx} className="gt-onb-resumo-dia">
                  <div className="wd">{DIAS_ABREV[idx]}</div>
                  <div className="items">
                    {items.length === 0
                      ? "—"
                      : items.map((it, i) => {
                          if (it.tipo === "treino") {
                            const treino = previewTreinos.find((t) => t.id === it.id);
                            if (!treino) return <div key={i}>{it.id}</div>;
                            const n = flattenExercicios(treino).length;
                            return (
                              <button type="button" key={i} className="gt-onb-resumo-item gt-onb-resumo-item-edit" onClick={() => openEditTreino(treino)}>
                                {treino.nome}
                                <span className="gt-onb-resumo-meta"> · {n} exercício{n === 1 ? "" : "s"} · {treino.duracaoMin}min · editar ✎</span>
                              </button>
                            );
                          }
                          const ativ = preview.atividades.find((a) => a.id === it.id);
                          return <div key={i} className="gt-onb-resumo-item">{ativ?.nome || it.id}</div>;
                        })}
                  </div>
                </div>
              );
            })}
            <div className="gt-modal-actions" style={{ marginTop: 16 }}>
              <button className="gt-btn" onClick={() => (!isRedo && onCompleteWithStrava ? setStep(5) : finishOnboarding(onComplete))}>
                {!isRedo && onCompleteWithStrava ? "Continuar" : "Concluir e começar"}
              </button>
              <button className="gt-btn secondary" onClick={() => setStep(3)}>Voltar</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="gt-card">
            <div className="gt-field-label"><StravaIcon size={14} /> STRAVA (OPCIONAL)</div>
            <p>Se você já registra corridas, pedaladas ou outros treinos no Strava, dá pra conectar sua conta agora e importar essas atividades direto pra cá — sem digitar nada. A sincronização é manual (você decide quando trazer atividades novas) e é só leitura: o Movo nunca escreve nada no seu Strava.</p>
            <p style={{ marginTop: 8 }}>Se preferir, dá pra conectar depois a qualquer momento em Configurações.</p>
            <div className="gt-modal-actions" style={{ marginTop: 16 }}>
              <button className="gt-btn secondary" disabled={connectingStrava} onClick={() => { setConnectingStrava(true); finishOnboarding(onCompleteWithStrava); }}>
                <StravaIcon size={14} /> {connectingStrava ? "Conectando…" : "Conectar com o Strava"}
              </button>
              <button className="gt-btn" disabled={connectingStrava} onClick={() => finishOnboarding(onComplete)}>Pular, terminar configuração</button>
            </div>
          </div>
        )}
      </div>

      {editingTreino && (
        <div className="gt-focus gt-builder">
          <div className="gt-focus-header">
            <button className="gt-focus-close" onClick={closeEditTreino}>✕</button>
            <div className="gt-focus-title-wrap">
              <div className="gt-focus-title">{editingTreino.nome}</div>
            </div>
          </div>

          <div className="gt-focus-body gt-builder-body">
            <div className="gt-field-label">EXERCÍCIOS</div>
            {editingTreino.blocos.length === 0 && (
              <div className="gt-empty" style={{ marginTop: 8 }}>Nenhum exercício ainda — adiciona pelo catálogo abaixo.</div>
            )}
            {editingTreino.blocos.map((bloco, blocoIdx) => (
              <div className="gt-bloco" key={bloco.nome}>
                <div className="gt-bloco-title">{bloco.nome.toUpperCase()}</div>
                {bloco.exercicios.map((ex, exIdx) => (
                  <div className="gt-builder-ex-row" key={ex.id || `${bloco.nome}-${exIdx}`}>
                    <div className="gt-builder-ex-main">
                      <div className="gt-builder-ex-nome">{ex.nome}</div>
                      <div className="gt-builder-ex-fields">
                        <input type="number" inputMode="numeric" className="gt-builder-ex-input" value={ex.series} onChange={(e) => onbUpdateExField(blocoIdx, exIdx, "series", Number(e.target.value) || 0)} />
                        <span className="gt-builder-ex-x">x</span>
                        <input type="text" className="gt-builder-ex-input wide" value={ex.repeticoes} onChange={(e) => onbUpdateExField(blocoIdx, exIdx, "repeticoes", e.target.value)} />
                      </div>
                    </div>
                    <div className="gt-builder-ex-actions">
                      <button type="button" onClick={() => onbMoveExercicio(blocoIdx, exIdx, -1)} disabled={exIdx === 0}>▲</button>
                      <button type="button" onClick={() => onbMoveExercicio(blocoIdx, exIdx, 1)} disabled={exIdx === bloco.exercicios.length - 1}>▼</button>
                      <button type="button" className="danger" onClick={() => onbRemoveExercicio(blocoIdx, exIdx)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <button className="gt-add-extra-card" type="button" onClick={() => setOnbPickerOpen(true)}>
              <span className="plus">+</span> Adicionar exercício
            </button>
            <div style={{ height: 76 }} />
          </div>

          <div className="gt-focus-footer gt-builder-footer">
            <button className="gt-btn" onClick={saveEditTreino}>Salvar alterações</button>
          </div>

          {onbPickerOpen && (
            <ExercisePickerModal
              search={onbPickerSearch}
              setSearch={setOnbPickerSearch}
              grupo={onbPickerGrupo}
              setGrupo={setOnbPickerGrupo}
              isAdded={onbIsAdded}
              onAdd={onbAddExercicio}
              onClose={() => setOnbPickerOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TreinoFocusView({ treino, item, treinoLog, selectedDate, expandedEx, setExpandedEx, ensureSetsForExpand, updateSetField, updateExComentario, cycleExercicioStatus, onClose, onFinish }) {
  const flat = flattenExercicios(treino);
  const doneCount = flat.filter((ex) => treinoLog[ex.id]?.status === "feito").length;
  const skippedCount = flat.filter((ex) => treinoLog[ex.id]?.status === "pulei").length;
  const key = itemKey(item);
  const [videoOpenId, setVideoOpenId] = useState(null);

  return (
    <div className="gt-focus">
      <div className="gt-focus-header">
        <button className="gt-focus-close" onClick={onClose}>✕</button>
        <div className="gt-focus-title-wrap">
          <div className="gt-focus-title">{treino.nome}</div>
          <div className="gt-focus-progress-label">
            {selectedDate && (
              <span className={`gt-focus-date ${selectedDate !== todayISO() ? "not-today" : ""}`}>
                {selectedDate === todayISO() ? "Hoje" : `${DIAS_ABREV[weekdayOf(selectedDate)]}, ${formatDateLabel(selectedDate)}`}
                {" · "}
              </span>
            )}
            {doneCount}/{flat.length} exercícios{skippedCount > 0 ? ` · ${skippedCount} pulado${skippedCount > 1 ? "s" : ""}` : ""}
          </div>
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
                      {(() => {
                        const ytId = extractYoutubeId(ex.videoUrl);
                        if (!ytId) return null;
                        const videoShown = videoOpenId === ex.id;
                        return (
                          <div className="gt-ex-video-wrap">
                            <button
                              type="button"
                              className="gt-ex-video-toggle"
                              onClick={(e) => { e.stopPropagation(); setVideoOpenId(videoShown ? null : ex.id); }}
                            >
                              ▶ {videoShown ? "Esconder vídeo" : "Ver vídeo do exercício"}
                            </button>
                            {videoShown && (
                              <div className="gt-ex-video-frame">
                                <iframe
                                  src={`https://www.youtube.com/embed/${ytId}`}
                                  title={`Vídeo: ${ex.nome}`}
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
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
        <div className="gt-field-label">DOR PÓS-SESSÃO (0-10, OPCIONAL)</div>
        <div className="gt-rpe-scale">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              className={`gt-rpe-btn dor ${rpeModal.dor === n ? "on" : ""}`}
              onClick={() => setRpeModal({ ...rpeModal, dor: rpeModal.dor === n ? null : n })}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="gt-rpe-hint">0 = nenhuma dor · 10 = dor máxima. Deixe sem marcar se não quiser registrar.</div>
        <div className="gt-modal-actions">
          <button className="gt-btn" disabled={!canSave} onClick={onSave}>Salvar</button>
          <button className="gt-btn secondary" onClick={onSkip}>Pular por agora</button>
        </div>
      </div>
    </div>
  );
}

function AgendaAdder({ day, treinos, atividades, onAdd }) {
  // Mesmo default (Treino) e mesmo padrão de interação (adiciona ao escolher
  // o item) do "Adicionar avulso pra hoje" — era a mesma ação com dois
  // comportamentos diferentes antes.
  const [tipo, setTipo] = useState("treino");
  const [id, setId] = useState("");
  const opts = tipo === "treino" ? treinos : atividades;
  return (
    <div className="gt-inline-form">
      <select className="gt-select" style={{ flex: "0 0 90px" }} value={tipo} onChange={(e) => { setTipo(e.target.value); setId(""); }}>
        <option value="treino">Treino</option>
        <option value="atividade">Atividade</option>
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
  useEffect(() => { setHover(null); }, [data]);
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
      {hover !== null && data[hover] && (
        <div className="gt-chart-tooltip" style={{ display: "inline-block" }}>
          <div>{data[hover].label}</div>
          <div style={{ color: "#C6F135" }}>{data[hover].pesoMax} kg</div>
        </div>
      )}
    </div>
  );
}

function LoadChart({ series, acuteDays = 7 }) {
  const W = 320, H = 170, PAD_L = 34, PAD_R = 28, PAD_T = 14, PAD_B = 24;
  const [hover, setHover] = useState(null);
  useEffect(() => { setHover(null); }, [series]);
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

  // Linha de dor (sugestão do fisio): eixo secundário fixo 0-10, só liga os
  // dias em que alguém de fato registrou dor (pula os dias sem dado, em vez
  // de tratar "não registrado" como zero).
  const hasDor = series.some((d) => d.dor != null);
  const yForDor = (v) => PAD_T + (1 - v / 10) * (H - PAD_T - PAD_B);
  const dorPoints = series
    .map((d, i) => (d.dor != null ? `${xFor(i) + barW / 2},${yForDor(d.dor)}` : null))
    .filter(Boolean)
    .join(" ");

  return (
    <div style={{ width: "100%" }}>
      <div className="gt-field-label" style={{ marginBottom: 8 }}>CARGA DIÁRIA (últimos {series.length} dias) · linha verde = média móvel {acuteDays}d{hasDor ? " · linha laranja = dor pós-sessão" : ""}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 180, overflow: "visible" }}>
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T} y2={PAD_T} stroke="#2C3038" strokeWidth="1" />
        <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#2C3038" strokeWidth="1" />
        <text x={4} y={PAD_T + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">{Math.round(max)}</text>
        <text x={4} y={H - PAD_B + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">0</text>
        {hasDor && <text x={W - PAD_R + 3} y={yForDor(10) + 4} fontSize="9" fill="#FF5A36" fontFamily="Roboto Mono, monospace">10</text>}
        {hasDor && <text x={W - PAD_R + 3} y={yForDor(0) + 4} fontSize="9" fill="#FF5A36" fontFamily="Roboto Mono, monospace">0</text>}
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
        {hasDor && <polyline points={dorPoints} fill="none" stroke="#FF5A36" strokeWidth="2" strokeDasharray="4 2" />}
        {hasDor && series.map((d, i) => d.dor != null && (
          <circle key={"dor-" + d.date} cx={xFor(i) + barW / 2} cy={yForDor(d.dor)} r={hover === i ? 4 : 2.5} fill="#FF5A36" />
        ))}
      </svg>
      {hover !== null && series[hover] && (
        <div className="gt-chart-tooltip" style={{ display: "inline-block" }}>
          <div>{formatDateLabel(series[hover].date)}</div>
          <div style={{ color: "#C6F135" }}>carga: {Math.round(series[hover].load)}</div>
          {series[hover].dor != null && <div style={{ color: "#FF5A36" }}>dor: {series[hover].dor.toFixed(1)}</div>}
        </div>
      )}
    </div>
  );
}

function FrequencyChart({ series, unit }) {
  const W = 320, H = 170, PAD_L = 28, PAD_R = 12, PAD_T = 14, PAD_B = 24;
  const [hover, setHover] = useState(null);
  useEffect(() => { setHover(null); }, [series]);
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
      {hover !== null && series[hover] && (
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


