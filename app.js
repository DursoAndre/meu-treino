/* Movo — Copyright (c) 2026 Andre. Todos os direitos reservados. Uso, cópia ou redistribuição só com autorização por escrito. Ver LICENSE. */
const { useState, useEffect, useMemo, useCallback, useRef } = React;

// --- Supabase (login + sincronização em nuvem) ---
// A URL e a chave "publishable" (antiga "anon key") são seguras de expor no
// frontend — o acesso real aos dados é controlado pelas políticas de RLS no
// banco, não pelo sigilo dessa chave.
const SUPABASE_URL = "https://wgdhjkebfvcmgokxscvb.supabase.co";
const APP_BUILD = "v101";
const SUPABASE_ANON_KEY = "sb_publishable_W0cKrWrtCwCp1XjNl1JFqQ_myok_WPk";
// Lido ANTES de criar o cliente: ao abrir pelo link mágico do e-mail, a URL
// traz o token, e o Supabase limpa isso logo que inicia. Serve só pra
// registrar que este login veio por link (e não por código digitado).
const OPENED_VIA_LOGIN_LINK = typeof window !== "undefined" && /access_token=|[?&]code=|token_hash=/.test((window.location.hash || "") + (window.location.search || ""));
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Convite de desafio (?desafio=CODIGO): guardado já na abertura, pra sobreviver ao login
// (o link mágico/redirect pode recarregar a página). É consumido depois de logado.
(function captureDesafioInvite() {
  try {
    const m = /[?&]desafio=([A-Za-z0-9]{4,12})/.exec(window.location.search || "");
    if (m) localStorage.setItem("treino-app:desafioInvite", m[1].toUpperCase());
  } catch (e) {}
})();

// Evento de uso (só nome + usuário), pra medir adoção/uso no painel de admin.
// Nunca bloqueia nada se a escrita falhar (ex: tabela ainda não criada).
function logEventFor(userId, name) {
  try {
    if (!userId) return;
    supabaseClient.from("app_events").insert({ user_id: userId, name }).then(() => {});
  } catch (e) {}
}

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

// Nomes diferentes pro mesmo exercício/máquina: quem busca por um acha os outros.
const EXERCICIO_SINONIMOS = [
  ["cadeira flexora", "mesa flexora", "flexora", "leg curl"],
  ["cadeira extensora", "extensora", "leg extension"],
  ["leg press", "leg 45", "pressao de pernas"],
  ["stiff", "terra romeno", "romanian"],
  ["panturrilha", "gemeos", "calf"],
  ["abdominal", "crunch", "abdomen"],
  ["voador", "peck deck", "peitoral na maquina"],
  ["puxada", "pulley", "puxador", "lat pulldown"],
  ["remada", "row"],
  ["rosca", "biceps curl"],
  ["triceps", "pushdown"],
  ["agachamento", "squat"],
  ["supino", "bench press"],
  ["elevacao pelvica", "hip thrust", "ponte de gluteo", "glute bridge"],
  ["abdutora", "abducao"],
  ["adutora", "aducao"],
  ["afundo", "avanco", "lunge"],
];
// O exercício bate com a busca? Por nome ou por sinônimo (ex.: "cadeira flexora" acha "Mesa flexora").
function exercicioCombinaBusca(nome, busca) {
  const q = normalizeSearch(busca).trim();
  if (!q) return true;
  const n = normalizeSearch(nome);
  if (n.includes(q)) return true;
  return EXERCICIO_SINONIMOS.some((grupo) => {
    const termos = grupo.map(normalizeSearch);
    const relacionado = termos.some((t) => t.includes(q) || (t.length >= 4 && q.includes(t)));
    return relacionado && termos.some((t) => n.includes(t));
  });
}

// --- Detecção de "instalar app" (PWA) ---
// iOS Safari não dispara beforeinstallprompt (não tem instalação por botão
// programático) — o único jeito é instruir a pessoa a usar o menu de
// compartilhar manualmente, por isso precisamos saber se é iOS pra mostrar
// o passo a passo certo em vez de simplesmente não funcionar.
function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ se identifica como "Macintosh" mas tem tela de toque — Mac de
  // verdade não tem maxTouchPoints > 1.
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}
function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  if (window.navigator && window.navigator.standalone === true) return true; // iOS Safari instalado
  try { return window.matchMedia && window.matchMedia("(display-mode: standalone)").matches; } catch (e) { return false; }
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
      const treino = resolveTreinoForDay(treinoById(item.id), daySession);
      if (!treino) return;
      const flat = flattenExercicios(treino);
      const exLog = log[key] || {};
      if (flat.some((ex) => exLog[ex.id]?.status === "feito")) doneCount++;
    } else {
      const atividade = atividadeById && atividadeById(item.id);
      // Descanso não tem "fui/não fui" pra marcar — só estar no dia já conta.
      if ((atividade && atividade.descanso) || (log[key] || {}).status === "fui") doneCount++;
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

// Ícones de navegação (traço único, herdam a cor do texto).
// Ícones Phosphor (MIT, phosphoricons.com) — só os usados, embutidos pra funcionar offline.
const PH_ICONS = {"hoje":{"regular":"<path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z\"/>","fill":"<path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM169.66,133.66l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35a8,8,0,0,1,11.32,11.32ZM48,80V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80Z\"/>","duotone":"<path d=\"M216,48V88H40V48a8,8,0,0,1,8-8H208A8,8,0,0,1,216,48Z\" opacity=\"0.2\"/><path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-38.34-85.66a8,8,0,0,1,0,11.32l-48,48a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L116,164.69l42.34-42.35A8,8,0,0,1,169.66,122.34Z\"/>"},"treinos":{"regular":"<path d=\"M248,120h-8V88a16,16,0,0,0-16-16H208V64a16,16,0,0,0-16-16H168a16,16,0,0,0-16,16v56H104V64A16,16,0,0,0,88,48H64A16,16,0,0,0,48,64v8H32A16,16,0,0,0,16,88v32H8a8,8,0,0,0,0,16h8v32a16,16,0,0,0,16,16H48v8a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V136h48v56a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16v-8h16a16,16,0,0,0,16-16V136h8a8,8,0,0,0,0-16ZM32,168V88H48v80Zm56,24H64V64H88V192Zm104,0H168V64h24V175.82c0,.06,0,.12,0,.18s0,.12,0,.18V192Zm32-24H208V88h16Z\"/>","fill":"<path d=\"M200,64V192a16,16,0,0,1-16,16H168a16,16,0,0,1-16-16V136H104v56a16,16,0,0,1-16,16H72a16,16,0,0,1-16-16V64A16,16,0,0,1,72,48H88a16,16,0,0,1,16,16v56h48V64a16,16,0,0,1,16-16h16A16,16,0,0,1,200,64ZM36,72H32A16,16,0,0,0,16,88v32H8.27A8.18,8.18,0,0,0,0,127.47,8,8,0,0,0,8,136h8v32a16,16,0,0,0,16,16h4a4,4,0,0,0,4-4V76A4,4,0,0,0,36,72Zm220,55.47a8.18,8.18,0,0,0-8.25-7.47H240V88a16,16,0,0,0-16-16h-4a4,4,0,0,0-4,4V180a4,4,0,0,0,4,4h4a16,16,0,0,0,16-16V136h8A8,8,0,0,0,256,127.47Z\"/>","duotone":"<path d=\"M96,64V192a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H88A8,8,0,0,1,96,64Zm96-8H168a8,8,0,0,0-8,8V192a8,8,0,0,0,8,8h24a8,8,0,0,0,8-8V64A8,8,0,0,0,192,56Z\" opacity=\"0.2\"/><path d=\"M248,120h-8V88a16,16,0,0,0-16-16H208V64a16,16,0,0,0-16-16H168a16,16,0,0,0-16,16v56H104V64A16,16,0,0,0,88,48H64A16,16,0,0,0,48,64v8H32A16,16,0,0,0,16,88v32H8a8,8,0,0,0,0,16h8v32a16,16,0,0,0,16,16H48v8a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V136h48v56a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16v-8h16a16,16,0,0,0,16-16V136h8a8,8,0,0,0,0-16ZM32,168V88H48v80Zm56,24H64V64H88V192Zm104,0H168V64h24V175.83c0,.06,0,.11,0,.17s0,.12,0,.17V192Zm32-24H208V88h16Z\"/>"},"desafios":{"regular":"<path d=\"M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z\"/>","fill":"<path d=\"M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z\"/>","duotone":"<path d=\"M200,48v63.1c0,39.7-31.75,72.6-71.45,72.9A72,72,0,0,1,56,112V48Z\" opacity=\"0.2\"/><path d=\"M232,64H208V48a8,8,0,0,0-8-8H56a8,8,0,0,0-8,8V64H24A16,16,0,0,0,8,80V96a40,40,0,0,0,40,40h3.65A80.13,80.13,0,0,0,120,191.61V216H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V191.58c31.94-3.23,58.44-25.64,68.08-55.58H208a40,40,0,0,0,40-40V80A16,16,0,0,0,232,64ZM48,120A24,24,0,0,1,24,96V80H48v32q0,4,.39,8Zm144-8.9c0,35.52-29,64.64-64,64.9a64,64,0,0,1-64-64V56H192ZM232,96a24,24,0,0,1-24,24h-.5a81.81,81.81,0,0,0,.5-8.9V80h24Z\"/>"},"evolucao":{"regular":"<path d=\"M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0V156.69l50.34-50.35a8,8,0,0,1,11.32,0L128,132.69,180.69,80H160a8,8,0,0,1,0-16h40a8,8,0,0,1,8,8v40a8,8,0,0,1-16,0V91.31l-58.34,58.35a8,8,0,0,1-11.32,0L96,123.31l-56,56V200H224A8,8,0,0,1,232,208Z\"/>","fill":"<path d=\"M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM200,192H56a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v76.69l34.34-34.35a8,8,0,0,1,11.32,0L128,132.69,172.69,88H144a8,8,0,0,1,0-16h48a8,8,0,0,1,8,8v48a8,8,0,0,1-16,0V99.31l-50.34,50.35a8,8,0,0,1-11.32,0L104,131.31l-40,40V176H200a8,8,0,0,1,0,16Z\"/>","duotone":"<path d=\"M224,64V208H32V48H208A16,16,0,0,1,224,64Z\" opacity=\"0.2\"/><path d=\"M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V48a8,8,0,0,1,16,0V156.69l50.34-50.35a8,8,0,0,1,11.32,0L128,132.69,180.69,80H160a8,8,0,0,1,0-16h40a8,8,0,0,1,8,8v40a8,8,0,0,1-16,0V91.31l-58.34,58.35a8,8,0,0,1-11.32,0L96,123.31l-56,56V200H224A8,8,0,0,1,232,208Z\"/>"},"ia":{"regular":"<path d=\"M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z\"/>","fill":"<path d=\"M208,144a15.78,15.78,0,0,1-10.42,14.94L146,178l-19,51.62a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88L78,110l19-51.62a15.92,15.92,0,0,1,29.88,0L146,110l51.62,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z\"/>","duotone":"<path d=\"M194.82,151.43l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0l-20.3-55.09-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3A7.92,7.92,0,0,1,194.82,151.43Z\" opacity=\"0.2\"/><path d=\"M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z\"/>"},"ajustar":{"regular":"<path d=\"M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z\"/>","fill":"<path d=\"M232,96a72,72,0,0,1-100.94,66L79,222.22c-.12.14-.26.29-.39.42a32,32,0,0,1-45.26-45.26c.14-.13.28-.27.43-.39L94,124.94a72.07,72.07,0,0,1,83.54-98.78,8,8,0,0,1,3.93,13.19L144,80l5.66,26.35L176,112l40.65-37.52a8,8,0,0,1,13.19,3.93A72.6,72.6,0,0,1,232,96Z\"/>","duotone":"<path d=\"M224,96a64,64,0,0,1-94.94,56L73,217A24,24,0,0,1,39,183L104,126.94a64,64,0,0,1,80-90.29L144,80l5.66,26.34L176,112l43.35-40A63.8,63.8,0,0,1,224,96Z\" opacity=\"0.2\"/><path d=\"M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z\"/>"},"novo":{"regular":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm48-88a8,8,0,0,1-8,8H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32A8,8,0,0,1,176,128Z\"/>","fill":"<path d=\"M128,24A104,104,0,1,0,232,128,104.13,104.13,0,0,0,128,24Zm40,112H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32a8,8,0,0,1,0,16Z\"/>","duotone":"<path d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\" opacity=\"0.2\"/><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm48-88a8,8,0,0,1-8,8H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32A8,8,0,0,1,176,128Z\"/>"},"fichas":{"regular":"<path d=\"M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z\"/>","fill":"<path d=\"M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z\"/>","duotone":"<path d=\"M208,48V216a8,8,0,0,1-8,8H56a8,8,0,0,1-8-8V48a8,8,0,0,1,8-8H96a39.83,39.83,0,0,0-8,24v8h80V64a39.83,39.83,0,0,0-8-24h40A8,8,0,0,1,208,48Z\" opacity=\"0.2\"/><path d=\"M168,152a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,152Zm-8-40H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm56-64V216a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V48A16,16,0,0,1,56,32H92.26a47.92,47.92,0,0,1,71.48,0H200A16,16,0,0,1,216,48ZM96,64h64a32,32,0,0,0-64,0ZM200,48H173.25A47.93,47.93,0,0,1,176,64v8a8,8,0,0,1-8,8H88a8,8,0,0,1-8-8V64a47.93,47.93,0,0,1,2.75-16H56V216H200Z\"/>"},"provas":{"regular":"<path d=\"M227.32,48.75A8,8,0,0,0,218.76,50c-28,24.22-51.72,12.48-79.21-1.13C111.07,34.76,78.78,18.79,42.76,50A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,28.49,14.09,60.77,30.06,96.79-1.13a8,8,0,0,0,2.76-6V56A8,8,0,0,0,227.32,48.75ZM216,71.6v40.65c-14,11.06-27,13.22-40,10.88V79.34A60.05,60.05,0,0,0,216,71.6Zm-56,3.76v43c-6.66-2.67-13.43-6-20.45-9.48-8.82-4.37-18-8.91-27.55-12.18v-43c6.66,2.66,13.43,6,20.45,9.48C141.27,67.55,150.46,72.09,160,75.36ZM96,48.91V92.69a60.06,60.06,0,0,0-40,7.75V59.78C70,48.72,83,46.57,96,48.91ZM86.58,152A60.06,60.06,0,0,0,56,160.43V119.78c14-11.06,27-13.22,40-10.88v43.8A65.61,65.61,0,0,0,86.58,152ZM112,156.67v-43c6.66,2.66,13.43,6,20.45,9.48,8.82,4.37,18,8.9,27.55,12.17v43c-6.66-2.67-13.43-6-20.45-9.48C130.73,164.47,121.54,159.94,112,156.67Zm64,26.45v-43.8a65.61,65.61,0,0,0,9.42.72A60.11,60.11,0,0,0,216,131.57v40.68C202,183.31,189,185.46,176,183.12Z\"/>","fill":"<path d=\"M227.32,48.75A8,8,0,0,0,218.76,50c-28,24.22-51.72,12.48-79.21-1.13C111.07,34.76,78.78,18.79,42.76,50h0A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,227.32,48.75ZM56,160.44V109.88c16.85-11.28,32.64-11.59,48-7.34v51.74C88.87,150.47,72.87,150.71,56,160.44ZM104,50.87c9.25,2.83,18.61,7.45,28.45,12.32,11.26,5.57,23.11,11.43,35.55,14.56v51.74c15.35,4.25,31.14,3.94,48-7.35v50.11c-16.87,13.32-32.27,13.72-48,8.91V129.49c-21.62-6-42.38-21-64-26.95Z\"/>","duotone":"<path d=\"M224,56v60c-19.89,17.23-38.23,18.39-56,13.48v-60C185.76,74.39,204.11,73.23,224,56ZM104,102.52v-60C86.24,37.61,67.89,38.77,48,56v60c19.89-17.22,38.23-18.39,56-13.48v60c21.62,6,42.38,21,64,27v-60c-21.62-6-42.38-21-64-27Z\" opacity=\"0.2\"/><path d=\"M227.32,48.75A8,8,0,0,0,218.76,50c-28,24.22-51.72,12.48-79.21-1.13C111.07,34.76,78.78,18.79,42.76,50A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,28.49,14.09,60.77,30.06,96.79-1.13a8,8,0,0,0,2.76-6V56A8,8,0,0,0,227.32,48.75ZM216,71.6v40.65c-14,11.06-27,13.22-40,10.88V79.34A60.05,60.05,0,0,0,216,71.6Zm-56,3.76v43c-6.66-2.67-13.43-6-20.45-9.48-8.82-4.37-18-8.91-27.55-12.18v-43c6.66,2.66,13.43,6,20.45,9.48C141.27,67.55,150.46,72.09,160,75.36ZM96,48.91V92.69a60.06,60.06,0,0,0-40,7.75V59.78C70,48.72,83,46.57,96,48.91ZM86.58,152A60.06,60.06,0,0,0,56,160.43V119.78c14-11.06,27-13.22,40-10.88v43.8A65.61,65.61,0,0,0,86.58,152ZM112,156.67v-43c6.66,2.66,13.43,6,20.45,9.48,8.82,4.37,18,8.9,27.55,12.17v43c-6.66-2.67-13.43-6-20.45-9.48C130.73,164.47,121.54,159.94,112,156.67Zm64,26.45v-43.8a65.61,65.61,0,0,0,9.42.72A60.11,60.11,0,0,0,216,131.57v40.68C202,183.31,189,185.46,176,183.12Z\"/>"},"corrida":{"regular":"<path d=\"M152,88a32,32,0,1,0-32-32A32,32,0,0,0,152,88Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,152,40Zm67.31,100.68c-.61.28-7.49,3.28-19.67,3.28-13.85,0-34.55-3.88-60.69-20a169.31,169.31,0,0,1-15.41,32.34,104.29,104.29,0,0,1,31.31,15.81C173.92,186.65,184,207.35,184,232a8,8,0,0,1-16,0c0-41.7-34.69-56.71-54.14-61.85-.55.7-1.12,1.41-1.69,2.1-19.64,23.8-44.25,36.18-71.63,36.18A92.29,92.29,0,0,1,31.2,208,8,8,0,0,1,32.8,192c25.92,2.58,48.47-7.49,67-30,12.49-15.14,21-33.61,25.25-47C86.13,92.35,61.27,111.63,61,111.84A8,8,0,1,1,51,99.36c1.5-1.2,37.22-29,89.51,6.57,45.47,30.91,71.93,20.31,72.18,20.19a8,8,0,1,1,6.63,14.56Z\"/>","fill":"<path d=\"M120,56a32,32,0,1,1,32,32A32,32,0,0,1,120,56Zm103.28,74.08a8,8,0,0,0-10.6-4c-.25.12-26.71,10.72-72.18-20.19-52.29-35.54-88-7.77-89.51-6.57a8,8,0,1,0,10,12.48c.26-.21,25.12-19.5,64.07,3.27-4.25,13.35-12.76,31.82-25.25,47-18.56,22.48-41.11,32.56-67,30A8,8,0,0,0,31.2,208a92.29,92.29,0,0,0,9.34.47c27.38,0,52-12.38,71.63-36.18.57-.69,1.14-1.4,1.69-2.1C133.31,175.29,168,190.3,168,232a8,8,0,0,0,16,0c0-24.65-10.08-45.35-29.15-59.86a104.29,104.29,0,0,0-31.31-15.81A169.31,169.31,0,0,0,139,124c26.14,16.09,46.84,20,60.69,20,12.18,0,19.06-3,19.67-3.28A8,8,0,0,0,223.28,130.08Z\"/>","duotone":"<path d=\"M176,56a24,24,0,1,1-24-24A24,24,0,0,1,176,56Z\" opacity=\"0.2\"/><path d=\"M152,88a32,32,0,1,0-32-32A32,32,0,0,0,152,88Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,152,40Zm67.31,100.68c-.61.28-7.49,3.28-19.67,3.28-13.85,0-34.55-3.88-60.69-20a169.31,169.31,0,0,1-15.41,32.34,104.29,104.29,0,0,1,31.31,15.81C173.92,186.65,184,207.35,184,232a8,8,0,0,1-16,0c0-41.7-34.69-56.71-54.14-61.85-.55.7-1.12,1.41-1.69,2.1-19.64,23.8-44.25,36.18-71.63,36.18A92.29,92.29,0,0,1,31.2,208,8,8,0,0,1,32.8,192c25.92,2.59,48.47-7.49,67-30,12.49-15.14,21-33.61,25.25-47C86.13,92.34,61.27,111.63,61,111.84A8,8,0,1,1,51,99.36c1.5-1.2,37.22-29,89.51,6.57,45.47,30.91,71.93,20.31,72.18,20.19a8,8,0,1,1,6.63,14.56Z\"/>"},"metas":{"regular":"<path d=\"M221.87,83.16A104.1,104.1,0,1,1,195.67,49l22.67-22.68a8,8,0,0,1,11.32,11.32l-96,96a8,8,0,0,1-11.32-11.32l27.72-27.72a40,40,0,1,0,17.87,31.09,8,8,0,1,1,16-.9,56,56,0,1,1-22.38-41.65L184.3,60.39a87.88,87.88,0,1,0,23.13,29.67,8,8,0,0,1,14.44-6.9Z\"/>","fill":"<path d=\"M221.87,83.16A104.1,104.1,0,1,1,195.67,49l22.67-22.68a8,8,0,0,1,11.32,11.32L167.6,99.71h0l-37.71,37.71-23.95,23.95a40,40,0,0,0,62-35.67,8,8,0,1,1,16-.9,56,56,0,0,1-95.5,42.79h0a56,56,0,0,1,73.13-84.43L184.3,60.39a87.88,87.88,0,1,0,23.13,29.67,8,8,0,0,1,14.44-6.9Z\"/>","duotone":"<path d=\"M176,128a48,48,0,1,1-48-48A48,48,0,0,1,176,128Z\" opacity=\"0.2\"/><path d=\"M221.87,83.16A104.1,104.1,0,1,1,195.67,49l22.67-22.68a8,8,0,0,1,11.32,11.32l-96,96a8,8,0,0,1-11.32-11.32l27.72-27.72a40,40,0,1,0,17.87,31.09,8,8,0,1,1,16-.9,56,56,0,1,1-22.38-41.65L184.3,60.39a87.88,87.88,0,1,0,23.13,29.67,8,8,0,0,1,14.44-6.9Z\"/>"},"raio":{"regular":"<path d=\"M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z\"/>","fill":"<path d=\"M213.85,125.46l-112,120a8,8,0,0,1-13.69-7l14.66-73.33L45.19,143.49a8,8,0,0,1-3-13l112-120a8,8,0,0,1,13.69,7L153.18,90.9l57.63,21.61a8,8,0,0,1,3,12.95Z\"/>","duotone":"<path d=\"M96,240l16-80L48,136,160,16,144,96l64,24Z\" opacity=\"0.2\"/><path d=\"M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z\"/>"},"importar":{"regular":"<path d=\"M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z\"/>","fill":"<path d=\"M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40A8,8,0,0,0,168,96H136V32a8,8,0,0,0-16,0V96H88a8,8,0,0,0-5.66,13.66Z\"/>","duotone":"<path d=\"M216,48V208H40V48A16,16,0,0,1,56,32H200A16,16,0,0,1,216,48Z\" opacity=\"0.2\"/><path d=\"M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z\"/>"},"amigos":{"regular":"<path d=\"M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1-7.37-4.89,8,8,0,0,1,0-6.22A8,8,0,0,1,192,112a24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.84,8,57,57,0,0,0-98.16,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z\"/>","fill":"<path d=\"M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z\"/>","duotone":"<path d=\"M168,144a40,40,0,1,1-40-40A40,40,0,0,1,168,144ZM64,56A32,32,0,1,0,96,88,32,32,0,0,0,64,56Zm128,0a32,32,0,1,0,32,32A32,32,0,0,0,192,56Z\" opacity=\"0.2\"/><path d=\"M244.8,150.4a8,8,0,0,1-11.2-1.6A51.6,51.6,0,0,0,192,128a8,8,0,0,1,0-16,24,24,0,1,0-23.24-30,8,8,0,1,1-15.5-4A40,40,0,1,1,219,117.51a67.94,67.94,0,0,1,27.43,21.68A8,8,0,0,1,244.8,150.4ZM190.92,212a8,8,0,1,1-13.85,8,57,57,0,0,0-98.15,0,8,8,0,1,1-13.84-8,72.06,72.06,0,0,1,33.74-29.92,48,48,0,1,1,58.36,0A72.06,72.06,0,0,1,190.92,212ZM128,176a32,32,0,1,0-32-32A32,32,0,0,0,128,176ZM72,120a8,8,0,0,0-8-8A24,24,0,1,1,87.24,82a8,8,0,1,0,15.5-4A40,40,0,1,0,37,117.51,67.94,67.94,0,0,0,9.6,139.19a8,8,0,1,0,12.8,9.61A51.6,51.6,0,0,1,64,128,8,8,0,0,0,72,120Z\"/>"},"config":{"regular":"<path d=\"M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.21,107.21,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.71,107.71,0,0,0-26.25-10.87,8,8,0,0,0-7.06,1.49L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.21,107.21,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8,8,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8,8,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z\"/>","fill":"<path d=\"M216,130.16q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z\"/>","duotone":"<path d=\"M207.86,123.18l16.78-21a99.14,99.14,0,0,0-10.07-24.29l-26.7-3a81,81,0,0,0-6.81-6.81l-3-26.71a99.43,99.43,0,0,0-24.3-10l-21,16.77a81.59,81.59,0,0,0-9.64,0l-21-16.78A99.14,99.14,0,0,0,77.91,41.43l-3,26.7a81,81,0,0,0-6.81,6.81l-26.71,3a99.43,99.43,0,0,0-10,24.3l16.77,21a81.59,81.59,0,0,0,0,9.64l-16.78,21a99.14,99.14,0,0,0,10.07,24.29l26.7,3a81,81,0,0,0,6.81,6.81l3,26.71a99.43,99.43,0,0,0,24.3,10l21-16.77a81.59,81.59,0,0,0,9.64,0l21,16.78a99.14,99.14,0,0,0,24.29-10.07l3-26.7a81,81,0,0,0,6.81-6.81l26.71-3a99.43,99.43,0,0,0,10-24.3l-16.77-21A81.59,81.59,0,0,0,207.86,123.18ZM128,168a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z\" opacity=\"0.2\"/><path d=\"M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-3.93l-23.72-2.64q-1.48-1.56-3-3L186,40.54a8,8,0,0,0-3.94-6,107.29,107.29,0,0,0-26.25-10.86,8,8,0,0,0-7.06,1.48L130.16,40Q128,40,125.84,40L107.2,25.11a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,73.89,34.51a8,8,0,0,0-3.93,6L67.32,64.27q-1.56,1.49-3,3L40.54,70a8,8,0,0,0-6,3.94,107.71,107.71,0,0,0-10.87,26.25,8,8,0,0,0,1.49,7.06L40,125.84Q40,128,40,130.16L25.11,148.8a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,3.93l23.72,2.64q1.49,1.56,3,3L70,215.46a8,8,0,0,0,3.94,6,107.71,107.71,0,0,0,26.25,10.87,8,8,0,0,0,7.06-1.49L125.84,216q2.16.06,4.32,0l18.64,14.92a8,8,0,0,0,7.06,1.48,107.21,107.21,0,0,0,26.25-10.88,8,8,0,0,0,3.93-6l2.64-23.72q1.56-1.48,3-3L215.46,186a8,8,0,0,0,6-3.94,107.71,107.71,0,0,0,10.87-26.25,8,8,0,0,0-1.49-7.06Zm-16.1-6.5a73.93,73.93,0,0,1,0,8.68,8,8,0,0,0,1.74,5.48l14.19,17.73a91.57,91.57,0,0,1-6.23,15L187,173.11a8,8,0,0,0-5.1,2.64,74.11,74.11,0,0,1-6.14,6.14,8,8,0,0,0-2.64,5.1l-2.51,22.58a91.32,91.32,0,0,1-15,6.23l-17.74-14.19a8,8,0,0,0-5-1.75h-.48a73.93,73.93,0,0,1-8.68,0,8.06,8.06,0,0,0-5.48,1.74L100.45,215.8a91.57,91.57,0,0,1-15-6.23L82.89,187a8,8,0,0,0-2.64-5.1,74.11,74.11,0,0,1-6.14-6.14,8,8,0,0,0-5.1-2.64L46.43,170.6a91.32,91.32,0,0,1-6.23-15l14.19-17.74a8,8,0,0,0,1.74-5.48,73.93,73.93,0,0,1,0-8.68,8,8,0,0,0-1.74-5.48L40.2,100.45a91.57,91.57,0,0,1,6.23-15L69,82.89a8,8,0,0,0,5.1-2.64,74.11,74.11,0,0,1,6.14-6.14A8,8,0,0,0,82.89,69L85.4,46.43a91.32,91.32,0,0,1,15-6.23l17.74,14.19a8,8,0,0,0,5.48,1.74,73.93,73.93,0,0,1,8.68,0,8.06,8.06,0,0,0,5.48-1.74L155.55,40.2a91.57,91.57,0,0,1,15,6.23L173.11,69a8,8,0,0,0,2.64,5.1,74.11,74.11,0,0,1,6.14,6.14,8,8,0,0,0,5.1,2.64l22.58,2.51a91.32,91.32,0,0,1,6.23,15l-14.19,17.74A8,8,0,0,0,199.87,123.66Z\"/>"},"ajuda":{"regular":"<path d=\"M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/>","fill":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,168a12,12,0,1,1,12-12A12,12,0,0,1,128,192Zm8-48.72V144a8,8,0,0,1-16,0v-8a8,8,0,0,1,8-8c13.23,0,24-9,24-20s-10.77-20-24-20-24,9-24,20v4a8,8,0,0,1-16,0v-4c0-19.85,17.94-36,40-36s40,16.15,40,36C168,125.38,154.24,139.93,136,143.28Z\"/>","duotone":"<path d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\" opacity=\"0.2\"/><path d=\"M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/>"},"feedback":{"regular":"<path d=\"M168,112a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm-8,24H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm72-8A104,104,0,0,1,79.12,219.82L45.07,231.17a16,16,0,0,1-20.24-20.24l11.35-34.05A104,104,0,1,1,232,128Zm-16,0A88,88,0,1,0,51.81,172.06a8,8,0,0,1,.66,6.54L40,216,77.4,203.53a7.85,7.85,0,0,1,2.53-.42,8,8,0,0,1,4,1.08A88,88,0,0,0,216,128Z\"/>","fill":"<path d=\"M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z\"/>","duotone":"<path d=\"M224,128A96,96,0,0,1,79.93,211.11h0L42.54,223.58a8,8,0,0,1-10.12-10.12l12.47-37.39h0A96,96,0,1,1,224,128Z\" opacity=\"0.2\"/><path d=\"M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-4-1.08,7.85,7.85,0,0,0-2.53.42L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Zm40-104a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,112Zm0,32a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,144Z\"/>"},"admin":{"regular":"<path d=\"M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z\"/>","fill":"<path d=\"M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z\"/>","duotone":"<path d=\"M208,40V208H152V40Z\" opacity=\"0.2\"/><path d=\"M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z\"/>"},"sair":{"regular":"<path d=\"M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z\"/>","fill":"<path d=\"M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40A8,8,0,0,0,176,88v32H112a8,8,0,0,0,0,16h64v32a8,8,0,0,0,13.66,5.66l40-40A8,8,0,0,0,229.66,122.34Z\"/>","duotone":"<path d=\"M224,56V200a16,16,0,0,1-16,16H48V40H208A16,16,0,0,1,224,56Z\" opacity=\"0.2\"/><path d=\"M120,216a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V40a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H56V208h56A8,8,0,0,1,120,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L204.69,120H112a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,229.66,122.34Z\"/>"},"menu":{"regular":"<path d=\"M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z\"/>","fill":"<path d=\"M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM192,184H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Zm0-48H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Zm0-48H64a8,8,0,0,1,0-16H192a8,8,0,0,1,0,16Z\"/>","duotone":"<path d=\"M216,64V192H40V64Z\" opacity=\"0.2\"/><path d=\"M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16ZM216,184H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z\"/>"},"fire":{"regular":"<path d=\"M183.89,153.34a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68ZM216,144a88,88,0,0,1-176,0c0-27.92,11-56.47,32.66-84.85a8,8,0,0,1,11.93-.89l24.12,23.41,22-60.41a8,8,0,0,1,12.63-3.41C165.21,36,216,84.55,216,144Zm-16,0c0-46.09-35.79-85.92-58.21-106.33L119.52,98.74a8,8,0,0,1-13.09,3L80.06,76.16C64.09,99.21,56,122,56,144a72,72,0,0,0,144,0Z\"/>","fill":"<path d=\"M143.38,17.85a8,8,0,0,0-12.63,3.41l-22,60.41L84.59,58.26a8,8,0,0,0-11.93.89C51,87.53,40,116.08,40,144a88,88,0,0,0,176,0C216,84.55,165.21,36,143.38,17.85Zm40.51,135.49a57.6,57.6,0,0,1-46.56,46.55A7.65,7.65,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z\"/>","duotone":"<path d=\"M208,144a80,80,0,0,1-160,0c0-30.57,14.42-58.26,31-80l33,32,26.27-72C159.86,41.92,208,88.15,208,144Z\" opacity=\"0.2\"/><path d=\"M183.89,153.34a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68ZM216,144a88,88,0,0,1-176,0c0-27.92,11-56.47,32.66-84.85a8,8,0,0,1,11.93-.89l24.12,23.41,22-60.41a8,8,0,0,1,12.63-3.41C165.21,36,216,84.55,216,144Zm-16,0c0-46.09-35.79-85.92-58.21-106.33L119.52,98.74a8,8,0,0,1-13.09,3L80.06,76.16C64.09,99.21,56,122,56,144a72,72,0,0,0,144,0Z\"/>"},"arrows-clockwise":{"regular":"<path d=\"M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z\"/>","fill":"<path d=\"M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1-5.66-13.66L180.65,72a79.48,79.48,0,0,0-54.72-22.09h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27,96,96,0,0,1,192,60.7l18.36-18.36A8,8,0,0,1,224,48ZM186.41,183.29A80,80,0,0,1,75.35,184l18.31-18.31A8,8,0,0,0,88,152H40a8,8,0,0,0-8,8v48a8,8,0,0,0,13.66,5.66L64,195.3a95.42,95.42,0,0,0,66,26.76h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z\"/>","duotone":"<path d=\"M216,128a88,88,0,1,1-88-88A88,88,0,0,1,216,128Z\" opacity=\"0.2\"/><path d=\"M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z\"/>"},"warning":{"regular":"<path d=\"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z\"/>","fill":"<path d=\"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z\"/>","duotone":"<path d=\"M215.46,216H40.54C27.92,216,20,202.79,26.13,192.09L113.59,40.22c6.3-11,22.52-11,28.82,0l87.46,151.87C236,202.79,228.08,216,215.46,216Z\" opacity=\"0.2\"/><path d=\"M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z\"/>"},"handshake":{"regular":"<path d=\"M254.3,107.91,228.78,56.85a16,16,0,0,0-21.47-7.15L182.44,62.13,130.05,48.27a8.14,8.14,0,0,0-4.1,0L73.56,62.13,48.69,49.7a16,16,0,0,0-21.47,7.15L1.7,107.9a16,16,0,0,0,7.15,21.47l27,13.51,55.49,39.63a8.06,8.06,0,0,0,2.71,1.25l64,16a8,8,0,0,0,7.6-2.1l55.07-55.08,26.42-13.21a16,16,0,0,0,7.15-21.46Zm-54.89,33.37L165,113.72a8,8,0,0,0-10.68.61C136.51,132.27,116.66,130,104,122L147.24,80h31.81l27.21,54.41ZM41.53,64,62,74.22,36.43,125.27,16,115.06Zm116,119.13L99.42,168.61l-49.2-35.14,28-56L128,64.28l9.8,2.59-45,43.68-.08.09a16,16,0,0,0,2.72,24.81c20.56,13.13,45.37,11,64.91-5L188,152.66Zm62-57.87-25.52-51L214.47,64,240,115.06Zm-87.75,92.67a8,8,0,0,1-7.75,6.06,8.13,8.13,0,0,1-1.95-.24L80.41,213.33a7.89,7.89,0,0,1-2.71-1.25L51.35,193.26a8,8,0,0,1,9.3-13l25.11,17.94L126,208.24A8,8,0,0,1,131.82,217.94Z\"/>","fill":"<path d=\"M254.3,107.91,228.78,56.85a16,16,0,0,0-21.47-7.15L182.44,62.13,130.05,48.27a8.14,8.14,0,0,0-4.1,0L73.56,62.13,48.69,49.7a16,16,0,0,0-21.47,7.15L1.7,107.9a16,16,0,0,0,7.15,21.47l27,13.51,55.49,39.63a8.06,8.06,0,0,0,2.71,1.25l64,16a8,8,0,0,0,7.6-2.1l40-40,15.08-15.08,26.42-13.21a16,16,0,0,0,7.15-21.46Zm-54.89,33.37L165,113.72a8,8,0,0,0-10.68.61C136.51,132.27,116.66,130,104,122L147.24,80h31.81l27.21,54.41Zm-41.87,41.86L99.42,168.61l-49.2-35.14,28-56L128,64.28l9.8,2.59-45,43.68-.08.09a16,16,0,0,0,2.72,24.81c20.56,13.13,45.37,11,64.91-5L188,152.66Zm-25.72,34.8a8,8,0,0,1-7.75,6.06,8.13,8.13,0,0,1-1.95-.24L80.41,213.33a7.89,7.89,0,0,1-2.71-1.25L51.35,193.26a8,8,0,0,1,9.3-13l25.11,17.94L126,208.24A8,8,0,0,1,131.82,217.94Z\"/>","duotone":"<path d=\"M200,152l-40,40L96,176,40,136,72.68,70.63,128,56l55.32,14.63L183.6,72H144L98.34,116.29a8,8,0,0,0,1.38,12.42C117.23,139.9,141,139.13,160,120Z\" opacity=\"0.2\"/><path d=\"M254.3,107.91,228.78,56.85a16,16,0,0,0-21.47-7.15L182.44,62.13,130.05,48.27a8.14,8.14,0,0,0-4.1,0L73.56,62.13,48.69,49.7a16,16,0,0,0-21.47,7.15L1.7,107.9a16,16,0,0,0,7.15,21.47l27,13.51,55.49,39.63a8.06,8.06,0,0,0,2.71,1.25l64,16a8,8,0,0,0,7.6-2.1l55.07-55.08,26.42-13.21a16,16,0,0,0,7.15-21.46Zm-54.89,33.37L165,113.72a8,8,0,0,0-10.68.61C136.51,132.27,116.66,130,104,122L147.24,80h31.81l27.21,54.41ZM41.53,64,62,74.22,36.43,125.27,16,115.06Zm116,119.13L99.42,168.61l-49.2-35.14,28-56L128,64.28l9.8,2.59-45,43.68-.08.09a16,16,0,0,0,2.72,24.81c20.56,13.13,45.37,11,64.91-5L188,152.66Zm62-57.87-25.52-51L214.47,64,240,115.06Zm-87.75,92.67a8,8,0,0,1-7.75,6.06,8.13,8.13,0,0,1-1.95-.24L80.41,213.33a7.89,7.89,0,0,1-2.71-1.25L51.35,193.26a8,8,0,0,1,9.3-13l25.11,17.94L126,208.24A8,8,0,0,1,131.82,217.94Z\"/>"},"coffee":{"regular":"<path d=\"M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z\"/>","fill":"<path d=\"M208,80H32a8,8,0,0,0-8,8v48a96.3,96.3,0,0,0,32.54,72H32a8,8,0,0,0,0,16H208a8,8,0,0,0,0-16H183.46a96.59,96.59,0,0,0,27-40.09A40,40,0,0,0,248,128v-8A40,40,0,0,0,208,80Zm24,48a24,24,0,0,1-17.2,23,95.78,95.78,0,0,0,1.2-15V97.38A24,24,0,0,1,232,120ZM112,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm32,0V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0ZM80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Z\"/>","duotone":"<path d=\"M208,88v48a88,88,0,0,1-51.3,80H83.3A88,88,0,0,1,32,136V88Z\" opacity=\"0.2\"/><path d=\"M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z\"/>"},"check-circle":{"regular":"<path d=\"M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/>","fill":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z\"/>","duotone":"<path d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\" opacity=\"0.2\"/><path d=\"M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/>"},"calendar-blank":{"regular":"<path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z\"/>","fill":"<path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,48H48V48H72v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24Z\"/>","duotone":"<path d=\"M216,48V88H40V48a8,8,0,0,1,8-8H208A8,8,0,0,1,216,48Z\" opacity=\"0.2\"/><path d=\"M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z\"/>"},"road-horizon":{"regular":"<path d=\"M235.92,199A8,8,0,0,1,225,195.92L155.32,72H136v8a8,8,0,0,1-16,0V72H100.68L31,195.92A8,8,0,0,1,17,188.08L82.32,72H24a8,8,0,0,1,0-16H232a8,8,0,0,1,0,16H173.68L239,188.08A8,8,0,0,1,235.92,199ZM128,112a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V120A8,8,0,0,0,128,112Zm0,56a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V176A8,8,0,0,0,128,168Z\"/>","fill":"<path d=\"M239,188.08,173.68,72h58A8.17,8.17,0,0,0,240,64.53,8,8,0,0,0,232,56H24.27A8.17,8.17,0,0,0,16,63.47,8,8,0,0,0,24,72H82.32L17,188.08a8,8,0,0,0,1.17,9.43,8.24,8.24,0,0,0,6,2.49H116a4,4,0,0,0,4-4V176.27a8.17,8.17,0,0,1,7.47-8.25,8,8,0,0,1,8.53,8v20a4,4,0,0,0,4,4h91.77a8.24,8.24,0,0,0,6-2.49A8,8,0,0,0,239,188.08ZM136,140a8,8,0,0,1-16,0V124a8,8,0,0,1,16,0Zm0-52a8,8,0,0,1-16,0V80a8,8,0,0,1,16,0Z\"/>","duotone":"<path d=\"M232,192H24L96,64h64Z\" opacity=\"0.2\"/><path d=\"M235.92,199A8,8,0,0,1,225,195.92L155.32,72H136v8a8,8,0,0,1-16,0V72H100.68L31,195.92A8,8,0,0,1,17,188.08L82.32,72H24a8,8,0,0,1,0-16H232a8,8,0,0,1,0,16H173.68L239,188.08A8,8,0,0,1,235.92,199ZM128,112a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V120A8,8,0,0,0,128,112Zm0,56a8,8,0,0,0-8,8v16a8,8,0,0,0,16,0V176A8,8,0,0,0,128,168Z\"/>"},"device-mobile":{"regular":"<path d=\"M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z\"/>","fill":"<path d=\"M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM80,32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z\"/>","duotone":"<path d=\"M192,56V200H64V56Z\" opacity=\"0.2\"/><path d=\"M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z\"/>"},"video-camera":{"regular":"<path d=\"M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z\"/>","fill":"<path d=\"M192,72V184a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V72A16,16,0,0,1,32,56H176A16,16,0,0,1,192,72Zm58,.25a8.23,8.23,0,0,0-6.63,1.22L209.78,95.86A4,4,0,0,0,208,99.19v57.62a4,4,0,0,0,1.78,3.33l33.78,22.52a8,8,0,0,0,8.58.19,8.33,8.33,0,0,0,3.86-7.17V80A8,8,0,0,0,250,72.25Z\"/>","duotone":"<path d=\"M200,72V184a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8H192A8,8,0,0,1,200,72Z\" opacity=\"0.2\"/><path d=\"M251.77,73a8,8,0,0,0-8.21.39L208,97.05V72a16,16,0,0,0-16-16H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V159l35.56,23.71A8,8,0,0,0,248,184a8,8,0,0,0,8-8V80A8,8,0,0,0,251.77,73ZM192,184H32V72H192V184Zm48-22.95-32-21.33V116.28L240,95Z\"/>"},"paperclip":{"regular":"<path d=\"M209.66,122.34a8,8,0,0,1,0,11.32l-82.05,82a56,56,0,0,1-79.2-79.21L147.67,35.73a40,40,0,1,1,56.61,56.55L105,193A24,24,0,1,1,71,159L154.3,74.38A8,8,0,1,1,165.7,85.6L82.39,170.31a8,8,0,1,0,11.27,11.36L192.93,81A24,24,0,1,0,159,47L59.76,147.68a40,40,0,1,0,56.53,56.62l82.06-82A8,8,0,0,1,209.66,122.34Z\"/>","fill":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm37.66,50.34a8,8,0,0,0-11.32,0L87.09,143A24,24,0,1,0,121,177l49.32-50.32a8,8,0,1,1,11.42,11.2l-49.37,50.38a40,40,0,1,1-56.62-56.51L143,63.09A24,24,0,1,1,177,97L109.71,165.6a8,8,0,1,1-11.42-11.2L165.6,85.71a8,8,0,0,0,.06-11.37Z\"/>","duotone":"<path d=\"M180.75,104.75,204,128l-82.06,81.94a48,48,0,0,1-67.88-67.88L153.37,41.37a32,32,0,0,1,45.26,45.26Z\" opacity=\"0.2\"/><path d=\"M209.66,122.34a8,8,0,0,1,0,11.32l-82.05,82a56,56,0,0,1-79.2-79.21L147.67,35.73a40,40,0,1,1,56.61,56.55L105,193A24,24,0,1,1,71,159L154.3,74.38A8,8,0,1,1,165.7,85.6L82.39,170.31a8,8,0,1,0,11.27,11.36L192.93,81A24,24,0,1,0,159,47L59.76,147.68a40,40,0,1,0,56.53,56.62l82.06-82A8,8,0,0,1,209.66,122.34Z\"/>"},"book-open":{"regular":"<path d=\"M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z\"/>","fill":"<path d=\"M240,56V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,23.94,7.9,7.9,0,0,1-5.12,7.55A8,8,0,0,1,120,232a24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v87.73a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V80a32,32,0,0,1,32-32h64A8,8,0,0,1,240,56Z\"/>","duotone":"<path d=\"M232,56V200H160a32,32,0,0,0-32,32,32,32,0,0,0-32-32H24V56H96a32,32,0,0,1,32,32,32,32,0,0,1,32-32Z\" opacity=\"0.2\"/><path d=\"M232,48H160a40,40,0,0,0-32,16A40,40,0,0,0,96,48H24a8,8,0,0,0-8,8V200a8,8,0,0,0,8,8H96a24,24,0,0,1,24,24,8,8,0,0,0,16,0,24,24,0,0,1,24-24h72a8,8,0,0,0,8-8V56A8,8,0,0,0,232,48ZM96,192H32V64H96a24,24,0,0,1,24,24V200A39.81,39.81,0,0,0,96,192Zm128,0H160a39.81,39.81,0,0,0-24,8V88a24,24,0,0,1,24-24h64Z\"/>"},"lightbulb":{"regular":"<path d=\"M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z\"/>","fill":"<path d=\"M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-32.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z\"/>","duotone":"<path d=\"M208,104a79.86,79.86,0,0,1-30.59,62.92A24.29,24.29,0,0,0,168,186v6a8,8,0,0,1-8,8H96a8,8,0,0,1-8-8v-6a24.11,24.11,0,0,0-9.3-19A79.87,79.87,0,0,1,48,104.45C47.76,61.09,82.72,25,126.07,24A80,80,0,0,1,208,104Z\" opacity=\"0.2\"/><path d=\"M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z\"/>"},"bug":{"regular":"<path d=\"M144,92a12,12,0,1,1,12,12A12,12,0,0,1,144,92ZM100,80a12,12,0,1,0,12,12A12,12,0,0,0,100,80Zm116,64A87.76,87.76,0,0,1,213,167l22.24,9.72A8,8,0,0,1,232,192a7.89,7.89,0,0,1-3.2-.67L207.38,182a88,88,0,0,1-158.76,0L27.2,191.33A7.89,7.89,0,0,1,24,192a8,8,0,0,1-3.2-15.33L43,167A87.76,87.76,0,0,1,40,144v-8H16a8,8,0,0,1,0-16H40v-8a87.76,87.76,0,0,1,3-23L20.8,79.33a8,8,0,1,1,6.4-14.66L48.62,74a88,88,0,0,1,158.76,0l21.42-9.36a8,8,0,0,1,6.4,14.66L213,89.05a87.76,87.76,0,0,1,3,23v8h24a8,8,0,0,1,0,16H216ZM56,120H200v-8a72,72,0,0,0-144,0Zm64,95.54V136H56v8A72.08,72.08,0,0,0,120,215.54ZM200,144v-8H136v79.54A72.08,72.08,0,0,0,200,144Z\"/>","fill":"<path d=\"M168,92a12,12,0,1,1-12-12A12,12,0,0,1,168,92ZM100,80a12,12,0,1,0,12,12A12,12,0,0,0,100,80Zm116,64A87.76,87.76,0,0,1,213,167l22.24,9.72A8,8,0,0,1,232,192a7.89,7.89,0,0,1-3.2-.67L207.38,182a88,88,0,0,1-158.76,0L27.2,191.33A7.89,7.89,0,0,1,24,192a8,8,0,0,1-3.2-15.33L43,167A87.76,87.76,0,0,1,40,144v-8H16a8,8,0,0,1,0-16H40v-8a87.76,87.76,0,0,1,3-23L20.8,79.33a8,8,0,1,1,6.4-14.66L48.62,74a88,88,0,0,1,158.76,0l21.42-9.36a8,8,0,0,1,6.4,14.66L213,89.05a87.76,87.76,0,0,1,3,23v8h24a8,8,0,0,1,0,16H216Zm-80,0a8,8,0,0,0-16,0v64a8,8,0,0,0,16,0Zm64-32a72,72,0,0,0-144,0v8H200Z\"/>","duotone":"<path d=\"M208,128v16a80,80,0,0,1-160,0V128Z\" opacity=\"0.2\"/><path d=\"M144,92a12,12,0,1,1,12,12A12,12,0,0,1,144,92ZM100,80a12,12,0,1,0,12,12A12,12,0,0,0,100,80Zm116,64A87.76,87.76,0,0,1,213,167l22.24,9.72A8,8,0,0,1,232,192a7.89,7.89,0,0,1-3.2-.67L207.38,182a88,88,0,0,1-158.76,0L27.2,191.33A7.89,7.89,0,0,1,24,192a8,8,0,0,1-3.2-15.33L43,167A87.76,87.76,0,0,1,40,144v-8H16a8,8,0,0,1,0-16H40v-8a87.76,87.76,0,0,1,3-23L20.8,79.33a8,8,0,1,1,6.4-14.66L48.62,74a88,88,0,0,1,158.76,0l21.42-9.36a8,8,0,0,1,6.4,14.66L213,89.05a87.76,87.76,0,0,1,3,23v8h24a8,8,0,0,1,0,16H216ZM56,120H200v-8a72,72,0,0,0-144,0Zm64,95.54V136H56v8A72.08,72.08,0,0,0,120,215.54ZM200,144v-8H136v79.54A72.08,72.08,0,0,0,200,144Z\"/>"},"thumbs-up":{"regular":"<path d=\"M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32ZM223.94,97l-12,96a8,8,0,0,1-7.94,7H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,9Z\"/>","fill":"<path d=\"M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32Z\"/>","duotone":"<path d=\"M80,104V208H32a8,8,0,0,1-8-8V112a8,8,0,0,1,8-8Z\" opacity=\"0.2\"/><path d=\"M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32ZM223.94,97l-12,96a8,8,0,0,1-7.94,7H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,9Z\"/>"},"shuffle":{"regular":"<path d=\"M237.66,178.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L212.69,192H200.94a72.12,72.12,0,0,1-58.59-30.15l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.1,56.1,0,0,0,200.94,176h11.75l-10.35-10.34a8,8,0,0,1,11.32-11.32ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.1,56.1,0,0,1,200.94,80h11.75L202.34,90.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L212.69,64H200.94a72.12,72.12,0,0,0-58.59,30.15l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z\"/>","fill":"<path d=\"M237.66,178.34a8,8,0,0,1,0,11.32l-24,24A8,8,0,0,1,200,208V192a72.15,72.15,0,0,1-57.65-30.14l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.08,56.08,0,0,0,200,176V160a8,8,0,0,1,13.66-5.66ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.08,56.08,0,0,1,200,80V96a8,8,0,0,0,13.66,5.66l24-24a8,8,0,0,0,0-11.32l-24-24A8,8,0,0,0,200,48V64a72.15,72.15,0,0,0-57.65,30.14l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z\"/>","duotone":"<path d=\"M107.14,98.8,128,128l-20.86,29.2A64,64,0,0,1,55.06,184H32V72H55.06A64,64,0,0,1,107.14,98.8ZM200.94,72a64,64,0,0,0-52.08,26.8L128,128l20.86,29.2A64,64,0,0,0,200.94,184H232V72Z\" opacity=\"0.2\"/><path d=\"M237.66,178.34a8,8,0,0,1,0,11.32l-24,24a8,8,0,0,1-11.32-11.32L212.69,192H200.94a72.12,72.12,0,0,1-58.59-30.15l-41.72-58.4A56.1,56.1,0,0,0,55.06,80H32a8,8,0,0,1,0-16H55.06a72.12,72.12,0,0,1,58.59,30.15l41.72,58.4A56.1,56.1,0,0,0,200.94,176h11.75l-10.35-10.34a8,8,0,0,1,11.32-11.32ZM143,107a8,8,0,0,0,11.16-1.86l1.2-1.67A56.1,56.1,0,0,1,200.94,80h11.75L202.34,90.34a8,8,0,0,0,11.32,11.32l24-24a8,8,0,0,0,0-11.32l-24-24a8,8,0,0,0-11.32,11.32L212.69,64H200.94a72.12,72.12,0,0,0-58.59,30.15l-1.2,1.67A8,8,0,0,0,143,107Zm-30,42a8,8,0,0,0-11.16,1.86l-1.2,1.67A56.1,56.1,0,0,1,55.06,176H32a8,8,0,0,0,0,16H55.06a72.12,72.12,0,0,0,58.59-30.15l1.2-1.67A8,8,0,0,0,113,149Z\"/>"},"timer":{"regular":"<path d=\"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM173.66,90.34a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32l40-40A8,8,0,0,1,173.66,90.34ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z\"/>","fill":"<path d=\"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm45.66,61.66-40,40a8,8,0,0,1-11.32-11.32l40-40a8,8,0,0,1,11.32,11.32ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z\"/>","duotone":"<path d=\"M216,136a88,88,0,1,1-88-88A88,88,0,0,1,216,136Z\" opacity=\"0.2\"/><path d=\"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM173.66,90.34a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32l40-40A8,8,0,0,1,173.66,90.34ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z\"/>"},"prohibit":{"regular":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.56,87.56,0,0,1-20.41,56.28L71.72,60.4A88,88,0,0,1,216,128ZM40,128A87.56,87.56,0,0,1,60.41,71.72L184.28,195.6A88,88,0,0,1,40,128Z\"/>","fill":"<path d=\"M200,128a71.69,71.69,0,0,1-15.78,44.91L83.09,71.78A71.95,71.95,0,0,1,200,128ZM56,128a71.95,71.95,0,0,0,116.91,56.22L71.78,83.09A71.69,71.69,0,0,0,56,128Zm180,0A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-20,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/>","duotone":"<path d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\" opacity=\"0.2\"/><path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm88,104a87.56,87.56,0,0,1-20.41,56.28L71.72,60.4A88,88,0,0,1,216,128ZM40,128A87.56,87.56,0,0,1,60.41,71.72L184.28,195.6A88,88,0,0,1,40,128Z\"/>"},"map-pin":{"regular":"<path d=\"M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z\"/>","fill":"<path d=\"M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z\"/>","duotone":"<path d=\"M128,24a80,80,0,0,0-80,80c0,72,80,128,80,128s80-56,80-128A80,80,0,0,0,128,24Zm0,112a32,32,0,1,1,32-32A32,32,0,0,1,128,136Z\" opacity=\"0.2\"/><path d=\"M128,64a40,40,0,1,0,40,40A40,40,0,0,0,128,64Zm0,64a24,24,0,1,1,24-24A24,24,0,0,1,128,128Zm0-112a88.1,88.1,0,0,0-88,88c0,31.4,14.51,64.68,42,96.25a254.19,254.19,0,0,0,41.45,38.3,8,8,0,0,0,9.18,0A254.19,254.19,0,0,0,174,200.25c27.45-31.57,42-64.85,42-96.25A88.1,88.1,0,0,0,128,16Zm0,206c-16.53-13-72-60.75-72-118a72,72,0,0,1,144,0C200,161.23,144.53,209,128,222Z\"/>"},"ruler":{"regular":"<path d=\"M235.32,73.37,182.63,20.69a16,16,0,0,0-22.63,0L20.68,160a16,16,0,0,0,0,22.63l52.69,52.68a16,16,0,0,0,22.63,0L235.32,96A16,16,0,0,0,235.32,73.37ZM84.68,224,32,171.31l32-32,26.34,26.35a8,8,0,0,0,11.32-11.32L75.31,128,96,107.31l26.34,26.35a8,8,0,0,0,11.32-11.32L107.31,96,128,75.31l26.34,26.35a8,8,0,0,0,11.32-11.32L139.31,64l32-32L224,84.69Z\"/>","fill":"<path d=\"M235.32,96,96,235.31a16,16,0,0,1-22.63,0L20.68,182.63a16,16,0,0,1,0-22.63l29.17-29.17a4,4,0,0,1,5.66,0l34.83,34.83a8,8,0,0,0,11.71-.43,8.18,8.18,0,0,0-.6-11.09L66.82,119.51a4,4,0,0,1,0-5.65l15-15a4,4,0,0,1,5.66,0l34.83,34.83a8,8,0,0,0,11.71-.43,8.18,8.18,0,0,0-.6-11.09L98.83,87.51a4,4,0,0,1,0-5.65l15-15a4,4,0,0,1,5.65,0l34.83,34.83a8,8,0,0,0,11.72-.43,8.18,8.18,0,0,0-.61-11.09L130.83,55.51a4,4,0,0,1,0-5.65L160,20.69a16,16,0,0,1,22.63,0l52.69,52.68A16,16,0,0,1,235.32,96Z\"/>","duotone":"<path d=\"M229.66,90.34,90.34,229.66a8,8,0,0,1-11.31,0L26.34,177a8,8,0,0,1,0-11.31L165.66,26.34a8,8,0,0,1,11.31,0L229.66,79A8,8,0,0,1,229.66,90.34Z\" opacity=\"0.2\"/><path d=\"M235.32,73.37,182.63,20.69a16,16,0,0,0-22.63,0L20.68,160a16,16,0,0,0,0,22.63l52.69,52.68a16,16,0,0,0,22.63,0L235.32,96A16,16,0,0,0,235.32,73.37ZM84.68,224,32,171.31l32-32,26.34,26.35a8,8,0,0,0,11.32-11.32L75.31,128,96,107.31l26.34,26.35a8,8,0,0,0,11.32-11.32L107.31,96,128,75.31l26.34,26.35a8,8,0,0,0,11.32-11.32L139.31,64l32-32L224,84.69Z\"/>"},"trend-up":{"regular":"<path d=\"M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z\"/>","fill":"<path d=\"M240,56v64a8,8,0,0,1-13.66,5.66L200,99.31l-58.34,58.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,188.69,88,162.34,61.66A8,8,0,0,1,168,48h64A8,8,0,0,1,240,56Z\"/>","duotone":"<path d=\"M232,56v64L168,56Z\" opacity=\"0.2\"/><path d=\"M232,48H168a8,8,0,0,0-5.66,13.66L188.69,88,136,140.69l-34.34-34.35a8,8,0,0,0-11.32,0l-72,72a8,8,0,0,0,11.32,11.32L96,123.31l34.34,34.35a8,8,0,0,0,11.32,0L200,99.31l26.34,26.35A8,8,0,0,0,240,120V56A8,8,0,0,0,232,48Zm-8,52.69L187.31,64H224Z\"/>"},"dice-five":{"regular":"<path d=\"M192,32H64A32,32,0,0,0,32,64V192a32,32,0,0,0,32,32H192a32,32,0,0,0,32-32V64A32,32,0,0,0,192,32Zm16,160a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64A16,16,0,0,1,64,48H192a16,16,0,0,1,16,16ZM104,92A12,12,0,1,1,92,80,12,12,0,0,1,104,92Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,92Zm-72,72a12,12,0,1,1-12-12A12,12,0,0,1,104,164Zm36-36a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm36,36a12,12,0,1,1-12-12A12,12,0,0,1,176,164Z\"/>","fill":"<path d=\"M192,32H64A32,32,0,0,0,32,64V192a32,32,0,0,0,32,32H192a32,32,0,0,0,32-32V64A32,32,0,0,0,192,32ZM92,176a12,12,0,1,1,12-12A12,12,0,0,1,92,176Zm0-72a12,12,0,1,1,12-12A12,12,0,0,1,92,104Zm36,36a12,12,0,1,1,12-12A12,12,0,0,1,128,140Zm36,36a12,12,0,1,1,12-12A12,12,0,0,1,164,176Zm0-72a12,12,0,1,1,12-12A12,12,0,0,1,164,104Z\"/>","duotone":"<path d=\"M216,64V192a24,24,0,0,1-24,24H64a24,24,0,0,1-24-24V64A24,24,0,0,1,64,40H192A24,24,0,0,1,216,64Z\" opacity=\"0.2\"/><path d=\"M192,32H64A32,32,0,0,0,32,64V192a32,32,0,0,0,32,32H192a32,32,0,0,0,32-32V64A32,32,0,0,0,192,32Zm16,160a16,16,0,0,1-16,16H64a16,16,0,0,1-16-16V64A16,16,0,0,1,64,48H192a16,16,0,0,1,16,16ZM104,92A12,12,0,1,1,92,80,12,12,0,0,1,104,92Zm72,0a12,12,0,1,1-12-12A12,12,0,0,1,176,92Zm-72,72a12,12,0,1,1-12-12A12,12,0,0,1,104,164Zm36-36a12,12,0,1,1-12-12A12,12,0,0,1,140,128Zm36,36a12,12,0,1,1-12-12A12,12,0,0,1,176,164Z\"/>"},"alarm":{"regular":"<path d=\"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM61.66,37.66l-32,32A8,8,0,0,1,18.34,58.34l32-32A8,8,0,0,1,61.66,37.66Zm176,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,237.66,69.66ZM184,128a8,8,0,0,1,0,16H128a8,8,0,0,1-8-8V80a8,8,0,0,1,16,0v48Z\"/>","fill":"<path d=\"M61.66,37.66l-32,32A8,8,0,0,1,18.34,58.34l32-32A8,8,0,0,1,61.66,37.66Zm176,20.68-32-32a8,8,0,0,0-11.32,11.32l32,32a8,8,0,0,0,11.32-11.32ZM224,136a96,96,0,1,1-96-96A96.11,96.11,0,0,1,224,136Zm-32,0a8,8,0,0,0-8-8H136V80a8,8,0,0,0-16,0v56a8,8,0,0,0,8,8h56A8,8,0,0,0,192,136Z\"/>","duotone":"<path d=\"M216,136a88,88,0,1,1-88-88A88,88,0,0,1,216,136Z\" opacity=\"0.2\"/><path d=\"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM61.66,37.66l-32,32A8,8,0,0,1,18.34,58.34l32-32A8,8,0,0,1,61.66,37.66Zm176,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,237.66,69.66ZM184,128a8,8,0,0,1,0,16H128a8,8,0,0,1-8-8V80a8,8,0,0,1,16,0v48Z\"/>"},"rocket-launch":{"regular":"<path d=\"M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z\"/>","fill":"<path d=\"M101.85,191.14C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Zm122-144a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.4,27.07h0L88,108.7A8,8,0,0,1,76.67,97.39l26.56-26.57A4,4,0,0,0,100.41,64H74.35A15.9,15.9,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A16,16,0,0,0,192,181.65V155.59a4,4,0,0,0-6.83-2.82l-26.57,26.56a8,8,0,0,1-11.71-.42,8.2,8.2,0,0,1,.6-11.1l49.27-49.27h0C223.45,91.86,224.6,59.71,223.85,47.12Z\"/>","duotone":"<path d=\"M184,120v61.65a8,8,0,0,1-2.34,5.65l-34.35,34.35a8,8,0,0,1-13.57-4.53L128,176ZM136,72H74.35a8,8,0,0,0-5.65,2.34L34.35,108.69a8,8,0,0,0,4.53,13.57L80,128ZM40,216c37.65,0,50.69-19.69,54.56-28.18L68.18,161.44C59.69,165.31,40,178.35,40,216Z\" opacity=\"0.2\"/><path d=\"M223.85,47.12a16,16,0,0,0-15-15c-12.58-.75-44.73.4-71.41,27.07L132.69,64H74.36A15.91,15.91,0,0,0,63,68.68L28.7,103a16,16,0,0,0,9.07,27.16l38.47,5.37,44.21,44.21,5.37,38.49a15.94,15.94,0,0,0,10.78,12.92,16.11,16.11,0,0,0,5.1.83A15.91,15.91,0,0,0,153,227.3L187.32,193A15.91,15.91,0,0,0,192,181.64V123.31l4.77-4.77C223.45,91.86,224.6,59.71,223.85,47.12ZM74.36,80h42.33L77.16,119.52,40,114.34Zm74.41-9.45a76.65,76.65,0,0,1,59.11-22.47,76.46,76.46,0,0,1-22.42,59.16L128,164.68,91.32,128ZM176,181.64,141.67,216l-5.19-37.17L176,139.31Zm-74.16,9.5C97.34,201,82.29,224,40,224a8,8,0,0,1-8-8c0-42.29,23-57.34,32.86-61.85a8,8,0,0,1,6.64,14.56c-6.43,2.93-20.62,12.36-23.12,38.91,26.55-2.5,36-16.69,38.91-23.12a8,8,0,1,1,14.56,6.64Z\"/>"},"trend-down":{"regular":"<path d=\"M240,128v64a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h44.69L136,107.31l-34.34,34.35a8,8,0,0,1-11.32,0l-72-72A8,8,0,0,1,29.66,58.34L96,124.69l34.34-34.35a8,8,0,0,1,11.32,0L224,172.69V128a8,8,0,0,1,16,0Z\"/>","fill":"<path d=\"M240,128v64a8,8,0,0,1-8,8H168a8,8,0,0,1-5.66-13.66L188.69,160,136,107.31l-34.34,34.35a8,8,0,0,1-11.32,0l-72-72A8,8,0,0,1,29.66,58.34L96,124.69l34.34-34.35a8,8,0,0,1,11.32,0L200,148.69l26.34-26.35A8,8,0,0,1,240,128Z\"/>","duotone":"<path d=\"M232,128v64H168Z\" opacity=\"0.2\"/><path d=\"M235.06,120.61a8,8,0,0,0-8.72,1.73L200,148.69,141.66,90.34a8,8,0,0,0-11.32,0L96,124.69,29.66,58.34A8,8,0,0,0,18.34,69.66l72,72a8,8,0,0,0,11.32,0L136,107.31,188.69,160l-26.35,26.34A8,8,0,0,0,168,200h64a8,8,0,0,0,8-8V128A8,8,0,0,0,235.06,120.61ZM224,184H187.31L224,147.31Z\"/>"},"crown-simple":{"regular":"<path d=\"M230.9,73.6A15.85,15.85,0,0,0,212,77.39l-33.67,36.29-35.8-80.29a1,1,0,0,1,0-.1,16,16,0,0,0-29.06,0,1,1,0,0,1,0,.1l-35.8,80.29L44,77.39A16,16,0,0,0,16.25,90.81c0,.11,0,.21.07.32L39,195a16,16,0,0,0,15.72,13H201.29A16,16,0,0,0,217,195L239.68,91.13c0-.11,0-.21.07-.32A15.85,15.85,0,0,0,230.9,73.6ZM201.35,191.68l-.06.32H54.71l-.06-.32L32,88l.14.16,42,45.24a8,8,0,0,0,13.18-2.18L128,40l40.69,91.25a8,8,0,0,0,13.18,2.18l42-45.24L224,88Z\"/>","fill":"<path d=\"M239.75,90.81c0,.11,0,.21-.07.32L217,195a16,16,0,0,1-15.72,13H54.71A16,16,0,0,1,39,195L16.32,91.13c0-.11-.05-.21-.07-.32A16,16,0,0,1,44,77.39l33.67,36.29,35.8-80.29a1,1,0,0,0,0-.1,16,16,0,0,1,29.06,0,1,1,0,0,0,0,.1l35.8,80.29L212,77.39a16,16,0,0,1,27.71,13.42Z\"/>","duotone":"<path d=\"M231.87,89.42l-22.7,104a8,8,0,0,1-7.88,6.61H54.71a8,8,0,0,1-7.88-6.61l-22.7-104A8,8,0,0,1,38,82.76L80,128l40.74-91.35a8,8,0,0,1,14.52,0L176,128l42-45.24A8,8,0,0,1,231.87,89.42Z\" opacity=\"0.2\"/><path d=\"M230.9,73.6A15.85,15.85,0,0,0,212,77.39l-33.67,36.29-35.8-80.29a1,1,0,0,1,0-.1,16,16,0,0,0-29.06,0,1,1,0,0,1,0,.1l-35.8,80.29L44,77.39A16,16,0,0,0,16.25,90.81c0,.11,0,.21.07.32L39,195a16,16,0,0,0,15.72,13H201.29A16,16,0,0,0,217,195L239.68,91.13c0-.11,0-.21.07-.32A15.85,15.85,0,0,0,230.9,73.6ZM201.35,191.68l-.06.32H54.71l-.06-.32L32,88l.14.16,42,45.24a8,8,0,0,0,13.18-2.18L128,40l40.69,91.25a8,8,0,0,0,13.18,2.18l42-45.24L224,88Z\"/>"},"leaf":{"regular":"<path d=\"M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49c.57,15.92,5.21,32,13.79,47.85l-19.51,19.5a8,8,0,0,0,11.32,11.32l19.5-19.51C81,210.73,97.09,215.37,113,215.94q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07ZM153.75,189.5c-22.75,13.78-49.68,14-76.71.77l88.63-88.62a8,8,0,0,0-11.32-11.32L65.73,179c-13.19-27-13-54,.77-76.71,22.09-36.47,74.6-56.44,141.31-54.06C210.2,114.89,190.22,167.41,153.75,189.5Z\"/>","fill":"<path d=\"M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49A101.72,101.72,0,0,0,46.7,175.2a4,4,0,0,0,6.61,1.43l85-86.3a8,8,0,0,1,11.32,11.32L56.74,195.94,42.55,210.13a8.2,8.2,0,0,0-.6,11.1,8,8,0,0,0,11.71.43l16.79-16.79c14.14,6.84,28.41,10.57,42.56,11.07q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07Z\"/>","duotone":"<path d=\"M63.81,192.19c-47.89-79.81,16-159.62,151.64-151.64C223.43,176.23,143.62,240.08,63.81,192.19Z\" opacity=\"0.2\"/><path d=\"M223.45,40.07a8,8,0,0,0-7.52-7.52C139.8,28.08,78.82,51,52.82,94a87.09,87.09,0,0,0-12.76,49c.57,15.92,5.21,32,13.79,47.85l-19.51,19.5a8,8,0,0,0,11.32,11.32l19.5-19.51C81,210.73,97.09,215.37,113,215.94q1.67.06,3.33.06A86.93,86.93,0,0,0,162,203.18C205,177.18,227.93,116.21,223.45,40.07ZM153.75,189.5c-22.75,13.78-49.68,14-76.71.77l88.63-88.62a8,8,0,0,0-11.32-11.32L65.73,179c-13.19-27-13-54,.77-76.71,22.09-36.47,74.6-56.44,141.31-54.06C210.2,114.89,190.22,167.41,153.75,189.5Z\"/>"},"pencil-simple":{"regular":"<path d=\"M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z\"/>","fill":"<path d=\"M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM192,108.68,147.31,64l24-24L216,84.68Z\"/>","duotone":"<path d=\"M221.66,90.34,192,120,136,64l29.66-29.66a8,8,0,0,1,11.31,0L221.66,79A8,8,0,0,1,221.66,90.34Z\" opacity=\"0.2\"/><path d=\"M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z\"/>"},"info":{"regular":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z\"/>","fill":"<path d=\"M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-4,48a12,12,0,1,1-12,12A12,12,0,0,1,124,72Zm12,112a16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40a8,8,0,0,1,0,16Z\"/>","duotone":"<path d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\" opacity=\"0.2\"/><path d=\"M144,176a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176Zm88-48A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128ZM124,96a12,12,0,1,0-12-12A12,12,0,0,0,124,96Z\"/>"},"confetti":{"regular":"<path d=\"M111.49,52.63a15.8,15.8,0,0,0-26,5.77L33,202.78A15.83,15.83,0,0,0,47.76,224a16,16,0,0,0,5.46-1l144.37-52.5a15.8,15.8,0,0,0,5.78-26Zm-8.33,135.21-35-35,13.16-36.21,58.05,58.05Zm-55,20,14-38.41,24.45,24.45ZM156,168.64,87.36,100l13-35.87,91.43,91.43ZM160,72a37.8,37.8,0,0,1,3.84-15.58C169.14,45.83,179.14,40,192,40c6.7,0,11-2.29,13.65-7.21A22,22,0,0,0,208,23.94,8,8,0,0,1,224,24c0,12.86-8.52,32-32,32-6.7,0-11,2.29-13.65,7.21A22,22,0,0,0,176,72.06,8,8,0,0,1,160,72ZM136,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm101.66,82.34a8,8,0,1,1-11.32,11.31l-16-16a8,8,0,0,1,11.32-11.32Zm4.87-42.75-24,8a8,8,0,0,1-5.06-15.18l24-8a8,8,0,0,1,5.06,15.18Z\"/>","fill":"<path d=\"M111.49,52.63a15.8,15.8,0,0,0-26,5.77L33,202.78A15.83,15.83,0,0,0,47.76,224a16,16,0,0,0,5.46-1l144.37-52.5a15.8,15.8,0,0,0,5.78-26ZM65.14,161.13l19.2-52.79,63.32,63.32-52.8,19.2ZM160,72a37.8,37.8,0,0,1,3.84-15.58C169.14,45.83,179.14,40,192,40c6.7,0,11-2.29,13.65-7.21A22,22,0,0,0,208,23.94,8,8,0,0,1,224,24c0,12.86-8.52,32-32,32-6.7,0-11,2.29-13.65,7.21A22,22,0,0,0,176,72.06,8,8,0,0,1,160,72ZM136,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm101.66,82.34a8,8,0,1,1-11.32,11.31l-16-16a8,8,0,0,1,11.32-11.32Zm4.87-42.75-24,8a8,8,0,0,1-5.06-15.18l24-8a8,8,0,0,1,5.06,15.18Z\"/>","duotone":"<path d=\"M58.89,154.89l42.22,42.22-50.63,18.4a7.79,7.79,0,0,1-10-10Zm138.82-4.72L105.83,58.29A7.79,7.79,0,0,0,93,61.14l-14.9,41,75.82,75.82,41-14.9A7.79,7.79,0,0,0,197.71,150.17Z\" opacity=\"0.2\"/><path d=\"M111.49,52.63a15.8,15.8,0,0,0-26,5.77L33,202.78A15.83,15.83,0,0,0,47.76,224a16,16,0,0,0,5.46-1l144.37-52.5a15.8,15.8,0,0,0,5.78-26Zm-8.33,135.21-35-35,13.16-36.21,58.05,58.05Zm-55,20,14-38.41,24.45,24.45ZM156,168.64,87.36,100l13-35.87,91.43,91.43ZM160,72a37.8,37.8,0,0,1,3.84-15.58C169.14,45.83,179.14,40,192,40c6.7,0,11-2.29,13.65-7.21A22,22,0,0,0,208,23.94,8,8,0,0,1,224,24c0,12.86-8.52,32-32,32-6.7,0-11,2.29-13.65,7.21A22,22,0,0,0,176,72.06,8,8,0,0,1,160,72ZM136,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm101.66,82.34a8,8,0,1,1-11.32,11.31l-16-16a8,8,0,0,1,11.32-11.32Zm4.87-42.75-24,8a8,8,0,0,1-5.06-15.18l24-8a8,8,0,0,1,5.06,15.18Z\"/>"},"arrow-up-right":{"regular":"<path d=\"M200,64V168a8,8,0,0,1-16,0V83.31L69.66,197.66a8,8,0,0,1-11.32-11.32L172.69,72H88a8,8,0,0,1,0-16H192A8,8,0,0,1,200,64Z\"/>","fill":"<path d=\"M200,64V168a8,8,0,0,1-13.66,5.66L140,127.31,69.66,197.66a8,8,0,0,1-11.32-11.32L128.69,116,82.34,69.66A8,8,0,0,1,88,56H192A8,8,0,0,1,200,64Z\"/>","duotone":"<path d=\"M192,64V168L88,64Z\" opacity=\"0.2\"/><path d=\"M192,56H88a8,8,0,0,0-5.66,13.66L128.69,116,58.34,186.34a8,8,0,0,0,11.32,11.32L140,127.31l46.34,46.35A8,8,0,0,0,200,168V64A8,8,0,0,0,192,56Zm-8,92.69-38.34-38.34h0L107.31,72H184Z\"/>"}};

// Ícone Phosphor por nome e peso (regular | fill | duotone). Usa currentColor.
function Icon({ name, weight = "regular", size = 20, className = "" }) {
  const d = PH_ICONS[name];
  if (!d) return null;
  return <svg className={`gt-ico ${className}`} width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d[weight] || d.regular }} />;
}

// Emoji -> ícone Phosphor. Se o emoji não tiver ícone, mostra o texto mesmo.
const EMOJI_ICON = {"🏃": "corrida", "🎯": "metas", "🏆": "desafios", "✨": "ia", "🏋": "treinos", "🔥": "fire", "🔄": "arrows-clockwise", "⚡": "raio", "👑": "crown-simple", "⚠": "warning", "🤝": "handshake", "🏁": "provas", "☕": "coffee", "✅": "check-circle", "🌿": "leaf", "📅": "calendar-blank", "📋": "fichas", "👥": "amigos", "🛣": "road-horizon", "📥": "importar", "🔧": "ajustar", "📲": "device-mobile", "🎥": "video-camera", "📎": "paperclip", "📖": "book-open", "💡": "lightbulb", "🐞": "bug", "👍": "thumbs-up", "💬": "feedback", "🔀": "shuffle", "⏱": "timer", "⛔": "prohibit", "📍": "map-pin", "📏": "ruler", "📈": "trend-up", "🎲": "dice-five", "⏰": "alarm", "🚀": "rocket-launch", "📉": "trend-down", "🎉": "confetti", "🙌": "confetti", "⚙": "config", "📊": "admin", "ℹ": "info"};
function Ei({ e, size = "1.15em", weight = "duotone" }) {
  const nome = EMOJI_ICON[String(e || "").replace(/\uFE0F/g, "")];
  if (!nome) return <>{e}</>;
  return <Icon name={nome} weight={weight} size={size} className="gt-ico-inl" />;
}

function NavIcon({ name, size = 24, active = false }) {
  return <Icon name={name} weight={active ? "fill" : "regular"} size={size} className={active ? "pop" : ""} />;
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
// --- Sessão x ficha: o treino de um dia específico = a ficha (ou a cópia
// congelada dela, tirada quando o treino foi concluído) + os exercícios
// adicionados só naquele dia. Séries a mais/a menos já ficam no próprio
// registro do dia (sets), então não precisam de camada própria. ---
const ADDED_BLOCO_NOME = "Adicionados hoje";
function resolveTreinoForDay(treino, daySession) {
  if (!treino) return treino;
  const s = daySession || {};
  const base = aplicarSemanaTreino((s.base && s.base[treino.id]) || treino, s);
  const added = (s.ajustes && s.ajustes[treino.id] && s.ajustes[treino.id].added) || [];
  if (added.length === 0) return base;
  return { ...base, blocos: [...base.blocos, { nome: ADDED_BLOCO_NOME, exercicios: added }] };
}

// O que mudou no dia em relação à ficha, pra pergunta "Salvar na ficha?".
// Só considera séries de exercício que a pessoa realmente tocou (tem sets
// registrados) e que não foi pulado.
function computeFichaChanges(treinoBase, daySession, treinoKey) {
  const s = daySession || {};
  const added = ((s.ajustes && s.ajustes[treinoBase.id]) || {}).added || [];
  const log = (s.log && s.log[treinoKey]) || {};
  const changes = [];
  added.forEach((ex) => {
    const sets = (log[ex.id] && log[ex.id].sets) || [];
    const series = sets.length > 0 ? sets.length : ex.series;
    changes.push({ kind: "added", exId: ex.id, nome: ex.nome, exercicio: { ...ex, series }, on: true });
  });
  flattenExercicios(treinoBase).forEach((ex) => {
    const exLog = log[ex.id];
    if (!exLog) return;
    if (exLog.status === "pulei") {
      changes.push({ kind: "skipped", exId: ex.id, nome: ex.nome, on: false });
    } else if (exLog.sets && exLog.sets.length > 0 && exLog.sets.length !== ex.series) {
      changes.push({ kind: "series", exId: ex.id, nome: ex.nome, from: ex.series, to: exLog.sets.length, on: true });
    }
  });
  return changes;
}

// Aplica as mudanças marcadas na ficha: novos exercícios vão pro último
// bloco, séries são atualizadas, pulados marcados são removidos (blocos que
// ficam vazios somem).
function applyFichaChanges(treino, changes) {
  let blocos = treino.blocos.map((b) => ({ ...b, exercicios: b.exercicios.map((e) => ({ ...e })) }));
  changes.filter((c) => c.on).forEach((c) => {
    if (c.kind === "series") {
      blocos.forEach((b) => b.exercicios.forEach((e) => { if (e.id === c.exId) e.series = c.to; }));
    } else if (c.kind === "skipped") {
      blocos = blocos.map((b) => ({ ...b, exercicios: b.exercicios.filter((e) => e.id !== c.exId) }));
    }
  });
  blocos = blocos.filter((b) => b.exercicios.length > 0);
  const toAdd = changes.filter((c) => c.on && c.kind === "added");
  if (toAdd.length > 0) {
    if (blocos.length === 0) blocos.push({ nome: "Exercícios", exercicios: [] });
    const last = blocos[blocos.length - 1];
    const have = new Set(blocos.flatMap((b) => b.exercicios.map((e) => e.id)));
    toAdd.forEach((c) => { if (!have.has(c.exercicio.id)) last.exercicios.push({ ...c.exercicio }); });
  }
  return { ...treino, blocos };
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

// --- Importar histórico de treinos (arquivo interpretado por IA) ---
// A IA devolve JSON compacto por parte do arquivo; aqui validamos, juntamos, casamos os exercícios
// com os que a pessoa já tem / o catálogo, planejamos o que será criado (para a tela de revisão),
// aplicamos tudo marcando cada item com o id da importação (`imp`) e sabemos desfazer.
const HIST_MAX_CHARS = 9000; // tamanho de cada parte de texto enviada à IA
const HIST_MAX_PARTES = 20;

function histNorm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const HIST_STOP = new Set(["de", "da", "do", "das", "dos", "com", "na", "no", "nas", "nos", "e", "a", "o", "em", "para", "pra"]);
function histTokens(s) {
  return histNorm(s).split(" ").filter((t) => t && !HIST_STOP.has(t)).map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}
function histDataValida(d, hoje) {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, dd] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, dd);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== dd) return false;
  return y >= 2000 && (!hoje || d <= hoje);
}
// Texto da IA -> objeto (tolera ```json e texto em volta). null se não der.
function histParse(texto) {
  if (!texto) return null;
  let t = String(texto).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
function histNum(v, min, max) {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return isFinite(n) && n >= min && n <= max ? n : null;
}
// Valida o JSON da IA: descarta o que não faz sentido (datas futuras, séries vazias...).
function histLimpar(obj, hoje) {
  const out = { sessoes: [], ativ: [], avisos: [] };
  if (!obj || typeof obj !== "object") return out;
  (Array.isArray(obj.sessoes) ? obj.sessoes : []).forEach((s) => {
    if (!s || !histDataValida(s.d, hoje)) return;
    const ex = [];
    (Array.isArray(s.ex) ? s.ex : []).forEach((e) => {
      if (!e || typeof e.n !== "string" || !e.n.trim()) return;
      const sets = [];
      (Array.isArray(e.s) ? e.s : []).forEach((st) => {
        const peso = histNum(Array.isArray(st) ? st[0] : null, 0, 1000);
        const reps = histNum(Array.isArray(st) ? st[1] : null, 0, 500);
        if (peso == null && reps == null) return;
        sets.push({ peso, reps: reps == null ? null : Math.round(reps) });
      });
      if (!sets.length) return;
      ex.push({ n: e.n.trim().slice(0, 80), s: sets, o: typeof e.o === "string" ? e.o.trim().slice(0, 200) : "" });
    });
    if (!ex.length) return;
    out.sessoes.push({ d: s.d, n: (typeof s.n === "string" && s.n.trim() ? s.n.trim() : "Treino").slice(0, 60), min: histNum(s.min, 1, 400), ex });
  });
  (Array.isArray(obj.ativ) ? obj.ativ : []).forEach((a) => {
    if (!a || !histDataValida(a.d, hoje) || typeof a.n !== "string" || !a.n.trim()) return;
    out.ativ.push({ d: a.d, n: a.n.trim().slice(0, 60), km: histNum(a.km, 0.1, 500), min: histNum(a.min, 1, 1000) });
  });
  (Array.isArray(obj.avisos) ? obj.avisos : []).forEach((x) => { if (typeof x === "string" && x.trim()) out.avisos.push(x.trim().slice(0, 200)); });
  return out;
}
// Junta o resultado de várias partes: uma sessão por dia e nome (fica a que tem mais exercícios).
function histJuntar(lista) {
  const sess = new Map(), ativ = new Map(), avisos = [];
  lista.forEach((r) => {
    if (!r) return;
    r.sessoes.forEach((s) => {
      const k = `${s.d}|${histNorm(s.n)}`;
      const prev = sess.get(k);
      if (!prev || s.ex.length > prev.ex.length) sess.set(k, s);
    });
    r.ativ.forEach((a) => { const k = `${a.d}|${histNorm(a.n)}`; if (!ativ.has(k)) ativ.set(k, a); });
    r.avisos.forEach((x) => { if (avisos.indexOf(x) < 0 && avisos.length < 12) avisos.push(x); });
  });
  const porData = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  return { sessoes: [...sess.values()].sort(porData), ativ: [...ativ.values()].sort(porData), avisos };
}
// Casa o nome de um exercício com os da pessoa e do catálogo (exato; depois por palavras, só se forem 2+).
function histCasarExercicio(nome, conhecidos) {
  const n = histNorm(nome);
  const tk = histTokens(nome);
  const cands = (conhecidos || []).filter((c) => c && c.nome);
  const exato = cands.find((c) => histNorm(c.nome) === n);
  if (exato) return exato;
  if (tk.length >= 2) {
    const A = new Set(tk);
    let melhor = null, melhorSc = 0;
    cands.forEach((c) => {
      const B = new Set(histTokens(c.nome));
      if (B.size < 2) return;
      const inter = [...A].filter((t) => B.has(t)).length;
      const uni = new Set([...A, ...B]).size;
      const contido = inter === A.size || inter === B.size;
      const sc = inter / uni;
      if (contido && sc >= 0.6 && sc > melhorSc) { melhor = c; melhorSc = sc; }
    });
    if (melhor) return melhor;
  }
  return null;
}
function histTitulo(s) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
// Prepara o que será criado, para a tela de revisão. Não altera nada.
function histPlanejar(juntado, ctx) {
  const treinos = ctx.treinos || [], sessions = ctx.sessions || {}, schedule = ctx.schedule || {}, atividades = ctx.atividades || [];
  const seus = [];
  treinos.forEach((t) => flattenExercicios(t).forEach((e) => { if (!seus.some((x) => x.id === e.id)) seus.push({ id: e.id, nome: e.nome, origem: "seu" }); }));
  const cat = EXERCISE_CATALOG_FLAT.map((e) => ({ id: e.id, nome: e.nome, origem: "catalogo", descricao: e.descricao || "", videoUrl: e.videoUrl || "" }));
  const conhecidos = [...seus, ...cat];
  const cache = {};
  const casar = (nome) => {
    const k = histNorm(nome);
    if (!cache[k]) {
      const m = histCasarExercicio(nome, conhecidos);
      cache[k] = m ? { id: m.id, nome: m.nome, origem: m.origem, descricao: m.descricao || "", videoUrl: m.videoUrl || "" } : { id: slugify(nome) || "exercicio", nome: histTitulo(nome), origem: "novo", descricao: "", videoUrl: "" };
    }
    return cache[k];
  };
  const fichas = new Map();
  const sessoes = [];
  const novosEx = new Map();
  juntado.sessoes.forEach((s) => {
    let key = histNorm(s.n);
    let existente = treinos.find((t) => histNorm(t.nome) === key) || null;
    let nomeFicha = histTitulo(s.n);
    if (!existente && !ctx.criarFichas) { key = "__hist"; nomeFicha = "Histórico importado"; }
    if (!fichas.has(key)) fichas.set(key, { key, nome: existente ? existente.nome : nomeFicha, existenteId: existente ? existente.id : null, ex: new Map(), nSessoes: 0, ultimaData: "" });
    const f = fichas.get(key);
    const exs = [];
    s.ex.forEach((e) => {
      const m = casar(e.n);
      if (m.origem === "novo") novosEx.set(m.id, m.nome);
      const prev = exs.find((x) => x.id === m.id);
      if (prev) { prev.sets = prev.sets.concat(e.s); if (e.o && !prev.obs) prev.obs = e.o; }
      else exs.push({ id: m.id, nome: m.nome, origem: m.origem, descricao: m.descricao, videoUrl: m.videoUrl, sets: e.s.slice(), obs: e.o || "" });
    });
    f.nSessoes++;
    exs.forEach((e) => {
      if (!f.ex.has(e.id)) f.ex.set(e.id, { id: e.id, nome: e.nome, origem: e.origem, descricao: e.descricao, videoUrl: e.videoUrl, series: [], reps: [], ordem: f.ex.size + 1 });
      const acc = f.ex.get(e.id);
      acc.series.push(e.sets.length);
      e.sets.forEach((st) => { if (st.reps != null) acc.reps.push(st.reps); });
    });
    const treinoId = existente ? existente.id : null;
    const noFicha = existente ? new Set(flattenExercicios(existente).map((x) => x.id)) : null;
    const logExistente = treinoId && sessions[s.d] && sessions[s.d].log && sessions[s.d].log[`treino:${treinoId}`];
    const conflito = !!(logExistente && Object.values(logExistente).some((v) => v && v.status));
    sessoes.push({ data: s.d, fichaKey: key, treinoId, duracaoMin: s.min, conflito, exercicios: exs.map((e) => ({ ...e, naFicha: !noFicha || noFicha.has(e.id) })) });
  });
  const fichasOut = [...fichas.values()].map((f) => {
    const lista = [...f.ex.values()].sort((a, b) => a.ordem - b.ordem).map((e) => {
      const series = Math.max(1, Math.round(e.series.reduce((t, x) => t + x, 0) / e.series.length));
      const cont = {}; e.reps.forEach((r) => { cont[r] = (cont[r] || 0) + 1; });
      const moda = Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0];
      return { id: e.id, nome: e.nome, origem: e.origem, descricao: e.descricao, videoUrl: e.videoUrl, series, repeticoes: moda ? String(moda) : "" };
    });
    return { key: f.key, nome: f.nome, existenteId: f.existenteId, nSessoes: f.nSessoes, exercicios: lista };
  });
  const ativ = ctx.incluirAtiv === false ? [] : juntado.ativ.map((a) => {
    const nn = histNorm(a.n), tk = histTokens(a.n);
    const match = atividades.find((x) => !x.descanso && (histNorm(x.nome) === nn || (tk.length && (() => { const B = histTokens(x.nome); return B.length && (tk.every((t) => B.indexOf(t) >= 0) || B.every((t) => tk.indexOf(t) >= 0)); })())));
    const log = match && sessions[a.d] && sessions[a.d].log && sessions[a.d].log[`atividade:${match.id}`];
    return { data: a.d, nome: match ? match.nome : histTitulo(a.n), atividadeId: match ? match.id : null, km: a.km, min: a.min, conflito: !!(log && log.status === "fui") };
  });
  const datas = [...sessoes.map((s) => s.data), ...ativ.map((a) => a.data)].sort();
  return {
    fichas: fichasOut, sessoes, ativ,
    novosExercicios: [...novosEx.values()],
    periodo: datas.length ? { ini: datas[0], fim: datas[datas.length - 1] } : null,
    puladas: sessoes.filter((s) => s.conflito).length + ativ.filter((a) => a.conflito).length,
    avisos: juntado.avisos,
  };
}
function histIdUnico(base, usados) {
  let id = base || "item", i = 2;
  while (usados.has(id)) { id = `${base}-${i}`; i++; }
  usados.add(id);
  return id;
}
// Aplica o plano. Devolve novos treinos / sessions / atividades (não muta os de entrada).
function histAplicar(plano, estado, impId) {
  const treinos = [...estado.treinos];
  const atividades = [...estado.atividades];
  const sessions = { ...estado.sessions };
  const schedule = estado.schedule || {};
  const idsT = new Set(treinos.map((t) => t.id));
  const idsA = new Set(atividades.map((a) => a.id));
  const treinoDaFicha = {};
  let fichasNovas = 0;
  plano.fichas.forEach((f) => {
    if (f.existenteId) { treinoDaFicha[f.key] = f.existenteId; return; }
    const id = histIdUnico(slugify(f.nome), idsT);
    const mins = plano.sessoes.filter((s) => s.fichaKey === f.key && s.duracaoMin).map((s) => s.duracaoMin);
    const vistos = new Set();
    const exercicios = f.exercicios.filter((e) => (vistos.has(e.id) ? false : vistos.add(e.id))).map((e) => ({
      id: e.id, nome: e.nome, series: e.series, repeticoes: e.repeticoes || "", descricao: e.descricao || "", observacoes: "", videoUrl: e.videoUrl || "",
    }));
    treinos.push({ id, nome: f.nome, duracaoMin: mins.length ? Math.round(mins.reduce((t, x) => t + x, 0) / mins.length) : null, notas: "", imp: impId, blocos: [{ nome: "Exercícios", exercicios }] });
    treinoDaFicha[f.key] = id;
    fichasNovas++;
  });
  const sh = (d) => ({ log: {}, extras: [], removed: [], cargas: {}, ...(sessions[d] || {}) });
  const agendado = (d, tipo, id) => {
    const s = sessions[d] || {};
    const rem = (s.removed || []).some((it) => it.tipo === tipo && it.id === id);
    return !rem && (schedule[weekdayOf(d)] || []).some((it) => it.tipo === tipo && it.id === id);
  };
  let nSess = 0;
  plano.sessoes.forEach((s) => {
    if (s.conflito) return;
    const tid = treinoDaFicha[s.fichaKey];
    if (!tid) return;
    const treino = treinos.find((t) => t.id === tid);
    const key = `treino:${tid}`;
    const dia = sh(s.data);
    const log = { ...dia.log }; const tl = { ...(log[key] || {}) };
    let ajustes = dia.ajustes;
    const idsFicha = new Set(flattenExercicios(treino).map((e) => e.id));
    s.exercicios.forEach((e) => {
      let exId = e.id;
      if (!idsFicha.has(exId)) {
        const aj = (ajustes && ajustes[tid]) || { added: [] };
        if (!(aj.added || []).some((x) => x.id === exId)) {
          const n = Math.max(1, e.sets.length);
          ajustes = { ...(ajustes || {}), [tid]: { ...aj, added: [...(aj.added || []), { id: exId, nome: e.nome, series: n, repeticoes: "", descricao: e.descricao || "", observacoes: "", videoUrl: e.videoUrl || "", imp: impId }] } };
        }
      }
      tl[exId] = { status: "feito", comentario: e.obs || "", sets: e.sets.map((st) => ({ peso: st.peso == null ? "" : String(st.peso), reps: st.reps == null ? "" : String(st.reps) })), imp: impId };
    });
    log[key] = tl;
    const extras = agendado(s.data, "treino", tid) || (dia.extras || []).some((it) => it.tipo === "treino" && it.id === tid) ? dia.extras : [...(dia.extras || []), { tipo: "treino", id: tid, imp: impId }];
    const cargas = s.duracaoMin ? { ...dia.cargas, [key]: { duracaoMin: s.duracaoMin, updatedAt: Date.now(), imp: impId } } : dia.cargas;
    sessions[s.data] = { ...dia, log, extras, cargas, ...(ajustes ? { ajustes } : {}) };
    nSess++;
  });
  let nAtiv = 0;
  plano.ativ.forEach((a) => {
    if (a.conflito) return;
    let aid = a.atividadeId;
    if (!aid) {
      const ja = atividades.find((x) => histNorm(x.nome) === histNorm(a.nome));
      if (ja) aid = ja.id;
      else { aid = histIdUnico(slugify(a.nome), idsA); atividades.push({ id: aid, nome: a.nome, imp: impId }); }
    }
    const key = `atividade:${aid}`;
    const dia = sh(a.data);
    const extras = agendado(a.data, "atividade", aid) || (dia.extras || []).some((it) => it.tipo === "atividade" && it.id === aid) ? dia.extras : [...(dia.extras || []), { tipo: "atividade", id: aid, imp: impId }];
    const cg = {};
    if (a.min) cg.duracaoMin = a.min;
    if (a.km) cg.distanciaKm = a.km;
    cg.updatedAt = Date.now(); cg.imp = impId;
    sessions[a.data] = { ...dia, log: { ...dia.log, [key]: { status: "fui", comentario: "", imp: impId } }, extras, cargas: { ...dia.cargas, [key]: cg } };
    nAtiv++;
  });
  return { treinos, atividades, sessions, resumo: { sessoes: nSess, fichas: fichasNovas, atividades: nAtiv, puladas: plano.puladas || 0 } };
}
// Importações feitas (derivadas das marcas `imp` nos dados), da mais nova para a mais antiga.
function histImportacoes(estado) {
  const mapa = {};
  const pega = (id) => (mapa[id] = mapa[id] || { id, sessoes: 0, fichas: 0, ini: "", fim: "" });
  Object.keys(estado.sessions || {}).forEach((d) => {
    const s = estado.sessions[d] || {};
    Object.keys(s.log || {}).forEach((k) => {
      const v = s.log[k]; if (!v) return;
      let id = null;
      if (k.indexOf("treino:") === 0) { const e = Object.values(v).find((x) => x && x.imp); id = e && e.imp; } else id = v.imp;
      if (!id) return;
      const m = pega(id); m.sessoes++;
      if (!m.ini || d < m.ini) m.ini = d;
      if (!m.fim || d > m.fim) m.fim = d;
    });
  });
  (estado.treinos || []).forEach((t) => { if (t.imp) pega(t.imp).fichas++; });
  return Object.values(mapa).sort((a, b) => (a.id < b.id ? 1 : -1));
}
// Desfaz uma importação. Fichas que a pessoa passou a usar depois (registros dela) ficam.
function histDesfazer(impId, estado) {
  const sessions = {};
  const usadaDepois = new Set();
  Object.keys(estado.sessions || {}).forEach((d) => {
    const s = estado.sessions[d];
    const log = {}, cargas = {};
    Object.keys(s.log || {}).forEach((k) => {
      const v = s.log[k];
      if (k.indexOf("treino:") === 0 && v) {
        const resto = {};
        Object.keys(v).forEach((ex) => { if (!(v[ex] && v[ex].imp === impId)) resto[ex] = v[ex]; });
        if (Object.keys(resto).length) { log[k] = resto; usadaDepois.add(k.slice(7)); }
      } else if (!(v && v.imp === impId)) log[k] = v;
    });
    Object.keys(s.cargas || {}).forEach((k) => { if (!(s.cargas[k] && s.cargas[k].imp === impId)) cargas[k] = s.cargas[k]; });
    const extras = (s.extras || []).filter((it) => it.imp !== impId);
    let ajustes = s.ajustes;
    if (ajustes) {
      const novo = {};
      Object.keys(ajustes).forEach((tid) => { novo[tid] = { ...ajustes[tid], added: (ajustes[tid].added || []).filter((x) => x.imp !== impId) }; });
      ajustes = novo;
    }
    const vazio = !Object.keys(log).length && !Object.keys(cargas).length && !extras.length && !(s.removed || []).length && !(ajustes && Object.values(ajustes).some((a) => (a.added || []).length)) && !s.base;
    if (!vazio) sessions[d] = { ...s, log, cargas, extras, ...(ajustes ? { ajustes } : {}) };
  });
  const treinos = [];
  (estado.treinos || []).forEach((t) => {
    if (t.imp !== impId) { treinos.push(t); return; }
    if (usadaDepois.has(t.id)) { const { imp, ...resto } = t; treinos.push(resto); }
  });
  const atividades = (estado.atividades || []).filter((a) => a.imp !== impId);
  return { sessions, treinos, atividades };
}
// Divide texto em partes de até `max` caracteres, em quebras de linha. `cabecalho` repete em cada parte (CSV).
function histDividirTexto(texto, max, cabecalho) {
  const lim = max || HIST_MAX_CHARS;
  const ini = cabecalho ? cabecalho + "\n" : "";
  const partes = [];
  let atual = ini;
  const temConteudo = () => atual.length > ini.length && atual.trim().length > 0;
  const fecha = () => { if (temConteudo()) partes.push(atual); atual = ini; };
  String(texto || "").replace(/\r\n?/g, "\n").split("\n").forEach((l) => {
    let linha = l;
    while (linha.length > lim) { fecha(); partes.push(linha.slice(0, lim)); linha = linha.slice(lim); }
    if (atual.length + linha.length + 1 > lim) fecha();
    atual += linha + "\n";
  });
  fecha();
  return partes;
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
    tplExercicio("Cadeira flexora (flexora sentada)", 3, "12-15", ""),
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
  } else if (n === 7) {
    // 7 dias: o split de 6 (Push/Pull/Legs A+B) + um sétimo dia mais leve de
    // corpo inteiro + abdômen, pra não empilhar um terceiro dia pesado.
    treinos = [
      ...buildMusculacaoSplit(6),
      tplTreino("Full Body Leve — Core & Mobilidade", 40, [
        tplBloco("Corpo inteiro", [TPL_EX.peito[0], TPL_EX.costas[0], TPL_EX.quad[0]]),
        tplBloco("Abdômen", [TPL_EX.abdomen[0], TPL_EX.abdomen[1]]),
        tplBloco("Mobilidade", [TPL_EX_CATALOG_EXTRA.mobilidade[2]]),
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
// Registra o nome de um exercício criado na hora (fora do catálogo), pra revisar no painel de admin.
// Nunca atrapalha nada se falhar (ex.: tabela ainda não criada).
function logExercicioLivre(nome) {
  try {
    if (!desafioUserIdAtual || !nome) return;
    supabaseClient.from("exercise_suggestions").insert({ user_id: desafioUserIdAtual, nome: String(nome).slice(0, 80) }).then(() => {});
  } catch (e) {}
}

function ExercisePickerModal({ search, setSearch, grupo, setGrupo, isAdded, onAdd, canRemove, onRemove, onClose }) {
  const q = normalizeSearch(search);
  const filtered = EXERCISE_CATALOG_FLAT.filter((ex) => (q
    ? exercicioCombinaBusca(ex.nome, search)
    : ex.grupo === grupo));
  const porNome = q ? EXERCISE_CATALOG_FLAT.filter((ex) => normalizeSearch(ex.nome).includes(q.trim())) : [];
  const termoLivre = search.trim().replace(/\s+/g, " ").slice(0, 60);
  const podeCriarLivre = !!termoLivre && !EXERCISE_CATALOG_FLAT.some((ex) => normalizeSearch(ex.nome) === normalizeSearch(termoLivre));
  const nomeLivre = termoLivre.charAt(0).toUpperCase() + termoLivre.slice(1);
  const [okLivre, setOkLivre] = useState("");
  const livreJaAdicionado = podeCriarLivre && isAdded({ nome: nomeLivre });

  // Cria o exercício com o nome digitado (vale pelo botão e pelo "OK"/Enter do teclado).
  function adicionarLivre() {
    if (!podeCriarLivre || livreJaAdicionado) return;
    logExercicioLivre(nomeLivre);
    onAdd({ nome: nomeLivre, series: 3, repeticoes: "10-12", grupo: "Outros", descricao: "", videoUrl: "" });
    setOkLivre(nomeLivre);
    setSearch("");
  }
  function aoTeclar(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // "OK" do teclado: se só um exercício do catálogo tem esse nome, adiciona ele; se nenhum tem
    // (resultados só por sinônimo não contam), cria o exercício com o que foi digitado.
    if (!q.trim()) return;
    if (porNome.length === 1) { if (!isAdded(porNome[0])) onAdd(porNome[0]); setSearch(""); return; }
    if (porNome.length === 0) adicionarLivre();
  }

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
          enterKeyHint={porNome.length === 0 && podeCriarLivre ? "done" : "search"}
          onChange={(e) => { setSearch(e.target.value); if (okLivre) setOkLivre(""); }}
          onKeyDown={aoTeclar}
        />
        {okLivre && !search.trim() && <div className="gt-exercise-ok">✓ "{okLivre}" adicionado ao treino</div>}
        {podeCriarLivre && (
          <button type="button" className="gt-exercise-row gt-exercise-row-livre" onClick={adicionarLivre} disabled={livreJaAdicionado}>
            <div className="gt-exercise-row-main">
              <div className="gt-exercise-row-nome">{livreJaAdicionado ? `✓ "${nomeLivre}" já está no treino` : `+ Adicionar "${termoLivre}" como novo exercício`}</div>
              <div className="gt-exercise-row-meta">{filtered.length === 0 ? "Não está no catálogo. " : ""}Cria um exercício livre · 3x 10-12 (dá pra mudar depois)</div>
            </div>
          </button>
        )}
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
            // Exercício adicionado agora há pouco (só no treino de hoje) dá
            // pra desfazer tocando de novo — quem errou o toque na busca
            // resolve ali mesmo, sem procurar o botão dentro do exercício.
            const removable = added && canRemove && canRemove(ex);
            return (
              <button
                type="button"
                key={`${ex.nome}-${i}`}
                className={`gt-exercise-row ${added ? "added" : ""}`}
                onClick={() => (removable ? onRemove(ex) : added ? null : onAdd(ex))}
              >
                <div className="gt-exercise-row-main">
                  <div className="gt-exercise-row-nome">{ex.nome}</div>
                  <div className="gt-exercise-row-meta">{ex.grupo} · {ex.series}x {ex.repeticoes}{ex.videoUrl ? <> · <Ei e="🎥" /></> : ""}{removable ? " · toque pra remover" : ""}</div>
                </div>
                <div className="gt-exercise-row-add">{removable ? "✕" : added ? "✓" : "+"}</div>
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
  .gt-shell { height:100vh; height:100dvh; padding-bottom:0; display:flex; flex-direction:column; overflow:hidden; overscroll-behavior:none; }
  .gt-shell > .gt-header { flex-shrink:0; }
  .gt-shell > .gt-body { flex:1 1 auto; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
  .gt-shell > .gt-tabbar { position:static; flex-shrink:0; margin:0 auto; width:100%; }
  .gt-header { padding:10px 18px; border-bottom:1px solid var(--border); }
  .gt-header-row { display:flex; align-items:center; gap:14px; min-height:44px; }
  .gt-header-row .gt-title { flex:1; min-width:0; margin:0; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:20px; }
  .gt-header-row .gt-brand { margin:0 0 0 auto; flex-shrink:0; gap:8px; }
  .gt-header-row .gt-brand-name { font-size:16px; }
  .gt-menu-btn { position:relative; width:44px; height:44px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; background:none; border:1px solid var(--border); border-radius:12px; cursor:pointer; padding:0; }
  .gt-menu-btn span { display:block; width:18px; height:2px; border-radius:2px; background:var(--text); }
  .gt-menu-dot { position:absolute; top:6px; right:6px; width:9px; height:9px; border-radius:50%; background:var(--warn); }
  .gt-menu-dot.inline { position:static; margin-left:auto; flex-shrink:0; }
  .gt-menu-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:70; animation:gtFadeIn .15s ease; }
  .gt-menu { position:absolute; top:0; bottom:0; left:0; width:min(300px,84vw); background:var(--bg); border-right:1px solid var(--border); padding:18px 12px 24px; overflow-y:auto; animation:gtSlideIn .2s ease; display:flex; flex-direction:column; }
  @keyframes gtSlideIn { from { transform:translateX(-100%); } to { transform:none; } }
  @keyframes gtFadeIn { from { opacity:0; } to { opacity:1; } }
  .gt-menu-user { padding:4px 8px 14px; border-bottom:1px solid var(--border); margin-bottom:6px; }
  .gt-menu-user .nm { font-family:'Oswald',sans-serif; font-size:20px; font-weight:600; margin-top:10px; }
  .gt-menu-user .em { font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; }
  .gt-menu-sec { font-family:'Roboto Mono',monospace; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--text-muted); padding:14px 10px 4px; }
  .gt-menu-item { display:flex; align-items:center; gap:12px; width:100%; background:none; border:0; border-radius:10px; padding:11px 10px; color:var(--text); font-size:15px; text-align:left; cursor:pointer; }
  .gt-menu-item .ic { width:22px; display:flex; justify-content:center; color:var(--text-muted); }
  .gt-menu-item.ativo { background:var(--surface-2, rgba(127,127,127,0.14)); color:var(--accent); }
  .gt-menu-item.ativo .ic { color:var(--accent); }
  .gt-menu-item.sair { margin-top:auto; color:var(--text-muted); border-top:1px solid var(--border); border-radius:0; padding-top:14px; }
  .gt-provas-tabs { display:flex; gap:4px; padding:3px; margin:0 0 10px; background:var(--surface-2, rgba(127,127,127,0.14)); border-radius:12px; }
  .gt-provas-tabs button { flex:1; background:none; border:0; border-radius:9px; padding:9px 2px; font-size:12px; white-space:nowrap; font-weight:600; color:var(--text-muted); cursor:pointer; }
  .gt-provas-tabs button.on { background:var(--bg); color:var(--text); box-shadow:0 1px 3px rgba(0,0,0,0.25); }
  .gt-prova.clicavel { cursor:pointer; }
  .gt-cal-head { display:flex; align-items:center; gap:6px; margin-bottom:8px; }
  .gt-cal-titulo { flex:1; text-align:center; font-family:'Oswald',sans-serif; font-size:18px; text-transform:capitalize; }
  .gt-cal-nav { width:36px; height:36px; border-radius:10px; border:1px solid var(--border); background:none; color:var(--text); font-size:18px; cursor:pointer; }
  .gt-cal-modo { display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-left:4px; }
  .gt-cal-modo button { background:none; border:0; color:var(--text-muted); padding:8px 10px; font-size:12px; cursor:pointer; }
  .gt-cal-modo button.on { background:var(--surface-2); color:var(--accent); }
  .gt-cal-sem { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; font-family:'Roboto Mono',monospace; font-size:10px; color:var(--text-muted); margin-bottom:4px; }
  .gt-cal-grade { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
  .gt-cal-dia { aspect-ratio:1/1.05; background:var(--surface); border:1px solid var(--border); border-radius:8px; color:var(--text); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer; padding:0; }
  .gt-cal-dia .n { font-size:13px; }
  .gt-cal-dia.hoje { border-color:var(--info); }
  .gt-cal-dia.sel { border-color:var(--accent); background:var(--surface-2); }
  .gt-cal-dia .pt { display:flex; gap:3px; min-height:6px; }
  .gt-cal-dia i, .gt-cal-leg i { display:inline-block; width:6px; height:6px; border-radius:50%; }
  i.min { background:var(--accent); } i.met { background:#B38CFF; } i.out { background:var(--text-muted); }
  .gt-cal-leg { display:flex; gap:14px; justify-content:center; font-size:11px; color:var(--text-muted); margin:10px 0; }
  .gt-cal-leg span { display:flex; align-items:center; gap:5px; }
  .gt-cal-ano { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .gt-cal-mini { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px 6px; color:var(--text); display:flex; flex-direction:column; align-items:center; gap:2px; cursor:pointer; }
  .gt-cal-mini.atual { border-color:var(--info); }
  .gt-cal-mini .mn { font-family:'Oswald',sans-serif; font-size:15px; text-transform:capitalize; }
  .gt-cal-mini .nn { font-size:22px; font-family:'Oswald',sans-serif; color:var(--text-muted); }
  .gt-cal-mini .mm { font-size:11px; color:var(--accent); }
  .gt-cal-vou { font-size:12px; color:var(--accent); font-weight:600; align-self:center; }
  .gt-prova-detalhe { max-height:86vh; overflow-y:auto; }
  .gt-prova-detalhe-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
  .gt-prova-detalhe-head h3 { margin:0; }
  .gt-prova-detalhe-sub { font-size:13px; color:var(--text-muted); margin:4px 0 10px; }
  .gt-prova-detalhe-info { display:flex; flex-direction:column; gap:4px; font-size:14px; margin-bottom:12px; }
  .gt-prova-detalhe-acoes { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:8px; }
  .gt-prova-detalhe-sec { font-family:'Roboto Mono',monospace; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:var(--text-muted); margin:16px 0 6px; }
  .gt-prova-amigos { display:flex; flex-direction:column; gap:6px; }
  .gt-prova-amigo { display:flex; align-items:center; gap:10px; font-size:14px; }
  .gt-prova-amigo .av { width:28px; height:28px; border-radius:50%; background:var(--accent); color:var(--bg); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; flex-shrink:0; }
  .gt-prova-amigo .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-prova-amigo .km { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); }
  .gt-prova-detalhe-outros { font-size:13px; color:var(--info); margin-top:8px; }
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
  .gt-ex-adjusted { color:var(--accent); font-size:10px; margin-left:8px; font-family:'Roboto Mono',monospace; }
  .gt-set-adjust { display:flex; gap:8px; margin:8px 0 12px; flex-wrap:wrap; }
  .gt-set-adjust button { background:none; border:1px solid var(--border); color:var(--text-muted); border-radius:20px; padding:5px 12px; font-family:'Roboto Mono',monospace; font-size:11px; cursor:pointer; }
  .gt-ficha-changes { display:flex; flex-direction:column; gap:8px; margin:12px 0; }
  .gt-ficha-change { display:flex; align-items:flex-start; gap:10px; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:13px; line-height:1.4; cursor:pointer; }
  .gt-ficha-change input { margin-top:2px; accent-color:var(--accent); }
  .gt-admin-login-row { display:flex; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); font-size:13px; }
  .gt-admin-login-email { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-admin-login-count { flex-shrink:0; font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); }
  .gt-admin-login-count.warn { color:var(--warn); }
  .gt-pull-indicator { display:flex; align-items:center; justify-content:center; overflow:hidden; font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); }
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
  .gt-tab .ic { display:flex; height:22px; align-items:center; }
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
  .gt-install-banner { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--surface-2); border-bottom:1px solid var(--border); flex-shrink:0; }
  .gt-install-banner-text { flex:1; font-size:12px; color:var(--text); line-height:1.4; }
  .gt-install-banner-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
  .gt-install-banner-btn { background:var(--accent); color:#14161A; border:none; font-family:'Oswald',sans-serif; font-size:12px; font-weight:600; padding:7px 14px; border-radius:20px; cursor:pointer; white-space:nowrap; }
  .gt-install-banner-dismiss { background:none; border:none; color:var(--text-muted); font-size:14px; cursor:pointer; padding:4px; }
  .gt-install-steps { display:flex; flex-direction:column; gap:10px; margin:14px 0; }
  .gt-install-step { display:flex; gap:10px; align-items:flex-start; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
  .gt-install-step-num { font-family:'Oswald',sans-serif; font-size:14px; color:var(--accent); flex-shrink:0; width:20px; }
  .gt-install-step-text { font-size:13px; line-height:1.4; }
  .gt-settings-install-row { margin-top: 10px; }
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
  .gt-kpi-grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin:10px 0 16px; }
  .gt-kpi-card { background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
  .gt-kpi-value { font-family:'Oswald',sans-serif; font-size:22px; color:var(--accent); line-height:1.1; }
  .gt-kpi-label { font-size:10.5px; color:var(--text-muted); margin-top:3px; letter-spacing:.02em; }
  .gt-admin-chart-bar { fill:#3A3F47; cursor:pointer; }
  .gt-admin-chart-bar.hover { fill:#F2F3F1; }
  /* O painel de uso (admin) é uma tela cheia (gt-focus), não a folha que
     sobe de baixo (gt-modal) — tem muita coisa pra ler (KPIs, gráfico,
     lista por usuário, erros) e merece a tela toda, com a lista por
     usuário rolando junto do resto em vez de presa numa caixinha de 32vh. */
  .gt-admin-screen .gt-admin-list { max-height:none; overflow:visible; }
  .gt-admin-refresh { background:none; border:1px solid var(--border); color:var(--text); width:34px; height:34px; border-radius:50%; font-size:15px; cursor:pointer; flex-shrink:0; }
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
  .gt-link-btn { background:none; border:none; color:var(--accent); font-family:'Inter',sans-serif; font-size:12.5px; text-decoration:underline; cursor:pointer; padding:0; }
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
  .gt-focus-title-input { width:100%; background:transparent; border:none; border-bottom:1px dashed var(--border); color:var(--text); padding:2px 0; outline:none; box-sizing:border-box; }
  .gt-focus-title-input:focus { border-bottom-color:var(--accent); }
  .gt-focus-title-hint { font-size:10px; color:var(--text-muted); margin-top:2px; font-family:'Roboto Mono',monospace; }
  .gt-focus-progress-label { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); margin-top:2px; }
  .gt-focus-date.not-today { color:var(--accent); }
  .gt-focus-progress-bar { flex:0 0 6px; height:6px; margin:0 14px 12px; }
  .gt-focus-body { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
  .gt-focus-footer { position:sticky; bottom:0; padding:12px 14px calc(12px + env(safe-area-inset-bottom)); background:var(--bg); border-top:1px solid var(--border); flex-shrink:0; }
  .gt-series-label-row { display:flex; align-items:center; justify-content:space-between; }
  /* Barra de timers no topo da tela de foco: timer do treino todo (início
     manual, pré-preenche a duração no RPE ao concluir) + descanso entre
     séries (único, não por exercício — por isso mora aqui em cima, fora do
     detalhe de qualquer exercício, e sobrevive a fechar/trocar o acordeão). */
  .gt-focus-timers { display:flex; align-items:center; gap:8px; padding:0 14px 10px; flex-shrink:0; flex-wrap:wrap; }
  .gt-workout-timer-start { background:none; border:1px solid var(--border); color:var(--text-muted); font-family:'Roboto Mono',monospace; font-size:11px; letter-spacing:.02em; padding:5px 10px; border-radius:20px; cursor:pointer; white-space:nowrap; }
  .gt-workout-timer-running { display:flex; align-items:center; gap:6px; font-family:'Roboto Mono',monospace; font-size:12.5px; color:var(--text); padding:5px 10px; border:1px solid var(--border); border-radius:20px; white-space:nowrap; }
  .gt-workout-timer-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); flex-shrink:0; animation: gt-pulse 1.6s ease-in-out infinite; }
  @keyframes gt-pulse { 0%, 100% { opacity:1; } 50% { opacity:.35; } }
  .gt-rest-timer-slot { flex:1; min-width:0; }
  .gt-rest-start-btn { background:none; border:1px solid var(--accent-dim); color:var(--accent); font-family:'Roboto Mono',monospace; font-size:11px; letter-spacing:.02em; padding:5px 10px; border-radius:20px; cursor:pointer; white-space:nowrap; }
  .gt-rest-bar { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 12px; background:var(--surface-2); border:1px solid var(--accent-dim); border-radius:20px; flex-shrink:0; }
  .gt-rest-bar-main { display:flex; align-items:baseline; gap:8px; min-width:0; }
  .gt-rest-bar-time { font-family:'Roboto Mono',monospace; font-size:16px; font-weight:600; color:var(--accent); flex-shrink:0; }
  .gt-rest-bar-label { font-size:11px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-rest-bar-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
  .gt-rest-bar-actions button { background:var(--surface); border:1px solid var(--border); color:var(--text); font-family:'Roboto Mono',monospace; font-size:11px; padding:6px 9px; border-radius:6px; cursor:pointer; }
  .gt-rest-bar-stop { color:var(--warn) !important; }

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
  .gt-exercise-row-livre { width:100%; margin:8px 0; border:1px dashed var(--accent) !important; }
  .gt-exercise-row-livre:disabled { opacity:0.7; cursor:default; }
  .gt-exercise-ok { margin:8px 0; padding:9px 12px; border-radius:var(--radius); background:rgba(198,241,53,0.12); border:1px solid rgba(198,241,53,0.4); font-size:13px; }
  .gt-exercise-row { display:flex; align-items:center; justify-content:space-between; gap:10px; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:11px 12px; cursor:pointer; text-align:left; color:var(--text); font-family:inherit; }
  .gt-exercise-row.added { border-color:var(--accent-dim); opacity:0.75; }
  .gt-exercise-row-main { min-width:0; }
  .gt-exercise-row-nome { font-size:13.5px; }
  .gt-exercise-row-meta { color:var(--text-muted); font-size:11px; font-family:'Roboto Mono',monospace; margin-top:2px; }
  .gt-exercise-row-add { flex-shrink:0; font-size:16px; color:var(--accent); width:22px; text-align:center; }
  .gt-prova-chip { display:flex; align-items:center; gap:8px; width:100%; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:8px 12px; margin-bottom:10px; color:var(--text); font-family:'Inter',sans-serif; font-size:12.5px; cursor:pointer; text-align:left; }
  .gt-prova-plano-btn { display:block; width:100%; background:none; border:1px dashed var(--accent-dim); border-radius:var(--radius); color:var(--accent); font-family:'Inter',sans-serif; font-size:12.5px; padding:8px 12px; margin:-4px 0 10px; cursor:pointer; text-align:center; }
  .gt-prova-hoje { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:10px; overflow:hidden; }
  .gt-prova-hoje .gt-prova-chip { border:0; border-radius:0; margin:0; background:none; padding:10px 12px; }
  .gt-prova-hoje .gt-prova-plano-btn { border:0; border-top:1px solid var(--border); border-radius:0; margin:0; padding:10px 12px; font-weight:600; background:rgba(198,241,53,0.06); }
  .gt-prova-chip b { font-family:'Oswald',sans-serif; font-weight:600; color:var(--accent); white-space:nowrap; }
  .gt-prova-chip .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-provas-modal { max-height:92vh; min-height:70vh; display:flex; flex-direction:column; }
  .gt-provas-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .gt-provas-close { background:none; border:none; color:var(--text-muted); font-size:20px; cursor:pointer; padding:4px 8px; }
  .gt-provas-filters { display:flex; gap:6px; flex-wrap:wrap; margin:10px 0 8px; }
  .gt-provas-pill { background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); border-radius:14px; padding:5px 11px; font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; }
  .gt-provas-pill.on { background:var(--accent); border-color:var(--accent); color:#14161A; font-weight:600; }
  .gt-provas-row2 { display:flex; gap:8px; margin-bottom:6px; }
  .gt-provas-row2 .gt-input { flex:1; }
  .gt-provas-row2 select.gt-input { flex:0 0 96px; }
  .gt-provas-list { overflow-y:auto; flex:1; margin:0 -4px; padding:0 4px; }
  .gt-prova-km-edit { display:block; background:none; border:none; padding:0; margin-top:4px; color:var(--text-muted); font-size:11.5px; text-decoration:underline; cursor:pointer; }
  .gt-plano-cta { display:block; width:100%; margin-top:8px; background:rgba(198,241,53,0.10); border:1px dashed var(--accent); color:var(--accent); border-radius:6px; padding:8px 10px; font-family:'Inter',sans-serif; font-size:12.5px; font-weight:600; cursor:pointer; text-align:center; }
  .gt-provas-mes.minhas { color:var(--accent); font-size:12.5px; margin-top:4px; }
  .gt-provas-minhas { margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid var(--border); }
  .gt-provas-mes { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; margin:14px 0 6px; }
  .gt-prova { display:flex; gap:10px; align-items:flex-start; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:10px; margin-bottom:8px; }
  .gt-prova.going { border-color:var(--accent-dim); }
  .gt-prova-date { flex:0 0 44px; text-align:center; font-family:'Oswald',sans-serif; line-height:1.1; }
  .gt-prova-date .d { font-size:20px; color:var(--accent); }
  .gt-prova-date .w { font-size:10px; color:var(--text-muted); font-family:'Roboto Mono',monospace; text-transform:uppercase; }
  .gt-prova-body { flex:1; min-width:0; }
  .gt-prova-nm { font-size:13.5px; line-height:1.3; }
  .gt-prova-meta { color:var(--text-muted); font-size:11.5px; margin-top:3px; }
  .gt-prova-links { display:flex; gap:12px; margin-top:6px; font-size:12px; }
  .gt-prova-links a { color:var(--info); text-decoration:none; }
  .gt-prova-links button { background:none; border:none; padding:0; color:var(--text-muted); font-size:12px; cursor:pointer; }
  .gt-prova-go { flex:0 0 auto; background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:14px; padding:6px 10px; font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; white-space:nowrap; }
  .gt-prova-go.on { background:var(--accent); border-color:var(--accent); color:#14161A; font-weight:600; }
  .gt-prova-outros { font-size:11px; color:var(--info); margin-top:3px; }
  .gt-prova-tag { font-family:'Roboto Mono',monospace; font-size:9px; color:var(--accent); margin-left:6px; }
  .gt-provas-empty { color:var(--text-muted); font-size:13px; text-align:center; padding:28px 12px; }
  .gt-provas-add { margin-top:10px; border-top:1px solid var(--border); padding-top:10px; }
  .gt-provas-form { display:flex; flex-direction:column; gap:8px; margin-top:8px; }
  .gt-provas-form-row { display:flex; gap:8px; }
  .gt-provas-form-row > * { flex:1; min-width:0; }
  .gt-provas-foot { font-size:10.5px; color:var(--text-muted); margin-top:8px; line-height:1.4; }
  .gt-dsf-seg { display:flex; gap:8px; margin-bottom:12px; }
  .gt-dsf-seg button { flex:1; background:var(--surface); border:1px solid var(--border); color:var(--text-muted); border-radius:var(--radius); padding:9px; font-family:'Oswald',sans-serif; font-size:14px; cursor:pointer; }
  .gt-dsf-seg button.active { color:#14161A; background:var(--accent); border-color:var(--accent); font-weight:600; }
  .gt-dsf-card { display:block; width:100%; text-align:left; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px; margin-bottom:8px; color:var(--text); cursor:pointer; font-family:'Inter',sans-serif; }
  .gt-dsf-card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:3px; }
  .gt-dsf-card-nome { font-family:'Oswald',sans-serif; font-size:17px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-dsf-card-prog { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--accent); white-space:nowrap; }
  .gt-dsf-vazio { text-align:center; }
  .gt-dsf-entrar { display:flex; gap:8px; margin-top:12px; }
  .gt-dsf-entrar .gt-input { flex:1; text-transform:uppercase; letter-spacing:0.08em; }
  .gt-dsf-hint { color:var(--text-muted); font-size:11.5px; line-height:1.45; margin:6px 0 0; }
  .gt-dsf-resumo { margin-top:16px; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; font-size:12.5px; line-height:1.5; color:var(--text-muted); }
  .gt-dsf-resumo b { color:var(--text); }
  .gt-dsf-stepper { display:inline-flex; align-items:center; gap:10px; background:var(--surface-2); border:1px solid var(--border); border-radius:20px; padding:3px; }
  .gt-dsf-stepper button { width:30px; height:30px; border-radius:50%; border:none; background:var(--surface); color:var(--accent); font-size:18px; line-height:1; cursor:pointer; }
  .gt-dsf-stepper button:disabled { opacity:0.35; cursor:default; }
  .gt-dsf-stepper span { min-width:96px; text-align:center; font-size:13px; font-family:'Inter',sans-serif; }
  .gt-dsf-modelos { display:flex; flex-direction:column; gap:8px; }
  .gt-dsf-modelo { text-align:left; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; color:var(--text); cursor:pointer; font-family:'Inter',sans-serif; display:flex; flex-direction:column; gap:2px; }
  .gt-dsf-modelo b { font-family:'Oswald',sans-serif; font-weight:500; font-size:15px; }
  .gt-dsf-modelo span { font-size:12px; color:var(--text-muted); }
  .gt-dsf-modelo.on { border-color:var(--accent); background:var(--surface-2); }
  .gt-dsf-regra { display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
  .gt-dsf-dias { display: flex; gap: 6px; }
.gt-dsf-dia { flex: 1; min-width: 0; padding: 9px 0; border-radius: 10px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-size: 12px; text-transform: capitalize; cursor: pointer; }
.gt-dsf-dia-txt { flex: 0 0 auto; padding: 8px 12px; }
.gt-dsf-dia.on { background: var(--accent); color: #14161A; border-color: var(--accent); font-weight: 600; }
.gt-dsf-check { display:flex; align-items:center; gap:8px; font-size:13.5px; cursor:pointer; }
  .gt-dsf-check input { accent-color:var(--accent); width:17px; height:17px; }
  .gt-dsf-pontos-row { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; font-size:13px; }
  .gt-dsf-code { font-family:'Oswald',sans-serif; font-size:44px; letter-spacing:0.18em; color:var(--accent); margin:6px 0; }
  .gt-dsf-code.sm { font-size:22px; margin:0; letter-spacing:0.14em; }
  .gt-dsf-convite { display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .gt-dsf-convite .gt-btn { width:auto; padding:9px 16px; }
  .gt-dsf-minha { display:flex; align-items:center; gap:14px; }
  .gt-dsf-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
  .gt-dsf-chip { background:var(--surface-2); border:1px solid var(--border); border-radius:12px; padding:2px 8px; font-size:10.5px; color:var(--text-muted); }
  .gt-dsf-sec-head { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px; }
  .gt-dsf-link { background:none; border:none; padding:0; color:var(--accent); font-size:12px; cursor:pointer; font-family:'Inter',sans-serif; }
  .gt-dsf-link.danger { color:var(--warn); }
  .gt-dsf-pista { display:block; margin-top:2px; }
  .gt-dsf-rank-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid var(--border); }
  .gt-dsf-rank-row:last-of-type { border-bottom:none; }
  .gt-dsf-pos { width:24px; text-align:center; font-family:'Oswald',sans-serif; color:var(--text-muted); }
  .gt-dsf-avatar { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Oswald',sans-serif; font-size:12px; font-weight:600; color:#14161A; flex-shrink:0; }
  .gt-dsf-rank-nome { font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-dsf-pts { font-family:'Oswald',sans-serif; font-size:20px; min-width:54px; text-align:right; }
  .gt-dsf-pts small { font-size:10px; color:var(--text-muted); font-family:'Inter',sans-serif; }
  .gt-dsf-pend-row { display:flex; flex-direction:column; gap:8px; padding:8px 0; font-size:13px; }
  .gt-dsf-pend-actions { display:flex; gap:8px; }
  .gt-dsf-pend-actions .gt-btn { flex:1; }
  .gt-dsf-sem { padding:10px 0; border-bottom:1px solid var(--border); font-size:13px; }
  .gt-dsf-sem:last-child { border-bottom:none; }
  .gt-dsf-sem-head { display:flex; align-items:center; gap:8px; margin-bottom:4px; }
  .gt-dsf-sem-head .gt-dsf-link { margin-left:auto; }
  .gt-dsf-sem-lines { display:flex; flex-direction:column; gap:2px; }
  .gt-dsf-collapse { width:100%; background:none; border:none; color:var(--text); text-align:left; font-family:'Oswald',sans-serif; font-size:14px; cursor:pointer; padding:0; }
  .gt-dsf-regras-txt { margin-top:10px; display:flex; flex-direction:column; gap:6px; font-size:12.5px; color:var(--text-muted); line-height:1.5; }
  .gt-dsf-regras-txt b { color:var(--text); }
  .gt-dsf-campeao { text-align:center; border-color:var(--accent-dim); }
  .gt-dsf-campeao-nome { font-family:'Oswald',sans-serif; font-size:26px; color:var(--accent); }
  .gt-dsf-cartao-modal { max-height:92vh; }
  .gt-dsf-cartao-img { width:100%; max-width:340px; display:block; margin:10px auto 14px; border-radius:10px; border:1px solid var(--border); }
  .gt-desafio-chip { display:flex; flex-direction:column; align-items:stretch; gap:4px; width:100%; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:8px 12px; margin-bottom:10px; color:var(--text); font-family:'Inter',sans-serif; font-size:12.5px; cursor:pointer; text-align:left; }
  .gt-desafio-chip .row { display:flex; align-items:center; gap:8px; }
  .gt-desafio-chip .aviso { font-size:11.5px; color:var(--text-muted); line-height:1.35; }
  .gt-desafio-chip.alerta { border-color:var(--accent); }
  .gt-desafio-chip.alerta .aviso { color:var(--text); }
  .gt-tab { position:relative; }
  .gt-tab-dot { position:absolute; top:8px; left:calc(50% + 8px); width:9px; height:9px; border-radius:50%; background:#FF5A36; border:2px solid var(--surface); }
  .gt-dsf-avisos { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
  .gt-dsf-aviso { display:flex; gap:10px; align-items:flex-start; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; font-size:13px; line-height:1.4; }
  .gt-dsf-aviso.lembrete { border-color:var(--accent); }
  .gt-dsf-aviso-emoji { font-size:20px; line-height:1.2; }
  .gt-dsf-evo { display:block; margin-top:6px; }
  .gt-desafio-chip b { font-family:'Oswald',sans-serif; font-weight:600; color:var(--accent); white-space:nowrap; }
  .gt-desafio-chip .nm { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .gt-plano-modal { max-height:92vh; display:flex; flex-direction:column; overflow-y:auto; }
  .gt-plano-sub { font-family:'Roboto Mono',monospace; font-size:11px; color:var(--text-muted); margin:2px 0 10px; }
  .gt-plano-form { display:flex; flex-direction:column; gap:8px; }
  .gt-plano-lbl { font-family:'Oswald',sans-serif; font-size:13px; margin-top:6px; }
  .gt-plano-dica { font-size:11.5px; color:var(--text-muted); line-height:1.45; }
  .gt-plano-link { background:none; border:none; padding:0; color:var(--accent); font-size:11.5px; cursor:pointer; text-decoration:underline; }
  .gt-sem-linha { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; padding:6px 0; border-bottom:1px solid var(--border); }
  .gt-sem-linha .d { width:64px; flex-shrink:0; font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); text-transform:uppercase; padding-top:2px; }
  .gt-sem-linha .it { flex:1; line-height:1.5; min-width:0; }
  .gt-sem-head { display:flex; gap:12px; align-items:center; background:var(--surface-2); border:1px solid var(--border); border-radius:var(--radius); padding:12px 14px; }
  .gt-sem-head .ic { font-size:28px; }
  .gt-sem-head .k { font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; }
  .gt-sem-head .t { font-family:'Oswald',sans-serif; font-size:17px; margin-top:2px; line-height:1.25; }
  .gt-sem-motivos { margin:2px 0 0; padding-left:18px; font-size:12.5px; line-height:1.5; color:var(--text); }
  .gt-sem-cont { display:flex; gap:8px; font-size:12px; }
  .gt-sem-cont span { flex:1; text-align:center; padding:6px 0; border-radius:6px; background:var(--surface-2); border:1px solid var(--border); }
  .gt-sem-cont span.repoe b { color:var(--info); }
  .gt-sem-cont span.fica b { color:var(--accent); } .gt-sem-cont span.muda b { color:#F5A623; } .gt-sem-cont span.sai b { color:#E5484D; }
  .gt-sem-card { background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--border); border-radius:var(--radius); padding:12px 14px; }
  .gt-sem-card.fica { border-left-color:var(--accent); } .gt-sem-card.muda { border-left-color:#F5A623; } .gt-sem-card.sai { border-left-color:#E5484D; }
  .gt-sem-card-hd { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .gt-sem-card-hd .dia { font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; }
  .gt-sem-card-hd .nm { font-family:'Oswald',sans-serif; font-size:16px; margin-top:3px; }
  .gt-sem-badge { font-size:10.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; padding:3px 8px; border-radius:20px; white-space:nowrap; }
  .gt-sem-badge.fica { background:rgba(198,241,53,0.15); color:var(--accent); } .gt-sem-badge.muda { background:rgba(245,166,35,0.16); color:#F5A623; } .gt-sem-badge.sai { background:rgba(229,72,77,0.16); color:#E5484D; }
  .gt-sem-motivo { font-size:12.5px; color:var(--text-muted); margin-top:6px; line-height:1.45; }
  .gt-sem-mud { display:flex; align-items:center; gap:8px; margin-top:8px; font-size:13px; }
  .gt-sem-step { display:inline-flex; align-items:center; gap:6px; }
  .gt-sem-step button { width:26px; height:26px; border-radius:6px; border:1px solid var(--border); background:var(--surface-2); color:var(--text); font-size:15px; line-height:1; cursor:pointer; }
  .gt-sem-step button:disabled { opacity:0.35; cursor:default; }
  .gt-sem-link { background:none; border:none; color:var(--text-muted); font-size:12px; text-decoration:underline; padding:8px 0 0; cursor:pointer; }
  .gt-sem-fixos { font-size:12px; color:var(--text-muted); line-height:1.5; }
  .gt-plano-chk { display:flex; gap:8px; align-items:flex-start; font-size:12px; color:var(--text-muted); line-height:1.4; }
  .gt-plano-dias { display:flex; gap:5px; }
  .gt-plano-dia { flex:1; background:var(--surface-2); border:1px solid var(--border); color:var(--text-muted); border-radius:8px; padding:9px 0; font-size:12px; font-family:'Inter',sans-serif; cursor:pointer; position:relative; }
  .gt-plano-dia.on { background:var(--accent); border-color:var(--accent); color:#14161A; font-weight:600; }
  .gt-plano-dia .ac { position:absolute; top:-7px; right:-2px; font-size:11px; }
  .gt-plano-conflito { background:var(--surface-2); border:1px solid var(--warn); border-radius:8px; padding:10px; font-size:12.5px; line-height:1.45; }
  .gt-plano-aviso { background:var(--surface-2); border-left:3px solid var(--accent); border-radius:4px; padding:8px 10px; font-size:12px; line-height:1.45; margin:6px 0; }
  .gt-plano-aviso.aviso, .gt-plano-aviso.curto, .gt-plano-aviso.erro { border-left-color:var(--warn); }
  .gt-plano-aviso.info, .gt-plano-aviso.longo { border-left-color:var(--border); color:var(--text-muted); }
  .gt-plano-erro { color:var(--warn); font-size:12px; line-height:1.4; }
  .gt-plano-foot { font-size:10.5px; color:var(--text-muted); line-height:1.4; margin-top:8px; }
  .gt-plano-passo { font-size:13px; margin-top:4px; }
  .gt-plano-ia { display:flex; flex-direction:column; gap:6px; }
  .gt-run { display:flex; flex-direction:column; align-items:center; text-align:center; padding:22px 8px 10px; }
  .gt-run svg { width:190px; height:128px; overflow:visible; }
  .gt-run-lottie { width:170px; height:198px; margin:-6px 0 -4px; }
  .gt-run .gt-run-lottie svg { width:100%; height:100%; }
  .gt-run .j { transform-box:view-box; }
  .gt-run .hip { transform-origin:70px 60px; }
  .gt-run .knee { transform-origin:70px 80px; }
  .gt-run .sho { transform-origin:79px 36px; }
  .gt-run .elb { transform-origin:79px 52px; }
  .gt-run .legA .hip { animation:rnThigh 0.62s ease-in-out infinite alternate; }
  .gt-run .legA .knee { animation:rnShin 0.62s ease-in-out infinite alternate; }
  .gt-run .legB .hip { animation:rnThigh 0.62s ease-in-out infinite alternate-reverse; }
  .gt-run .legB .knee { animation:rnShin 0.62s ease-in-out infinite alternate-reverse; }
  .gt-run .armA .sho { animation:rnArm 0.62s ease-in-out infinite alternate-reverse; }
  .gt-run .armB .sho { animation:rnArm 0.62s ease-in-out infinite alternate; }
  .gt-run .rn-body { animation:rnBob 0.31s ease-in-out infinite alternate; }
  .gt-run .rn-shadow { animation:rnShadow 0.31s ease-in-out infinite alternate; transform-box:fill-box; transform-origin:center; }
  .gt-run .rn-ground { animation:rnGround 0.5s linear infinite; }
  .gt-run .rn-wind { animation:rnWind 0.8s linear infinite; }
  @keyframes rnThigh { from { transform:rotate(-48deg); } to { transform:rotate(34deg); } }
  @keyframes rnShin { from { transform:rotate(14deg); } to { transform:rotate(92deg); } }
  @keyframes rnArm { from { transform:rotate(-55deg); } to { transform:rotate(45deg); } }
  @keyframes rnBob { from { transform:translateY(1px); } to { transform:translateY(-4px); } }
  @keyframes rnShadow { from { transform:scaleX(1); opacity:0.35; } to { transform:scaleX(0.85); opacity:0.2; } }
  @keyframes rnGround { from { stroke-dashoffset:0; } to { stroke-dashoffset:-30; } }
  @keyframes rnWind { from { transform:translateX(14px); opacity:0; } 30% { opacity:0.7; } to { transform:translateX(-22px); opacity:0; } }
  .gt-run-t { font-size:30px; font-weight:700; font-variant-numeric:tabular-nums; margin:8px 0 2px; }
  .gt-run-bar { width:100%; max-width:300px; height:8px; border-radius:6px; background:var(--surface-2); overflow:hidden; margin:8px 0; position:relative; }
  .gt-run-bar > i { display:block; height:100%; background:var(--accent); border-radius:6px; transition:width 0.5s linear; }
  .gt-run-bar.ind > i { position:absolute; width:35%; animation:rnInd 1.4s ease-in-out infinite; }
  @keyframes rnInd { from { left:-35%; } to { left:100%; } }
  .gt-run-msg { font-size:13px; color:var(--text-muted); min-height:20px; }
  @media (prefers-reduced-motion: reduce) { .gt-run svg *, .gt-run-bar.ind > i { animation:none !important; } }
  .gt-tc-item { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; margin-top:8px; }
  .gt-tc-item .ti { font-family:'Oswald',sans-serif; font-size:16px; }
  .gt-tc-item .mt { font-size:12px; color:var(--text-muted); margin-top:2px; }
  .gt-tc-resumo { font-size:12px; margin-top:6px; line-height:1.45; }
  .gt-plano-ou { text-align:center; font-size:11px; color:var(--text-muted); margin:6px 0 2px; }
  .gt-plano-prompt { min-height:120px; max-height:220px; font-family:'Roboto Mono',monospace; font-size:11px; line-height:1.4; resize:vertical; }
  .gt-plano-resumo { font-size:13px; line-height:1.5; margin:4px 0 8px; }
  .gt-plano-sem { border:1px solid var(--border); border-radius:8px; margin:6px 0; overflow:hidden; }
  .gt-plano-sem-h { width:100%; display:flex; justify-content:space-between; gap:8px; background:var(--surface-2); border:none; color:var(--text); padding:9px 10px; font-family:'Roboto Mono',monospace; font-size:11.5px; cursor:pointer; text-align:left; }
  .gt-plano-sess { display:flex; gap:10px; padding:8px 10px; border-top:1px solid var(--border); }
  .gt-plano-sess.feito { opacity:0.65; }
  .gt-plano-sess.pulou { opacity:0.5; }
  .gt-plano-sess-d { flex:0 0 42px; font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); display:flex; flex-direction:column; }
  .gt-plano-sess-d b { color:var(--text); font-weight:500; }
  .gt-plano-sess-b .ti { font-size:13px; font-weight:600; }
  .gt-plano-sess-b .mt { font-size:11.5px; color:var(--text-muted); margin-top:2px; line-height:1.4; }
  .gt-plano-sess-b .de { font-size:12px; margin-top:4px; line-height:1.45; }
  .gt-etapas { margin-top:8px; }
  .gt-etapas-graf { display:flex; align-items:flex-end; gap:1px; height:54px; background:var(--surface-2); border-radius:6px; padding:4px 4px 0; overflow:hidden; }
  .gt-etapas-seg { min-width:2px; border-radius:2px 2px 0 0; }
  .lv1 { background:#5E656E; }
  .lv2 { background:var(--info); }
  .lv3 { background:var(--accent); }
  .lv4 { background:var(--warn); }
  .gt-etapas-leg { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; font-family:'Roboto Mono',monospace; font-size:9.5px; color:var(--text-muted); margin:4px 0 6px; }
  .gt-etapas-leg .gt-etapa-dot { margin-left:6px; }
  .gt-etapa { display:flex; gap:8px; align-items:baseline; font-size:12.5px; line-height:1.5; }
  .gt-etapa .ex { color:var(--text-muted); font-size:11.5px; }
  .gt-etapa-dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex:0 0 8px; margin-right:3px; }
  .gt-etapa-bloco { display:flex; gap:8px; align-items:flex-start; border-left:2px solid var(--border); padding-left:8px; margin:3px 0; }
  .gt-etapa-bloco .rep { font-family:'Oswald',sans-serif; font-size:15px; color:var(--accent); flex:0 0 auto; min-width:26px; }
  .gt-plano-hoje { background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius); padding:12px 14px; margin-bottom:12px; }
  .gt-plano-hoje.alerta { border-left-color:var(--warn); }
  .gt-plano-hoje .gt-plano-row { display:flex; align-items:flex-start; gap:10px; cursor:pointer; }
  .gt-plano-hoje .gt-plano-main { flex:1; min-width:0; }
  .gt-plano-hoje .hd { font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; }
  .gt-plano-hoje .ti { font-family:'Oswald',sans-serif; font-size:17px; margin-top:4px; }
  .gt-plano-hoje .mt { font-size:12px; color:var(--text-muted); margin-top:3px; line-height:1.45; }
  .gt-plano-hoje .de { font-size:12.5px; margin-top:6px; line-height:1.5; }
  .gt-plano-hoje .ac { display:flex; gap:8px; margin-top:10px; }
  .gt-plano-hoje .ac button { flex:1; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:8px; font-size:12px; cursor:pointer; }
  .gt-plano-hoje .ac button.on { background:var(--accent); border-color:var(--accent); color:#14161A; font-weight:600; }
  .gt-ico { flex-shrink:0; display:block; }
  .gt-ico-inl { display:inline-block; vertical-align:-2px; margin-right:4px; }
  .gt-tab .gt-ico { transition:transform .2s ease; }
  .gt-tab:active .gt-ico { transform:scale(.85); }
  .gt-ico.pop { animation:gt-ico-pop .38s cubic-bezier(.34,1.56,.64,1); }
  @keyframes gt-ico-pop { 0% { transform:scale(.6) rotate(-8deg); } 100% { transform:scale(1) rotate(0); } }
  .gt-menu-item { transition:background .15s ease, transform .1s ease; }
  .gt-menu-item:active { transform:scale(.98); background:var(--surface-2, rgba(127,127,127,0.14)); }
  .gt-menu .gt-menu-item { animation:gt-menu-in .28s ease both; }
  @keyframes gt-menu-in { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:none; } }
  .gt-menu .gt-menu-item:nth-of-type(1){animation-delay:.02s}.gt-menu .gt-menu-item:nth-of-type(2){animation-delay:.05s}.gt-menu .gt-menu-item:nth-of-type(3){animation-delay:.08s}.gt-menu .gt-menu-item:nth-of-type(4){animation-delay:.11s}.gt-menu .gt-menu-item:nth-of-type(5){animation-delay:.14s}.gt-menu .gt-menu-item:nth-of-type(6){animation-delay:.17s}.gt-menu .gt-menu-item:nth-of-type(n+7){animation-delay:.2s}
  @media (prefers-reduced-motion: reduce) { .gt-ico.pop, .gt-menu .gt-menu-item { animation:none; } }
  .gt-fb-tipos { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; }
  .gt-fb-tipo { background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:16px; padding:6px 12px; font-size:13px; cursor:pointer; }
  .gt-fb-tipo.on { border-color:var(--accent); color:var(--accent); }
  .gt-fb-check { display:flex; align-items:center; gap:8px; font-size:13px; margin-top:10px; color:var(--text-muted); }
  .gt-fb-erro { color:var(--warn); font-size:13px; margin-top:8px; }
  .gt-fb-hint { color:var(--text-muted); font-size:14px; margin:6px 0 12px; }
  .gt-fb-item { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px; margin-bottom:8px; }
  .gt-fb-item.novo { border-left:3px solid var(--accent); }
  .gt-fb-msg { white-space:pre-wrap; font-size:14px; margin:4px 0 8px; }
  .gt-sem-aviso { background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--accent); border-radius:var(--radius); padding:12px 14px; margin-bottom:12px; }
  .gt-sem-aviso.alerta { border-left-color:var(--warn); }
  .gt-sem-aviso .gt-plano-row { display:flex; align-items:flex-start; gap:10px; cursor:pointer; }
  .gt-sem-aviso .gt-plano-main { flex:1; min-width:0; }
  .gt-sem-aviso .hd { font-family:'Roboto Mono',monospace; font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em; }
  .gt-sem-aviso .ti { font-family:'Oswald',sans-serif; font-size:17px; margin-top:4px; }
  .gt-sem-aviso .mt { font-size:12px; color:var(--text-muted); margin-top:3px; line-height:1.45; }
  .gt-sem-aviso .de { font-size:12.5px; margin-top:6px; line-height:1.5; }
  .gt-sem-aviso .ac { display:flex; gap:8px; margin-top:10px; }
  .gt-sem-aviso .ac button { flex:1; background:var(--surface-2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:8px; font-size:12px; cursor:pointer; }
  .gt-sem-aviso .ac button.on { background:var(--accent); border-color:var(--accent); color:#14161A; font-weight:600; }
`;

// --- Provas (calendário de provas esportivas): tela separada do fluxo de
// treino. A base vem de races.json (carregada manualmente/semanalmente), as
// provas marcadas ("Vou nessa") vão pra nuvem (race_entries); as cadastradas viram de todos
// (shared_races) quando o SQL está rodado; sem ele, tudo fica no aparelho (localStorage). ---
const PROVA_UFS_NOME = { AC:"AC",AL:"AL",AM:"AM",AP:"AP",BA:"BA",CE:"CE",DF:"DF",ES:"ES",GO:"GO",MA:"MA",MG:"MG",MS:"MS",MT:"MT",PA:"PA",PB:"PB",PE:"PE",PI:"PI",PR:"PR",RJ:"RJ",RN:"RN",RO:"RO",RR:"RR",RS:"RS",SC:"SC",SE:"SE",SP:"SP",TO:"TO" };
const PROVA_MODALIDADES = [
  { id: "todas", nome: "Todas" },
  { id: "corrida", nome: "Corrida" },
  { id: "hyrox", nome: "Hyrox" },
  { id: "outras", nome: "Outras" },
];
function provaFim(r) { return r.data_fim || r.data_inicio; }
function diasAte(iso, hojeISO) {
  const [y1, m1, d1] = iso.split("-").map(Number);
  const [y2, m2, d2] = hojeISO.split("-").map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
}
function provaDiasLabel(r, hojeISO) {
  const n = diasAte(r.data_inicio, hojeISO);
  if (n < 0 && diasAte(provaFim(r), hojeISO) >= 0) return "acontecendo agora";
  if (n === 0) return "é hoje";
  if (n === 1) return "amanhã";
  return `faltam ${n} dias`;
}
function provaDataCurta(r) {
  const [y, m, d] = r.data_inicio.split("-").map(Number);
  const ini = new Date(y, m - 1, d);
  const mes = ini.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  if (!r.data_fim) return `${d} ${mes}`;
  const [y2, m2, d2] = r.data_fim.split("-").map(Number);
  const fim = new Date(y2, m2 - 1, d2);
  if (m2 === m) return `${d}–${d2} ${mes}`;
  return `${d} ${mes} – ${d2} ${fim.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}`;
}
function provaMesLabel(iso) {
  const [y, m] = iso.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label;
}
function provaDistLabel(r) {
  const d = (r.distancias || []).filter((x) => x !== "" && x != null);
  return d.length ? d.map((x) => `${String(x).replace(".", ",")} km`).join(" · ") : "";
}
function provaSafeUrl(u) { return typeof u === "string" && /^https?:\/\//i.test(u) ? u : null; }

// --- Plano de corrida: assistente para criar o plano (perguntas → prompt → colar o JSON →
// conferir → salvar) e visão do plano salvo. A lógica está no bloco PLANO_CORRIDA acima. ---
// Gráfico de barras do treino (largura = tempo estimado, altura = intensidade) + lista de passos.
function PlanoEtapas({ etapas, paceBase }) {
  if (!etapas || !etapas.length) return null;
  const segs = planoEtapasSegmentos(etapas, paceBase);
  const total = segs.reduce((t, x) => t + x.min, 0);
  const passoLinha = (p, k) => {
    const extra = [p.esforco, p.pace ? `pace ${p.pace}` : ""].filter(Boolean).join(" · ");
    return (
      <div className="gt-etapa" key={k}>
        <span className={`gt-etapa-dot lv${PLANO_ETAPA_TIPOS[p.tipo].nivel}`}></span>
        <span className="tx">{planoPassoTexto(p)}{extra ? <span className="ex"> · {extra}</span> : null}</span>
      </div>
    );
  };
  return (
    <div className="gt-etapas">
      <div className="gt-etapas-graf" role="img" aria-label={planoEtapasResumo(etapas)}>
        {segs.map((x, i) => <div key={i} className={`gt-etapas-seg lv${x.nivel}`} style={{ width: `${(x.min / total) * 100}%`, height: `${x.nivel * 25}%` }} title={x.texto}></div>)}
      </div>
      <div className="gt-etapas-leg"><span>≈ {Math.round(total)} min no total</span><span><i className="gt-etapa-dot lv1"></i>leve/caminhada <i className="gt-etapa-dot lv2"></i>trote <i className="gt-etapa-dot lv3"></i>ritmo <i className="gt-etapa-dot lv4"></i>forte</span></div>
      {etapas.map((e, i) => e.passos
        ? <div className="gt-etapa-bloco" key={i}><div className="rep">{e.repeticoes}×</div><div>{e.passos.map((p, j) => passoLinha(p, j))}</div></div>
        : passoLinha(e, i))}
    </div>
  );
}

// Estimativa de duração da geração com IA: mediana das últimas gerações deste aparelho (padrão 2 min).
function iaEstimativaSeg() {
  try {
    const arr = JSON.parse(localStorage.getItem("treino-app:iaDurs") || "[]").filter((n) => n > 5 && n < 600).sort((a, b) => a - b);
    if (arr.length) return Math.max(30, Math.min(150, arr[Math.floor(arr.length / 2)]));
  } catch (e) {}
  return 120;
}
function iaRegistrarDuracao(seg) {
  try {
    const arr = JSON.parse(localStorage.getItem("treino-app:iaDurs") || "[]");
    arr.push(Math.round(seg));
    localStorage.setItem("treino-app:iaDurs", JSON.stringify(arr.slice(-5)));
  } catch (e) {}
}
// Tela de espera da IA: corredor animado, contagem regressiva da estimativa (o fim real sempre manda).
// --- Importar histórico: leitura de arquivos no aparelho ---
function histB64(buf) {
  const u8 = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
// Lê os arquivos .txt de dentro de um .zip (exportação do WhatsApp no iPhone).
async function histLerZip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("zip inválido");
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!/\.txt$/i.test(nome) || /^__MACOSX/.test(nome)) continue;
    const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const dados = u8.subarray(ini, ini + csize);
    let bytes;
    if (method === 0) bytes = dados;
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else continue;
    out.push({ nome, texto: new TextDecoder("utf-8").decode(bytes) });
  }
  return out;
}
function histCarregarXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error("xlsx")));
    s.onerror = () => rej(new Error("xlsx"));
    document.head.appendChild(s);
  });
}
function histImagemB64(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.width * esc)); c.height = Math.max(1, Math.round(img.height * esc));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.82).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagem")); };
    img.src = url;
  });
}
// Um arquivo vira uma lista de "fontes": { nome, tipo: texto|pdf|imagem, texto|b64, cabecalho? }.
async function histLerArquivo(file) {
  const nome = file.name || "arquivo";
  const ext = (nome.split(".").pop() || "").toLowerCase();
  const tipo = file.type || "";
  if (file.size > 15 * 1024 * 1024) throw new Error(`${nome}: arquivo grande demais (máx. 15 MB).`);
  if (ext === "zip") {
    const txts = await histLerZip(await file.arrayBuffer());
    if (!txts.length) throw new Error(`${nome}: não achei nenhum .txt dentro do zip.`);
    return txts.map((t) => ({ nome: t.nome, tipo: "texto", texto: t.texto }));
  }
  if (ext === "pdf" || tipo === "application/pdf") {
    if (file.size > 5 * 1024 * 1024) throw new Error(`${nome}: PDF grande demais (máx. 5 MB). Divida em partes.`);
    return [{ nome, tipo: "pdf", b64: histB64(await file.arrayBuffer()) }];
  }
  if (/^image\//.test(tipo) || /^(jpe?g|png|webp|gif)$/.test(ext)) {
    return [{ nome, tipo: "imagem", mime: "image/jpeg", b64: await histImagemB64(file) }];
  }
  if (/^(xlsx|xlsm|xls|ods)$/.test(ext)) {
    const XLSX = await histCarregarXlsx();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return wb.SheetNames.map((sn) => {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn], { blankrows: false });
      const cab = csv.split("\n")[0] || "";
      return { nome: `${nome} · ${sn}`, tipo: "texto", texto: `Planilha, aba "${sn}":\n${csv}`, cabecalho: cab.length < 300 ? cab : "" };
    }).filter((f) => f.texto.length > 40);
  }
  if (/^(txt|csv|tsv|md|json|log|text)$/.test(ext) || /^text\//.test(tipo) || !ext) {
    const texto = await file.text();
    return [{ nome, tipo: "texto", texto, cabecalho: /^(csv|tsv)$/.test(ext) ? (texto.split("\n")[0] || "").trim() : "" }];
  }
  throw new Error(`${nome}: formato não suportado. Use texto, CSV, Excel, PDF, zip do WhatsApp ou foto.`);
}
// Fontes -> partes (cada parte é uma chamada à IA). Texto é dividido; imagens vão de 3 em 3.
function histMontarPartes(fontes, textoColado, lado) {
  let textos = [];
  fontes.filter((f) => f.tipo === "texto").forEach((f) => histDividirTexto(f.texto, HIST_MAX_CHARS, f.cabecalho).forEach((t) => textos.push(t)));
  if ((textoColado || "").trim()) histDividirTexto(textoColado, HIST_MAX_CHARS).forEach((t) => textos.push(t));
  const demais = Math.max(0, textos.length - HIST_MAX_PARTES);
  if (demais > 0) textos = lado === "inicio" ? textos.slice(0, HIST_MAX_PARTES) : textos.slice(demais);
  const partes = textos.map((t) => [{ tipo: "texto", texto: t }]);
  fontes.filter((f) => f.tipo === "pdf").forEach((f) => partes.push([{ tipo: "pdf", b64: f.b64 }]));
  const imgs = fontes.filter((f) => f.tipo === "imagem");
  for (let i = 0; i < imgs.length; i += 3) partes.push(imgs.slice(i, i + 3).map((f) => ({ tipo: "imagem", mime: f.mime, b64: f.b64 })));
  return { partes, cortadas: demais };
}

function ImportarHistoricoModal({ treinos, sessions, schedule, atividades, hojeISO, getToken, onAplicar, onDesfazer, onEvent, onErro, onClose }) {
  const [etapa, setEtapa] = useState("inicio"); // inicio | lendo | revisao | ok
  const [fontes, setFontes] = useState([]);
  const [colado, setColado] = useState("");
  const [unidade, setUnidade] = useState("auto");
  const [meuNome, setMeuNome] = useState("");
  const [lado, setLado] = useState("fim");
  const [erro, setErro] = useState("");
  const [lendoArq, setLendoArq] = useState(false);
  const [uso, setUso] = useState(null); // null carregando | false sem SQL | {usados, limite}
  const [prog, setProg] = useState({ feitas: 0, total: 0, falhas: 0 });
  const [juntado, setJuntado] = useState(null);
  const [falhas, setFalhas] = useState(0);
  const [criarFichas, setCriarFichas] = useState(true);
  const [incluirAtiv, setIncluirAtiv] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [impAtual, setImpAtual] = useState(null);
  const cancelRef = useRef(false);
  const reservaRef = useRef(null);
  const vivoRef = useRef(true);
  useEffect(() => () => { vivoRef.current = false; cancelRef.current = true; }, []);
  useEffect(() => {
    let vivo = true;
    supabaseClient.rpc("ai_generation_usage", { p_kind: "historico", max_per_month: 3 })
      .then(({ data, error }) => { if (vivo) setUso(error || !data ? false : data); })
      .catch(() => { if (vivo) setUso(false); });
    return () => { vivo = false; };
  }, [etapa === "inicio"]);

  const plano = useMemo(
    () => (juntado ? histPlanejar(juntado, { treinos, sessions, schedule, atividades, criarFichas, incluirAtiv }) : null),
    [juntado, criarFichas, incluirAtiv]
  );
  const importacoes = useMemo(() => histImportacoes({ treinos, sessions }), [treinos, sessions, etapa]);
  const fmtD = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const semLimite = uso && uso.limite >= 1000;
  const podeUsar = uso && (semLimite || uso.usados < uso.limite);

  async function escolherArquivos(ev) {
    const lista = Array.from(ev.target.files || []);
    ev.target.value = "";
    if (!lista.length) return;
    setErro(""); setLendoArq(true);
    const novas = [];
    const erros = [];
    for (const f of lista) {
      try { (await histLerArquivo(f)).forEach((x) => novas.push({ ...x, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })); }
      catch (e) { erros.push(e && e.message ? e.message : `${f.name}: não consegui ler.`); }
    }
    if (!vivoRef.current) return;
    setFontes((prev) => [...prev, ...novas]);
    setLendoArq(false);
    if (erros.length) setErro(erros.join(" "));
  }
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

  // Uma parte: pede à função (que responde com um id de tarefa) e consulta ai_jobs até terminar.
  async function processarParte(i, partes) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/importar-historico`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ reserva: reservaRef.current, idx: i, hoje: hojeISO, unidade, nome: meuNome.trim(), partes }),
      });
      let obj = null;
      try { obj = JSON.parse(await resp.text()); } catch (e) {}
      if (!obj || !obj.ok || !obj.job) { onErro("hist_import", obj && obj.erro ? obj.erro : `resp_${resp.status}`); return null; }
      for (let t = 0; t < 150 && !cancelRef.current; t++) {
        await dormir(t === 0 ? 1500 : 2500);
        const { data, error } = await supabaseClient.from("ai_jobs").select("status,result").eq("id", obj.job).maybeSingle();
        if (error || !data || data.status === "rodando") continue;
        if (data.status !== "pronto" || !data.result || !data.result.texto) { onErro("hist_import_job", `${(data.result && data.result.erro) || data.status}: ${(data.result && data.result.mensagem) || ""}`); return null; }
        const parsed = histParse(data.result.texto);
        return parsed ? histLimpar(parsed, hojeISO) : null;
      }
      return null;
    } catch (e) {
      onErro("hist_import_rede", e && e.message);
      return null;
    }
  }

  async function analisar() {
    setErro("");
    const { partes, cortadas } = histMontarPartes(fontes, colado, lado);
    if (!partes.length) { setErro("Escolha um arquivo ou cole o texto do seu histórico."); return; }
    let r;
    try {
      const resp = await supabaseClient.rpc("reserve_ai_generation", { p_kind: "historico", p_label: "importar histórico", max_per_month: 3 });
      if (resp.error || !resp.data) { setUso(false); setErro("A importação ainda não está disponível. Tente mais tarde."); return; }
      r = resp.data;
    } catch (e) { setErro("Sem conexão. Tente de novo."); return; }
    if (!r.ok) { setUso({ usados: r.usados, limite: r.limite }); setErro(`Você já usou as ${r.limite} importações deste mês.`); return; }
    reservaRef.current = r.id;
    cancelRef.current = false;
    onEvent("hist_import_iniciado");
    setEtapa("lendo");
    setProg({ feitas: 0, total: partes.length, falhas: 0 });
    const resultados = new Array(partes.length).fill(null);
    let prox = 0, feitas = 0, nFalhas = 0;
    const worker = async () => {
      while (!cancelRef.current) {
        const i = prox++;
        if (i >= partes.length) return;
        let res = null;
        for (let t = 0; t < 2 && !res && !cancelRef.current; t++) res = await processarParte(i, partes[i]);
        if (res) resultados[i] = res; else nFalhas++;
        feitas++;
        if (vivoRef.current) setProg({ feitas, total: partes.length, falhas: nFalhas });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (cancelRef.current || !vivoRef.current) return;
    const bons = resultados.filter(Boolean);
    const devolver = async () => { try { await supabaseClient.rpc("refund_plan_generation", { p_id: reservaRef.current }); } catch (e) {} };
    if (!bons.length) {
      await devolver();
      setErro("Não consegui ler o arquivo agora. Esta tentativa não conta no seu limite. Tente de novo em instantes.");
      setEtapa("inicio");
      return;
    }
    const j = histJuntar(bons);
    if (cortadas > 0) j.avisos.unshift(`Arquivo grande: li só ${HIST_MAX_PARTES} partes (${lado === "inicio" ? "o começo" : "a parte mais recente"}). Importe o restante em outra rodada.`);
    if (!j.sessoes.length && !j.ativ.length) {
      await devolver();
      setErro(`Não encontrei treinos nesse arquivo.${j.avisos.length ? " " + j.avisos[0] : ""} Esta tentativa não conta no seu limite.`);
      setEtapa("inicio");
      return;
    }
    setFalhas(nFalhas);
    setJuntado(j);
    setEtapa("revisao");
  }

  function confirmarImportacao() {
    const impId = `imp-${Date.now().toString(36)}`;
    const res = onAplicar(plano, impId);
    setResumo(res); setImpAtual(impId);
    onEvent("hist_import_aplicado");
    setEtapa("ok");
  }
  function fechar() {
    if (etapa === "lendo") {
      if (!window.confirm("Cancelar a leitura? A importação deste mês já foi contada, mas você pode mandar o arquivo de novo.")) return;
      cancelRef.current = true;
    }
    onClose();
  }
  const nExerc = plano ? plano.fichas.reduce((t, f) => t + f.exercicios.length, 0) : 0;

  return (
    <div className="gt-modal-backdrop" onClick={fechar}>
      <div className="gt-modal gt-plano-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gt-provas-head">
          <h3><Ei e="📥" /> Importar histórico</h3>
          <button type="button" className="gt-provas-close" onClick={fechar} title="Fechar">✕</button>
        </div>

        {etapa === "inicio" && (
          <div className="gt-plano-form">
            <div className="gt-plano-dica">Traga seus treinos de outro app, planilha, anotações ou conversa de WhatsApp. A IA lê, o app organiza e você confere tudo antes de salvar.</div>
            <label className="gt-btn secondary" style={{ textAlign: "center", cursor: "pointer" }}>
              {lendoArq ? "Lendo arquivos…" : <><Ei e="📎" /> Escolher arquivos</>}
              <input type="file" multiple style={{ display: "none" }} accept=".txt,.csv,.tsv,.md,.json,.xlsx,.xlsm,.xls,.ods,.pdf,.zip,image/*" onChange={escolherArquivos} disabled={lendoArq} />
            </label>
            <div className="gt-plano-dica">Aceita: texto/CSV, Excel, PDF, fotos e prints, e a conversa exportada do WhatsApp (.txt ou .zip).</div>
            {fontes.map((f) => (
              <div className="gt-chip" key={f.id} style={{ alignSelf: "flex-start" }}>
                <span className="tag">{f.tipo === "pdf" ? "PDF" : f.tipo === "imagem" ? "FOTO" : "TEXTO"}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{f.nome}</span>
                <button type="button" title="Remover" onClick={() => setFontes((p) => p.filter((x) => x.id !== f.id))}>✕</button>
              </div>
            ))}
            <label className="gt-plano-lbl">Ou cole o texto aqui</label>
            <textarea className="gt-input" rows={4} placeholder="Ex.: 12/03 Treino A — supino 40kg 3x10, agachamento 60kg 3x8…" value={colado} onChange={(e) => setColado(e.target.value)} />
            <label className="gt-plano-lbl">Unidade das cargas</label>
            <div className="gt-provas-filters" style={{ margin: 0 }}>
              {[["auto", "Detectar"], ["kg", "kg"], ["lb", "lb"]].map(([id, nm]) => <button key={id} type="button" className={`gt-provas-pill ${unidade === id ? "on" : ""}`} onClick={() => setUnidade(id)}>{nm}</button>)}
            </div>
            {(colado.trim() || fontes.some((f) => f.tipo === "texto")) && (
              <>
                <label className="gt-plano-lbl">Seu nome na conversa (opcional)</label>
                <input className="gt-input" placeholder="Só se a conversa tiver mais gente" value={meuNome} onChange={(e) => setMeuNome(e.target.value)} maxLength={40} />
              </>
            )}
            {histMontarPartes(fontes, colado, lado).cortadas > 0 && (
              <>
                <div className="gt-plano-aviso aviso">Esse histórico é grande: leio até {HIST_MAX_PARTES} partes por importação. Qual parte importar agora?</div>
                <div className="gt-provas-filters" style={{ margin: 0 }}>
                  {[["fim", "A mais recente"], ["inicio", "O começo"]].map(([id, nm]) => <button key={id} type="button" className={`gt-provas-pill ${lado === id ? "on" : ""}`} onClick={() => setLado(id)}>{nm}</button>)}
                </div>
              </>
            )}
            {erro && <div className="gt-plano-erro">{erro}</div>}
            {uso === false && <div className="gt-plano-aviso aviso">A importação ainda não foi ativada neste app.</div>}
            {uso && !semLimite && <div className="gt-plano-dica" style={{ textAlign: "center" }}>{podeUsar ? `Restam ${uso.limite - uso.usados} de ${uso.limite} importações neste mês.` : `Você já usou as ${uso.limite} importações deste mês.`}</div>}
            <div className="gt-plano-foot">O arquivo é enviado para a IA só para ler seus treinos e não fica guardado.</div>
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gt-btn" disabled={!podeUsar || lendoArq || (!fontes.length && !colado.trim())} onClick={analisar}>Analisar com IA</button>
              <button type="button" className="gt-btn secondary" onClick={onClose}>Fechar</button>
            </div>
            {importacoes.length > 0 && (
              <>
                <label className="gt-plano-lbl" style={{ marginTop: 14 }}>Importações já feitas</label>
                {importacoes.map((im) => (
                  <div className="gt-tc-item" key={im.id}>
                    <div className="mt">{im.ini ? `${fmtD(im.ini)} a ${fmtD(im.fim)}` : "Importação"} · {im.sessoes} registros{im.fichas ? ` · ${im.fichas} fichas criadas` : ""}</div>
                    <div className="gt-modal-actions" style={{ marginTop: 6 }}>
                      <button type="button" className="gt-btn secondary small" onClick={() => { if (window.confirm("Desfazer esta importação? Os registros e fichas criados por ela serão removidos.")) { onDesfazer(im.id); onEvent("hist_import_desfeito"); } }}>Desfazer</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {etapa === "lendo" && (
          <div className="gt-run" role="status" aria-live="polite">
            <div style={{ fontSize: 34, marginTop: 6 }}><Ei e="📖" size={40} /></div>
            <div className="gt-run-t gt-hist-prog">{prog.feitas}/{prog.total}</div>
            <div className="gt-run-bar"><i style={{ width: `${prog.total ? Math.round((prog.feitas / prog.total) * 100) : 0}%` }} /></div>
            <div className="gt-run-msg">Lendo seu histórico… parte {Math.min(prog.total, prog.feitas + 1)} de {prog.total}</div>
            <div className="gt-plano-dica" style={{ marginTop: 10 }}>Pode levar alguns minutos em históricos grandes. Mantenha esta tela aberta.</div>
            <div className="gt-modal-actions" style={{ marginTop: 14 }}><button type="button" className="gt-btn secondary" onClick={fechar}>Cancelar</button></div>
          </div>
        )}

        {etapa === "revisao" && plano && (
          <div className="gt-plano-form">
            <div className="gt-plano-aviso info"><b>Confira antes de importar.</b> Nada foi salvo ainda.</div>
            <div className="gt-tc-item gt-hist-resumo">
              <div className="ti">{plano.sessoes.length} {plano.sessoes.length === 1 ? "treino" : "treinos"}{plano.ativ.length ? ` e ${plano.ativ.length} ${plano.ativ.length === 1 ? "atividade" : "atividades"}` : ""}</div>
              {plano.periodo && <div className="mt">de {fmtD(plano.periodo.ini)} até {fmtD(plano.periodo.fim)}</div>}
            </div>
            <label className="gt-plano-chk"><input type="checkbox" checked={criarFichas} onChange={(e) => setCriarFichas(e.target.checked)} /> <span>Criar uma ficha para cada tipo de treino (o histórico fica ligado a elas)</span></label>
            {juntado.ativ.length > 0 && <label className="gt-plano-chk"><input type="checkbox" checked={incluirAtiv} onChange={(e) => setIncluirAtiv(e.target.checked)} /> <span>Importar também corridas e outras atividades ({juntado.ativ.length})</span></label>}
            <label className="gt-plano-lbl">Fichas</label>
            {plano.fichas.map((f) => (
              <div className="gt-tc-item" key={f.key}>
                <div className="ti">{f.nome}</div>
                <div className="mt">{f.existenteId ? "Sua ficha atual" : "Ficha nova"} · {f.nSessoes} {f.nSessoes === 1 ? "treino" : "treinos"} · {f.exercicios.length} {f.exercicios.length === 1 ? "exercício" : "exercícios"}</div>
                <div className="gt-tc-resumo">{f.exercicios.map((e) => e.nome).join(" · ")}</div>
              </div>
            ))}
            {plano.novosExercicios.length > 0 && <div className="gt-plano-aviso info">Exercícios que não estão no catálogo (serão criados): {plano.novosExercicios.join(", ")}.</div>}
            {plano.puladas > 0 && <div className="gt-plano-aviso aviso">{plano.puladas === 1 ? "1 registro cai" : `${plano.puladas} registros caem`} em dias que você já preencheu e {plano.puladas === 1 ? "será mantido" : "serão mantidos"} como está (não sobrescrevo).</div>}
            {falhas > 0 && <div className="gt-plano-aviso aviso">{falhas} {falhas === 1 ? "parte do arquivo não pôde" : "partes do arquivo não puderam"} ser lida{falhas === 1 ? "" : "s"}. O período delas não entra agora; você pode importar de novo depois.</div>}
            {plano.avisos.map((a, i) => <div className="gt-plano-aviso info" key={i}>{a}</div>)}
            <div className="gt-modal-actions" style={{ marginTop: 8 }}>
              <button type="button" className="gt-btn" disabled={!plano.sessoes.length && !plano.ativ.length} onClick={confirmarImportacao}>Importar</button>
              <button type="button" className="gt-btn secondary" onClick={() => setEtapa("inicio")}>Voltar</button>
            </div>
          </div>
        )}

        {etapa === "ok" && resumo && (
          <div className="gt-plano-form">
            <div className="gt-plano-aviso info"><b>Importado ✓</b> {resumo.sessoes} treinos{resumo.atividades ? `, ${resumo.atividades} atividades` : ""}{resumo.fichas ? ` e ${resumo.fichas} fichas novas` : ""}. Veja no calendário e na aba Evolução.</div>
            <div className="gt-modal-actions" style={{ marginTop: 8 }}>
              <button type="button" className="gt-btn" onClick={onClose}>Pronto</button>
              <button type="button" className="gt-btn secondary" onClick={() => { if (window.confirm("Desfazer esta importação?")) { onDesfazer(impAtual); onEvent("hist_import_desfeito"); onClose(); } }}>Desfazer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Ajustar a semana com IA ---
// O código mede o que aconteceu (planejado x feito, carga, extras, grupos) e detecta desvios; a IA só
// recomenda sobre esse resumo. Toda proposta é validada aqui (só reduz, move ou repõe pouco) e o
// ajuste vale só para os dias restantes da semana: fica guardado por data (sessions[d].semana e
// planos[].sessoes[].ajuste), não mexe na ficha-base e pode ser desfeito.
const SEMANA_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const SEMANA_BLOCO_NOME = "Reposição da semana";
function semanaDatas(hojeISO) {
  const ini = addDays(hojeISO, -weekdayOf(hojeISO));
  return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
}
function semanaGrupo(nome, blocoNome) {
  const c = histCasarExercicio(nome, EXERCISE_CATALOG_FLAT);
  return c ? c.grupo : (blocoNome || "");
}
function semanaCarga(min, rpe) { return Number(min) > 0 && Number(rpe) > 0 ? Number(min) * Number(rpe) : null; }
// Aplica as mudanças da semana a uma ficha (séries, exercícios tirados, reposição).
function aplicarSemanaTreino(treino, daySession) {
  if (!treino) return treino;
  const sw = daySession && daySession.semana && daySession.semana.treinos && daySession.semana.treinos[treino.id];
  if (!sw) return treino;
  const ex = sw.ex || {};
  let blocos = treino.blocos
    .map((b) => ({ ...b, exercicios: b.exercicios.filter((e) => !(ex[e.id] && ex[e.id].remover)).map((e) => (ex[e.id] && ex[e.id].series ? { ...e, series: ex[e.id].series } : e)) }))
    .filter((b) => b.exercicios.length > 0);
  if ((sw.add || []).length) blocos = [...blocos, { nome: SEMANA_BLOCO_NOME, exercicios: sw.add }];
  return { ...treino, blocos, ajustadoSemana: true };
}

// Fotografia da semana (domingo a sábado, como a tira da aba Hoje).
function semanaFatos(ctx) {
  const { hojeISO, schedule, sessions, planos, treinoById, atividadeById } = ctx;
  const hojeFora = !!ctx.hojeFora;
  const datas = semanaDatas(hojeISO);
  const dias = datas.map((iso) => {
    const wd = weekdayOf(iso);
    const s = sessions[iso] || {};
    const removed = s.removed || [];
    const planejado = ((schedule && schedule[wd]) || []).filter((it) => !removed.some((r) => r.tipo === it.tipo && r.id === it.id));
    const extras = (s.extras || []).filter((e) => !planejado.some((p) => p.tipo === e.tipo && p.id === e.id));
    const itens = [];
    [...planejado.map((i) => ({ ...i, extra: false })), ...extras.map((i) => ({ ...i, extra: true }))].forEach((it) => {
      const key = itemKey(it);
      const log = (s.log || {})[key] || {};
      const carga = (s.cargas || {})[key] || {};
      const min = Number(carga.duracaoMin) || null, rpe = Number(carga.rpe) || null;
      const dor = carga.dor != null && carga.dor !== "" ? Number(carga.dor) : null;
      if (it.tipo === "treino") {
        const base = treinoById(it.id);
        if (!base) return;
        const treino = resolveTreinoForDay(base, s);
        const flat = flattenExercicios(treino);
        const feitos = flat.filter((e) => log[e.id] && log[e.id].status === "feito");
        const grupos = [];
        (feitos.length ? feitos : flat).forEach((e) => { const g = semanaGrupo(e.nome, e.blocoNome); if (g && grupos.indexOf(g) < 0) grupos.push(g); });
        itens.push({ tipo: "treino", id: it.id, nome: treino.nome, extra: it.extra, status: feitos.length === 0 ? "pendente" : feitos.length === flat.length ? "feito" : "parcial", min, rpe, dor, km: null, grupos, nEx: flat.length });
      } else {
        const at = atividadeById(it.id);
        if (!at || at.descanso) return;
        itens.push({ tipo: "atividade", id: it.id, nome: at.nome, extra: it.extra, status: log.status === "fui" ? "feito" : log.status === "nao-fui" ? "nao-fui" : "pendente", min, rpe, dor, km: Number(carga.distanciaKm) || null, grupos: [] });
      }
    });
    planoSessoesDoDia(planos, iso).forEach(({ plano, sessao, idx }) => {
      if (sessao.tipo === "prova") return;
      itens.push({ tipo: "corrida", id: `${plano.id}:${idx}`, planoId: plano.id, idx, nome: sessao.titulo, extra: false, status: sessao.status === "feito" ? "feito" : sessao.status === "pulou" ? "nao-fui" : "pendente", min: sessao.duracaoMin || null, rpe: null, dor: null, km: sessao.distanciaKm || null, grupos: [], tipoCorrida: sessao.tipo, ajustada: !!sessao.ajuste });
    });
    return { iso, wd, nome: SEMANA_DIAS[wd], passado: iso < hojeISO, hoje: iso === hojeISO, itens };
  });
  // restantes: de hoje em diante, o que ainda não foi feito
  const restantes = [];
  dias.forEach((d) => {
    if (d.iso < hojeISO) return;
    d.itens.forEach((it) => { if (it.status === "pendente") restantes.push({ iso: d.iso, dia: d.nome, ...it, naoVai: hojeFora && d.iso === hojeISO && it.tipo !== "atividade", ref: `${d.iso}|${it.tipo}|${it.id}` }); });
  });
  restantes.forEach((r, i) => { r.n = i + 1; });
  // treinos de musculação que ficaram para trás (podem ser repostos em outro dia)
  const perdidosItens = [];
  dias.forEach((d) => {
    if (d.iso >= hojeISO) return;
    d.itens.forEach((it) => { if (it.tipo === "treino" && !it.extra && it.status === "pendente") perdidosItens.push({ iso: d.iso, dia: d.nome, ...it, perdido: true, ref: `${d.iso}|${it.tipo}|${it.id}` }); });
  });
  perdidosItens.forEach((r, i) => { r.n = i + 1; r.rotulo = `P${i + 1}`; });
  // sinais de desvio
  const sinais = [];
  const perdidos = [];
  const extrasFortes = [];
  const cargaDia = {};
  dias.forEach((d) => {
    d.itens.forEach((it) => {
      const c = semanaCarga(it.min, it.rpe);
      if (it.status === "feito" || it.status === "parcial") {
        if (c) cargaDia[d.iso] = (cargaDia[d.iso] || 0) + c;
        if (c && c >= 300 && it.extra) extrasFortes.push({ iso: d.iso, dia: d.nome, nome: it.nome, min: it.min, rpe: it.rpe });
        else if (c && c >= 360 && it.tipo === "atividade") extrasFortes.push({ iso: d.iso, dia: d.nome, nome: it.nome, min: it.min, rpe: it.rpe });
        if (it.dor != null && it.dor >= 5 && d.iso >= addDays(hojeISO, -3)) sinais.push({ tipo: "dor", texto: `Dor ${it.dor}/10 registrada em ${it.nome} (${d.nome}).` });
      }
      const ontemOuAntes = d.iso < hojeISO;
      if (ontemOuAntes && !it.extra && (it.status === "pendente" || it.status === "nao-fui") && it.tipo !== "atividade") perdidos.push({ iso: d.iso, dia: d.nome, nome: it.nome, tipo: it.tipo });
      if (ontemOuAntes && !it.extra && it.status === "parcial") perdidos.push({ iso: d.iso, dia: d.nome, nome: `${it.nome} (parcial)`, tipo: it.tipo });
    });
  });
  if (perdidos.length) sinais.unshift({ tipo: "faltou", texto: `Faltou: ${perdidos.map((p) => `${p.nome} (${p.dia})`).join(", ")}.` });
  if (hojeFora && restantes.some((r) => r.naoVai)) sinais.unshift({ tipo: "hoje_fora", texto: `Você não vai treinar hoje: ${restantes.filter((r) => r.naoVai).map((r) => r.nome).join(", ")}.` });
  extrasFortes.forEach((e) => sinais.push({ tipo: "extra_forte", texto: `${e.nome} (${e.dia}): ${e.min} min, esforço ${e.rpe}/10, fora do planejado ou bem puxado.` }));
  let seq = 0;
  for (let c = (cargaDia[hojeISO] || 0) >= 200 ? hojeISO : addDays(hojeISO, -1); c >= datas[0] && (cargaDia[c] || 0) >= 200; c = addDays(c, -1)) seq++;
  if (seq >= 3) sinais.push({ tipo: "sequencia", texto: `${seq} dias seguidos de treino puxado.` });
  // ajuste já aplicado nesta semana
  let ajusteId = null, ajusteN = 0;
  datas.forEach((iso) => {
    const sw = sessions[iso] && sessions[iso].semana;
    if (sw && sw.id) { ajusteId = sw.id; ajusteN += sw.n || 1; }
  });
  (planos || []).forEach((p) => (p.sessoes || []).forEach((s) => { if (s.ajuste && s.ajuste.id && datas.indexOf(s.data) >= 0) { ajusteId = s.ajuste.id; ajusteN++; } }));
  const ajustaveis = restantes.filter((r) => r.tipo === "treino" || r.tipo === "corrida");
  return {
    hojeISO, hojeFora, datas, dias, restantes, ajustaveis, perdidos, perdidosItens, extrasFortes, sinais,
    gatilho: sinais.length > 0 && ajustaveis.length > 0 && !ajusteId,
    assinatura: `${datas[0]}|${sinais.map((x) => x.texto).join("|")}`,
    ajusteAtivo: ajusteId ? { id: ajusteId, n: ajusteN } : null,
  };
}

// Resumo compacto enviado à função (sem comentários nem dados pessoais).
function semanaPayload(fatos, bem) {
  const lim = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  const passado = [];
  fatos.dias.forEach((d) => {
    const its = d.itens.filter((it) => d.iso < fatos.hojeISO || it.status !== "pendente").map((it) => ({
      t: it.tipo, n: lim(it.nome, 50), st: it.status === "pendente" ? "faltou" : it.status === "nao-fui" ? "nao_fui" : it.status, ...(it.extra ? { ex: 1 } : {}),
      ...(it.min ? { min: it.min } : {}), ...(it.rpe ? { rpe: it.rpe } : {}), ...(it.dor != null ? { dor: it.dor } : {}), ...(it.km ? { km: it.km } : {}), ...(it.grupos && it.grupos.length ? { g: it.grupos.slice(0, 6) } : {}),
    }));
    if (its.length) passado.push({ d: d.iso, dia: d.nome, it: its });
  });
  const restante = fatos.restantes.map((r) => {
    const base = { r: `R${r.n}`, d: r.iso, dia: r.dia, t: r.tipo, n: lim(r.nome, 50), ...(r.naoVai ? { nv: 1 } : {}) };
    if (r.tipo === "atividade") return { ...base, fixo: 1, ...(r.extra ? { ex: 1 } : {}) };
    if (r.tipo === "corrida") return { ...base, tp: r.tipoCorrida || "rodagem", ...(r.km ? { km: r.km } : {}), ...(r.min ? { min: r.min } : {}) };
    return base;
  });
  const perdidos = (fatos.perdidosItens || []).map((p) => ({ r: p.rotulo, d: p.iso, dia: p.dia, n: lim(p.nome, 50), g: (p.grupos || []).slice(0, 6) }));
  return { passado, restante, perdidos };
}
// Exercícios dos treinos restantes (para a IA citar por id).
function semanaExerciciosRestantes(fatos, treinoById, sessions) {
  const out = {};
  fatos.ajustaveis.filter((r) => r.tipo === "treino").forEach((r) => {
    const t = treinoById(r.id);
    if (!t) return;
    out[`R${r.n}`] = flattenExercicios(resolveTreinoForDay(t, sessions[r.iso])).map((e) => ({ id: e.id, n: e.nome.slice(0, 60), s: e.series, rep: String(e.repeticoes || "").slice(0, 12), g: semanaGrupo(e.nome, e.blocoNome) }));
  });
  return out;
}

// Valida a proposta da IA: só reduz, tira, move ou repõe pouco; todo item restante aparece (sem mudança = "fica").
function semanaValidarProposta(raw, fatos, exPorRef, treinoById) {
  const out = { veredito: "manter", titulo: "", motivos: [], itens: [] };
  if (!raw || typeof raw !== "object") return out;
  out.veredito = ["manter", "aliviar", "reorganizar"].indexOf(raw.veredito) >= 0 ? raw.veredito : "aliviar";
  out.titulo = typeof raw.titulo === "string" ? raw.titulo.trim().slice(0, 140) : "";
  (Array.isArray(raw.motivos) ? raw.motivos : []).forEach((m) => { if (typeof m === "string" && m.trim() && out.motivos.length < 4) out.motivos.push(m.trim().slice(0, 200)); });
  const datasOk = fatos.datas.filter((d) => d >= fatos.hojeISO);
  const porRef = {};
  (Array.isArray(raw.itens) ? raw.itens : []).forEach((x) => { if (x && typeof x.r === "string") porRef[x.r] = x; });
  let adds = 0, k = 0, subidas = 0;
  const temTreinoNoDia = (iso, id) => { const d = fatos.dias.find((x) => x.iso === iso); return !!d && d.itens.some((it) => it.tipo === "treino" && it.id === id); };
  // treinos perdidos: só podem ser repostos (movidos) para um dia restante que ainda não tem esse treino
  (fatos.perdidosItens || []).forEach((r) => {
    const x = porRef[r.rotulo] || {};
    const mud = [];
    const alvo = datasOk.filter((d) => !(fatos.hojeFora && d === fatos.hojeISO));
    if (x.a === "mover" && typeof x.para === "string" && alvo.indexOf(x.para) >= 0 && !temTreinoNoDia(x.para, r.id)) mud.push({ id: `m${++k}`, tipo: "mover", para: x.para, on: true });
    out.itens.push({ ref: r.rotulo, iso: r.iso, dia: r.dia, tipo: "treino", id: r.id, nome: r.nome, perdido: true, motivo: typeof x.motivo === "string" ? x.motivo.trim().slice(0, 220) : "", mudancas: mud });
  });
  fatos.ajustaveis.forEach((r) => {
    const ref = `R${r.n}`;
    const x = porRef[ref] || {};
    const mud = [];
    const novoId = () => `m${++k}`;
    const exs = (exPorRef && exPorRef[ref]) || [];
    if (x.a === "pular") mud.push({ id: novoId(), tipo: "pular", on: true });
    else {
      if (x.a === "mover" && typeof x.para === "string" && datasOk.indexOf(x.para) >= 0 && x.para !== r.iso && !(r.tipo === "treino" && temTreinoNoDia(x.para, r.id)) && !(fatos.hojeFora && x.para === fatos.hojeISO)) mud.push({ id: novoId(), tipo: "mover", para: x.para, on: true });
      if (r.tipo === "corrida") {
        const para = Number(x.km);
        if (r.km && para > 0 && para < r.km) mud.push({ id: novoId(), tipo: "km", de: r.km, para: Math.max(Math.round(r.km * 0.4 * 10) / 10, Math.round(para * 10) / 10), leve: !!x.leve, on: true });
        else if (x.leve && (r.tipoCorrida === "intervalado" || r.tipoCorrida === "tempo" || r.tipoCorrida === "longao")) mud.push({ id: novoId(), tipo: "km", de: r.km || 0, para: r.km || 0, leve: true, on: true });
      } else {
        (Array.isArray(x.ex) ? x.ex : []).forEach((e) => {
          if (!Array.isArray(e)) return;
          const [exId, acao, v1, v2, v3] = e;
          const orig = exs.find((o) => o.id === exId);
          if (acao === "series" && orig) {
            const para = Math.round(Number(v1));
            if (para >= 1 && para < orig.s) mud.push({ id: novoId(), tipo: "series", exId, nome: orig.n, de: orig.s, para, on: true });
            else if (para === orig.s + 1 && para <= 6 && subidas < 8 && mud.filter((m) => m.tipo === "series" && m.para > m.de).length < 3) { subidas++; mud.push({ id: novoId(), tipo: "series", exId, nome: orig.n, de: orig.s, para, on: true }); }
          } else if (acao === "remover" && orig) {
            mud.push({ id: novoId(), tipo: "remover", exId, nome: orig.n, on: true });
          } else if (acao === "add" && typeof v1 === "string" && v1.trim() && adds < 5 && mud.filter((m) => m.tipo === "add").length < 3) {
            const cat = histCasarExercicio(v1.trim(), EXERCISE_CATALOG_FLAT);
            if (!cat) return;
            if (exs.some((o) => histNorm(o.n) === histNorm(cat.nome))) return;
            adds++;
            mud.push({ id: novoId(), tipo: "add", nome: cat.nome, series: Math.max(1, Math.min(4, Math.round(Number(v2)) || 3)), repeticoes: typeof v3 === "string" && v3.trim() ? v3.trim().slice(0, 12) : cat.repeticoes || "10", grupo: cat.grupo, descricao: cat.descricao || "", videoUrl: cat.videoUrl || "", on: true });
          }
        });
      }
    }
    out.itens.push({ ref, iso: r.iso, dia: r.dia, tipo: r.tipo, id: r.id, planoId: r.planoId, idx: r.idx, nome: r.nome, motivo: typeof x.motivo === "string" ? x.motivo.trim().slice(0, 220) : "", mudancas: mud });
  });
  return out;
}
// Situação de um item na tela: fica / muda / sai (considerando só as mudanças marcadas).
function semanaStatusItem(item) {
  const on = item.mudancas.filter((m) => m.on);
  if (on.some((m) => m.tipo === "pular")) return "sai";
  return on.length ? "muda" : "fica";
}
function semanaTextoMudanca(m, item) {
  if (m.tipo === "series") return `${m.nome}: ${m.de} → ${m.para} séries`;
  if (m.tipo === "remover") return `Tirar ${m.nome}`;
  if (m.tipo === "add") return `Incluir ${m.nome} ${m.series}x${m.repeticoes}`;
  if (m.tipo === "pular") return item.tipo === "corrida" ? "Pular esta corrida" : "Pular este treino";
  if (m.tipo === "mover") return `${item && item.perdido ? "Repor" : "Mover"} ${item && item.perdido ? "em" : "para"} ${SEMANA_DIAS[weekdayOf(m.para)]} (${m.para.slice(8)}/${m.para.slice(5, 7)})`;
  if (m.tipo === "km") return m.de && m.para !== m.de ? `${String(m.de).replace(".", ",")} km → ${String(m.para).replace(".", ",")} km${m.leve ? " em ritmo leve" : ""}` : "Fazer em ritmo leve";
  return "";
}

// Aplica a proposta (já editada) e devolve o novo estado. Tudo marcado com o id do ajuste.
function semanaAplicar(prop, estado, adjId) {
  const sessions = { ...estado.sessions };
  let planos = estado.planos;
  let n = 0;
  const dia = (iso) => {
    const s = sessions[iso] || { log: {}, extras: [], removed: [] };
    const sw = (s.semana && s.semana.id === adjId) ? s.semana : { id: adjId, n: 0, treinos: {}, removidos: [], adicionados: [] };
    return { s: { log: {}, extras: [], removed: [], cargas: {}, ...s }, sw: { ...sw, treinos: { ...sw.treinos }, removidos: [...sw.removidos], adicionados: [...sw.adicionados] } };
  };
  const grava = (iso, s, sw) => { sessions[iso] = { ...s, semana: sw }; };
  prop.itens.forEach((it) => {
    const on = it.mudancas.filter((m) => m.on);
    if (!on.length) return;
    if (it.tipo === "treino") {
      let destino = it.iso;
      const pular = on.find((m) => m.tipo === "pular");
      const mover = on.find((m) => m.tipo === "mover");
      const item = { tipo: "treino", id: it.id };
      if ((pular || mover) && !it.perdido) {
        const o = dia(it.iso);
        o.s.removed = [...(o.s.removed || []), item];
        o.sw.removidos.push(item); o.sw.n++;
        grava(it.iso, o.s, o.sw);
        n++;
      }
      if (pular) return;
      if (mover) {
        destino = mover.para;
        const d = dia(destino);
        if (!(d.s.extras || []).some((e) => e.tipo === "treino" && e.id === it.id)) { d.s.extras = [...(d.s.extras || []), item]; d.sw.adicionados.push(item); }
        d.sw.n++;
        grava(destino, d.s, d.sw);
      }
      const resto = on.filter((m) => m.tipo === "series" || m.tipo === "remover" || m.tipo === "add");
      if (resto.length) {
        const d = dia(destino);
        const atual = d.sw.treinos[it.id] || { ex: {}, add: [] };
        const t = { ex: { ...atual.ex }, add: [...atual.add] };
        const ids = new Set();
        const tr = (estado.treinoById && estado.treinoById(it.id));
        if (tr) flattenExercicios(tr).forEach((e) => ids.add(e.id));
        resto.forEach((m) => {
          if (m.tipo === "series") t.ex[m.exId] = { ...(t.ex[m.exId] || {}), series: m.para };
          else if (m.tipo === "remover") t.ex[m.exId] = { ...(t.ex[m.exId] || {}), remover: true };
          else {
            const base = slugify(m.nome); let id = base, i = 2;
            while (ids.has(id) || t.add.some((a) => a.id === id)) { id = `${base}-${i}`; i++; }
            t.add.push({ id, nome: m.nome, series: m.series, repeticoes: m.repeticoes, descricao: m.descricao || "", observacoes: "Reposição sugerida pelo ajuste da semana", videoUrl: m.videoUrl || "" });
          }
          d.sw.n++; n++;
        });
        d.sw.treinos[it.id] = t;
        grava(destino, d.s, d.sw);
      }
    } else if (it.tipo === "corrida") {
      planos = planos.map((p) => (p.id !== it.planoId ? p : {
        ...p,
        sessoes: p.sessoes.map((s, i) => {
          if (i !== it.idx) return s;
          const orig = { data: s.data, tipo: s.tipo, titulo: s.titulo, distanciaKm: s.distanciaKm, duracaoMin: s.duracaoMin, esforco: s.esforco, pace: s.pace, detalhes: s.detalhes, etapas: s.etapas, status: s.status };
          let novo = { ...s };
          const pular = on.find((m) => m.tipo === "pular");
          const mover = on.find((m) => m.tipo === "mover");
          const km = on.find((m) => m.tipo === "km");
          if (pular) { novo.status = "pulou"; }
          else {
            if (mover) novo.data = mover.para;
            if (km) {
              if (km.de && km.para !== km.de) { novo.distanciaKm = km.para; if (s.duracaoMin) novo.duracaoMin = Math.max(5, Math.round(s.duracaoMin * km.para / km.de)); }
              novo.etapas = [];
              if (km.leve) { novo.tipo = (s.tipo === "regenerativo" ? "regenerativo" : "rodagem"); novo.titulo = "Rodagem leve"; novo.esforco = "leve, conversando"; novo.pace = ""; }
              else novo.titulo = `${s.titulo} (ajustado)`;
            }
          }
          novo.detalhes = `Ajustado na semana: ${it.motivo || "para equilibrar a carga"}${s.detalhes ? ` · Antes: ${s.detalhes}` : ""}`.slice(0, 400);
          novo.ajuste = { id: adjId, orig };
          n += on.length;
          return novo;
        }),
      }));
    }
  });
  return { sessions, planos, n };
}
// Desfaz um ajuste inteiro (por id), em qualquer dia.
function semanaDesfazer(adjId, estado) {
  const sessions = { ...estado.sessions };
  Object.keys(sessions).forEach((iso) => {
    const s = sessions[iso];
    if (!s || !s.semana || s.semana.id !== adjId) return;
    const sw = s.semana;
    const same = (a, b) => a.tipo === b.tipo && a.id === b.id;
    const { semana, ...resto } = s;
    sessions[iso] = {
      ...resto,
      removed: (s.removed || []).filter((r) => !(sw.removidos || []).some((x) => same(x, r))),
      extras: (s.extras || []).filter((e) => !(sw.adicionados || []).some((x) => same(x, e))),
    };
  });
  const planos = (estado.planos || []).map((p) => ({
    ...p,
    sessoes: (p.sessoes || []).map((s) => {
      if (!s.ajuste || s.ajuste.id !== adjId) return s;
      const { ajuste, status, ...resto } = s;
      const o = ajuste.orig || {};
      const volta = { ...resto, ...o };
      if (o.status === undefined) delete volta.status;
      return volta;
    }),
  }));
  return { sessions, planos };
}

// --- Montar treinos de academia com IA (questionário guiado) ---
// A pessoa responde perguntas fechadas; a função `gerar-treino` monta o prompt (fechado) e a IA devolve
// fichas em JSON compacto. Aqui validamos, casamos os nomes com o catálogo e abrimos no construtor.
const TREINO_IA_OBJETIVOS = [["hipertrofia", "Ganhar massa"], ["emagrecimento", "Emagrecer"], ["forca", "Ganhar força"], ["condicionamento", "Condicionamento"], ["saude", "Saúde geral"]];
const TREINO_IA_NIVEIS = [["iniciante", "Iniciante"], ["intermediario", "Intermediário"], ["avancado", "Avançado"]];
const TREINO_IA_DURACOES = [30, 45, 60, 75, 90];
const TREINO_IA_LOCAIS = [["academia", "Academia completa"], ["casa_halteres", "Casa com halteres"], ["casa_sem", "Casa, sem equipamento"]];
const TREINO_IA_DIVISOES = [["auto", "Você decide"], ["fullbody", "Corpo todo"], ["upperlower", "Superior/inferior"], ["ppl", "Empurrar/puxar/pernas"], ["abc", "ABC"], ["abcd", "ABCD"]];
const TREINO_IA_FOCOS = [["peito", "Peito"], ["costas", "Costas"], ["ombro", "Ombros"], ["biceps", "Bíceps"], ["triceps", "Tríceps"], ["quad", "Quadríceps"], ["posterior", "Posterior"], ["gluteoPant", "Glúteo/panturrilha"], ["abdomen", "Abdômen"]];
const TREINO_IA_MAX_FICHAS = 7;
const TREINO_IA_MAX_EX = 14;

// Pedido enviado à função: só valores válidos e textos curtos; o catálogo vai por grupo para a IA usar os mesmos nomes.
function treinoIAMontarPedido(f) {
  const ok = (lista, v, pad) => (lista.some((x) => x[0] === v) ? v : pad);
  const dias = Math.max(1, Math.min(6, Math.round(Number(f.dias) || 3)));
  const catalogo = {};
  CATALOG_GRUPOS.forEach((g) => { catalogo[g.key] = EXERCISE_CATALOG_FLAT.filter((e) => e.grupo === g.label).map((e) => e.nome); });
  return {
    objetivo: ok(TREINO_IA_OBJETIVOS, f.objetivo, "hipertrofia"),
    nivel: ok(TREINO_IA_NIVEIS, f.nivel, "iniciante"),
    dias,
    duracao: TREINO_IA_DURACOES.indexOf(Number(f.duracao)) >= 0 ? Number(f.duracao) : 60,
    local: ok(TREINO_IA_LOCAIS, f.local, "academia"),
    divisao: ok(TREINO_IA_DIVISOES, f.divisao, "auto"),
    foco: (Array.isArray(f.foco) ? f.foco : []).filter((k) => TREINO_IA_FOCOS.some((x) => x[0] === k)).slice(0, 4),
    meta: String(f.meta || "").replace(/\s+/g, " ").trim().slice(0, 150),
    lesoes: String(f.lesoes || "").replace(/\s+/g, " ").trim().slice(0, 200),
    catalogo,
  };
}

// JSON da IA -> fichas no formato do construtor. Nomes do catálogo ganham descrição/vídeo; os demais ficam sinalizados.
function treinoIAExpandir(raw) {
  const out = { resumo: "", avisos: [], treinos: [], foraCatalogo: 0 };
  if (!raw || typeof raw !== "object") return out;
  out.resumo = typeof raw.resumo === "string" ? raw.resumo.trim().slice(0, 400) : "";
  (Array.isArray(raw.avisos) ? raw.avisos : []).forEach((x) => { if (typeof x === "string" && x.trim() && out.avisos.length < 5) out.avisos.push(x.trim().slice(0, 200)); });
  (Array.isArray(raw.fichas) ? raw.fichas : []).slice(0, TREINO_IA_MAX_FICHAS).forEach((f, i) => {
    if (!f || !Array.isArray(f.ex)) return;
    const blocos = [];
    const usados = new Set();
    f.ex.slice(0, TREINO_IA_MAX_EX).forEach((e) => {
      if (!Array.isArray(e) || typeof e[0] !== "string" || !e[0].trim()) return;
      const nomeIA = e[0].trim().slice(0, 80);
      const cat = histCasarExercicio(nomeIA, EXERCISE_CATALOG_FLAT);
      const nome = cat ? cat.nome : nomeIA;
      if (usados.has(histNorm(nome))) return;
      usados.add(histNorm(nome));
      const series = Math.max(1, Math.min(8, Math.round(Number(e[1]) || (cat && cat.series) || 3)));
      const reps = e[2] != null && String(e[2]).trim() ? String(e[2]).trim().slice(0, 14) : (cat && cat.repeticoes) || "10";
      const gk = CATALOG_GRUPOS.find((g) => g.key === e[3]);
      const grupo = cat ? cat.grupo : gk ? gk.label : "Exercícios";
      if (!cat) out.foraCatalogo++;
      let bl = blocos.find((b) => b.nome === grupo);
      if (!bl) { bl = { nome: grupo, exercicios: [] }; blocos.push(bl); }
      bl.exercicios.push({ nome, series, repeticoes: reps, descricao: cat ? cat.descricao || "" : "", observacoes: typeof e[4] === "string" ? e[4].trim().slice(0, 160) : "", videoUrl: cat ? cat.videoUrl || "" : "" });
    });
    if (!blocos.length) return;
    const nome = (typeof f.nome === "string" && f.nome.trim() ? f.nome.trim() : `Treino ${String.fromCharCode(65 + i)}`).slice(0, 60);
    const foco = typeof f.foco === "string" ? f.foco.trim().slice(0, 80) : "";
    const notas = [foco, typeof f.notas === "string" ? f.notas.trim().slice(0, 300) : ""].filter(Boolean).join(" — ");
    const min = Number(f.min);
    out.treinos.push({ nome, duracaoMin: min >= 10 && min <= 240 ? Math.round(min) : null, notas, blocos });
  });
  return out;
}

// --- Feedback dos usuários: grava em user_feedback (aparece no painel admin) e,
// se a função notificar-feedback estiver publicada com RESEND_API_KEY, manda e-mail. ---
const FEEDBACK_TIPOS = [
  { id: "ideia", e: "💡", rotulo: "Ideia" },
  { id: "problema", e: "🐞", rotulo: "Problema" },
  { id: "elogio", e: "👍", rotulo: "Elogio" },
  { id: "outro", e: "💬", rotulo: "Outro" },
];
function FeedbackModal({ onEnviar, onClose }) {
  const [tipo, setTipo] = useState("ideia");
  const [msg, setMsg] = useState("");
  const [contato, setContato] = useState(true);
  const [estado, setEstado] = useState("form"); // form | enviando | ok
  const [erro, setErro] = useState("");
  const ok = msg.trim().length >= 3;
  async function enviar() {
    if (!ok || estado === "enviando") return;
    setEstado("enviando"); setErro("");
    const r = await onEnviar({ tipo, mensagem: msg.trim(), contato });
    if (r && r.ok) setEstado("ok");
    else { setEstado("form"); setErro(r && r.limite ? "Você já enviou vários hoje. Tente de novo amanhã." : "Não consegui enviar. Tente de novo."); }
  }
  return (
    <div className="gt-modal-backdrop" onClick={onClose}>
      <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
        {estado === "ok" ? (
          <>
            <h3>Valeu! <Ei e="🙌" size={22} /></h3>
            <div className="gt-fb-hint">Recebi seu feedback. Eu leio tudo.</div>
            <div className="gt-modal-actions"><button className="gt-btn" onClick={onClose}>Fechar</button></div>
          </>
        ) : (
          <>
            <h3>Enviar feedback</h3>
            <div className="gt-fb-tipos">
              {FEEDBACK_TIPOS.map((t) => (
                <button key={t.id} type="button" className={`gt-fb-tipo ${tipo === t.id ? "on" : ""}`} onClick={() => setTipo(t.id)}><Ei e={t.e} /> {t.rotulo}</button>
              ))}
            </div>
            <textarea className="gt-input" rows={5} maxLength={2000} autoFocus placeholder={tipo === "problema" ? "O que aconteceu? Em que tela?" : "Conta pra gente…"} value={msg} onChange={(e) => setMsg(e.target.value)} />
            <label className="gt-fb-check"><input type="checkbox" checked={contato} onChange={(e) => setContato(e.target.checked)} /> Pode me responder por e-mail</label>
            {erro && <div className="gt-fb-erro">{erro}</div>}
            <div className="gt-modal-actions">
              <button className="gt-btn secondary" onClick={onClose}>Cancelar</button>
              <button className="gt-btn" disabled={!ok || estado === "enviando"} onClick={enviar}>{estado === "enviando" ? "Enviando…" : "Enviar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GerarTreinoIAModal({ getToken, onAbrirNoBuilder, onEvent, onErro, onClose }) {
  const [etapa, setEtapa] = useState("form"); // form | gerando | revisao
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState({ objetivo: "hipertrofia", nivel: "iniciante", dias: 3, duracao: 60, local: "academia", divisao: "auto", foco: [], meta: "", lesoes: "" });
  const [erro, setErro] = useState("");
  const [uso, setUso] = useState(null); // null carregando | false sem SQL | {usados, limite}
  const [res, setRes] = useState(null);
  const [seg, setSeg] = useState(0);
  const cancelRef = useRef(false);
  const vivoRef = useRef(true);
  useEffect(() => () => { vivoRef.current = false; cancelRef.current = true; }, []);
  useEffect(() => {
    let vivo = true;
    supabaseClient.rpc("ai_generation_usage", { p_kind: "treino", max_per_month: 5 })
      .then(({ data, error }) => { if (vivo) setUso(error || !data ? false : data); })
      .catch(() => { if (vivo) setUso(false); });
    return () => { vivo = false; };
  }, [etapa === "form"]);
  useEffect(() => {
    if (etapa !== "gerando") return;
    const t0 = performance.now();
    const id = setInterval(() => setSeg(Math.round((performance.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [etapa]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const semLimite = uso && uso.limite >= 1000;
  const podeUsar = uso && (semLimite || uso.usados < uso.limite);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const PASSOS = 4;

  async function gerar() {
    setErro("");
    let r;
    try {
      const resp = await supabaseClient.rpc("reserve_ai_generation", { p_kind: "treino", p_label: "treino academia", max_per_month: 5 });
      if (resp.error || !resp.data) { setUso(false); setErro("A montagem com IA ainda não está disponível. Tente mais tarde."); return; }
      r = resp.data;
    } catch (e) { setErro("Sem conexão. Tente de novo."); return; }
    if (!r.ok) { setUso({ usados: r.usados, limite: r.limite }); setErro(`Você já usou as ${r.limite} montagens deste mês.`); return; }
    cancelRef.current = false;
    setSeg(0); setEtapa("gerando");
    onEvent("treino_ia_iniciado");
    const falhar = async (codigo, msg, mostrar) => {
      onErro(codigo, msg);
      try { await supabaseClient.rpc("refund_plan_generation", { p_id: r.id }); } catch (e) {}
      if (!vivoRef.current) return;
      setErro(`${mostrar || "Não consegui montar agora."} Esta tentativa não conta no seu limite.`);
      setEtapa("form"); setPasso(PASSOS - 1);
    };
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gerar-treinos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ reserva: r.id, ...treinoIAMontarPedido(f) }),
      });
      let obj = null;
      try { obj = JSON.parse(await resp.text()); } catch (e) {}
      if (!obj || !obj.ok || !obj.job) { await falhar("treino_ia", obj && obj.erro ? obj.erro : `resp_${resp.status}`, obj && obj.mensagem); return; }
      for (let t = 0; t < 130 && !cancelRef.current; t++) {
        await dormir(t === 0 ? 2000 : 2500);
        const { data, error } = await supabaseClient.from("ai_jobs").select("status,result").eq("id", obj.job).maybeSingle();
        if (error || !data || data.status === "rodando") continue;
        if (data.status !== "pronto" || !data.result || !data.result.texto) { await falhar("treino_ia_job", `${(data.result && data.result.erro) || data.status}`, data.result && data.result.mensagem); return; }
        const parsed = histParse(data.result.texto);
        const ex = parsed ? treinoIAExpandir(parsed) : null;
        if (!ex || !ex.treinos.length) { await falhar("treino_ia_vazio", "sem_fichas", "A IA devolveu algo que não consegui ler."); return; }
        if (!vivoRef.current) return;
        setRes(ex); setEtapa("revisao");
        onEvent("treino_ia_pronto");
        return;
      }
      if (!cancelRef.current) await falhar("treino_ia_timeout", "timeout", "Demorou demais.");
    } catch (e) {
      await falhar("treino_ia_rede", e && e.message, "Não consegui falar com o servidor.");
    }
  }

  function fechar() {
    if (etapa === "gerando") {
      if (!window.confirm("Cancelar? Esta montagem já foi contada no seu limite deste mês.")) return;
      cancelRef.current = true;
    }
    onClose();
  }
  const pill = (ativo, onClick, txt, key) => <button key={key} type="button" className={`gt-provas-pill ${ativo ? "on" : ""}`} onClick={onClick}>{txt}</button>;
  const toggleFoco = (k) => set("foco", f.foco.includes(k) ? f.foco.filter((x) => x !== k) : f.foco.length >= 4 ? f.foco : [...f.foco, k]);

  return (
    <div className="gt-modal-backdrop" onClick={fechar}>
      <div className="gt-modal gt-plano-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gt-provas-head">
          <h3><Ei e="✨" /> Montar treino com IA</h3>
          <button type="button" className="gt-provas-close" onClick={fechar} title="Fechar">✕</button>
        </div>

        {etapa === "form" && (
          <div className="gt-plano-form">
            <div className="gt-plano-dica">Pergunta {passo + 1} de {PASSOS}</div>
            {passo === 0 && (
              <>
                <label className="gt-plano-lbl">Qual é o seu objetivo?</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{TREINO_IA_OBJETIVOS.map(([id, nm]) => pill(f.objetivo === id, () => set("objetivo", id), nm, id))}</div>
                <label className="gt-plano-lbl">Seu nível na musculação</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{TREINO_IA_NIVEIS.map(([id, nm]) => pill(f.nivel === id, () => set("nivel", id), nm, id))}</div>
              </>
            )}
            {passo === 1 && (
              <>
                <label className="gt-plano-lbl">Quantos treinos por semana?</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{[1, 2, 3, 4, 5, 6].map((n) => pill(f.dias === n, () => set("dias", n), String(n), n))}</div>
                <label className="gt-plano-lbl">Quanto tempo você tem por treino?</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{TREINO_IA_DURACOES.map((n) => pill(f.duracao === n, () => set("duracao", n), `${n} min`, n))}</div>
                <label className="gt-plano-lbl">Divisão dos treinos</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{TREINO_IA_DIVISOES.map(([id, nm]) => pill(f.divisao === id, () => set("divisao", id), nm, id))}</div>
              </>
            )}
            {passo === 2 && (
              <>
                <label className="gt-plano-lbl">Onde você vai treinar?</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{TREINO_IA_LOCAIS.map(([id, nm]) => pill(f.local === id, () => set("local", id), nm, id))}</div>
                <label className="gt-plano-lbl">Quer dar mais atenção a algum grupo? (até 4, opcional)</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>{TREINO_IA_FOCOS.map(([id, nm]) => pill(f.foco.includes(id), () => toggleFoco(id), nm, id))}</div>
              </>
            )}
            {passo === 3 && (
              <>
                <label className="gt-plano-lbl">Tem alguma meta ou prazo? (opcional)</label>
                <input className="gt-input" placeholder="Ex.: perder 5 kg até dezembro, supino com 80 kg" maxLength={150} value={f.meta} onChange={(e) => set("meta", e.target.value)} />
                <label className="gt-plano-lbl">Lesão ou limitação? (opcional)</label>
                <input className="gt-input" placeholder="Ex.: dor no ombro direito, joelho operado" maxLength={200} value={f.lesoes} onChange={(e) => set("lesoes", e.target.value)} />
                <div className="gt-plano-foot">Você confere e edita tudo antes de salvar. A IA sugere exercícios; não substitui orientação de um profissional.</div>
              </>
            )}
            {erro && <div className="gt-plano-erro">{erro}</div>}
            {passo === PASSOS - 1 && uso === false && <div className="gt-plano-aviso aviso">Este recurso ainda não foi ativado neste app.</div>}
            {passo === PASSOS - 1 && uso && !semLimite && <div className="gt-plano-dica" style={{ textAlign: "center" }}>{podeUsar ? `Restam ${uso.limite - uso.usados} de ${uso.limite} montagens neste mês.` : `Você já usou as ${uso.limite} montagens deste mês.`}</div>}
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              {passo < PASSOS - 1
                ? <button type="button" className="gt-btn" onClick={() => setPasso(passo + 1)}>Continuar</button>
                : <button type="button" className="gt-btn" disabled={!podeUsar} onClick={gerar}>Montar meus treinos</button>}
              {passo > 0 ? <button type="button" className="gt-btn secondary" onClick={() => setPasso(passo - 1)}>Voltar</button> : <button type="button" className="gt-btn secondary" onClick={onClose}>Fechar</button>}
            </div>
          </div>
        )}

        {etapa === "gerando" && (
          <div className="gt-run" role="status" aria-live="polite">
            <div style={{ fontSize: 34, marginTop: 6 }}><Ei e="🏋️" size={40} /></div>
            <div className="gt-run-t">{seg}s</div>
            <div className="gt-run-msg">Montando {f.dias === 1 ? "o seu treino" : `os seus ${f.dias} treinos`}… costuma levar de 20 a 60 segundos.</div>
            <div className="gt-plano-dica" style={{ marginTop: 10 }}>Mantenha esta tela aberta.</div>
            <div className="gt-modal-actions" style={{ marginTop: 14 }}><button type="button" className="gt-btn secondary" onClick={fechar}>Cancelar</button></div>
          </div>
        )}

        {etapa === "revisao" && res && (
          <div className="gt-plano-form">
            <div className="gt-plano-aviso info"><b>Proposta pronta.</b> Nada foi salvo ainda — você revisa e ajusta no próximo passo.</div>
            {res.resumo && <div className="gt-plano-dica">{res.resumo}</div>}
            {res.treinos.map((t, i) => (
              <div className="gt-tc-item" key={i}>
                <div className="ti">{t.nome}</div>
                <div className="mt">{t.blocos.reduce((s, b) => s + b.exercicios.length, 0)} exercícios{t.duracaoMin ? ` · ~${t.duracaoMin} min` : ""}</div>
                <div className="mt">{t.blocos.map((b) => b.exercicios.map((e) => `${e.nome} ${e.series}x${e.repeticoes}`).join(", ")).join(", ")}</div>
              </div>
            ))}
            {res.foraCatalogo > 0 && <div className="gt-plano-aviso aviso">{res.foraCatalogo} {res.foraCatalogo === 1 ? "exercício não está" : "exercícios não estão"} no catálogo do app (ficam sem vídeo/descrição).</div>}
            {res.avisos.map((a, i) => <div className="gt-plano-aviso aviso" key={i}>{a}</div>)}
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gt-btn" onClick={() => { onEvent("treino_ia_aberto_builder"); onAbrirNoBuilder(res.treinos); }}>Revisar e salvar</button>
              <button type="button" className="gt-btn secondary" onClick={() => { setRes(null); setEtapa("form"); setPasso(PASSOS - 1); }}>Voltar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AjustarSemanaModal({ fatosBase, gerarFatos, treinoById, sessions, getToken, onAplicar, onDesfazer, onEvent, onErro, onClose }) {
  const [etapa, setEtapa] = useState("contexto"); // contexto | gerando | relatorio | aplicado
  const [hojeFora, setHojeFora] = useState(false);
  const fatos = useMemo(() => (hojeFora ? gerarFatos({ hojeFora: true }) : fatosBase), [hojeFora, fatosBase]);
  const temHoje = fatosBase.restantes.some((r) => r.iso === fatosBase.hojeISO && r.tipo !== "atividade");
  const [bem, setBem] = useState("nao_informado");
  const [onde, setOnde] = useState("");
  const [erro, setErro] = useState("");
  const [uso, setUso] = useState(null); // null carregando | false sem SQL | {usados, limite}
  const [prop, setProp] = useState(null);
  const [seg, setSeg] = useState(0);
  const [aplicado, setAplicado] = useState(null);
  const [ativo, setAtivo] = useState(fatosBase.ajusteAtivo);
  const cancelRef = useRef(false);
  const vivoRef = useRef(true);
  useEffect(() => () => { vivoRef.current = false; cancelRef.current = true; }, []);
  useEffect(() => {
    let vivo = true;
    supabaseClient.rpc("ai_generation_usage", { p_kind: "ajuste_semana", max_per_month: 6 })
      .then(({ data, error }) => { if (vivo) setUso(error || !data ? false : data); })
      .catch(() => { if (vivo) setUso(false); });
    return () => { vivo = false; };
  }, [etapa === "contexto"]);
  useEffect(() => {
    if (etapa !== "gerando") return;
    const t0 = performance.now();
    const id = setInterval(() => setSeg(Math.round((performance.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [etapa]);
  const semLimite = uso && uso.limite >= 1000;
  const podeUsar = uso && (semLimite || uso.usados < uso.limite);
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}`;

  async function analisar() {
    setErro("");
    let r;
    try {
      const resp = await supabaseClient.rpc("reserve_ai_generation", { p_kind: "ajuste_semana", p_label: "ajuste da semana", max_per_month: 6 });
      if (resp.error || !resp.data) { setUso(false); setErro("O ajuste com IA ainda não está disponível. Tente mais tarde."); return; }
      r = resp.data;
    } catch (e) { setErro("Sem conexão. Tente de novo."); return; }
    if (!r.ok) { setUso({ usados: r.usados, limite: r.limite }); setErro(`Você já usou os ${r.limite} ajustes deste mês.`); return; }
    cancelRef.current = false;
    setSeg(0); setEtapa("gerando");
    onEvent("semana_ia_iniciado");
    const falhar = async (codigo, msg, mostrar) => {
      onErro(codigo, msg);
      try { await supabaseClient.rpc("refund_plan_generation", { p_id: r.id }); } catch (e) {}
      if (!vivoRef.current) return;
      setErro(`${mostrar || "Não consegui analisar agora."} Esta tentativa não conta no seu limite.`);
      setEtapa("contexto");
    };
    try {
      const catalogo = {};
      CATALOG_GRUPOS.forEach((g) => { catalogo[g.key] = EXERCISE_CATALOG_FLAT.filter((e) => e.grupo === g.label).map((e) => e.nome); });
      const pay = semanaPayload(fatos, {});
      const exPorRef = semanaExerciciosRestantes(fatos, treinoById, sessions);
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/ajustar-semana`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ reserva: r.id, hoje: fatos.hojeISO, dia: SEMANA_DIAS[weekdayOf(fatos.hojeISO)], bem, dor: bem === "dolorido" ? onde : "", passado: pay.passado, restante: pay.restante, perdidos: pay.perdidos, exercicios: exPorRef, catalogo }),
      });
      let obj = null;
      try { obj = JSON.parse(await resp.text()); } catch (e) {}
      if (!obj || !obj.ok || !obj.job) { await falhar("semana_ia", obj && obj.erro ? obj.erro : `resp_${resp.status}`, obj && obj.mensagem); return; }
      for (let t = 0; t < 110 && !cancelRef.current; t++) {
        await dormir(t === 0 ? 2000 : 2500);
        const { data, error } = await supabaseClient.from("ai_jobs").select("status,result").eq("id", obj.job).maybeSingle();
        if (error || !data || data.status === "rodando") continue;
        if (data.status !== "pronto" || !data.result || !data.result.texto) { await falhar("semana_ia_job", `${(data.result && data.result.erro) || data.status}`, data.result && data.result.mensagem); return; }
        const parsed = histParse(data.result.texto);
        const p = parsed ? semanaValidarProposta(parsed, fatos, exPorRef) : null;
        if (!p || !p.itens.length) { await falhar("semana_ia_vazio", "sem_itens", "A IA devolveu algo que não consegui ler."); return; }
        if (!vivoRef.current) return;
        setProp(p); setEtapa("relatorio");
        onEvent("semana_ia_pronto");
        return;
      }
      if (!cancelRef.current) await falhar("semana_ia_timeout", "timeout", "Demorou demais.");
    } catch (e) {
      await falhar("semana_ia_rede", e && e.message, "Não consegui falar com o servidor.");
    }
  }

  function fechar() {
    if (etapa === "gerando") {
      if (!window.confirm("Cancelar? Esta análise já foi contada no seu limite deste mês.")) return;
      cancelRef.current = true;
    }
    onClose();
  }
  const editar = (ref, mid, patch) => setProp((p) => ({ ...p, itens: p.itens.map((it) => (it.ref !== ref ? it : { ...it, mudancas: it.mudancas.map((m) => (m.id !== mid ? m : { ...m, ...patch })) })) }));
  const todas = (ref, on) => setProp((p) => ({ ...p, itens: p.itens.map((it) => (it.ref !== ref ? it : { ...it, mudancas: it.mudancas.map((m) => ({ ...m, on })) })) }));
  const nAtivas = prop ? prop.itens.reduce((t, it) => t + it.mudancas.filter((m) => m.on).length, 0) : 0;
  const cont = { fica: 0, muda: 0, sai: 0, repoe: 0 };
  if (prop) prop.itens.forEach((it) => { if (it.perdido) { if (it.mudancas.some((m) => m.on)) cont.repoe++; } else cont[semanaStatusItem(it)]++; });
  const temPerdidos = !!prop && prop.itens.some((it) => it.perdido);
  const BADGE = { fica: "Fica", muda: "Muda", sai: "Sai" };
  const VEREDITO = { manter: ["✅", "Manter a semana"], aliviar: ["🌿", "Aliviar a semana"], reorganizar: ["🔀", "Reorganizar a semana"] };

  function aplicar() {
    const r = onAplicar(prop);
    setAplicado(r); setAtivo({ id: r.id, n: r.n });
    onEvent("semana_ia_aplicado");
    setEtapa("aplicado");
  }
  const iconeItem = (it, d) => (it.status === "feito" ? "✅" : it.status === "parcial" ? "◐" : d.iso < fatos.hojeISO ? "✕" : "○");

  return (
    <div className="gt-modal-backdrop" onClick={fechar}>
      <div className="gt-modal gt-plano-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gt-provas-head">
          <h3><Ei e="🔧" /> Ajustar minha semana</h3>
          <button type="button" className="gt-provas-close" onClick={fechar} title="Fechar">✕</button>
        </div>

        {etapa === "contexto" && (
          <div className="gt-plano-form">
            <div className="gt-plano-dica">A IA olha o que você fez até agora e sugere o que manter, reduzir ou tirar nos treinos que ainda restam. Você confere e edita tudo antes de aceitar.</div>
            <label className="gt-plano-lbl">Como foi a sua semana</label>
            <div>
              {fatos.dias.filter((d) => d.itens.length).map((d) => (
                <div className="gt-sem-linha" key={d.iso}>
                  <div className="d">{d.hoje ? "Hoje" : d.nome.slice(0, 3)} {d.iso.slice(8)}</div>
                  <div className="it">{d.itens.map((it, i) => (
                    <div key={i}><Ei e={iconeItem(it, d)} /> {it.nome}{it.extra ? <> <Ei e="🔥" /></> : ""}{(it.status === "feito" || it.status === "parcial") && it.min ? ` · ${it.min} min${it.rpe ? `, esforço ${it.rpe}` : ""}` : ""}{it.status === "pendente" && d.iso < fatos.hojeISO ? " · faltou" : ""}</div>
                  ))}</div>
                </div>
              ))}
            </div>
            <div className="gt-plano-dica"><Ei e="✅" /> feito · ◐ parcial · ✕ faltou · ○ ainda por vir · <Ei e="🔥" /> fora do planejado</div>
            {fatos.sinais.length > 0 && fatos.sinais.map((s, i) => <div className="gt-plano-aviso aviso" key={i}>{s.texto}</div>)}
            {fatos.sinais.length === 0 && <div className="gt-plano-aviso info">Sua semana está seguindo o planejado. Dá para pedir um ajuste mesmo assim.</div>}
            {temHoje && (
              <label className="gt-plano-chk" style={{ alignItems: "center" }}>
                <input type="checkbox" checked={hojeFora} onChange={(e) => setHojeFora(e.target.checked)} />
                <span>Não vou treinar hoje (ajudar a repor nos outros dias)</span>
              </label>
            )}
            <label className="gt-plano-lbl">Como está o seu corpo? (opcional)</label>
            <div className="gt-provas-filters" style={{ margin: 0 }}>
              {[["nao_informado", "Prefiro não dizer"], ["otimo", "Ótimo"], ["cansado", "Cansado"], ["dolorido", "Dolorido"]].map(([id, nm]) => <button key={id} type="button" className={`gt-provas-pill ${bem === id ? "on" : ""}`} onClick={() => setBem(id)}>{nm}</button>)}
            </div>
            {bem === "dolorido" && <input className="gt-input" placeholder="Onde? Ex.: ombro direito, quadríceps" maxLength={60} value={onde} onChange={(e) => setOnde(e.target.value)} />}
            {ativo && (
              <div className="gt-plano-aviso info">
                Você já ajustou esta semana ({ativo.n} {ativo.n === 1 ? "mudança" : "mudanças"}). Para pedir outro ajuste, desfaça o atual primeiro.
                <div className="gt-modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="gt-btn secondary small" onClick={() => { onDesfazer(ativo.id); setAtivo(null); onEvent("semana_ia_desfeito"); }}>Desfazer o ajuste atual</button>
                </div>
              </div>
            )}
            {fatos.ajustaveis.length === 0 && !(fatos.perdidosItens || []).length && !ativo && <div className="gt-plano-aviso aviso">Não há treinos de musculação nem corridas restantes nesta semana para ajustar.</div>}
            {erro && <div className="gt-plano-erro">{erro}</div>}
            {uso === false && <div className="gt-plano-aviso aviso">O ajuste com IA ainda não foi ativado neste app.</div>}
            {uso && !semLimite && <div className="gt-plano-dica" style={{ textAlign: "center" }}>{podeUsar ? `Restam ${uso.limite - uso.usados} de ${uso.limite} ajustes neste mês.` : `Você já usou os ${uso.limite} ajustes deste mês.`}</div>}
            <div className="gt-plano-foot">A IA sugere; não substitui orientação de um profissional. Dor forte ou persistente merece avaliação.</div>
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gt-btn" disabled={!podeUsar || !!ativo || (fatos.ajustaveis.length === 0 && !(fatos.perdidosItens || []).length) || (bem === "dolorido" && !onde.trim())} onClick={analisar}>Analisar minha semana</button>
              <button type="button" className="gt-btn secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}

        {etapa === "gerando" && (
          <div className="gt-run" role="status" aria-live="polite">
            <div style={{ fontSize: 34, marginTop: 6 }}><Ei e="🔧" size={40} /></div>
            <div className="gt-run-t">{seg}s</div>
            <div className="gt-run-msg">Analisando o que você fez e o que ainda falta… costuma levar de 15 a 40 segundos.</div>
            <div className="gt-plano-dica" style={{ marginTop: 10 }}>Mantenha esta tela aberta.</div>
            <div className="gt-modal-actions" style={{ marginTop: 14 }}><button type="button" className="gt-btn secondary" onClick={fechar}>Cancelar</button></div>
          </div>
        )}

        {etapa === "relatorio" && prop && (
          <div className="gt-plano-form">
            <div className="gt-sem-head">
              <div className="ic"><Ei e={(VEREDITO[prop.veredito] || VEREDITO.aliviar)[0]} size={28} /></div>
              <div>
                <div className="k">{(VEREDITO[prop.veredito] || VEREDITO.aliviar)[1]}</div>
                <div className="t">{prop.titulo || "Veja o que fica e o que muda"}</div>
              </div>
            </div>
            {prop.motivos.length > 0 && <ul className="gt-sem-motivos">{prop.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>}
            <div className="gt-sem-cont">
              <span className="fica"><b>{cont.fica}</b> fica</span><span className="muda"><b>{cont.muda}</b> muda</span><span className="sai"><b>{cont.sai}</b> sai</span>{temPerdidos && <span className="repoe"><b>{cont.repoe}</b> repõe</span>}
            </div>
            {prop.itens.map((it) => {
              const st = semanaStatusItem(it);
              return (
                <div className={`gt-sem-card ${st}`} key={it.ref}>
                  <div className="gt-sem-card-hd">
                    <div><div className="dia">{it.dia} · {fmt(it.iso)}{it.perdido ? " · perdido" : ""}</div><div className="nm"><Ei e={it.tipo === "corrida" ? "🏃" : "🏋️"} /> {it.nome}</div></div>
                    <span className={`gt-sem-badge ${it.perdido ? (st === "fica" ? "sai" : "muda") : st}`}>{it.perdido ? (st === "fica" ? "Fica de fora" : "Repor") : BADGE[st]}</span>
                  </div>
                  {it.motivo && st !== "fica" && <div className="gt-sem-motivo">{it.motivo}</div>}
                  {it.mudancas.length === 0 && <div className="gt-sem-motivo">{it.motivo || (it.perdido ? "Sem reposição sugerida: este treino fica de fora da semana." : "Sem mudança: segue como está.")}</div>}
                  {it.mudancas.map((m) => (
                    <div className="gt-sem-mud" key={m.id}>
                      <label className="gt-plano-chk" style={{ flex: 1, alignItems: "center" }}>
                        <input type="checkbox" checked={m.on} onChange={(e) => editar(it.ref, m.id, { on: e.target.checked })} />
                        <span style={{ color: m.on ? "var(--text)" : "var(--text-muted)", textDecoration: m.on ? "none" : "line-through" }}>{semanaTextoMudanca(m, it)}</span>
                      </label>
                      {m.tipo === "series" && m.on && (
                        <span className="gt-sem-step">
                          <button type="button" disabled={m.para <= 1} onClick={() => editar(it.ref, m.id, { para: m.para - 1 })}>−</button>
                          <b>{m.para}</b>
                          <button type="button" disabled={m.para >= Math.min(6, m.de + 1)} onClick={() => editar(it.ref, m.id, { para: m.para + 1 })}>+</button>
                        </span>
                      )}
                      {m.tipo === "km" && m.on && m.de > 0 && m.para !== m.de && (
                        <span className="gt-sem-step">
                          <button type="button" disabled={m.para - 0.5 < Math.round(m.de * 0.4 * 10) / 10} onClick={() => editar(it.ref, m.id, { para: Math.round((m.para - 0.5) * 10) / 10 })}>−</button>
                          <b>{String(m.para).replace(".", ",")}</b>
                          <button type="button" disabled={m.para + 0.5 >= m.de} onClick={() => editar(it.ref, m.id, { para: Math.round((m.para + 0.5) * 10) / 10 })}>+</button>
                        </span>
                      )}
                    </div>
                  ))}
                  {it.mudancas.length > 0 && (
                    <button type="button" className="gt-sem-link" onClick={() => todas(it.ref, !it.mudancas.some((m) => m.on))}>{it.mudancas.some((m) => m.on) ? "Manter este dia como está" : "Voltar à sugestão"}</button>
                  )}
                </div>
              );
            })}
            {fatos.restantes.some((r) => r.tipo === "atividade") && (
              <div className="gt-sem-fixos">Não mudam: {fatos.restantes.filter((r) => r.tipo === "atividade").map((r) => `${r.nome} (${r.dia})`).join(", ")}. Atividades fora do app só entram na conta da carga.</div>
            )}
            <div className="gt-plano-foot">O ajuste vale só para esta semana e não altera suas fichas. Dá para desfazer depois.</div>
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gt-btn" disabled={nAtivas === 0} onClick={aplicar}>{nAtivas === 0 ? "Nenhuma mudança marcada" : `Aplicar ${nAtivas} ${nAtivas === 1 ? "mudança" : "mudanças"}`}</button>
              <button type="button" className="gt-btn secondary" onClick={onClose}>Não aplicar</button>
            </div>
          </div>
        )}

        {etapa === "aplicado" && aplicado && (
          <div className="gt-plano-form">
            <div className="gt-plano-aviso info"><b>Pronto!</b> {aplicado.n} {aplicado.n === 1 ? "mudança aplicada" : "mudanças aplicadas"} nos treinos da semana. Eles aparecem com a marca "ajustado" na aba Hoje. Perder um treino não muda a sua evolução; o que conta é a consistência.</div>
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gt-btn" onClick={onClose}>Ver minha semana</button>
              <button type="button" className="gt-btn secondary" onClick={() => { onDesfazer(aplicado.id); setAplicado(null); setAtivo(null); onEvent("semana_ia_desfeito"); setEtapa("contexto"); }}>Desfazer ajuste</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

let runnerAnimCache = null;
function GerandoIA({ seg, estimativa, pronto, mensagens }) {
  const lottieRef = useRef(null);
  const [lottieOk, setLottieOk] = useState(false);
  // Corredor animado (Lottie, runner.json). Se a biblioteca ou o arquivo não carregarem, fica o desenho em SVG.
  useEffect(() => {
    if (!window.lottie || !lottieRef.current) return;
    let anim = null, vivo = true;
    const dados = runnerAnimCache ? Promise.resolve(runnerAnimCache) : fetch("runner.json").then((r) => r.json()).then((j) => (runnerAnimCache = j));
    dados.then((animationData) => {
      if (!vivo || !lottieRef.current) return;
      anim = window.lottie.loadAnimation({ container: lottieRef.current, renderer: "svg", loop: true, autoplay: true, animationData });
      setLottieOk(true);
    }).catch(() => {});
    return () => { vivo = false; if (anim) anim.destroy(); };
  }, []);
  const restante = estimativa - seg;
  const passou = restante <= 0;
  const frac = Math.min(1, seg / estimativa);
  const pct = pronto ? 100 : Math.min(95, Math.round((frac < 0.5 ? frac * 1.4 : 0.7 + (frac - 0.5) * 0.5) * 100));
  const msgs = mensagens || [];
  const msg = pronto ? "Plano pronto ✓" : passou ? "Quase lá… só mais um pouquinho" : msgs[Math.min(msgs.length - 1, Math.floor(frac * msgs.length))] || "";
  const fmt = (n) => `${Math.floor(Math.abs(n) / 60)}:${String(Math.abs(n) % 60).padStart(2, "0")}`;
  return (
    <div className="gt-run" role="status" aria-live="polite">
      <div className="gt-run-lottie" ref={lottieRef} aria-hidden="true" style={lottieOk ? undefined : { display: "none" }} />
      {!lottieOk && <svg viewBox="0 0 160 108" aria-hidden="true">
        <ellipse className="rn-shadow" cx="72" cy="101" rx="24" ry="3.5" fill="#000" />
        <line className="rn-ground" x1="0" y1="104" x2="160" y2="104" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14 16" />
        <g className="rn-wind" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round"><line x1="20" y1="40" x2="40" y2="40" /><line x1="10" y1="56" x2="34" y2="56" /><line x1="24" y1="72" x2="40" y2="72" /></g>
        <g className="rn-body">
          <g className="legB" opacity="0.8"><g className="j hip"><line x1="70" y1="60" x2="70" y2="80" stroke="#E5B089" strokeWidth="9" strokeLinecap="round" /><g className="j knee"><line x1="70" y1="80" x2="70" y2="98" stroke="#E5B089" strokeWidth="8" strokeLinecap="round" /><path d="M64 97 q6 -4 15 -1 q3 2 0 5 h-15 z" fill="#E9EDF2" /></g></g></g>
          <g className="armB" opacity="0.8"><g className="j sho"><line x1="79" y1="36" x2="79" y2="52" stroke="#E5B089" strokeWidth="6" strokeLinecap="round" /><g className="j elb" transform="rotate(-85)"><line x1="79" y1="52" x2="79" y2="67" stroke="#E5B089" strokeWidth="5.5" strokeLinecap="round" /></g></g></g>
          <path d="M62 62 Q66 40 78 32 L88 40 Q80 50 82 62 Z" fill="var(--accent)" />
          <path d="M61 58 h24 l1 10 q-13 4 -26 0 z" fill="#2B3445" />
          <circle cx="88" cy="20" r="12" fill="#F2C29B" />
          <path d="M76 18 Q77 6 90 7 Q99 8 99 15 Q90 10 82 17 Z" fill="#3B2A20" />
          <rect x="77" y="14" width="23" height="4" rx="2" fill="#fff" transform="rotate(-6 88 16)" />
          <circle cx="94" cy="21" r="1.6" fill="#2a2018" />
          <path d="M93 27 q3 1.5 6 -0.5" stroke="#B5694A" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <g className="legA"><g className="j hip"><line x1="70" y1="60" x2="70" y2="80" stroke="#F2C29B" strokeWidth="9" strokeLinecap="round" /><g className="j knee"><line x1="70" y1="80" x2="70" y2="98" stroke="#F2C29B" strokeWidth="8" strokeLinecap="round" /><path d="M64 97 q6 -4 15 -1 q3 2 0 5 h-15 z" fill="#fff" stroke="#cfd6df" strokeWidth="0.8" /></g></g></g>
          <g className="armA"><g className="j sho"><line x1="79" y1="36" x2="79" y2="52" stroke="#F2C29B" strokeWidth="6.5" strokeLinecap="round" /><g className="j elb" transform="rotate(-85)"><line x1="79" y1="52" x2="79" y2="67" stroke="#F2C29B" strokeWidth="5.5" strokeLinecap="round" /></g></g></g>
        </g>
      </svg>}
      <div className="gt-run-t gt-gerando-tempo">{pronto ? "✓" : passou ? `+${fmt(-restante)}` : fmt(restante)}</div>
      <div className={`gt-run-bar ${passou && !pronto ? "ind" : ""}`}><i style={passou && !pronto ? undefined : { width: pct + "%" }} /></div>
      <div className="gt-run-msg">{msg}</div>
      <div className="gt-plano-dica" style={{ marginTop: 10 }}>{pronto ? "" : "Pode levar de 1 a 2 minutos. Pode sair desta tela: a geração continua e avisamos quando o plano estiver pronto."}</div>
    </div>
  );
}

function PlanoCorridaModal({ prova: provaProp, hojeISO, schedule, sessions, atividadeById, stravaConnected, planoExistente, modoReplan, usoIA, job, onIniciarIA, onDescartarJob, retomar, onSave, onDelete, onOpenSettings, onEvent, onClose }) {
  const F = (retomar && retomar.ctx && retomar.ctx.form) || {}; // valores do formulário ao retomar um plano gerado em segundo plano
  const ehMeta = !!provaProp.meta;
  const metaNova = ehMeta && !planoExistente;
  const [metaTipo, setMetaTipo] = useState(F.metaTipo || "distancia"); // distancia | tempo | habito
  const [metaKm, setMetaKm] = useState(F.metaKm || "");
  const [metaTempo, setMetaTempo] = useState(F.metaTempo || "");
  const [metaAtual, setMetaAtual] = useState(F.metaAtual || ""); // tempo atual na distância da meta
  const [metaData, setMetaData] = useState(F.metaData || "");
  const [metaSem, setMetaSem] = useState(F.metaSem || 8);
  const metaKmNum = parseFloat(String(metaKm).replace(",", ".")) || 0;
  const fmtKm = (n) => String(n).replace(".", ",");
  const metaDataEf = metaTipo === "habito" ? addDays(hojeISO, metaSem * 7) : metaData;
  const metaNome = metaTipo === "distancia" ? `Correr ${fmtKm(metaKmNum || "…")} km` : metaTipo === "tempo" ? `${fmtKm(metaKmNum || "…")} km em ${metaTempo.trim() || "…"}` : `Rotina de corrida · ${metaSem} semanas`;
  const prova = metaNova ? { ...provaProp, nome: metaNome, data_inicio: metaDataEf || "", kmEscolhido: metaKmNum } : provaProp;
  const distancias = planoDistanciasDaProva(prova);
  const semanas = prova.data_inicio ? planoSemanasAte(hojeISO, prova.data_inicio) : 0;
  const diasAcademia = useMemo(() => planoDiasAcademia(schedule), [schedule]);
  const hist = useMemo(() => planoHistoricoCorrida(sessions, atividadeById, hojeISO, 8), [sessions, hojeISO]);
  const [etapa, setEtapa] = useState(retomar ? "form" : planoExistente && !modoReplan ? "ver" : metaNova ? "meta" : "form");
  const [replan, setReplan] = useState(!!(modoReplan && planoExistente));
  const sit = useMemo(() => (planoExistente ? planoSituacao(planoExistente, hojeISO, (d) => planoCorridaFeitaNoDia(sessions, atividadeById, d), provaProp.data_inicio) : null), [planoExistente, sessions, hojeISO]);
  const [distKm, setDistKm] = useState(F.distKm != null ? F.distKm : prova.kmEscolhido > 0 ? String(prova.kmEscolhido).replace(".", ",") : distancias.length ? String(distancias[0]).replace(".", ",") : "");
  const [confortavel, setConfortavel] = useState(F.confortavel != null ? F.confortavel : hist ? String(hist.confortavelKm).replace(".", ",") : "");
  const [paceTxt, setPaceTxt] = useState(F.paceTxt != null ? F.paceTxt : hist && hist.paceMin ? planoFmtPace(hist.paceMin) : "");
  const [objetivo, setObjetivo] = useState(F.objetivo || "completar");
  const [tempoAlvo, setTempoAlvo] = useState(F.tempoAlvo || "");
  const [lesoes, setLesoes] = useState(F.lesoes || "");
  const [usaRelogio, setUsaRelogio] = useState(F.usaRelogio != null ? F.usaRelogio : true);
  const [mantemConflito, setMantemConflito] = useState(!!F.mantemConflito);
  const distNum = parseFloat(String(distKm).replace(",", ".")) || 0;
  const confNum = parseFloat(String(confortavel).replace(",", ".")) || 0;
  const rec = distNum > 0 ? planoRecomendarDias(distNum, semanas, objetivo, confNum) : null;
  const [dias, setDias] = useState(() => {
    if (Array.isArray(F.dias) && F.dias.length) return F.dias;
    const r0 = distNum > 0 ? planoRecomendarDias(distNum, semanas, "completar", confNum) : { ideal: 3 };
    return planoSugerirDias(r0.ideal, planoDiasAcademia(schedule), []).dias;
  });
  const [erro, setErro] = useState("");
  const [colado, setColado] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [previa, setPrevia] = useState(null); // { plano, validacao }
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [abertas, setAbertas] = useState({});
  const [ia, setIa] = useState(null); // null = verificando · false = indisponível · { usados, limite }
  const [enviando, setEnviando] = useState(false); // pedido sendo enviado ao servidor
  const [aguardando, setAguardando] = useState(false); // esta tela está esperando o resultado da geração
  const [viaIA, setViaIA] = useState(false);
  const [segGerando, setSegGerando] = useState(0);
  const [pronto, setPronto] = useState(false);
  const [estimativaIA] = useState(() => iaEstimativaSeg());
  // A geração roda em segundo plano (tarefa no servidor): é "minha" se foi pedida para esta prova.
  const jobMeu = !!(job && job.ctx && job.ctx.provaProp && job.ctx.provaProp.id === provaProp.id);
  const gerando = enviando || pronto || (jobMeu && job.status === "rodando");
  const inicioGeracao = jobMeu && job.startedAt ? job.startedAt : null;
  useEffect(() => {
    if (!gerando) { setSegGerando(0); return; }
    const t0 = inicioGeracao || Date.now();
    const tick = () => setSegGerando(Math.max(0, Math.floor((Date.now() - t0) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [gerando, inicioGeracao]);
  // Pode sair da tela: a geração continua e o app avisa quando o plano ficar pronto.
  function fechar() { onClose(); }
  // Resultado chegou enquanto esta tela estava aberta: mostra "pronto" e abre a prévia.
  useEffect(() => {
    if (!aguardando || !jobMeu || job.status === "rodando") return;
    setAguardando(false);
    const r = job.result || {};
    if (job.status === "pronto" && r.ok && r.texto) {
      setIa({ usados: r.usados, limite: r.limite });
      setViaIA(true);
      onEvent("plano_corrida_ia_gerado");
      setPronto(true);
      setTimeout(() => { setPronto(false); validarColado(r.texto); }, 600);
    } else {
      if (r.erro === "limite") setIa({ usados: r.usados, limite: r.limite });
      setErro(r.mensagem || "Não consegui gerar o plano agora. Tente de novo ou use a opção de copiar e colar.");
      onDescartarJob();
    }
  }, [aguardando, jobMeu, job && job.status]);
  // Retomou um plano que ficou pronto em segundo plano: vai direto para a prévia.
  useEffect(() => {
    if (retomar && retomar.texto) { setViaIA(true); validarColado(retomar.texto); }
  }, []);

  // Só oferece "Gerar com IA" se a função de uso existe no banco (SQL rodado) e responde.
  useEffect(() => {
    if (etapa !== "form" || !usoIA) return;
    let vivo = true;
    usoIA().then((u) => { if (vivo) setIa(u && typeof u.usados === "number" ? u : false); });
    return () => { vivo = false; };
  }, [etapa]);

  const iaOk = !!ia && ia.usados < ia.limite;
  const prazo = distNum > 0 ? planoAvaliarPrazo(distNum, semanas, confNum) : null;
  const emConflito = dias.filter((d) => diasAcademia.indexOf(d) >= 0);
  const diasLivres = 7 - diasAcademia.length;
  const params = {
    provaNome: prova.nome, provaISO: prova.data_inicio, distKm: distNum, hojeISO, semanas, confortavelKm: confNum,
    paceTxt: planoParsePace(paceTxt) ? paceTxt.trim() : "", tempoAtual: ehMeta && metaNova && metaTipo === "tempo" ? metaAtual.trim() : ((planoExistente && planoExistente.params && planoExistente.params.tempoAtual) || ""), objetivo, tempoAlvo: tempoAlvo.trim(), dias, diaLongao: dias.length ? planoDiaLongao(dias) : 6,
    diasAcademia, mantemConflito, lesoes: lesoes.trim(), usaRelogio,
    meta: ehMeta ? { tipo: metaNova ? metaTipo : ((planoExistente && planoExistente.metaTipo) || "distancia") } : null,
    replan: replan && sit ? { ...sit, maiorKmRecente: hist ? hist.maiorKm : 0, motivo: planoMotivoReplan(sit) } : null,
  };
  const prompt = etapa === "prompt" || etapa === "form" ? planoMontarPrompt(params) : "";

  // Replanejar: volta ao formulário já preenchido com o que a pessoa informou, mas com o
  // ponto de partida atualizado pelo histórico recente. O que já passou fica no plano.
  function iniciarReplan() {
    const pr = (planoExistente && planoExistente.params) || {};
    setReplan(true);
    if (pr.distKm) setDistKm(String(pr.distKm).replace(".", ","));
    const conf = hist ? hist.confortavelKm : pr.confortavelKm;
    if (conf) setConfortavel(String(conf).replace(".", ","));
    if (pr.paceTxt) setPaceTxt(pr.paceTxt);
    setObjetivo(pr.objetivo || "completar");
    setTempoAlvo(pr.tempoAlvo || "");
    if (Array.isArray(pr.dias) && pr.dias.length) setDias(pr.dias);
    setMantemConflito(false);
    setErro("");
    setEtapa("form");
  }
  useEffect(() => { if (modoReplan && planoExistente && !retomar) iniciarReplan(); }, []);

  function metaSugestao() {
    const conf = confNum || (hist ? hist.confortavelKm : 0);
    if (!(metaKmNum > 0)) return null;
    let sem = planoSemanasIdeais(metaKmNum, conf);
    let nota = "";
    if (metaTipo === "tempo") {
      const at = planoTempoMin(metaAtual); const al = planoTempoMin(metaTempo);
      if (at > 0 && al > 0) {
        const pct = (at - al) / at * 100;
        if (pct > 0) sem = Math.max(sem, 4 + Math.ceil(pct * 0.8));
        nota = pct > 0 ? ` para baixar ${Math.round(pct)}% do tempo` : "";
      } else return null;
    }
    sem = Math.min(52, sem);
    return { sem, iso: addDays(hojeISO, sem * 7), nota };
  }
  function metaContinuar() {
    if (!(metaKmNum > 0 && metaKmNum <= 400)) { setErro(metaTipo === "habito" ? "Informe a distância típica de cada corrida, em km (ex.: 4)." : "Informe a distância da meta em km (ex.: 10)."); return; }
    if (!(confNum > 0)) { setErro("Informe quantos km você corre confortável hoje (pode ser uma estimativa)."); return; }
    if (metaTipo === "tempo" && !(planoTempoMin(metaTempo) > 0)) { setErro("Informe o tempo que você quer fazer (ex.: 50min ou 1h55)."); return; }
    if (metaTipo === "tempo" && !(planoTempoMin(metaAtual) > 0)) { setErro("Informe seu tempo atual nessa distância (mesmo que seja uma estimativa)."); return; }
    if (metaTipo !== "habito") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(metaData)) { setErro("Escolha até quando você quer chegar nessa meta."); return; }
      if (metaData < addDays(hojeISO, 14)) { setErro("A meta precisa estar a pelo menos 2 semanas de hoje pra dar tempo de treinar."); return; }
      if (metaData > addDays(hojeISO, 7 * 52)) { setErro("Escolha uma data dentro dos próximos 12 meses."); return; }
    }
    setErro("");
    setDistKm(fmtKm(metaKmNum));
    setObjetivo(metaTipo === "tempo" ? "tempo" : "completar");
    setTempoAlvo(metaTipo === "tempo" ? metaTempo.trim() : "");
    const sem = Math.max(1, planoSemanasAte(hojeISO, metaDataEf));
    const r0 = planoRecomendarDias(metaKmNum, sem, metaTipo === "tempo" ? "tempo" : "completar", confNum);
    setDias(planoSugerirDias(r0.ideal, diasAcademia, []).dias);
    setMantemConflito(false);
    setEtapa("form");
    onEvent("meta_corrida_definida");
  }
  function alternaDia(d) {
    setMantemConflito(false);
    setDias(dias.indexOf(d) >= 0 ? dias.filter((x) => x !== d) : planoOrdenaDias([...dias, d]));
  }
  function usarDiasLivres() {
    const n = Math.max(1, dias.length);
    const livres = Math.min(n, diasLivres);
    const s = planoSugerirDias(n, diasAcademia, []);
    setDias(s.dias);
    setMantemConflito(false);
    if (livres < n) setErro(`Você só tem ${diasLivres} dia(s) sem musculação; sobrou(aram) ${n - livres} dia(s) de corrida junto da academia (a IA vai deixar essas sessões curtas e leves).`);
    else setErro("");
  }
  function validarForm() {
    if (!(distNum > 0)) { setErro(ehMeta ? "Informe a distância da meta em km." : "Informe a distância da prova em km."); return false; }
    if (!(confNum > 0)) { setErro("Informe quantos km você corre confortável hoje (pode ser uma estimativa)."); return false; }
    if (dias.length < 1) { setErro("Escolha pelo menos 1 dia de corrida por semana."); return false; }
    if (semanas < 1) { setErro(ehMeta ? "A meta é daqui a menos de 1 semana: não dá tempo de montar um plano." : "A prova é daqui a menos de 1 semana: não dá tempo de montar um plano."); return false; }
    if (objetivo === "tempo" && paceTxt && !planoParsePace(paceTxt)) { setErro('O pace precisa estar no formato 6:30 (minutos:segundos por km).'); return false; }
    if (paceTxt.trim() && !planoParsePace(paceTxt)) { setErro('O pace precisa estar no formato 6:30 (minutos:segundos por km).'); return false; }
    setErro("");
    return true;
  }
  function irParaPrompt() {
    if (!validarForm()) return;
    setEtapa("prompt");
    onEvent("plano_corrida_prompt");
  }
  function gerarDoForm() {
    if (!validarForm()) return;
    gerarComIA();
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(prompt); setCopiado(true); setTimeout(() => setCopiado(false), 2000); onEvent("plano_corrida_prompt_copiado"); } catch (e) { setErro("Não consegui copiar; selecione o texto e copie manualmente."); }
  }
  async function gerarComIA() {
    if (gerando) return;
    setErro("");
    setEnviando(true);
    onEvent("plano_corrida_ia_pedido");
    const ctx = {
      provaProp, replan: !!(replan && planoExistente),
      form: { metaTipo, metaKm, metaTempo, metaAtual, metaData, metaSem, distKm, confortavel, paceTxt, objetivo, tempoAlvo, lesoes, usaRelogio, mantemConflito, dias },
    };
    const r = await onIniciarIA(planoMontarPrompt({ ...params, compacto: true }), prova.nome, ctx);
    setEnviando(false);
    if (r && r.ok) setAguardando(true);
    else {
      if (r && r.erro === "limite") setIa({ usados: r.usados, limite: r.limite });
      setErro((r && r.mensagem) || "Não consegui gerar o plano agora. Tente de novo ou use a opção de copiar e colar.");
    }
  }
  function validarColado(texto) {
    const raw = planoExpandirCompacto(planoParseJson(typeof texto === "string" ? texto : colado), { paceMin: planoParsePace(paceTxt), confortavelKm: confNum, usaRelogio });
    if (!raw) { setErro("Não consegui ler o JSON. Cole a resposta inteira da IA (começando em { e terminando em })."); return; }
    const plano = planoNormalizar(raw, { provaISO: prova.data_inicio, provaNome: prova.nome, distKm: distNum, hojeISO, meta: ehMeta });
    if (!plano) { setErro('O JSON precisa ter a lista "sessoes".'); return; }
    const validacao = planoValidar(plano, { provaISO: prova.data_inicio, distKm: distNum, confortavelKm: confNum, nDias: dias.length, dias, diasAcademia, mantemConflito });
    setErro("");
    setPrevia({ plano, validacao });
    setEtapa("previa");
  }
  function salvar() {
    const p = previa.plano;
    let novo = {
      id: `plano-${prova.id}`, provaId: prova.id, provaNome: prova.nome, provaData: prova.data_inicio, provaKm: distNum,
      ...(ehMeta ? { tipo: "meta", metaTipo: params.meta.tipo } : {}),
      criadoEm: new Date().toISOString(),
      params: { distKm: distNum, confortavelKm: confNum, objetivo, tempoAlvo: tempoAlvo.trim(), dias, paceTxt: params.paceTxt, tempoAtual: params.tempoAtual },
      resumo: p.resumo, avisos: p.avisos, sessoes: p.sessoes,
    };
    if (replan && planoExistente) {
      novo = { ...planoJuntarReplan(planoExistente, novo, hojeISO), criadoEm: planoExistente.criadoEm || novo.criadoEm, replanejadoEm: new Date().toISOString() };
    }
    onSave(novo);
    onEvent(replan ? "plano_corrida_replanejado" : "plano_corrida_criado");
  }

  function fmtSemana(w) {
    const f = (iso) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
    return `${f(w.inicio)} – ${f(w.fim)}`;
  }
  function renderSessao(s, key) {
    const t = PLANO_TIPOS[s.tipo] || PLANO_TIPOS.rodagem;
    const [, m, d] = s.data.split("-");
    const meta = [s.distanciaKm ? `${String(s.distanciaKm).replace(".", ",")} km` : "", s.duracaoMin ? `${s.duracaoMin} min` : ""].filter(Boolean).join(" · ");
    return (
      <div key={key} className={`gt-plano-sess ${s.status || ""}`}>
        <div className="gt-plano-sess-d">{PLANO_DIAS_CURTO[weekdayOf(s.data)]}<b>{d}/{m}</b></div>
        <div className="gt-plano-sess-b">
          <div className="ti"><Ei e={s.meta ? "🎯" : t.emoji} /> {s.titulo}{s.status === "feito" ? " ✓" : s.status === "pulou" ? " (pulou)" : ""}</div>
          {(meta || s.esforco || s.pace) && <div className="mt">{[meta, s.esforco, s.pace ? `pace ${s.pace}` : ""].filter(Boolean).join(" · ")}</div>}
          {s.detalhes && <div className="de">{s.detalhes}</div>}
          <PlanoEtapas etapas={s.etapas} paceBase={planoParsePace(params.paceTxt) || (planoExistente && planoParsePace(planoExistente.params && planoExistente.params.paceTxt)) || 0} />
        </div>
      </div>
    );
  }
  function renderSemanas(plano) {
    const ws = planoSemanas(plano);
    return ws.map((w) => {
      const aberta = abertas[w.n] !== undefined ? abertas[w.n] : (w.inicio <= hojeISO && hojeISO <= w.fim);
      const fase = (w.sessoes.find((s) => s.fase) || {}).fase;
      return (
        <div key={w.n} className="gt-plano-sem">
          <button type="button" className="gt-plano-sem-h" onClick={() => setAbertas({ ...abertas, [w.n]: !aberta })}>
            <span>Semana {w.n} · {fmtSemana(w)}{fase ? ` · ${fase}` : ""}</span>
            <span>{w.km > 0 ? `${String(w.km).replace(".", ",")} km ` : ""}{aberta ? "▴" : "▾"}</span>
          </button>
          {aberta && w.sessoes.map((s) => renderSessao(s, s.idx))}
        </div>
      );
    });
  }

  return (
    <div className="gt-modal-backdrop" onClick={fechar}>
      <div className="gt-modal gt-plano-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gt-provas-head">
          <h3><Ei e={ehMeta ? "🎯" : "🏃"} /> {ehMeta ? "Meta" : "Plano"} · {etapa === "meta" ? "nova meta" : prova.nome}</h3>
          <button type="button" className="gt-provas-close" onClick={fechar} title="Fechar">✕</button>
        </div>
        {etapa !== "meta" && <div className="gt-plano-sub">{ehMeta ? "até " : ""}{provaDataCurta(prova)} · {provaDiasLabel(prova, hojeISO)}{prova.kmEscolhido > 0 ? ` · você: ${String(prova.kmEscolhido).replace(".", ",")} km` : distancias.length ? ` · ${distancias.map((x) => String(x).replace(".", ",") + " km").join(" / ")}` : ""}</div>}

        {etapa === "meta" && (
          <div className="gt-plano-form">
            <div className="gt-plano-dica">Treine para um objetivo, sem precisar de uma prova inscrita.</div>
            <label className="gt-plano-lbl">Qual é a sua meta?</label>
            <div className="gt-provas-filters" style={{ margin: 0 }}>
              {[["distancia", "Correr uma distância"], ["tempo", "Baixar meu tempo"], ["habito", "Criar o hábito"]].map(([id, nm]) => (
                <button key={id} type="button" className={`gt-provas-pill ${metaTipo === id ? "on" : ""}`} onClick={() => { setMetaTipo(id); setErro(""); }}>{nm}</button>
              ))}
            </div>
            <label className="gt-plano-lbl">{metaTipo === "habito" ? "Distância típica de cada corrida (km)" : "Distância da meta (km)"}</label>
            {metaTipo !== "habito" && (
              <div className="gt-provas-filters" style={{ margin: "0 0 6px" }}>
                {[5, 10, 21.1, 42.2].map((d) => <button key={d} type="button" className={`gt-provas-pill ${Math.abs(metaKmNum - d) < 0.05 ? "on" : ""}`} onClick={() => { setMetaKm(fmtKm(d)); setErro(""); }}>{fmtKm(d)} km</button>)}
              </div>
            )}
            <input className="gt-input" inputMode="decimal" placeholder={metaTipo === "habito" ? "Ex.: 4" : "Ou digite, ex.: 8"} value={metaKm} onChange={(e) => { setMetaKm(e.target.value); setErro(""); }} />
            {metaTipo === "tempo" && (
              <>
                <label className="gt-plano-lbl">Tempo que você quer fazer</label>
                <input className="gt-input" placeholder="Ex.: 50min ou 1h55" value={metaTempo} onChange={(e) => { setMetaTempo(e.target.value); setErro(""); }} />
                <label className="gt-plano-lbl">Seu tempo atual nessa distância</label>
                <input className="gt-input" placeholder="Ex.: 31:00 ou 1h05 (pode ser estimado)" value={metaAtual} onChange={(e) => { setMetaAtual(e.target.value); setErro(""); }} />
              </>
            )}
            <label className="gt-plano-lbl">Quantos km você corre confortável hoje?</label>
            <input className="gt-input" inputMode="decimal" placeholder="Ex.: 5" value={confortavel} onChange={(e) => { setConfortavel(e.target.value); setErro(""); }} />
            {metaTipo === "habito" ? (
              <>
                <label className="gt-plano-lbl">Por quanto tempo?</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>
                  {[4, 8, 12].map((n) => <button key={n} type="button" className={`gt-provas-pill ${metaSem === n ? "on" : ""}`} onClick={() => setMetaSem(n)}>{n} semanas</button>)}
                </div>
                <div className="gt-plano-dica">O plano foca em constância e evolução leve, sem pressa de distância.</div>
              </>
            ) : (
              <>
                <label className="gt-plano-lbl">Até quando?</label>
                <input className="gt-input" type="date" value={metaData} min={addDays(hojeISO, 14)} onChange={(e) => { setMetaData(e.target.value); setErro(""); }} />
                {(() => {
                  const sg = metaSugestao();
                  return sg ? (
                    <div className="gt-plano-dica">Sugestão para chegar com segurança: cerca de {sg.sem} semanas{sg.nota} ({planoDataBR(sg.iso)}). <button type="button" className="gt-plano-link" onClick={() => setMetaData(sg.iso)}>Usar essa data</button></div>
                  ) : (metaTipo === "tempo" && metaKmNum > 0 ? <div className="gt-plano-dica">Informe seu tempo atual e o que quer fazer para eu sugerir um prazo realista.</div> : null);
                })()}
              </>
            )}
            {erro && <div className="gt-plano-erro">{erro}</div>}
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn" onClick={metaContinuar}>Continuar</button>
              <button type="button" className="gt-btn secondary" onClick={onClose}>Cancelar</button>
            </div>
          </div>
        )}

        {etapa === "ver" && planoExistente && (
          <div>
            {sit && (sit.atrasado || sit.dataMudou) && (
              <div className="gt-plano-aviso curto"><Ei e="🔄" /> {sit.atrasado ? `Você ficou ${sit.faltou} de ${sit.recentes} sessões sem registro nas últimas 2 semanas.` : ""}{sit.atrasado && sit.dataMudou ? " " : ""}{sit.dataMudou ? `A data da prova mudou (agora ${provaDataCurta(prova)}).` : ""} Vale replanejar a partir de hoje.</div>
            )}
            {planoExistente.resumo && <div className="gt-plano-resumo">{planoExistente.resumo}</div>}
            {(planoExistente.avisos || []).map((a, i) => <div key={i} className="gt-plano-aviso"><Ei e="⚠️" /> {a}</div>)}
            {renderSemanas(planoExistente)}
            <div className="gt-plano-foot">Esta é uma sugestão de treino e não substitui avaliação médica nem o acompanhamento de um treinador. Em caso de dor, pare e procure um profissional.</div>
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn secondary" onClick={iniciarReplan}>Replanejar a partir de hoje</button>
              {!confirmaExcluir
                ? <button type="button" className="gt-btn secondary" onClick={() => setConfirmaExcluir(true)}>Excluir</button>
                : <button type="button" className="gt-btn" onClick={() => onDelete(planoExistente)}>Confirmar</button>}
            </div>
          </div>
        )}

        {etapa === "form" && gerando && (
          <GerandoIA seg={segGerando} estimativa={estimativaIA} pronto={pronto} mensagens={["Analisando seu ponto de partida…", "Montando as semanas de base…", "Distribuindo longões e treinos de qualidade…", "Ajustando a reta final e o polimento…"]} />
        )}
        {etapa === "form" && !gerando && (
          <div className="gt-plano-form">
            {replan && sit
              ? <div className="gt-plano-aviso"><Ei e="🔄" /> Replanejando: das {sit.totalPassadas} sessões previstas até hoje, {sit.feitasTotal} foram feitas e {sit.naoFeitasTotal} ficaram sem registro. O novo plano começa hoje, mantém o que já passou no histórico e usa isso como ponto de partida.{sit.dataMudou ? ` A data da prova agora é ${provaDataCurta(prova)}.` : ""}</div>
              : planoExistente && <div className="gt-plano-aviso">Já existe um plano para esta prova. Ao salvar um novo, ele substitui o atual.</div>}
            <label className="gt-plano-lbl">{ehMeta ? "Distância da meta (km)" : "Distância da prova (km)"}</label>
            {distancias.length > 1 && (!(prova.kmEscolhido > 0) || distancias.indexOf(prova.kmEscolhido) >= 0)
              ? <div className="gt-provas-filters" style={{ margin: 0 }}>{distancias.map((x) => (
                  <button key={x} type="button" className={`gt-provas-pill ${distNum === x ? "on" : ""}`} onClick={() => setDistKm(String(x).replace(".", ","))}>{String(x).replace(".", ",")} km</button>
                ))}</div>
              : <input className="gt-input" inputMode="decimal" placeholder="Ex.: 10" value={distKm} onChange={(e) => setDistKm(e.target.value)} />}

            <label className="gt-plano-lbl">Quantos km você corre confortável hoje?</label>
            <input className="gt-input" inputMode="decimal" placeholder="Ex.: 5" value={confortavel} onChange={(e) => setConfortavel(e.target.value)} />
            {hist
              ? <div className="gt-plano-dica">Sugerido pelo seu histórico: {hist.n} corrida{hist.n > 1 ? "s" : ""} nas últimas 8 semanas (maior: {String(hist.maiorKm).replace(".", ",")} km). Ajuste se não estiver certo.</div>
              : <div className="gt-plano-dica">Sem corridas registradas nas últimas 8 semanas. {stravaConnected
                  ? "Sincronize o Strava na aba Hoje pra eu sugerir isso automaticamente."
                  : <>Conectando o Strava eu consigo sugerir isso sozinho. <button type="button" className="gt-plano-link" onClick={onOpenSettings}>Conectar agora</button></>}</div>}

            <label className="gt-plano-lbl">Pace confortável nesses treinos (min/km, opcional)</label>
            <input className="gt-input" inputMode="text" placeholder="Ex.: 6:10" value={paceTxt} onChange={(e) => setPaceTxt(e.target.value)} />
            <label className="gt-plano-chk"><input type="checkbox" checked={usaRelogio} onChange={(e) => setUsaRelogio(e.target.checked)} /> Treino com relógio/GPS (incluir pace nas sessões, além do esforço)</label>

            {!ehMeta && (
              <>
                <label className="gt-plano-lbl">Objetivo</label>
                <div className="gt-provas-filters" style={{ margin: 0 }}>
                  <button type="button" className={`gt-provas-pill ${objetivo === "completar" ? "on" : ""}`} onClick={() => setObjetivo("completar")}>Completar a prova</button>
                  <button type="button" className={`gt-provas-pill ${objetivo === "tempo" ? "on" : ""}`} onClick={() => setObjetivo("tempo")}>Baixar meu tempo</button>
                </div>
                {objetivo === "tempo" && <input className="gt-input" placeholder="Meta de tempo (ex.: 50min ou 1h55)" value={tempoAlvo} onChange={(e) => setTempoAlvo(e.target.value)} />}
              </>
            )}

            <label className="gt-plano-lbl">Dias de corrida por semana</label>
            {rec && <div className="gt-plano-dica">Recomendado: <b>{rec.ideal} dias</b>. {rec.motivo}</div>}
            <div className="gt-plano-dias">
              {PLANO_ORDEM_SEMANA.map((d) => (
                <button key={d} type="button" className={`gt-plano-dia ${dias.indexOf(d) >= 0 ? "on" : ""}`} onClick={() => alternaDia(d)}>
                  {PLANO_DIAS_CURTO[d]}{diasAcademia.indexOf(d) >= 0 && <span className="ac"><Ei e="🏋️" size="1em" /></span>}
                </button>
              ))}
            </div>
            <div className="gt-plano-dica">{dias.length} dia{dias.length === 1 ? "" : "s"} escolhido{dias.length === 1 ? "" : "s"}{diasAcademia.length ? ` · 🏋️ = dia de musculação na sua agenda` : ""}{rec && dias.length > rec.max ? ` · acima do recomendado (máx. ${rec.max})` : rec && dias.length < rec.min ? ` · abaixo do recomendado (mín. ${rec.min})` : ""}</div>
            {emConflito.length > 0 && !mantemConflito && (
              <div className="gt-plano-conflito">
                <div><Ei e="⚠️" /> Você treina musculação em {planoNomesDias(emConflito)}, e a corrida nesses dias pode pesar. Quer ajustar?</div>
                <div className="gt-modal-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="gt-btn small" onClick={usarDiasLivres}>Usar dias livres</button>
                  <button type="button" className="gt-btn secondary small" onClick={() => setMantemConflito(true)}>Manter assim</button>
                </div>
              </div>
            )}
            {emConflito.length > 0 && mantemConflito && <div className="gt-plano-dica">Mantendo corrida em dia de musculação ({planoNomesDias(emConflito)}): essas sessões vão ser curtas e leves.</div>}

            <label className="gt-plano-lbl">Lesões ou restrições (opcional)</label>
            <textarea className="gt-input" rows={2} placeholder="Ex.: dor no joelho direito em corridas longas" value={lesoes} onChange={(e) => setLesoes(e.target.value)} />

            {prazo && <div className={`gt-plano-aviso ${prazo.nivel}`}><Ei e={prazo.nivel === "curto" ? "⏱️" : "📅"} /> {prazo.texto}</div>}
            {erro && <div className="gt-plano-erro">{erro}</div>}
            <div className="gt-plano-foot">Esta é uma sugestão de treino e não substitui avaliação médica nem o acompanhamento de um treinador. Em caso de dor, pare e procure um profissional.</div>
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              {iaOk
                ? <button type="button" className="gt-btn" onClick={gerarDoForm}><Ei e="✨" /> Gerar plano com IA</button>
                : <button type="button" className="gt-btn" onClick={irParaPrompt}>Continuar</button>}
              <button type="button" className="gt-btn secondary" onClick={() => { if (planoExistente) { setReplan(false); setEtapa("ver"); } else if (metaNova) setEtapa("meta"); else onClose(); }}>{metaNova ? "Voltar" : "Cancelar"}</button>
            </div>
            {iaOk && ia.limite < 1000 && <div className="gt-plano-dica" style={{ textAlign: "center" }}>Restam {ia.limite - ia.usados} de {ia.limite} gerações neste mês.</div>}
            {ia && !iaOk && <div className="gt-plano-dica" style={{ textAlign: "center" }}>Você já usou os {ia.limite} planos deste mês. Dá pra montar copiando e colando numa IA.</div>}
            {iaOk && <button type="button" className="gt-link-btn" style={{ display: "block", margin: "6px auto 0", background: "none", border: 0, color: "inherit", opacity: 0.7, textDecoration: "underline", fontSize: 13 }} onClick={irParaPrompt}>Prefiro usar outra IA (copiar e colar)</button>}
          </div>
        )}

        {etapa === "prompt" && (
          <div className="gt-plano-form">
            <div className="gt-plano-passo"><b>1.</b> Copie o texto abaixo e cole no Claude (ou outra IA).</div>
            <textarea className="gt-input gt-plano-prompt" readOnly value={prompt} onFocus={(e) => e.target.select()} />
            <button type="button" className="gt-btn secondary small" style={{ width: "100%" }} onClick={copiar}>{copiado ? "✓ Copiado" : <><Ei e="📋" /> Copiar prompt</>}</button>
            <div className="gt-plano-passo"><b>2.</b> Copie a resposta (o JSON) e cole aqui.</div>
            <textarea className="gt-input gt-plano-prompt" placeholder='{ "resumo": "...", "sessoes": [ ... ] }' value={colado} onChange={(e) => setColado(e.target.value)} spellCheck={false} />
            {erro && <div className="gt-plano-erro">{erro}</div>}
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn" disabled={!colado.trim() || gerando} onClick={() => validarColado()}>Conferir plano</button>
              <button type="button" className="gt-btn secondary" disabled={gerando} onClick={() => { setErro(""); setEtapa("form"); }}>Voltar</button>
            </div>
          </div>
        )}

        {etapa === "previa" && previa && (
          <div>
            {previa.plano.resumo && <div className="gt-plano-resumo">{previa.plano.resumo}</div>}
            {previa.plano.avisos.map((a, i) => <div key={"a" + i} className="gt-plano-aviso"><Ei e="⚠️" /> {a}</div>)}
            {previa.validacao.map((v, i) => <div key={"v" + i} className={`gt-plano-aviso ${v.nivel}`}><Ei e={v.nivel === "erro" ? "⛔" : v.nivel === "aviso" ? "⚠️" : "ℹ️"} /> {v.texto}</div>)}
            {previa.plano.descartadas > 0 && <div className="gt-plano-dica">{previa.plano.descartadas} sessão(ões) fora do período até a prova foram ignoradas.</div>}
            {renderSemanas(previa.plano)}
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn" disabled={previa.validacao.some((v) => v.nivel === "erro")} onClick={salvar}>Salvar plano</button>
              <button type="button" className="gt-btn secondary" onClick={() => { setViaIA(false); setEtapa(viaIA ? "form" : "prompt"); }}>Voltar</button>
            </div>
            <div className="gt-plano-foot">Os avisos são só alertas: o plano é seu e você decide se segue como veio.</div>
          </div>
        )}
      </div>
    </div>
  );
}

const CAL_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// Calendário de provas (mensal e anual) pra se programar: mostra as minhas, as da lista e as metas.
function ProvasCalendario({ provas, marcadas, metas, hojeISO, onAbrir }) {
  const [ano, setAno] = useState(Number(hojeISO.slice(0, 4)));
  const [mes, setMes] = useState(Number(hojeISO.slice(5, 7)) - 1);
  const [modo, setModo] = useState("mes");
  const [dia, setDia] = useState(null);
  const pad = (n) => String(n).padStart(2, "0");
  const mapa = {};
  const add = (k, tipo, x) => { (mapa[k] = mapa[k] || { minhas: [], outras: [], metas: [] })[tipo].push(x); };
  provas.forEach((r) => {
    let d = r.data_inicio; const fim = provaFim(r); let n = 0;
    while (d <= fim && n < 7) { add(d, marcadas.includes(r.id) ? "minhas" : "outras", r); d = addDays(d, 1); n++; }
  });
  (metas || []).forEach((pl) => add(pl.provaData, "metas", pl));
  function mover(delta) {
    if (modo === "ano") { setAno(ano + delta); return; }
    let m = mes + delta; let a = ano;
    if (m < 0) { m = 11; a--; } else if (m > 11) { m = 0; a++; }
    setMes(m); setAno(a); setDia(null);
  }
  const prefixoMes = `${ano}-${pad(mes + 1)}`;
  function resumoMes(a, m) {
    const pre = `${a}-${pad(m + 1)}`;
    const ids = new Set(); const meus = new Set();
    Object.keys(mapa).forEach((k) => { if (k.startsWith(pre)) { mapa[k].minhas.forEach((r) => { ids.add(r.id); meus.add(r.id); }); mapa[k].outras.forEach((r) => ids.add(r.id)); } });
    return { total: ids.size, meus: meus.size };
  }
  const grade = [];
  if (modo === "mes") {
    const primeiro = new Date(ano, mes, 1).getDay();
    const dias = new Date(ano, mes + 1, 0).getDate();
    for (let i = 0; i < primeiro; i++) grade.push(null);
    for (let d = 1; d <= dias; d++) grade.push(`${prefixoMes}-${pad(d)}`);
  }
  // Lista abaixo da grade: o dia selecionado ou o mês inteiro.
  const itens = [];
  if (modo === "mes") {
    Object.keys(mapa).filter((k) => (dia ? k === dia : k.startsWith(prefixoMes))).sort().forEach((k) => {
      mapa[k].metas.forEach((pl) => itens.push({ k, meta: pl }));
      mapa[k].minhas.forEach((r) => itens.push({ k, r, minha: true }));
      mapa[k].outras.forEach((r) => itens.push({ k, r }));
    });
  }
  const vistos = new Set();
  const lista = itens.filter((it) => { const id = it.meta ? "m" + it.meta.id : it.r.id; if (vistos.has(id)) return false; vistos.add(id); return true; });
  return (
    <div className="gt-cal">
      <div className="gt-cal-head">
        <button type="button" className="gt-cal-nav" onClick={() => mover(-1)} aria-label="Anterior">‹</button>
        <div className="gt-cal-titulo">{modo === "ano" ? ano : `${CAL_MESES[mes]} ${ano}`}</div>
        <button type="button" className="gt-cal-nav" onClick={() => mover(1)} aria-label="Próximo">›</button>
        <div className="gt-cal-modo">
          <button type="button" className={modo === "mes" ? "on" : ""} onClick={() => setModo("mes")}>Mês</button>
          <button type="button" className={modo === "ano" ? "on" : ""} onClick={() => { setModo("ano"); setDia(null); }}>Ano</button>
        </div>
      </div>
      {modo === "ano" ? (
        <div className="gt-cal-ano">
          {CAL_MESES.map((nm, i) => {
            const r = resumoMes(ano, i);
            const atual = `${ano}-${pad(i + 1)}` === hojeISO.slice(0, 7);
            return (
              <button key={nm} type="button" className={`gt-cal-mini ${atual ? "atual" : ""}`} onClick={() => { setMes(i); setModo("mes"); setDia(null); }}>
                <span className="mn">{nm.slice(0, 3)}</span>
                <span className="nn">{r.total || "·"}</span>
                {r.meus > 0 && <span className="mm">{r.meus} {r.meus === 1 ? "vou" : "vou"}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="gt-cal-sem">{["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => <span key={i}>{l}</span>)}</div>
          <div className="gt-cal-grade">
            {grade.map((k, i) => {
              if (!k) return <span key={"v" + i} />;
              const x = mapa[k];
              return (
                <button key={k} type="button" className={`gt-cal-dia ${k === hojeISO ? "hoje" : ""} ${k === dia ? "sel" : ""}`} onClick={() => setDia(k === dia ? null : k)}>
                  <span className="n">{Number(k.slice(8))}</span>
                  <span className="pt">
                    {x && x.minhas.length > 0 && <i className="min" />}
                    {x && x.metas.length > 0 && <i className="met" />}
                    {x && x.outras.length > 0 && <i className="out" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="gt-cal-leg"><span><i className="min" /> eu vou</span><span><i className="met" /> minha meta</span><span><i className="out" /> outras provas</span></div>
          <div className="gt-cal-lista">
            {lista.length === 0 && <div className="gt-plano-dica">{dia ? "Nenhuma prova nesse dia." : "Nenhuma prova neste mês."}</div>}
            {lista.map((it) => {
              const [, m, d] = it.k.split("-");
              if (it.meta) return <div key={"m" + it.meta.id} className="gt-prova going"><div className="gt-prova-date"><div className="d">{Number(d)}</div><div className="w">{m}</div></div><div className="gt-prova-body"><div className="gt-prova-nm"><Ei e="🎯" /> {it.meta.provaNome}</div><div className="gt-prova-meta">dia da sua meta</div></div></div>;
              const r = it.r;
              return (
                <div key={r.id} className={`gt-prova clicavel ${it.minha ? "going" : ""}`} role="button" tabIndex={0} onClick={() => onAbrir(r.id)} onKeyDown={(e) => { if (e.key === "Enter") onAbrir(r.id); }}>
                  <div className="gt-prova-date"><div className="d">{Number(d)}</div><div className="w">{CAL_MESES[Number(m) - 1].slice(0, 3)}</div></div>
                  <div className="gt-prova-body">
                    <div className="gt-prova-nm">{r.nome}</div>
                    <div className="gt-prova-meta">{[r.cidade && r.uf ? `${r.cidade}/${r.uf}` : (r.cidade || r.uf), provaDistLabel(r)].filter(Boolean).join(" · ")}</div>
                  </div>
                  {it.minha && <span className="gt-cal-vou">✓ Vou</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Montar treino de corrida avulso (sem prova/plano): escolhe tipo, distância e nível; o app calcula as etapas.
function TreinoCorridaModal({ biblioteca, dataInicial, paceBase, onSalvar, onAgendar, onExcluir, onClose }) {
  const [etapa, setEtapa] = useState((biblioteca || []).length ? "lista" : "montar");
  const [tipo, setTipo] = useState("tiros400");
  const [kmTxt, setKmTxt] = useState("");
  const [nivel, setNivel] = useState("intermediario");
  const [paceTxt, setPaceTxt] = useState(paceBase > 0 ? planoFmtPace(paceBase) : "");
  const [res, setRes] = useState(null);
  const [erro, setErro] = useState("");
  const [data, setData] = useState(dataInicial || "");
  const [agendando, setAgendando] = useState(null); // id do item da biblioteca
  const km = parseFloat(String(kmTxt).replace(",", ".")) || 0;
  const cfg = TREINOS_CORRIDA[tipo];
  function montar() {
    if (paceTxt.trim() && !planoParsePace(paceTxt)) { setErro("O pace precisa estar no formato 6:30 (minutos:segundos por km)."); return; }
    const r = planoGerarTreinoCorrida(tipo, km, nivel, planoParsePace(paceTxt));
    if (!r.ok) { setErro(r.erro); return; }
    setErro(""); setRes(r.treino); setEtapa("previa");
  }
  const metaTxt = (t) => [t.distanciaKm ? `${String(t.distanciaKm).replace(".", ",")} km` : "", t.duracaoMin ? `≈ ${t.duracaoMin} min` : "", t.pace ? `pace ${t.pace}` : ""].filter(Boolean).join(" · ");
  return (
    <div className="gt-modal-backdrop" onClick={onClose}>
      <div className="gt-modal gt-plano-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gt-provas-head">
          <h3><Ei e="🏃" /> Treinos de corrida</h3>
          <button type="button" className="gt-provas-close" onClick={onClose} title="Fechar">✕</button>
        </div>

        {etapa === "lista" && (
          <div className="gt-plano-form">
            <div className="gt-plano-dica">Seus treinos de corrida salvos. Coloque na agenda quando quiser.</div>
            {(biblioteca || []).map((t) => (
              <div className="gt-tc-item" key={t.id}>
                <div className="ti"><Ei e={(TREINOS_CORRIDA[t.modelo] || {}).emoji || "🏃"} /> {t.titulo}</div>
                <div className="mt">{metaTxt(t)}</div>
                <div className="gt-tc-resumo">{planoEtapasResumo(t.etapas)}</div>
                {agendando === t.id ? (
                  <div className="gt-inline-form" style={{ marginTop: 8 }}>
                    <input className="gt-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                    <button type="button" className="gt-btn small" disabled={!data} onClick={() => { onAgendar(t, data); setAgendando(null); }}>Agendar</button>
                  </div>
                ) : (
                  <div className="gt-modal-actions" style={{ marginTop: 8 }}>
                    <button type="button" className="gt-btn small" onClick={() => { setAgendando(t.id); if (!data) setData(dataInicial || todayISO()); }}><Ei e="📅" /> Colocar na agenda</button>
                    <button type="button" className="gt-btn secondary small" onClick={() => onExcluir(t)}>Excluir</button>
                  </div>
                )}
              </div>
            ))}
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn" onClick={() => setEtapa("montar")}>+ Montar novo treino</button>
              <button type="button" className="gt-btn secondary" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}

        {etapa === "montar" && (
          <div className="gt-plano-form">
            <div className="gt-plano-dica">O app monta o treino passo a passo (aquecimento, blocos e desaquecimento) para a distância que você escolher.</div>
            <label className="gt-plano-lbl">Tipo de treino</label>
            <div className="gt-provas-filters" style={{ margin: 0 }}>
              {Object.keys(TREINOS_CORRIDA).map((k) => <button key={k} type="button" className={`gt-provas-pill ${tipo === k ? "on" : ""}`} onClick={() => { setTipo(k); setErro(""); }}>{TREINOS_CORRIDA[k].nome}</button>)}
            </div>
            <div className="gt-plano-dica"><Ei e={cfg.emoji} /> {cfg.desc}</div>
            <label className="gt-plano-lbl">Distância total (km)</label>
            <div className="gt-provas-filters" style={{ margin: "0 0 6px" }}>
              {[3, 5, 8, 10, 15].map((d) => <button key={d} type="button" className={`gt-provas-pill ${km === d ? "on" : ""}`} onClick={() => { setKmTxt(String(d)); setErro(""); }}>{d} km</button>)}
            </div>
            <input className="gt-input" inputMode="decimal" placeholder="Ou digite, ex.: 7,5" value={kmTxt} onChange={(e) => { setKmTxt(e.target.value); setErro(""); }} />
            <label className="gt-plano-lbl">Seu nível</label>
            <div className="gt-provas-filters" style={{ margin: 0 }}>
              {Object.keys(TREINOS_CORRIDA_NIVEIS).map((k) => <button key={k} type="button" className={`gt-provas-pill ${nivel === k ? "on" : ""}`} onClick={() => setNivel(k)}>{TREINOS_CORRIDA_NIVEIS[k]}</button>)}
            </div>
            <label className="gt-plano-lbl">Pace de um treino leve (opcional)</label>
            <input className="gt-input" placeholder="Ex.: 6:30 (min/km). Sem isso, o treino usa só esforço." value={paceTxt} onChange={(e) => { setPaceTxt(e.target.value); setErro(""); }} />
            {erro && <div className="gt-plano-erro">{erro}</div>}
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn" onClick={montar}>Montar treino</button>
              <button type="button" className="gt-btn secondary" onClick={() => ((biblioteca || []).length ? setEtapa("lista") : onClose())}>{(biblioteca || []).length ? "Voltar" : "Cancelar"}</button>
            </div>
          </div>
        )}

        {etapa === "previa" && res && (
          <div className="gt-plano-form">
            <div className="gt-tc-item" style={{ border: 0, padding: 0 }}>
              <div className="ti"><Ei e={cfg.emoji} /> {res.titulo}</div>
              <div className="mt">{metaTxt(res)}</div>
              {res.detalhes && <div className="gt-plano-dica">{res.detalhes}</div>}
              <PlanoEtapas etapas={res.etapas} paceBase={planoParsePace(paceTxt)} />
            </div>
            <label className="gt-plano-lbl">Colocar na agenda em (opcional)</label>
            <input className="gt-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <div className="gt-modal-actions" style={{ marginTop: 10 }}>
              <button type="button" className="gt-btn" disabled={!data} onClick={() => { const t = onSalvar(res); onAgendar(t, data); onClose(); }}>Salvar e agendar</button>
              <button type="button" className="gt-btn secondary" onClick={() => { onSalvar(res); onClose(); }}>Só salvar</button>
            </div>
            <div className="gt-modal-actions" style={{ marginTop: 6 }}>
              <button type="button" className="gt-btn secondary" onClick={() => setEtapa("montar")}>Ajustar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProvasModal({ provas, marcadas, kms, planos, onMeta, onVerMeta, participantes, amigosVao, nuvem, verAmigos, onVerAmigos, abaInicial, hojeISO, onToggle, onMarcar, onKm, onPlano, onAddManual, onRemoveManual, onLinkClick, onClose }) {
  const [mod, setMod] = useState("todas");
  const [uf, setUf] = useState("");
  const [busca, setBusca] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nome: "", data: "", cidade: "", uf: "", modalidade: "corrida", link: "", km: "" });
  const [formErro, setFormErro] = useState("");
  const [escolha, setEscolha] = useState(null); // { r, editar } — escolhendo a distância que vai correr
  const [kmTxt, setKmTxt] = useState("");
  const [kmErro, setKmErro] = useState("");

  const [aba, setAba] = useState(abaInicial || (marcadas.length > 0 ? "minhas" : "explorar"));
  const metas = (planos || []).filter((x) => x.tipo === "meta").sort((a, b) => a.provaData.localeCompare(b.provaData));
  const metaAtiva = metas.find((x) => x.provaData >= hojeISO) || null;
  const metasPassadas = metas.filter((x) => x.provaData < hojeISO);
  function cardMeta(pl) {
    const treinos = (pl.sessoes || []).filter((x) => x.tipo !== "prova");
    const feitas = treinos.filter((x) => x.status === "feito").length;
    const [, m, d] = pl.provaData.split("-");
    return (
      <div key={pl.id} className="gt-prova going clicavel" role="button" tabIndex={0} onClick={() => onVerMeta(pl)} onKeyDown={(e) => { if (e.key === "Enter") onVerMeta(pl); }}>
        <div className="gt-prova-date"><div className="d"><Ei e="🎯" size={22} /></div></div>
        <div className="gt-prova-body">
          <div className="gt-prova-nm">{pl.provaNome}</div>
          <div className="gt-prova-meta">até {d}/{m} · {pl.provaData >= hojeISO ? provaDiasLabel({ data_inicio: pl.provaData }, hojeISO) : "concluída"}{treinos.length ? ` · ${feitas} de ${treinos.length} treinos` : ""}</div>
        </div>
        <button type="button" className="gt-prova-go on" onClick={(e) => { e.stopPropagation(); onVerMeta(pl); }}>Ver plano</button>
      </div>
    );
  }
  const [detalheId, setDetalheId] = useState(null);

  const futuras = provas.filter((r) => provaFim(r) >= hojeISO);
  const ufsDisponiveis = Array.from(new Set(futuras.map((r) => r.uf).filter(Boolean))).sort();
  const q = normalizeSearch(busca);
  const filtradas = futuras.filter((r) => {
    if (mod !== "todas" && r.modalidade !== mod) return false;
    if (uf && r.uf !== uf) return false;
    if (q && !normalizeSearch(`${r.nome} ${r.cidade || ""}`).includes(q)) return false;
    return true;
  }).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio) || a.nome.localeCompare(b.nome));

  const minhas = futuras.filter((r) => marcadas.includes(r.id)).sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  const grupos = [];
  filtradas.forEach((r) => {
    const k = r.data_inicio.slice(0, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.k !== k) { g = { k, label: provaMesLabel(r.data_inicio), itens: [] }; grupos.push(g); }
    g.itens.push(r);
  });

  const kmDe = (r) => (kms && kms[r.id]) || 0;
  const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "Amigo";
  // Quem vai nessa prova: amigos (com nome) e o total de outras pessoas (só número), sem me contar.
  function pessoas(r) {
    const p = participantes && participantes[r.id];
    const amigos = (amigosVao && amigosVao[r.id]) || [];
    if (!p && amigos.length === 0) return null;
    let total = p ? p.total : 0;
    const por = { ...((p && p.por_km) || {}) };
    if (marcadas.includes(r.id) && p) {
      total -= 1;
      const meu = kmDe(r);
      const chave = Object.keys(por).find((k) => (meu > 0 ? Math.abs(parseFloat(k) - meu) < 0.001 : k === "?"));
      if (chave && por[chave] > 0) por[chave] -= 1;
    }
    total = Math.max(total, amigos.length);
    if (total <= 0) return null;
    const partes = Object.keys(por).filter((k) => por[k] > 0)
      .sort((a, b) => (a === "?") - (b === "?") || parseFloat(a) - parseFloat(b))
      .map((k) => ({ rotulo: k === "?" ? "distância não definida" : String(parseFloat(k)).replace(".", ",") + " km", n: por[k] }));
    return { total, amigos, partes };
  }
  // Linha curta do card: "🤝 Ana, Bruno · 👥 5 vão".
  function linhaSocial(r) {
    const x = pessoas(r);
    if (!x) return null;
    const nomes = x.amigos.slice(0, 2).map((a) => primeiroNome(a.nome)).join(", ") + (x.amigos.length > 2 ? ` +${x.amigos.length - 2}` : "");
    return (
      <div className="gt-prova-outros">
        {x.amigos.length > 0 && <span><Ei e="🤝" /> {nomes}</span>}
        {x.amigos.length > 0 && " · "}
        <span><Ei e="👥" /> {x.total} {x.total === 1 ? "vai" : "vão"}</span>
      </div>
    );
  }
  function abrirEscolha(r, editar) {
    const ds = planoDistanciasDaProva(r);
    setKmTxt(kmDe(r) ? String(kmDe(r)).replace(".", ",") : ds.length === 1 ? String(ds[0]).replace(".", ",") : "");
    setKmErro("");
    setEscolha({ r, editar: !!editar });
  }
  // Provas de corrida pedem a distância ao marcar "Vou nessa"; as outras marcam direto.
  function clicarVou(r, going) {
    if (going || r.modalidade !== "corrida") { onToggle(r); return; }
    abrirEscolha(r, false);
  }
  function confirmarKm(pular) {
    const km = pular ? 0 : parseFloat(String(kmTxt).replace(",", "."));
    if (!pular && !(km > 0 && km <= 400)) { setKmErro("Informe a distância em km (ex.: 10 ou 21,1)."); return; }
    if (escolha.editar) onKm(escolha.r, km); else onMarcar(escolha.r, km);
    setEscolha(null);
  }
  function submitManual() {
    const nome = form.nome.trim();
    if (!nome) { setFormErro("Dá um nome pra prova."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.data)) { setFormErro("Escolhe a data."); return; }
    const link = form.link.trim();
    if (link && !provaSafeUrl(link)) { setFormErro("O link precisa começar com http:// ou https://"); return; }
    const formKm = parseFloat(String(form.km || "").replace(",", ".")) || 0;
    onAddManual({
      id: `manual-${Date.now()}`,
      nome,
      data_inicio: form.data,
      data_fim: null,
      cidade: form.cidade.trim(),
      uf: form.uf || "",
      modalidade: form.modalidade,
      distancias: formKm > 0 ? [formKm] : [],
      link_oficial: link || null,
      fonte: "manual",
      manual: true,
    }, formKm > 0 ? formKm : 0);
    setForm({ nome: "", data: "", cidade: "", uf: "", modalidade: "corrida", link: "", km: "" });
    setFormErro("");
    setAdding(false);
  }

  // Botão pra criar/ver o plano de treino (só provas de corrida que a pessoa marcou).
  function planoCta(r) {
    if (r.modalidade !== "corrida") return null;
    const tem = (planos || []).some((p) => p.provaId === r.id);
    return (
      <button type="button" className="gt-plano-cta" onClick={(e) => { e.stopPropagation(); onPlano(r); }}>
        <Ei e="🏃" /> {tem ? "Ver plano de treino" : "Criar plano de treino"}
      </button>
    );
  }

  function cardProva(r, minha) {
    const going = marcadas.includes(r.id);
    const [y, m, d] = r.data_inicio.split("-").map(Number);
    const wd = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
    const local = r.cidade && r.uf ? `${r.cidade}/${r.uf}` : (r.cidade || r.uf);
    const dist = going && kmDe(r) ? `você: ${String(kmDe(r)).replace(".", ",")} km` : provaDistLabel(r);
    const meta = [minha ? provaDiasLabel(r, hojeISO) : "", local, dist].filter(Boolean).join(" · ");
    return (
      <div key={r.id} className={`gt-prova clicavel ${going ? "going" : ""}`} role="button" tabIndex={0}
        onClick={() => setDetalheId(r.id)} onKeyDown={(e) => { if (e.key === "Enter") setDetalheId(r.id); }}>
        <div className="gt-prova-date">
          <div className="d">{d}{r.data_fim ? "+" : ""}</div>
          <div className="w">{wd}</div>
        </div>
        <div className="gt-prova-body">
          <div className="gt-prova-nm">{r.nome}{r.manual && <span className="gt-prova-tag">MANUAL</span>}{r.compartilhada && <span className="gt-prova-tag">COMUNIDADE</span>}</div>
          {meta && <div className="gt-prova-meta">{meta}</div>}
          {linhaSocial(r)}
          {minha && r.modalidade === "corrida" && <button type="button" className="gt-prova-km-edit" onClick={(e) => { e.stopPropagation(); abrirEscolha(r, true); }}>{kmDe(r) ? "alterar distância" : "definir a distância que vou correr"}</button>}
          {minha && planoCta(r)}
        </div>
        <button type="button" className={`gt-prova-go ${going ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); clicarVou(r, going); }}>
          {going ? "✓ Vou" : "Vou nessa"}
        </button>
      </div>
    );
  }

  // Detalhes da prova (painel que sobe de baixo): tudo sobre a prova e quem vai.
  function detalhe() {
    const r = provas.find((x) => x.id === detalheId);
    if (!r) return null;
    const going = marcadas.includes(r.id);
    const x = pessoas(r);
    const url = provaSafeUrl(r.link_oficial);
    const local = r.cidade && r.uf ? `${r.cidade}/${r.uf}` : (r.cidade || r.uf || "");
    const outros = x ? Math.max(0, x.total - x.amigos.length) : 0;
    return (
      <div className="gt-modal-backdrop" style={{ zIndex: 55 }} onClick={() => setDetalheId(null)}>
        <div className="gt-modal gt-prova-detalhe" onClick={(e) => e.stopPropagation()}>
          <div className="gt-prova-detalhe-head">
            <h3>{r.nome}</h3>
            <button type="button" className="gt-provas-close" onClick={() => setDetalheId(null)} title="Fechar">✕</button>
          </div>
          <div className="gt-prova-detalhe-sub">
            {provaDataCurta(r)} · {provaDiasLabel(r, hojeISO)}
            {r.compartilhada && <span className="gt-prova-tag">COMUNIDADE</span>}
            {r.manual && <span className="gt-prova-tag">MANUAL</span>}
          </div>
          <div className="gt-prova-detalhe-info">
            {local && <div><Ei e="📍" /> {local}</div>}
            {provaDistLabel(r) && <div><Ei e="📏" /> {provaDistLabel(r)}</div>}
            {going && kmDe(r) > 0 && <div><Ei e="🏃" /> Você vai correr {String(kmDe(r)).replace(".", ",")} km</div>}
          </div>
          <div className="gt-prova-detalhe-acoes">
            <button type="button" className={`gt-prova-go ${going ? "on" : ""}`} onClick={() => clicarVou(r, going)}>{going ? "✓ Vou" : "Vou nessa"}</button>
            {going && r.modalidade === "corrida" && <button type="button" className="gt-prova-km-edit" onClick={() => abrirEscolha(r, true)}>{kmDe(r) ? "alterar distância" : "definir a distância que vou correr"}</button>}
          </div>
          {going && planoCta(r)}
          <div className="gt-prova-detalhe-sec">Quem vai</div>
          {x && x.amigos.length > 0 ? (
            <div className="gt-prova-amigos">
              {x.amigos.map((a) => (
                <div key={a.user_id} className="gt-prova-amigo">
                  <span className="av">{primeiroNome(a.nome).slice(0, 1).toUpperCase()}</span>
                  <span className="nm">{a.nome}</span>
                  <span className="km">{a.km > 0 ? `${String(Number(a.km)).replace(".", ",")} km` : "km não definido"}</span>
                </div>
              ))}
            </div>
          ) : (
            verAmigos === false ? (
              <div className="gt-plano-dica">Você escolheu não aparecer na lista de amigos, então também não vê quem vai. <button type="button" className="gt-plano-link" onClick={onVerAmigos}>Mudar nas configurações</button></div>
            ) : (
              <div className="gt-plano-dica">{nuvem ? "Nenhum amigo marcou essa prova ainda." : "Ative a sincronização para ver quem vai."}</div>
            )
          )}
          {x && outros > 0 && (
            <div className="gt-prova-detalhe-outros">
              <Ei e="👥" /> {x.amigos.length > 0 ? "+ " : ""}{outros} {outros === 1 ? "outra pessoa" : "outras pessoas"}
              {x.partes.length > 0 && <span> · {x.partes.map((q) => `${q.rotulo}: ${q.n}`).join(" · ")}</span>}
            </div>
          )}
          {(url || r.manual) && (
            <div className="gt-prova-links" style={{ marginTop: 12 }}>
              {url && <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => onLinkClick(r)}>Ver inscrição ↗</a>}
              {r.manual && <button type="button" onClick={() => { onRemoveManual(r.id); setDetalheId(null); }}>Excluir</button>}
            </div>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="gt-modal-backdrop" onClick={onClose}>
      <div className="gt-modal gt-provas-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gt-provas-head">
          <h3><Ei e="🏁" /> Provas</h3>
          <button type="button" className="gt-provas-close" onClick={onClose} title="Fechar">✕</button>
        </div>
        <div className="gt-provas-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={aba === "minhas"} className={aba === "minhas" ? "on" : ""} onClick={() => setAba("minhas")}>Minhas{minhas.length > 0 ? ` (${minhas.length})` : ""}</button>
          <button type="button" role="tab" aria-selected={aba === "explorar"} className={aba === "explorar" ? "on" : ""} onClick={() => setAba("explorar")}>Explorar</button>
          <button type="button" role="tab" aria-selected={aba === "calendario"} className={aba === "calendario" ? "on" : ""} onClick={() => setAba("calendario")}>Calendário</button>
          <button type="button" role="tab" aria-selected={aba === "metas"} className={aba === "metas" ? "on" : ""} onClick={() => setAba("metas")}>Metas</button>
        </div>

        {escolha && (
          <div className="gt-modal-backdrop" style={{ zIndex: 60 }} onClick={() => setEscolha(null)}>
            <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Qual distância você vai correr?</h3>
              <div className="gt-plano-dica" style={{ marginBottom: 8 }}>{escolha.r.nome}. Se a prova tem mais de uma opção, informe a sua.</div>
              {(() => {
                const da = planoDistanciasDaProva(escolha.r);
                const ds = [...da, ...[5, 10, 21.1, 42.2].filter((p) => !da.some((x) => Math.abs(x - p) < 0.5))].sort((a, b) => a - b);
                const atual = parseFloat(String(kmTxt).replace(",", ".")) || 0;
                return (
                  <div className="gt-provas-filters" style={{ margin: "0 0 8px" }}>
                    {ds.map((d) => <button key={d} type="button" className={`gt-provas-pill ${Math.abs(atual - d) < 0.05 ? "on" : ""}`} onClick={() => { setKmTxt(String(d).replace(".", ",")); setKmErro(""); }}>{String(d).replace(".", ",")} km</button>)}
                  </div>
                );
              })()}
              <input className="gt-input" inputMode="decimal" placeholder="Ou digite a distância em km" value={kmTxt} onChange={(e) => { setKmTxt(e.target.value); setKmErro(""); }} />
              {kmErro && <div className="gt-plano-erro" style={{ marginTop: 6 }}>{kmErro}</div>}
              <div className="gt-modal-actions" style={{ marginTop: 12 }}>
                <button type="button" className="gt-btn" onClick={() => confirmarKm(false)}>{escolha.editar ? "Salvar" : "Confirmar e marcar"}</button>
                <button type="button" className="gt-btn secondary" onClick={() => setEscolha(null)}>Cancelar</button>
              </div>
              {!escolha.editar && <button type="button" className="gt-plano-link" style={{ marginTop: 10 }} onClick={() => confirmarKm(true)}>Marcar sem definir a distância agora</button>}
            </div>
          </div>
        )}

        {detalheId && detalhe()}

        {aba === "calendario" ? (
          <div className="gt-provas-list">
            <ProvasCalendario provas={provas} marcadas={marcadas} metas={metas} hojeISO={hojeISO} onAbrir={setDetalheId} />
          </div>
        ) : aba === "metas" ? (
          <div className="gt-provas-list gt-provas-metas">
            <div className="gt-plano-dica" style={{ margin: "0 2px 10px" }}>Quer treinar para uma distância ou um tempo, sem prova marcada? Crie uma meta e receba um plano de treino de corrida.</div>
            {metaAtiva && cardMeta(metaAtiva)}
            {!metaAtiva && (
              <button type="button" className="gt-btn" style={{ width: "100%" }} onClick={onMeta}><Ei e="🎯" /> Criar uma meta de corrida</button>
            )}
            {metaAtiva && <div className="gt-plano-dica" style={{ margin: "10px 2px" }}>Uma meta ativa por vez. Para criar outra, exclua ou conclua esta.</div>}
            {metasPassadas.length > 0 && (
              <>
                <div className="gt-provas-mes">Concluídas</div>
                {metasPassadas.map(cardMeta)}
              </>
            )}
          </div>
        ) : aba === "minhas" ? (
          <div className="gt-provas-list gt-provas-minhas">
            {minhas.length === 0 ? (
              <div className="gt-provas-empty">
                Você ainda não marcou nenhuma prova.
                <button type="button" className="gt-btn small" style={{ marginTop: 10 }} onClick={() => setAba("explorar")}>Explorar provas</button>
              </div>
            ) : minhas.map((r) => cardProva(r, true))}
          </div>
        ) : (
          <>
        <div className="gt-provas-filters">
          {PROVA_MODALIDADES.map((m) => (
            <button key={m.id} type="button" className={`gt-provas-pill ${mod === m.id ? "on" : ""}`} onClick={() => setMod(m.id)}>{m.nome}</button>
          ))}
        </div>
        <div className="gt-provas-row2">
          <input className="gt-input" placeholder="Buscar prova ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <select className="gt-input" value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">Brasil</option>
            {ufsDisponiveis.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

            <div className="gt-provas-list">
              {grupos.length === 0 && (
                <div className="gt-provas-empty">Nenhuma prova com esses filtros. Se a sua não está aqui, cadastra na mão logo abaixo.</div>
              )}
              {grupos.map((g) => (
                <div key={g.k}>
                  <div className="gt-provas-mes">{g.label}</div>
                  {g.itens.map((r) => cardProva(r, false))}
                </div>
              ))}
            </div>

          <div className="gt-provas-add">
            {!adding ? (
              <button type="button" className="gt-btn secondary small" style={{ width: "100%" }} onClick={() => setAdding(true)}>+ Adicionar uma prova</button>
            ) : (
              <div className="gt-provas-form">
                <input className="gt-input" placeholder="Nome da prova" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                <div className="gt-provas-form-row">
                  <input className="gt-input" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                  <select className="gt-input" value={form.modalidade} onChange={(e) => setForm({ ...form, modalidade: e.target.value })}>
                    <option value="corrida">Corrida</option>
                    <option value="hyrox">Hyrox</option>
                    <option value="outras">Outra</option>
                  </select>
                </div>
                <div className="gt-provas-form-row">
                  <input className="gt-input" placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                  <select className="gt-input" style={{ flex: "0 0 80px" }} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })}>
                    <option value="">UF</option>
                    {Object.keys(PROVA_UFS_NOME).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {form.modalidade === "corrida" && <input className="gt-input" inputMode="decimal" placeholder="Distância que você vai correr, em km (opcional)" value={form.km} onChange={(e) => setForm({ ...form, km: e.target.value })} />}
                <input className="gt-input" placeholder="Link de inscrição (opcional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                {formErro && <div style={{ color: "var(--warn)", fontSize: 12 }}>{formErro}</div>}
                <div className="gt-provas-form-row">
                  <button type="button" className="gt-btn small" onClick={submitManual}>Salvar prova</button>
                  <button type="button" className="gt-btn secondary small" onClick={() => { setAdding(false); setFormErro(""); }}>Cancelar</button>
                </div>
              </div>
            )}
            <div className="gt-provas-foot">{nuvem ? "Suas provas marcadas ficam salvas na sua conta. As provas que você cadastra aparecem para todo mundo; só mostramos quantas pessoas vão, sem nomes. " : "Provas marcadas e cadastradas ficam só neste aparelho por enquanto. "}Datas e links vêm de fontes públicas e podem mudar: confira sempre no site do organizador.</div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// DESAFIOS (estilo gymrats): grupo com regras, semanas, pontos e aposta.
// Toda a lógica de pontos fica aqui (funções puras, sem rede): o banco só
// guarda os check-ins e as regras; quem calcula é o app, então a regra é
// transparente e fácil de mudar. Um check-in = (dia, tipo de atividade):
// no máximo um por tipo por dia (academia conta uma vez, mesmo com duas
// fichas; corrida + vôlei no mesmo dia contam as duas).
// =====================================================================
const DESAFIO_CORES = ["#C6F135", "#5AB0FF", "#FF9F43", "#FF5A9E", "#B28CFF", "#2ED3B7", "#FFD23F", "#FF6B5A"];
const DESAFIO_SEMANA_NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const DESAFIO_MODELOS = [
  {
    id: "meta", nome: "Meta semanal", desc: "Bate a meta e ganha pontos. Sem pontos negativos.",
    rules: { meta: 4, pontos: [0, 0, 1, 3, 5], bonusJuntos: 1, academia: { on: true, minMin: 30 }, atividades: { on: true, minMin: 0 } },
  },
  {
    id: "cafe", nome: "Valendo café", desc: "Quem não treina perde pontos. Ideal pra aposta entre amigos.",
    rules: { meta: 4, pontos: [-5, -3, -1, 2, 5], bonusJuntos: 1, academia: { on: true, minMin: 30 }, atividades: { on: true, minMin: 0 } },
  },
  {
    id: "simples", nome: "Simples", desc: "1 ponto por treino, até 7 por semana.",
    rules: { meta: 7, pontos: [0, 1, 2, 3, 4, 5, 6, 7], bonusJuntos: 0, academia: { on: true, minMin: 0 }, atividades: { on: true, minMin: 0 } },
  },
];

function desafioClone(x) { return JSON.parse(JSON.stringify(x)); }
function desafioDefaultRules() { return desafioClone(DESAFIO_MODELOS[0].rules); }

// Garante o formato das regras (vindas do banco ou editadas), sem quebrar com campo faltando.
function desafioNormalizeRules(raw) {
  const base = desafioDefaultRules();
  const r = raw && typeof raw === "object" ? raw : {};
  const meta = Math.min(7, Math.max(1, Math.round(Number(r.meta)) || base.meta));
  let pontos = Array.isArray(r.pontos) ? r.pontos.map((n) => Math.round(Number(n)) || 0) : base.pontos.slice();
  while (pontos.length < meta + 1) pontos.push(pontos.length ? pontos[pontos.length - 1] : 0);
  pontos = pontos.slice(0, meta + 1);
  return {
    meta,
    pontos,
    bonusJuntos: Math.min(5, Math.max(0, Math.round(Number(r.bonusJuntos)) || 0)),
    academia: {
      on: !(r.academia && r.academia.on === false),
      minMin: Math.max(0, Math.round(Number(r.academia && r.academia.minMin)) || 0),
      minExs: Math.min(15, Math.max(0, Math.round(Number(r.academia && r.academia.minExs)) || 0)),
    },
    atividades: {
      on: !(r.atividades && r.atividades.on === false),
      minMin: Math.max(0, Math.round(Number(r.atividades && r.atividades.minMin)) || 0),
      // Distância mínima (km) das atividades que têm distância (ex.: corrida do Strava).
      minKm: Math.min(100, Math.max(0, Math.round((Number(r.atividades && r.atividades.minKm) || 0) * 2) / 2)),
      // Só contam atividades cujo nome contém algum destes termos (vazio = todas).
      nomes: Array.isArray(r.atividades && r.atividades.nomes)
        ? r.atividades.nomes.map((n) => String(n).trim().slice(0, 30)).filter(Boolean).slice(0, 12) : [],
    },
    // Máximo de treinos que contam por dia: 0 = sem limite (1 por tipo), 1 = "dia ativo".
    maxPorDia: Math.min(3, Math.max(0, Math.round(Number(r.maxPorDia)) || 0)),
    // Dias da semana em que o treino conta (0 = domingo ... 6 = sábado).
    dias: (() => {
      const d = Array.isArray(r.dias) ? Array.from(new Set(r.dias.map(Number).filter((n) => n >= 0 && n <= 6 && Number.isInteger(n)))).sort() : [];
      return d.length === 0 || d.length === 7 ? [0, 1, 2, 3, 4, 5, 6] : d;
    })(),
    // Se ligado, treino sem duração registrada não conta quando há mínimo de minutos.
    exigirDuracao: !!r.exigirDuracao,
    // Se ligado, atividade sem distância registrada não conta quando há mínimo de km.
    exigirKm: !!r.exigirKm,
  };
}

// Distância (km) registrada pra uma atividade no dia: campo da carga (Strava novo) ou texto do
// comentário ("Importado do Strava — nome · 12.3 km · 45 min" ou algo digitado como "5 km").
function desafioKmDe(carga, log) {
  const c = Number(carga && carga.distanciaKm);
  if (c > 0) return c;
  const txt = log && log.comentario ? String(log.comentario) : "";
  let soma = 0;
  txt.split("\n").forEach((linha) => {
    if (linha.indexOf("Importado do Strava") === 0) {
      linha.split(" · ").forEach((seg) => { const m = seg.trim().match(/^(\d+(?:[.,]\d+)?) km$/i); if (m) soma += parseFloat(m[1].replace(",", ".")); });
    } else {
      const m = linha.match(/(\d+(?:[.,]\d+)?)\s*km\b/i);
      if (m) soma += parseFloat(m[1].replace(",", "."));
    }
  });
  return Math.round(soma * 10) / 10;
}
function desafioFmtKm(n) { return `${String(Math.round(n * 10) / 10).replace(".", ",")} km`; }

function desafioNomeNorm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function desafioNomeConta(rules, nome) {
  const lista = rules.atividades.nomes || [];
  if (lista.length === 0) return true;
  const n = desafioNomeNorm(nome);
  return lista.some((t) => { const x = desafioNomeNorm(t); return x && n.indexOf(x) >= 0; });
}
// === PLANO_CORRIDA_START
// --- Plano de treino para provas de corrida. Tudo aqui é lógica pura (sem
// React): recomendação de dias, conflito com a academia, histórico de corrida,
// montagem do prompt, leitura/validação do JSON que a IA devolve e agrupamento
// por semana. A IA propõe; o código confere e só avisa — quem manda é a pessoa. ---
const PLANO_TIPOS = {
  rodagem: { emoji: "🏃", nome: "Rodagem" },
  longao: { emoji: "🛣️", nome: "Longão" },
  intervalado: { emoji: "⚡", nome: "Intervalado" },
  tempo: { emoji: "🎯", nome: "Ritmo de prova" },
  regenerativo: { emoji: "🌿", nome: "Regenerativo" },
  prova: { emoji: "🏁", nome: "Prova" },
};
const PLANO_DIAS_NOME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const PLANO_DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const PLANO_ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

function planoDistanciasDaProva(r) {
  return ((r && r.distancias) || []).map((x) => parseFloat(String(x).replace(",", "."))).filter((n) => n > 0);
}
function planoNivelDist(km) { return km <= 7 ? 5 : km <= 15 ? 10 : km <= 30 ? 21 : 42; }
function planoLimites(km) {
  // longPico: longão-alvo do pico; longMax: acima disso acende aviso; polimento: dias de redução
  const k5 = Math.max(0, +km || 0);
  return { 5: { longPico: Math.max(8, Math.ceil(k5 * 1.3)), longMax: Math.max(10, Math.ceil(k5 * 1.6)), longMin: 5, polimento: 7 }, 10: { longPico: 12, longMax: 15, longMin: 8, polimento: 7 },
    21: { longPico: 18, longMax: 22, longMin: 14, polimento: 14 }, 42: { longPico: 32, longMax: 35, longMin: 26, polimento: 21 } }[planoNivelDist(km)];
}
function planoSemanasAte(hojeISO, provaISO) { return Math.max(0, Math.floor(diasAte(provaISO, hojeISO) / 7)); }
function planoOrdemDia(d) { return (d + 6) % 7; } // segunda=0 … domingo=6
function planoOrdenaDias(dias) { return dias.slice().sort((a, b) => planoOrdemDia(a) - planoOrdemDia(b)); }
function planoNomesDias(dias) { return planoOrdenaDias(dias).map((d) => PLANO_DIAS_CURTO[d]).join(", "); }
function planoFmtPace(min) {
  if (!(min > 0)) return "";
  let m = Math.floor(min); let s = Math.round((min - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, "0")}`;
}
function planoParsePace(txt) {
  const m = String(txt || "").trim().match(/^(\d{1,2})[:'.](\d{2})$/);
  return m ? parseInt(m[1], 10) + parseInt(m[2], 10) / 60 : 0;
}

// Quantos dias de corrida por semana fazem sentido para essa prova e esse prazo.
function planoRecomendarDias(distKm, semanas, objetivo, confortavelKm) {
  const base = { 5: [2, 3, 4], 10: [3, 3, 4], 21: [3, 4, 5], 42: [4, 4, 5] }[planoNivelDist(distKm)];
  let min = base[0]; let ideal = base[1]; let max = base[2];
  if (objetivo === "tempo" && semanas >= 8) ideal = Math.min(max, ideal + 1);
  if (semanas < 6) { ideal = Math.min(ideal, 3); max = Math.min(max, 4); }
  if (confortavelKm > 0 && confortavelKm < 3) { ideal = Math.min(ideal, 3); max = Math.min(max, 4); }
  ideal = Math.max(min, Math.min(max, ideal));
  const prova = `${String(distKm).replace(".", ",")} km`;
  const motivo = `Para ${prova} em ${semanas} semana${semanas === 1 ? "" : "s"}, ${ideal} dias por semana costuma equilibrar evolução e recuperação (dá pra ir de ${min} a ${max}).`;
  return { min, ideal, max, motivo };
}
// Quantas semanas seriam o ideal para sair do que a pessoa corre hoje e chegar à prova.
function planoSemanasIdeais(distKm, confortavelKm) {
  const b = planoNivelDist(distKm);
  const alvo = planoLimites(distKm).longPico;
  const passo = { 5: 1.5, 10: 1.5, 21: 1.5, 42: 2 }[b];
  const taper = { 5: 1, 10: 1, 21: 2, 42: 3 }[b];
  const c = Math.max(confortavelKm || 0, 2);
  const crescer = c >= alvo ? 0 : Math.ceil((alvo - c) / passo);
  return Math.max(4, crescer + taper + 1);
}
function planoAvaliarPrazo(distKm, semanas, confortavelKm) {
  const ideal = planoSemanasIdeais(distKm, confortavelKm);
  if (semanas < 2) return { nivel: "curto", ideal, texto: "A prova é daqui a menos de 2 semanas: não dá tempo de construir condicionamento. O melhor é manter treinos leves e foco em chegar bem descansado." };
  if (semanas < ideal * 0.75) {
    return { nivel: "curto", ideal, texto: `Faltam ${semanas} semanas e o ideal pra chegar com segurança seria uns ${ideal}. Dá pra fazer, mas com meta conservadora: completar a prova, alternando corrida e caminhada se precisar.` };
  }
  if (semanas > 20 && semanas > ideal * 2.2) {
    return { nivel: "longo", ideal, texto: `Faltam ${semanas} semanas, bastante tempo. O plano começa com uma fase de base mais tranquila e evolui em blocos.` };
  }
  return null;
}

// Dias da semana (0=dom…6=sáb) em que a pessoa tem ficha de academia na agenda.
function planoDiasAcademia(schedule) {
  const out = [];
  for (let d = 0; d < 7; d++) if (((schedule && schedule[d]) || []).some((it) => it.tipo === "treino")) out.push(d);
  return out;
}
// Escolhe n dias de corrida evitando academia, dias colados e priorizando um dia de fim de semana pro longão.
function planoSugerirDias(n, diasAcademia, preferidos) {
  n = Math.max(1, Math.min(7, n | 0));
  const acad = diasAcademia || []; const pref = preferidos || [];
  let melhor = null;
  const total = 1 << 7;
  for (let mask = 0; mask < total; mask++) {
    const dias = [];
    for (let d = 0; d < 7; d++) if (mask & (1 << d)) dias.push(d);
    if (dias.length !== n) continue;
    const ord = dias.map(planoOrdemDia).sort((a, b) => a - b);
    let score = 0;
    dias.forEach((d) => { if (acad.indexOf(d) >= 0) score -= 100; if (pref.indexOf(d) >= 0) score += 3; });
    for (let i = 1; i < ord.length; i++) if (ord[i] - ord[i - 1] === 1) score -= 10;
    if (dias.indexOf(6) >= 0 || dias.indexOf(0) >= 0) score += 8;
    if (!melhor || score > melhor.score) melhor = { score, dias };
  }
  const dias = planoOrdenaDias(melhor.dias);
  return { dias, conflitos: dias.filter((d) => acad.indexOf(d) >= 0) };
}
function planoDiaLongao(dias) {
  if (dias.indexOf(6) >= 0) return 6;
  if (dias.indexOf(0) >= 0) return 0;
  const o = planoOrdenaDias(dias);
  return o[o.length - 1];
}

// Resumo das corridas recentes (Strava ou registradas à mão) pra sugerir o ponto de partida.
function planoHistoricoCorrida(sessions, atividadeById, hojeISO, semanas) {
  const inicio = addDays(hojeISO, -7 * (semanas || 8));
  const corridas = [];
  Object.keys(sessions || {}).forEach((date) => {
    if (date < inicio || date > hojeISO) return;
    const s = sessions[date] || {}; const log = s.log || {}; const cargas = s.cargas || {};
    Object.keys(log).forEach((k) => {
      if (k.indexOf("atividade:") !== 0) return;
      const v = log[k];
      if (!v || v.status !== "fui") return;
      const a = atividadeById ? atividadeById(k.slice("atividade:".length)) : null;
      if (!a || !/corrid|correr|running|\brun\b/.test(desafioNomeNorm(a.nome))) return;
      const km = desafioKmDe(cargas[k], v);
      if (!(km > 0)) return;
      corridas.push({ date, km, min: Number(cargas[k] && cargas[k].duracaoMin) || 0 });
    });
  });
  if (!corridas.length) return null;
  const kms = corridas.map((c) => c.km).sort((a, b) => a - b);
  const metade = kms.slice(Math.floor(kms.length / 2));
  const med = metade[Math.floor((metade.length - 1) / 2)];
  const comPace = corridas.filter((c) => c.min > 0);
  const somaKm = comPace.reduce((t, c) => t + c.km, 0);
  const pace = somaKm > 0 ? comPace.reduce((t, c) => t + c.min, 0) / somaKm : 0;
  return {
    n: corridas.length,
    maiorKm: Math.round(kms[kms.length - 1] * 10) / 10,
    confortavelKm: Math.max(1, Math.round(med * 2) / 2),
    paceMin: pace >= 3 && pace <= 12 ? pace : 0,
  };
}

// Lê tempos como "28:00", "50min", "1h55", "1:05:30" e devolve minutos (0 se inválido).
function planoTempoMin(txt) {
  const t = String(txt || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return 0;
  let m = t.match(/^(\d{1,2})h(\d{1,2})?(?:min)?$/);
  if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  m = t.match(/^(\d{1,3})(?:min|m)?$/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / 60;
  m = t.match(/^(\d{1,3}):(\d{2})$/);
  if (m) { const a = parseInt(m[1], 10), b = parseInt(m[2], 10); return a <= 3 ? a * 60 + b : a + b / 60; }
  return 0;
}

function planoDataBR(iso) { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }

function planoMontarPrompt(p) {
  const lim = planoLimites(p.distKm);
  const km = String(p.distKm).replace(".", ",");
  const inicio = p.hojeISO < addDays(p.provaISO, -1) ? p.hojeISO : addDays(p.provaISO, -1);
  const fim = addDays(p.provaISO, -1);
  const linhas = [];
  linhas.push("Você é um treinador de corrida experiente. Monte um plano de treino de corrida personalizado e responda SOMENTE com um JSON válido (sem texto fora do JSON, sem comentários, sem bloco de código).");
  linhas.push("");
  linhas.push("DADOS DA PESSOA");
  const alvo = p.meta ? "meta" : "prova";
  linhas.push(p.meta
    ? `- Meta pessoal (a pessoa NÃO tem prova inscrita): ${p.provaNome}, para ${planoDataBR(p.provaISO)} (${km} km${p.meta.tipo === "habito" ? " por corrida" : ""}).`
    : `- Prova: ${p.provaNome}, em ${planoDataBR(p.provaISO)} (${km} km).`);
  linhas.push(`- Hoje é ${planoDataBR(p.hojeISO)}; faltam ${p.semanas} semana${p.semanas === 1 ? "" : "s"} (${diasAte(p.provaISO, p.hojeISO)} dias).`);
  linhas.push(`- Corre hoje, com conforto, cerca de ${String(p.confortavelKm).replace(".", ",")} km por treino${p.paceTxt ? `; pace de referência nesses treinos: ${p.paceTxt} min/km` : "; não informou pace de referência"}.`);
  if (p.tempoAtual) linhas.push(`- Tempo atual nessa distância (${km} km): ${p.tempoAtual}. Calibre os ritmos de treino a partir dele e da meta.`);
  linhas.push(p.meta && p.meta.tipo === "habito"
    ? `- Objetivo: criar o hábito de correr com regularidade durante ${p.semanas} semanas, sem pressa de aumentar distância: priorize constância, prazer e progressão muito leve (a meta é conseguir correr cerca de ${km} km por sessão com conforto).`
    : p.objetivo === "tempo"
      ? `- Objetivo: baixar o tempo${p.tempoAlvo ? ` (meta: ${p.tempoAlvo})` : ""}.`
      : `- Objetivo: ${p.meta ? "conseguir correr essa distância" : "completar a prova"} com segurança.`);
  linhas.push(`- Dias de corrida por semana: ${p.dias.length} (${planoOrdenaDias(p.dias).map((d) => PLANO_DIAS_NOME[d]).join(", ")}). Longão na ${PLANO_DIAS_NOME[p.diaLongao]}.`);
  if (p.diasAcademia && p.diasAcademia.length) {
    const emConflito = p.dias.filter((d) => p.diasAcademia.indexOf(d) >= 0);
    linhas.push(`- Faz musculação nos dias: ${planoOrdenaDias(p.diasAcademia).map((d) => PLANO_DIAS_NOME[d]).join(", ")}.` + (emConflito.length && p.mantemConflito
      ? ` Os dias de corrida ${planoOrdenaDias(emConflito).map((d) => PLANO_DIAS_NOME[d]).join(", ")} coincidem com a musculação: nesses dias, prefira sessões mais curtas e leves, e nunca intervalado ou longão.`
      : " Evite pôr sessões de intensidade colada em dia de perna."));
  }
  { const av = planoAvaliarPrazo(p.distKm, p.semanas, p.confortavelKm);
    linhas.push(av && av.nivel === "curto"
      ? `- Avaliação do prazo (feita pelo app): CURTO — o ideal seria ~${av.ideal} semanas. Seja conservador e priorize completar com segurança.`
      : `- Avaliação do prazo (feita pelo app): ADEQUADO — dá para evoluir bem em ${p.semanas} semanas. Monte um plano de verdade, com progressão firme; NÃO o trate como conservador nem como "prazo curto".`); }
  linhas.push(`- Lesões ou restrições: ${p.lesoes ? p.lesoes : "nenhuma informada"}.`);
  linhas.push(p.usaRelogio ? "- Treina com relógio/GPS (pode usar pace)." : "- Não usa relógio: priorize esforço percebido.");
  if (p.replan) {
    const r = p.replan;
    linhas.push("");
    linhas.push("HISTÓRICO DO PLANO ANTERIOR (REPLANEJAMENTO)");
    linhas.push(`- Das ${r.totalPassadas} sessões previstas até hoje, ${r.feitasTotal} foram feitas e ${r.naoFeitasTotal} não (puladas ou sem registro).`);
    linhas.push(r.ultimaFeita ? `- Última sessão feita em ${planoDataBR(r.ultimaFeita)} (há ${r.diasParado} dias).` : "- Nenhuma sessão do plano anterior foi registrada como feita.");
    if (r.maiorKmRecente > 0) linhas.push(`- Maior corrida registrada nas últimas 8 semanas: ${String(r.maiorKmRecente).replace(".", ",")} km.`);
    if (r.motivo) linhas.push(`- Motivo do replanejamento: ${r.motivo}.`);
  }
  linhas.push("");
  linhas.push("REGRAS");
  linhas.push(`1. A primeira sessão pode ser a partir de ${p.hojeISO} e a última no máximo em ${fim}. Não inclua ${p.meta ? "o dia da meta" : "a prova em si"} nem dias de descanso: só as sessões de corrida.`);
  linhas.push(`2. Use apenas os dias da semana indicados, no máximo ${p.dias.length} sessões por semana. O longão sempre no dia indicado.`);
  linhas.push("3. Divida em fases proporcionais ao prazo (Base, Construção, Pico, Polimento). Se faltar bastante tempo, comece com uma base tranquila; se faltar pouco, vá direto ao essencial.");
  linhas.push(`4. Aumente o volume semanal de forma gradual (em geral até ~10%, no máximo 15%) e inclua uma semana mais leve (volume 20% a 30% menor) a cada 3 ou 4 semanas. O longão cresce até um pico de cerca de ${lim.longPico} km e nunca passa de ${lim.longMax} km.`);
  linhas.push("5. No máximo 2 sessões de intensidade (intervalado ou tempo) por semana, nunca em dias seguidos. Só pessoas iniciantes (que correm confortável menos de 3 km) ficam apenas com rodagens leves até a base estar firme.");
  linhas.push(`6. Polimento: nos últimos ${lim.polimento} dias antes d${p.meta ? "a meta" : "a prova"}, reduza o volume (a última semana com cerca de 50% a 60% do pico), mantendo sessões curtas e leves.`);
  linhas.push("7. Só adote postura conservadora se a AVALIAÇÃO DO PRAZO acima disser CURTO ou se o objetivo for claramente ambicioso demais; nesses casos, use corrida/caminhada se preciso e explique em \"avisos\". Caso contrário, atue como uma consultoria de corrida: o melhor plano possível dentro do prazo, sem excesso de cautela.");
  linhas.push(`8. Em cada sessão, preencha "esforco" em linguagem simples (ex.: "leve, dá pra conversar"). ${p.paceTxt && p.usaRelogio ? 'Preencha também "pace" com uma faixa em min/km (ex.: "6:30-7:00") calculada a partir do pace de referência' + (p.objetivo === "tempo" && p.tempoAlvo ? " e da meta de tempo" : "") + "." : 'Use "pace": null.'}`);
  linhas.push('9. Respeite as lesões informadas (adapte as sessões e, se houver lesão, traga um aviso curto sobre ela). Em "avisos" coloque no máximo 3 itens, só o que for específico desta pessoa (prazo, lesão, conflito com musculação). Não repita recomendações genéricas (hidratação, ritmo de largada, "pare se doer", paces são referência): o app já mostra um aviso de saúde.');
  linhas.push(p.compacto
    ? '10. Em cada sessão, escolha o "modelo" de treino mais adequado (lista no fim). NÃO escreva etapas nem título: o app monta aquecimento, tiros, blocos e desaquecimento sozinho a partir do modelo e da distância. Respeite a distância mínima de cada modelo.'
    : '10. Toda sessão de intervalado e de tempo (e longões com variação de ritmo) DEVE trazer "etapas" descrevendo o treino passo a passo: aquecimento, os tiros/blocos com repetições, recuperação e desaquecimento. Rodagens simples podem ter "etapas": [].');
  linhas.push("11. Qualidade e progressão: se a pessoa corre confortável pelo menos 3 km, inclua 1 sessão de qualidade por semana a partir da segunda semana (progressivo, tempo ou intervalado leve), evoluindo para o ritmo da meta nas últimas semanas antes do polimento. O longão cresce de 1 a 1,5 km por semana até o pico (exceto nas semanas leves). Já na primeira semana use todos os dias de corrida disponíveis a partir de hoje.");
  if (p.replan) {
    linhas.push("12. Este é um REPLANEJAMENTO: comece a partir de hoje levando em conta o tempo parado. Se a pessoa ficou mais de 10 dias sem treinar, a primeira semana deve ter cerca de 60% a 70% do volume que ela fazia antes; se parou menos que isso, retome em cerca de 80%. Não tente \"compensar\" as sessões perdidas. Se o prazo que sobrou ficou curto demais para o objetivo, ajuste a meta de forma conservadora e explique em \"avisos\".");
  }
  linhas.push("");
  linhas.push("FORMATO DA RESPOSTA (JSON)");
  if (p.compacto) {
    linhas.push("{");
    linhas.push('  "resumo": "2 a 3 frases explicando a estratégia e as fases",');
    linhas.push('  "avisos": ["alertas importantes, se houver; lista vazia se não houver"],');
    linhas.push('  "sessoes": [');
    linhas.push('    { "data": "AAAA-MM-DD", "fase": "Base", "modelo": "rodagem", "distanciaKm": 5, "duracaoMin": 35, "esforco": "leve, dá pra conversar", "pace": "6:30-7:00", "nota": "foco da sessão em uma frase curta" },');
    linhas.push('    { "data": "AAAA-MM-DD", "fase": "Construção", "modelo": "tiros400", "distanciaKm": 6, "duracaoMin": 42, "esforco": "tiros fortes, recuperação leve", "pace": null, "nota": "boa postura nos tiros" }');
    linhas.push("  ]");
    linhas.push("}");
    linhas.push('"modelo" deve ser exatamente um destes (distância mínima em km): ' + Object.keys(TREINOS_CORRIDA).map((k) => `${k} (${TREINOS_CORRIDA[k].min})`).join(", ") + ". Significados: rodagem = corrida leve contínua; regenerativo = bem leve e curto; longao = mais longo da semana em ritmo constante; longao_prog = longão que termina mais forte; tempo = bloco contínuo em ritmo de limiar; progressivo = cada trecho mais rápido; fartlek = alterna forte e leve por tempo; tiros200/400/800/1000 = tiros (distância de cada tiro em metros) com pausa. \"nota\" tem no máximo 1 frase curta. \"data\" sempre no formato AAAA-MM-DD. Ordene as sessões por data. Responda só com o JSON, sem texto extra.");
    return linhas.join("\n");
  }
  linhas.push("{");
  linhas.push('  "resumo": "2 a 3 frases explicando a estratégia e as fases",');
  linhas.push('  "avisos": ["alertas importantes, se houver; lista vazia se não houver"],');
  linhas.push('  "sessoes": [');
  linhas.push('    { "data": "AAAA-MM-DD", "fase": "Base", "tipo": "rodagem", "titulo": "Rodagem leve", "distanciaKm": 5, "duracaoMin": 35, "esforco": "leve, dá pra conversar", "pace": "6:30-7:00", "detalhes": "como executar a sessão em 1 ou 2 frases", "etapas": [] },');
  linhas.push('    { "data": "AAAA-MM-DD", "fase": "Construção", "tipo": "intervalado", "titulo": "Tiros curtos", "distanciaKm": 5, "duracaoMin": 38, "esforco": "tiros fortes, recuperação caminhando", "pace": null, "detalhes": "foco em boa postura nos tiros",');
  linhas.push('      "etapas": [');
  linhas.push('        { "tipo": "aquecimento", "duracaoMin": 10, "esforco": "trote leve" },');
  linhas.push('        { "repeticoes": 6, "passos": [ { "tipo": "forte", "distanciaM": 400, "esforco": "forte (RPE 8)", "pace": "5:00" }, { "tipo": "caminhada", "distanciaM": 200, "descricao": "caminhando" } ] },');
  linhas.push('        { "tipo": "desaquecimento", "duracaoMin": 5, "esforco": "trote leve" }');
  linhas.push('      ] }');
  linhas.push("  ]");
  linhas.push("}");
  linhas.push('"tipo" da sessão deve ser um destes: rodagem, longao, intervalado, tempo, regenerativo. "tipo" de cada etapa: aquecimento, leve, constante, moderado, forte, recuperacao, caminhada, desaquecimento. Cada etapa usa "distanciaM" (metros) OU "duracaoMin"/"duracaoSeg". "data" sempre no formato AAAA-MM-DD. Ordene as sessões por data.');
  return linhas.join("\n");
}

function planoParseJson(texto) {
  const t = String(texto || "");
  const a = t.indexOf("{"); const b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}
function planoTipoNorm(t) {
  const n = desafioNomeNorm(t);
  if (/long/.test(n)) return "longao";
  if (/interval|tiro|fartlek|repeti/.test(n)) return "intervalado";
  if (/tempo|ritmo|limiar/.test(n)) return "tempo";
  if (/regener|recuper|solto/.test(n)) return "regenerativo";
  return "rodagem";
}
function planoNum(v, max) {
  const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return n > 0 && n <= max ? Math.round(n * 10) / 10 : 0;
}
// Converte o JSON cru da IA em plano limpo. Descarta sessões fora do período e acrescenta o dia da prova.
function planoNormalizar(raw, ctx) {
  if (!raw || !Array.isArray(raw.sessoes)) return null;
  const fim = addDays(ctx.provaISO, -1);
  let descartadas = 0;
  const sessoes = [];
  raw.sessoes.forEach((s) => {
    const data = s && typeof s.data === "string" ? s.data.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data < ctx.hojeISO || data > fim) { descartadas++; return; }
    const tipo = planoTipoNorm(s.tipo);
    const pace = typeof s.pace === "string" && /^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/.test(s.pace.trim()) ? s.pace.trim() : "";
    sessoes.push({
      data, tipo,
      fase: typeof s.fase === "string" ? s.fase.trim().slice(0, 30) : "",
      titulo: (typeof s.titulo === "string" && s.titulo.trim() ? s.titulo.trim() : PLANO_TIPOS[tipo].nome).slice(0, 80),
      distanciaKm: planoNum(s.distanciaKm, 100),
      duracaoMin: Math.round(planoNum(s.duracaoMin, 600)),
      esforco: typeof s.esforco === "string" ? s.esforco.trim().slice(0, 120) : "",
      pace,
      detalhes: typeof s.detalhes === "string" ? s.detalhes.trim().slice(0, 400) : "",
      etapas: planoEtapasNorm(s.etapas),
    });
  });
  sessoes.sort((a, b) => a.data.localeCompare(b.data));
  sessoes.push(ctx.meta
    ? { data: ctx.provaISO, tipo: "prova", meta: true, fase: "", titulo: `Dia da meta: ${ctx.provaNome}`, distanciaKm: ctx.distKm, duracaoMin: 0, esforco: "", pace: "", detalhes: "Dia de colocar a meta à prova. Faça um bom aquecimento, comece num ritmo confortável e ouça seu corpo.", etapas: [] }
    : { data: ctx.provaISO, tipo: "prova", fase: "", titulo: ctx.provaNome, distanciaKm: ctx.distKm, duracaoMin: 0, esforco: "", pace: "", detalhes: "Dia da prova. Confira o kit, o horário de largada e capriche no aquecimento.", etapas: [] });
  return {
    resumo: typeof raw.resumo === "string" ? raw.resumo.trim().slice(0, 600) : "",
    avisos: (Array.isArray(raw.avisos) ? raw.avisos : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim().slice(0, 300)).slice(0, 8),
    sessoes, descartadas,
  };
}
function planoSemanaChave(iso) { return addDays(iso, -planoOrdemDia(weekdayOf(iso))); }
// Agrupa as sessões por semana (segunda a domingo) com o volume de cada uma.
function planoSemanas(plano) {
  const mapa = new Map();
  (plano.sessoes || []).forEach((s, idx) => {
    const k = planoSemanaChave(s.data);
    if (!mapa.has(k)) mapa.set(k, { inicio: k, fim: addDays(k, 6), sessoes: [], km: 0 });
    const w = mapa.get(k);
    w.sessoes.push({ ...s, idx });
    if (s.tipo !== "prova") w.km += s.distanciaKm || 0;
  });
  return Array.from(mapa.values()).sort((a, b) => a.inicio.localeCompare(b.inicio)).map((w, i) => ({ ...w, n: i + 1, km: Math.round(w.km * 10) / 10 }));
}
// Confere o plano contra regras básicas de segurança. Devolve avisos; nunca bloqueia (só plano vazio).
function planoValidar(plano, ctx) {
  const out = [];
  const corridas = (plano.sessoes || []).filter((s) => s.tipo !== "prova");
  if (!corridas.length) return [{ nivel: "erro", texto: "O plano veio sem nenhuma sessão válida (datas fora do período ou formato errado). Confira o JSON ou peça de novo à IA." }];
  const lim = planoLimites(ctx.distKm);
  const sem = planoSemanas(plano);
  const nDias = ctx.nDias || 7;
  sem.forEach((w) => {
    const n = w.sessoes.filter((s) => s.tipo !== "prova").length;
    if (n > nDias) out.push({ nivel: "aviso", texto: `A semana ${w.n} tem ${n} sessões, mais do que os ${nDias} dias escolhidos.` });
    const forte = w.sessoes.filter((s) => s.tipo === "intervalado" || s.tipo === "tempo").length;
    if (forte > 2) out.push({ nivel: "aviso", texto: `A semana ${w.n} tem ${forte} sessões de intensidade; o recomendado é no máximo 2.` });
  });
  const saltos = [];
  for (let i = 1; i < sem.length - 1; i++) {
    const a = sem[i - 1]; const b = sem[i];
    if (a.km > 0 && b.km > a.km * 1.15 + 1) saltos.push(b.n);
  }
  if (saltos.length) out.push({ nivel: "aviso", texto: `O volume sobe mais de 15% de uma semana pra outra (semana${saltos.length > 1 ? "s" : ""} ${saltos.join(", ")}). Isso aumenta o risco de lesão.` });
  const longoMax = Math.max(0, ...corridas.map((s) => s.distanciaKm || 0));
  if (longoMax > lim.longMax) out.push({ nivel: "aviso", texto: `Tem sessão de ${String(longoMax).replace(".", ",")} km, acima do teto de ${lim.longMax} km sugerido para essa prova.` });
  const primeiroLongao = corridas.find((s) => s.tipo === "longao");
  if (primeiroLongao && ctx.confortavelKm > 0 && primeiroLongao.distanciaKm > ctx.confortavelKm * 1.4 + 1) {
    out.push({ nivel: "aviso", texto: `O primeiro longão (${String(primeiroLongao.distanciaKm).replace(".", ",")} km) é um salto grande em relação aos ${String(ctx.confortavelKm).replace(".", ",")} km que você corre hoje.` });
  }
  const spanDias = diasAte(ctx.provaISO, corridas[0].data);
  if (spanDias >= 21) {
    const pico = Math.max(...sem.map((w) => w.km));
    const ultimos = corridas.filter((s) => diasAte(ctx.provaISO, s.data) <= lim.polimento).reduce((t, s) => t + (s.distanciaKm || 0), 0);
    const semanalEq = (ultimos * 7) / lim.polimento;
    if (pico > 0 && semanalEq > pico * 0.75) out.push({ nivel: "aviso", texto: "O volume das últimas semanas antes da prova ainda está alto; o ideal é reduzir (polimento) pra chegar descansado." });
  }
  if (sem.length >= 7) {
    const temLeve = sem.some((w, i) => i > 0 && i < sem.length - 1 && sem[i - 1].km > 0 && w.km <= sem[i - 1].km * 0.85);
    if (!temLeve) out.push({ nivel: "info", texto: "Não há semanas mais leves de recuperação ao longo do plano. Vale incluir uma a cada 3 ou 4 semanas." });
  }
  if (longoMax < lim.longMin) {
    out.push({ nivel: "info", texto: `A maior sessão do plano tem ${String(longoMax).replace(".", ",")} km. Pra essa prova costuma-se chegar a ${lim.longMin} km ou mais; se o prazo é curto, isso é esperado, e a meta deve ser conservadora.` });
  }
  if (ctx.dias && ctx.dias.length) {
    const fora = corridas.filter((s) => ctx.dias.indexOf(weekdayOf(s.data)) < 0).length;
    if (fora) out.push({ nivel: "info", texto: `${fora} sessão(ões) caem em dias da semana diferentes dos que você escolheu.` });
  }
  if (ctx.diasAcademia && ctx.diasAcademia.length && ctx.mantemConflito) {
    const em = corridas.filter((s) => ctx.diasAcademia.indexOf(weekdayOf(s.data)) >= 0).length;
    if (em) out.push({ nivel: "info", texto: `${em} sessão(ões) caem em dias de musculação, como você escolheu manter.` });
  }
  const ordem = { erro: 0, aviso: 1, info: 2 };
  return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}
// Sessões dos planos para um dia (aparecem na aba Hoje).
function planoSessoesDoDia(planos, iso) {
  const out = [];
  (planos || []).forEach((pl) => (pl.sessoes || []).forEach((s, idx) => { if (s.data === iso) out.push({ plano: pl, sessao: s, idx }); }));
  return out;
}
// Etapas de uma sessão (aquecimento, tiros, recuperação…). Cada etapa é um passo simples
// ({tipo, distanciaM|duracaoMin|duracaoSeg, esforco, pace, descricao}) ou um bloco repetido
// ({repeticoes, passos:[…]}). O gráfico e o texto de resumo saem daqui.
const PLANO_ETAPA_TIPOS = {
  aquecimento: { nome: "aquecimento", nivel: 2 },
  leve: { nome: "trote leve", nivel: 2 },
  constante: { nome: "ritmo constante", nivel: 2 },
  moderado: { nome: "ritmo de prova", nivel: 3 },
  forte: { nome: "forte", nivel: 4 },
  recuperacao: { nome: "recuperação", nivel: 1 },
  caminhada: { nome: "caminhada", nivel: 1 },
  desaquecimento: { nome: "desaquecimento", nivel: 2 },
};
function planoEtapaTipoNorm(t) {
  const n = desafioNomeNorm(t);
  if (/desaquec|volta a calma|cool/.test(n)) return "desaquecimento";
  if (/aquec|warm/.test(n)) return "aquecimento";
  if (/caminh/.test(n)) return "caminhada";
  if (/recup|descans|trote suave/.test(n)) return "recuperacao";
  if (/forte|tiro|sprint|intens|rapid|acelera/.test(n)) return "forte";
  if (/constan|estavel|steady|continu/.test(n)) return "constante";
  if (/moder|prova|tempo|limiar/.test(n)) return "moderado";
  return "leve";
}
function planoPassoNorm(p) {
  if (!p || typeof p !== "object") return null;
  const tipo = planoEtapaTipoNorm(p.tipo);
  const distanciaM = Math.round(planoNum(p.distanciaM, 50000));
  const duracaoSeg = Math.round(planoNum(p.duracaoSeg, 7200)) || (planoNum(p.duracaoMin, 240) ? Math.round(planoNum(p.duracaoMin, 240) * 60) : 0);
  if (!distanciaM && !duracaoSeg) return null;
  const pace = typeof p.pace === "string" && /^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/.test(p.pace.trim()) ? p.pace.trim() : "";
  return {
    tipo, distanciaM: distanciaM || 0, duracaoSeg: distanciaM ? 0 : duracaoSeg,
    esforco: typeof p.esforco === "string" ? p.esforco.trim().slice(0, 80) : "",
    pace, descricao: typeof p.descricao === "string" ? p.descricao.trim().slice(0, 80) : "",
  };
}
function planoEtapasNorm(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.slice(0, 20).forEach((e) => {
    if (e && Array.isArray(e.passos)) {
      const passos = e.passos.slice(0, 6).map(planoPassoNorm).filter(Boolean);
      const reps = Math.round(planoNum(e.repeticoes, 40)) || 1;
      if (passos.length) out.push({ repeticoes: reps, passos });
    } else {
      const p = planoPassoNorm(e);
      if (p) out.push(p);
    }
  });
  return out;
}
function planoFmtDistM(m) { return m >= 1000 ? `${String(Math.round(m / 100) / 10).replace(".", ",")} km` : `${m} m`; }
function planoFmtDurSeg(sg) { return sg >= 60 && sg % 60 === 0 ? `${sg / 60} min` : sg >= 120 ? `${Math.floor(sg / 60)} min ${sg % 60} s` : `${sg} s`; }
function planoPassoTexto(p) {
  const q = p.distanciaM ? planoFmtDistM(p.distanciaM) : planoFmtDurSeg(p.duracaoSeg);
  return `${q} ${p.descricao ? p.descricao : PLANO_ETAPA_TIPOS[p.tipo].nome}`;
}
// "5 min aquecimento · 4× (200 m forte + 100 m caminhando) · 5 min desaquecimento"
function planoEtapasResumo(etapas) {
  return (etapas || []).map((e) => e.passos ? `${e.repeticoes}× (${e.passos.map(planoPassoTexto).join(" + ")})` : planoPassoTexto(e)).join(" · ");
}
// Minutos estimados de um passo (usado só pra proporção do gráfico).
function planoPassoMin(p, paceBase) {
  if (p.duracaoSeg) return p.duracaoSeg / 60;
  const pb = paceBase > 0 ? paceBase : 6.5;
  const fator = { forte: 0.78, moderado: 0.9, recuperacao: 1.25, caminhada: 11 / pb, aquecimento: 1.1, desaquecimento: 1.1 }[p.tipo] || 1;
  const pp = p.pace ? planoParsePace(p.pace.split(/[-–]/)[0].trim()) : 0;
  return (p.distanciaM / 1000) * (pp > 0 ? pp : pb * fator);
}
// Lista plana de segmentos (blocos repetidos já expandidos) com minutos e nível de intensidade.
function planoEtapasSegmentos(etapas, paceBase) {
  const out = [];
  (etapas || []).forEach((e) => {
    const lista = e.passos ? Array.from({ length: e.repeticoes }, () => e.passos).reduce((a, b) => a.concat(b), []) : [e];
    lista.forEach((p) => out.push({ tipo: p.tipo, nivel: PLANO_ETAPA_TIPOS[p.tipo].nivel, min: Math.max(0.3, planoPassoMin(p, paceBase)), texto: planoPassoTexto(p) }));
  });
  return out;
}
// --- Replanejar: detecta plano atrasado (sessões das últimas 2 semanas sem registro) ou prova
// com data diferente, e junta o plano antigo (só o que já passou) com o novo. ---
function planoCorridaFeitaNoDia(sessions, atividadeById, iso) {
  const log = ((sessions || {})[iso] || {}).log || {};
  return Object.keys(log).some((k) => {
    if (k.indexOf("atividade:") !== 0 || !log[k] || log[k].status !== "fui") return false;
    const a = atividadeById ? atividadeById(k.slice("atividade:".length)) : null;
    return !!a && /corrid|correr|running|\brun\b/.test(desafioNomeNorm(a.nome));
  });
}
function planoSituacao(plano, hojeISO, feitaNoDia, provaAtualISO) {
  const feita = (s) => s.status === "feito" || (s.status !== "pulou" && !!feitaNoDia && feitaNoDia(s.data));
  const passadas = (plano.sessoes || []).filter((s) => s.tipo !== "prova" && s.data < hojeISO);
  // Depois de um replanejamento, só conta o que veio depois dele (o passado antigo já foi "perdoado").
  const desde = plano.replanejadoEm ? isoFromDate(new Date(plano.replanejadoEm)) : "";
  const recentes = passadas.filter((s) => s.data >= addDays(hojeISO, -14) && s.data >= desde);
  const feitasRec = recentes.filter(feita).length;
  const faltou = recentes.length - feitasRec;
  const feitas = passadas.filter(feita);
  const ultimaFeita = feitas.length ? feitas[feitas.length - 1].data : null;
  const refParado = ultimaFeita || (passadas.length ? passadas[0].data : null);
  const dataMudou = !!provaAtualISO && provaAtualISO !== plano.provaData;
  const restantes = (plano.sessoes || []).filter((s) => s.tipo !== "prova" && s.data >= hojeISO).length;
  return {
    totalPassadas: passadas.length, feitasTotal: feitas.length, naoFeitasTotal: passadas.length - feitas.length,
    recentes: recentes.length, feitasRec, faltou, ultimaFeita,
    diasParado: refParado ? Math.max(0, diasAte(hojeISO, refParado)) : 0,
    atrasado: recentes.length >= 2 && faltou >= Math.max(2, Math.ceil(recentes.length * 0.5)),
    dataMudou, restantes,
  };
}
function planoMotivoReplan(sit) {
  const m = [];
  if (sit.atrasado) m.push(`${sit.faltou} de ${sit.recentes} sessões das últimas 2 semanas ficaram sem registro`);
  if (sit.dataMudou) m.push("a data da prova mudou");
  return m.join(" e ");
}
// Plano novo (a partir de hoje) + o que o plano antigo já tinha de passado, com os status.
function planoJuntarReplan(antigo, novo, hojeISO) {
  const passado = (antigo.sessoes || []).filter((s) => s.tipo !== "prova" && s.data < hojeISO);
  return { ...novo, sessoes: passado.concat(novo.sessoes).sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === "prova" ? 1 : 0) - (b.tipo === "prova" ? 1 : 0)) };
}

// --- Treinos de corrida avulsos: o app monta o treino por regras (sem IA). ---
const TREINOS_CORRIDA = {
  rodagem: { nome: "Rodagem leve", emoji: "🏃", desc: "Corrida contínua em ritmo confortável, dá pra conversar.", min: 2 },
  regenerativo: { nome: "Regenerativo", emoji: "🌿", desc: "Bem leve e curto, para soltar as pernas.", min: 2 },
  longao: { nome: "Longão", emoji: "🛣️", desc: "O treino mais longo da semana, em ritmo constante.", min: 6 },
  longao_prog: { nome: "Longão progressivo", emoji: "🛣️", desc: "Começa leve e termina mais forte.", min: 8 },
  tempo: { nome: "Ritmo (tempo run)", emoji: "🎯", desc: "Bloco contínuo em ritmo forte e controlado.", min: 5 },
  progressivo: { nome: "Progressivo", emoji: "📈", desc: "Cada trecho um pouco mais rápido que o anterior.", min: 5 },
  fartlek: { nome: "Fartlek", emoji: "🎲", desc: "Alterna trechos fortes e leves por tempo.", min: 5 },
  tiros200: { nome: "Tiros de 200 m", emoji: "⚡", desc: "Tiros curtíssimos e rápidos, com pausa caminhando.", min: 4 },
  tiros400: { nome: "Tiros de 400 m", emoji: "⚡", desc: "Clássico para velocidade: 400 m forte, pausa em trote.", min: 5 },
  tiros800: { nome: "Yasso 800", emoji: "⚡", desc: "800 m fortes com pausa de trote, para ritmo de prova.", min: 6 },
  tiros1000: { nome: "Tiros de 1000 m", emoji: "⚡", desc: "Tiros longos, ótimos para ritmo de 5 a 10 km.", min: 7 },
};
const TREINOS_CORRIDA_NIVEIS = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado" };
function planoPaceStr(p, ate) { if (!(p > 0)) return ""; return ate > p ? `${planoFmtPace(p)}-${planoFmtPace(ate)}` : planoFmtPace(p); }
// Gera as etapas de um treino de corrida. paceMin = pace leve de referência (min/km, 0 se não informado).
// Devolve { ok:true, treino } ou { ok:false, erro }. A soma das etapas fecha exatamente a distância pedida.
function planoGerarTreinoCorrida(tipo, km, nivel, paceMin) {
  const cfg = TREINOS_CORRIDA[tipo];
  km = Math.round((+km || 0) * 10) / 10;
  if (!cfg) return { ok: false, erro: "Tipo de treino desconhecido." };
  if (!(km > 0) || km > 60) return { ok: false, erro: "Informe a distância total em km (até 60)." };
  const lv = nivel === "iniciante" || nivel === "avancado" ? nivel : "intermediario";
  const idx = { iniciante: 0, intermediario: 1, avancado: 2 }[lv];
  const P = paceMin > 0 ? paceMin : 0;
  const pc = (f, faixa) => (P ? planoPaceStr(P * f, faixa ? P * f * faixa : 0) : "");
  const M = (x) => Math.round(x * 1000 / 100) * 100; // km -> m, em múltiplos de 100
  const total = Math.round(km * 1000);
  const passo = (t, distanciaM, esforco, pace, descricao) => ({ tipo: t, distanciaM, duracaoSeg: 0, esforco, pace: pace || "", descricao: descricao || "" });
  const fecha = (etapas) => { // ajusta o primeiro passo para a soma bater com o total
    const dist = (e) => (e.passos ? e.repeticoes * e.passos.reduce((t, p) => t + p.distanciaM, 0) : e.distanciaM);
    const soma = etapas.reduce((t, e) => t + dist(e), 0);
    const first = etapas[0];
    if (soma !== total && first && !first.passos) first.distanciaM = Math.max(100, first.distanciaM + (total - soma));
    return etapas;
  };
  let semFecha = false; let etapas = []; let tp = "rodagem"; let esforco = ""; let paceTxt = ""; let detalhes = "";
  if (tipo === "rodagem" || tipo === "regenerativo") {
    const f = tipo === "regenerativo" ? 1.1 : 1;
    esforco = tipo === "regenerativo" ? "muito leve, quase passeando" : "leve, dá pra conversar";
    paceTxt = pc(f, 1.08);
    etapas = [passo("leve", total, esforco, paceTxt)];
    tp = tipo === "regenerativo" ? "regenerativo" : "rodagem";
    detalhes = tipo === "regenerativo" ? "Corra bem solto e sem olhar o relógio. Se o corpo pedir, caminhe um pouco." : "Mantenha um ritmo em que você consegue conversar. Termine com a sensação de que dava para ir mais.";
  } else if (tipo === "longao") {
    esforco = "leve e constante";
    paceTxt = pc(1.03, 1.08);
    etapas = [passo("leve", total, esforco, paceTxt)];
    tp = "longao";
    detalhes = "Comece devagar e mantenha o ritmo constante até o fim. Hidrate-se e, acima de 1h15, leve algo para repor energia.";
  } else if (tipo === "longao_prog") {
    const a = M(km * 0.7 / 1) - (M(km * 0.7) % 100);
    const b = total - a;
    esforco = "leve no começo, ritmo firme nos últimos trechos";
    etapas = [passo("leve", a, "leve, dá pra conversar", pc(1.03, 1.08)), passo("moderado", b, "ritmo firme, controlado", pc(0.92), "mais firme")];
    tp = "longao"; paceTxt = pc(1.0, 1.1);
    detalhes = "Os primeiros 70% bem leves; o final um pouco mais forte, sem sprint. O objetivo é terminar cansado, mas no controle.";
  } else if (tipo === "progressivo") {
    const q = [0.4, 0.3, 0.2, 0.1].map((x) => M(km * x));
    const niveis = [["leve", "leve", 1.05, "leve"], ["constante", "constante, confortável", 0.97, "constante"], ["moderado", "ritmo firme", 0.9, "firme"], ["forte", "forte, mas controlado", 0.84, "forte"]];
    etapas = q.map((d, i) => passo(niveis[i][0], d, niveis[i][1], pc(niveis[i][2]), niveis[i][3]));
    etapas = fecha(etapas);
    esforco = "começa leve e termina forte"; tp = "tempo"; paceTxt = pc(0.97, 1.1);
    detalhes = "Aumente o ritmo a cada trecho. No começo parece fácil demais, e é isso mesmo.";
  } else if (tipo === "tempo") {
    const minBloco = [20, 30, 40][idx]; // minutos no ritmo de limiar
    const pLim = (P || 6.5) * 0.88;
    const aq0 = Math.max(1500, M(km * 0.15)); const de0 = Math.max(1000, M(km * 0.1));
    const disp = total - aq0 - de0;
    if (disp < 2000) return { ok: false, erro: `Para um treino de ritmo, use pelo menos ${String(Math.ceil((aq0 + de0 + 2000) / 100) / 10).replace(".", ",")} km.` };
    const principal = Math.max(2000, Math.min(disp, M(minBloco / pLim)));
    const resto = total - principal;
    const aq = Math.max(aq0, Math.round(resto * 0.58 / 100) * 100); const de = resto - aq;
    etapas = [passo("aquecimento", aq, "trote leve", pc(1.1, 1.08), "aquecimento"), passo("moderado", principal, "forte e controlado (RPE 7)", pc(0.88), "em ritmo de limiar"), passo("desaquecimento", de, "trote bem leve", pc(1.12), "desaquecimento")];
    tp = "tempo"; esforco = "forte e controlado (RPE 7)"; paceTxt = pc(0.88);
    detalhes = "O bloco do meio é um ritmo que você sustenta, mas sem folga para conversar mais do que poucas palavras.";
  } else if (tipo === "fartlek") {
    const [fs, ls] = [[60, 120], [120, 120], [180, 120]][idx];
    const pf = P ? P * 0.84 : 5.5; const pl = P ? P * 1.05 : 6.9;
    const ciclo = (fs / 60) / pf + (ls / 60) / pl; // km por ciclo
    const aq = Math.max(1500, M(km * 0.2)); const de = Math.max(1000, M(km * 0.1));
    const reps = Math.floor((total - aq - de) / 1000 / ciclo);
    if (reps < 3) return { ok: false, erro: `Para fartlek, use pelo menos ${String(Math.ceil((aq + de) / 100 + ciclo * 30) / 10).replace(".", ",")} km.` };
    const kmCiclos = Math.round(reps * ciclo * 1000 / 100) * 100;
    const resto = total - aq - de - kmCiclos;
    etapas = [passo("aquecimento", aq + resto, "trote leve", pc(1.1, 1.08), "aquecimento"),
      { repeticoes: reps, passos: [{ tipo: "forte", distanciaM: 0, duracaoSeg: fs, esforco: "forte (RPE 8)", pace: pc(0.84), descricao: "forte" }, { tipo: "leve", distanciaM: 0, duracaoSeg: ls, esforco: "trote leve", pace: "", descricao: "trote leve" }] },
      passo("desaquecimento", de, "trote bem leve", pc(1.12), "desaquecimento")];
    tp = "intervalado"; esforco = "alterna forte e leve por tempo"; paceTxt = pc(0.84);
    detalhes = "Acelere nos trechos fortes e solte no trote. Aqui o relógio manda, não a distância.";
    semFecha = true; // etapas por tempo: a distância total é aproximada
  } else {
    const T = { tiros200: [200, 200, "caminhada", 0.72, [8, 12, 16], 1000, 500], tiros400: [400, 200, "recuperacao", 0.76, [5, 8, 12], 1500, 1000], tiros800: [800, 400, "recuperacao", 0.82, [3, 5, 8], 1500, 1000], tiros1000: [1000, 400, "recuperacao", 0.84, [3, 4, 6], 1500, 1000] }[tipo];
    const [tiro, pausa, tpPausa, f, caps] = T;
    const aq0 = Math.max(T[5], M(km * 0.14)); const de0 = Math.max(T[6], M(km * 0.08));
    const ciclo = tiro + pausa;
    let reps = Math.floor((total - aq0 - de0) / ciclo);
    const minReps = 3;
    if (reps < minReps) return { ok: false, erro: `Para esse treino, use pelo menos ${String(Math.ceil((aq0 + de0 + minReps * ciclo) / 100) / 10).replace(".", ",")} km.` };
    reps = Math.min(reps, caps[idx]);
    const usado = reps * ciclo;
    const sobra = total - usado - aq0 - de0;
    const aq = aq0 + Math.round(sobra * 0.6 / 100) * 100;
    const de = total - usado - aq;
    etapas = [passo("aquecimento", aq, "trote leve", pc(1.1, 1.08), "aquecimento"),
      { repeticoes: reps, passos: [passo("forte", tiro, "forte (RPE 8)", pc(f), "tiro"), passo(tpPausa, pausa, tpPausa === "caminhada" ? "caminhando" : "trote leve", "", tpPausa === "caminhada" ? "caminhando" : "trote")] },
      passo("desaquecimento", de, "trote bem leve", pc(1.12), "desaquecimento")];
    tp = "intervalado"; esforco = "tiros fortes (RPE 8), recuperação leve"; paceTxt = pc(f);
    detalhes = `${reps} tiros de ${tiro} m. Corra todos no mesmo ritmo: se o último for muito mais lento que o primeiro, saiu forte demais.`;
  }
  if (!semFecha) etapas = fecha(etapas);
  const segs = planoEtapasSegmentos(etapas, P || 0);
  const dur = Math.round(segs.reduce((t, x) => t + x.min, 0));
  const nomeBase = cfg.nome;
  const titulo = ["rodagem", "regenerativo", "longao", "longao_prog", "tempo", "progressivo"].indexOf(tipo) >= 0 ? `${nomeBase} · ${String(km).replace(".", ",")} km` : (tipo === "fartlek" ? `Fartlek · ${String(km).replace(".", ",")} km` : `${nomeBase} · ${String(km).replace(".", ",")} km`);
  return { ok: true, treino: { tipo: tp, modelo: tipo, nivel: lv, titulo, distanciaKm: km, duracaoMin: dur, esforco, pace: paceTxt, detalhes, etapas } };
}

// Formato curto da IA: cada sessão traz só o "modelo" (rodagem, tiros400...), km, duração, esforço, pace e uma nota;
// o app monta título e etapas com o mesmo gerador dos treinos avulsos. Sessões já no formato completo passam direto.
function planoExpandirCompacto(raw, ctx) {
  if (!raw || !Array.isArray(raw.sessoes)) return raw;
  const P = ctx && ctx.paceMin > 0 ? ctx.paceMin : 0;
  const conf = ctx && ctx.confortavelKm > 0 ? ctx.confortavelKm : 0;
  const nivel = conf < 4 ? "iniciante" : conf < 10 ? "intermediario" : "avancado";
  const simples = { rodagem: 1, regenerativo: 1, longao: 1 };
  const sessoes = raw.sessoes.map((s) => {
    if (!s || typeof s !== "object" || !s.modelo) return s;
    const chave = String(s.modelo).toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    const modelo = TREINOS_CORRIDA[chave] ? chave : ({ longao: "longao", intervalado: "tiros400", tempo: "tempo", regenerativo: "regenerativo" }[planoTipoNorm(s.modelo)] || "rodagem");
    const km = planoNum(s.distanciaKm, 100);
    let g = km > 0 ? planoGerarTreinoCorrida(modelo, km, nivel, P) : { ok: false };
    if (!g.ok && km > 0) g = planoGerarTreinoCorrida(modelo === "longao_prog" ? "longao" : "rodagem", km, nivel, P);
    const t = g.ok ? g.treino : null;
    const mEf = t ? t.modelo : modelo; // modelo realmente usado (cai para rodagem se o km não comporta o pedido)
    const paceOk = typeof s.pace === "string" && /^\d{1,2}:\d{2}(\s*[-–]\s*\d{1,2}:\d{2})?$/.test(s.pace.trim());
    return {
      data: s.data, fase: s.fase,
      tipo: t ? t.tipo : planoTipoNorm(s.modelo),
      titulo: simples[mEf] || !t ? (TREINOS_CORRIDA[mEf] || TREINOS_CORRIDA.rodagem).nome : t.titulo,
      distanciaKm: km || (t ? t.distanciaKm : 0),
      duracaoMin: planoNum(s.duracaoMin, 600) > 0 ? s.duracaoMin : (t ? t.duracaoMin : 0),
      esforco: typeof s.esforco === "string" && s.esforco.trim() ? s.esforco : (t ? t.esforco : ""),
      pace: paceOk ? s.pace.trim() : (t && P > 0 && ctx.usaRelogio ? t.pace : null),
      detalhes: typeof s.nota === "string" && s.nota.trim() ? s.nota : (t ? t.detalhes : ""),
      etapas: t && !simples[mEf] ? t.etapas : [],
    };
  });
  return { ...raw, sessoes };
}
// === PLANO_CORRIDA_END

// Conta treinos de uma lista [{date,...}] respeitando dias da semana e o limite por dia.
function desafioContarLista(lista, rules) {
  const r = desafioNormalizeRules(rules);
  const porDia = {};
  (lista || []).forEach((c) => {
    if (r.dias.indexOf(weekdayOf(c.date)) < 0) return;
    porDia[c.date] = (porDia[c.date] || 0) + 1;
  });
  return Object.keys(porDia).reduce((acc, d) => acc + (r.maxPorDia > 0 ? Math.min(r.maxPorDia, porDia[d]) : porDia[d]), 0);
}

// Muda a meta redimensionando a tabela de pontos (a última linha é "meta ou mais").
function desafioSetMeta(rules, meta) {
  const next = desafioClone(rules);
  const old = next.pontos.slice();
  next.meta = meta;
  const pontos = [];
  for (let i = 0; i <= meta; i++) pontos.push(i < old.length ? old[i] : old[old.length - 1]);
  // Ao diminuir a meta, a última linha deve continuar sendo o "máximo" da tabela.
  if (meta < old.length - 1) pontos[meta] = old[old.length - 1];
  next.pontos = pontos;
  return next;
}

function desafioFmtPts(n) {
  const v = Math.round(n);
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return "0";
}

// Frase viva que resume a regra ("4 ou mais = +5 · 3 = +2 · ...").
function desafioRegrasResumo(rules) {
  const r = desafioNormalizeRules(rules);
  const partes = [];
  for (let n = r.meta; n >= 0; n--) {
    partes.push(`${n}${n === r.meta && r.meta > 0 ? "+" : ""} = ${desafioFmtPts(r.pontos[n])}`);
  }
  return partes.join(" · ");
}

function desafioContamTexto(rules) {
  const r = desafioNormalizeRules(rules);
  const partes = [];
  if (r.academia.on) {
    const ex = [r.academia.minMin > 0 && `${r.academia.minMin}+ min`, r.academia.minExs > 0 && `${r.academia.minExs}+ exercícios`].filter(Boolean).join(", ");
    partes.push(ex ? `treino de academia (${ex})` : "treino de academia");
  }
  if (r.atividades.on) {
    const quais = r.atividades.nomes.length ? r.atividades.nomes.join(", ") : "qualquer atividade marcada como \"fui\"";
    const req = [r.atividades.minMin > 0 && `${r.atividades.minMin}+ min`, r.atividades.minKm > 0 && `${desafioFmtKm(r.atividades.minKm).replace(" km", "")}+ km`].filter(Boolean).join(", ");
    partes.push(req ? `${quais} (${req})` : quais);
  }
  return partes.length ? partes.join(" e ") : "nada (ative ao menos um tipo)";
}

// Texto das condições extras (dias, limite por dia, duração obrigatória).
function desafioLimitesTexto(rules) {
  const r = desafioNormalizeRules(rules);
  const t = [];
  t.push(r.maxPorDia === 0 ? "até 1 por tipo por dia" : r.maxPorDia === 1 ? "só 1 treino por dia (conta dia ativo)" : `até ${r.maxPorDia} treinos por dia`);
  if (r.dias.length < 7) t.push(`vale só ${r.dias.map((d) => DESAFIO_SEMANA_NOMES[d]).join(", ")}`);
  if (r.exigirDuracao && (r.academia.minMin > 0 || r.atividades.minMin > 0)) t.push("exige duração registrada");
  if (r.exigirKm && r.atividades.minKm > 0) t.push("exige distância registrada");
  return t.join(" · ");
}

// "Snap": o desafio começa no primeiro dia da semana escolhido (ex: segunda) a partir da data dada.
function desafioSnapStart(iso, weekStart) {
  let d = iso;
  for (let i = 0; i < 7 && weekdayOf(d) !== weekStart; i++) d = addDays(d, 1);
  return d;
}
function desafioEnd(ch) { return addDays(ch.start_date, ch.weeks * 7 - 1); }
function desafioWeekRange(ch, idx) { const start = addDays(ch.start_date, idx * 7); return { start, end: addDays(start, 6) }; }

// Onde estamos: antes de começar, rolando (semana N) ou encerrado.
function desafioStatus(ch, today) {
  const end = desafioEnd(ch);
  if (today < ch.start_date) {
    const dias = Math.round((new Date(ch.start_date + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
    return { fase: "antes", diasParaComecar: dias, semanaIdx: -1 };
  }
  if (today > end) return { fase: "fim", semanaIdx: ch.weeks - 1, semanaNum: ch.weeks };
  const dias = Math.round((new Date(today + "T00:00:00") - new Date(ch.start_date + "T00:00:00")) / 86400000);
  const idx = Math.floor(dias / 7);
  const wr = desafioWeekRange(ch, idx);
  const restantes = Math.round((new Date(wr.end + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000);
  return { fase: "rolando", semanaIdx: idx, semanaNum: idx + 1, diasRestantesSemana: restantes, semanaFim: wr.end };
}

// Quais check-ins as sessões deste aparelho geram dentro da janela do desafio.
// Academia: algum exercício de ficha "feito" no dia. Atividade: "fui" (descanso não conta).
// Minutos vêm do que a pessoa registrou ao concluir; se não registrou, vale (confiança).
function desafioCheckinsFromSessions(sessions, atividadeById, rules, startIso, endIso) {
  const r = desafioNormalizeRules(rules);
  const out = [];
  Object.keys(sessions || {}).forEach((date) => {
    if (date < startIso || date > endIso) return;
    if (r.dias.indexOf(weekdayOf(date)) < 0) return;
    const s = sessions[date] || {};
    const log = s.log || {};
    const cargas = s.cargas || {};
    let academiaFeita = false;
    let academiaMin = 0;
    let academiaExs = 0;
    Object.keys(log).forEach((k) => {
      const v = log[k];
      if (!v) return;
      if (k.indexOf("treino:") === 0) {
        const feitos = Object.values(v).filter((ex) => ex && ex.status === "feito").length;
        if (feitos > 0) {
          academiaFeita = true;
          academiaExs += feitos;
          academiaMin += Number(cargas[k] && cargas[k].duracaoMin) || 0;
        }
        return;
      }
      if (k.indexOf("atividade:") === 0 && v.status === "fui" && r.atividades.on) {
        const id = k.slice("atividade:".length);
        const a = atividadeById ? atividadeById(id) : null;
        if (a && a.descanso) return;
        if (!desafioNomeConta(r, a ? a.nome : "")) return;
        const min = Number(cargas[k] && cargas[k].duracaoMin) || 0;
        if (r.atividades.minMin > 0 && min < r.atividades.minMin && (min > 0 || r.exigirDuracao)) return;
        const km = desafioKmDe(cargas[k], v);
        if (r.atividades.minKm > 0 && km < r.atividades.minKm && (km > 0 || r.exigirKm)) return;
        out.push({ date, tipo: k, label: (a ? a.nome : "Atividade") + (km > 0 ? ` · ${desafioFmtKm(km)}` : ""), minutos: min || null });
      }
    });
    if (academiaFeita && r.academia.on) {
      const curto = r.academia.minMin > 0 && academiaMin < r.academia.minMin && (academiaMin > 0 || r.exigirDuracao);
      if (!curto && academiaExs >= r.academia.minExs) {
        out.push({ date, tipo: "academia", label: "Academia", minutos: academiaMin || null });
      }
    }
  });
  return out;
}

// Quantos check-ins a pessoa tem numa janela [start, end] (chaves únicas data+tipo).
function desafioContarCheckins(checkins, userId, start, end, rules) {
  const seen = new Map();
  (checkins || []).forEach((c) => {
    if (c.user_id !== userId) return;
    if (c.date < start || c.date > end) return;
    seen.set(`${c.date}|${c.tipo}`, { date: c.date });
  });
  return desafioContarLista(Array.from(seen.values()), rules);
}

// Placar completo: semana a semana (com vencedor/perdedor das fechadas) e totais.
// Pontos negativos só valem no fechamento da semana; na semana em andamento, os pontos
// "ao vivo" nunca são negativos (ninguém perde ponto no meio da semana por não ter treinado ainda).
function desafioStandings(ch, members, checkins, together, today) {
  const rules = desafioNormalizeRules(ch.rules);
  const status = desafioStatus(ch, today);
  const semanas = [];
  const nomeDe = {};
  (members || []).forEach((m) => { nomeDe[m.user_id] = m.nome; });
  const temCheckin = (uid, date) => rules.dias.indexOf(weekdayOf(date)) >= 0 && (checkins || []).some((c) => c.user_id === uid && c.date === date);

  for (let i = 0; i < ch.weeks; i++) {
    const { start, end } = desafioWeekRange(ch, i);
    if (today < start) break;
    const fechada = today > end;
    const rows = (members || []).map((m) => {
      const count = desafioContarCheckins(checkins, m.user_id, start, end, rules);
      const bonus = (together || []).filter((t) => (
        t.status === "confirmed" && t.date >= start && t.date <= end
        && (t.from_user === m.user_id || t.to_user === m.user_id)
        && temCheckin(t.from_user, t.date) && temCheckin(t.to_user, t.date)
      )).length;
      const base = rules.pontos[Math.min(count, rules.pontos.length - 1)];
      return { user_id: m.user_id, nome: m.nome, count, bonus, pts: base + bonus * rules.bonusJuntos, base };
    });
    let winners = [];
    let losers = [];
    if (fechada && rows.length >= 2) {
      const max = Math.max(...rows.map((r) => r.pts));
      const min = Math.min(...rows.map((r) => r.pts));
      if (max > min) {
        winners = rows.filter((r) => r.pts === max).map((r) => r.user_id);
        losers = rows.filter((r) => r.pts === min).map((r) => r.user_id);
      }
    }
    semanas.push({ idx: i, num: i + 1, start, end, fechada, atual: !fechada, rows, winners, losers });
  }

  const totais = (members || []).map((m) => {
    let fechados = 0;
    let treinos = 0;
    let vitorias = 0;
    let atualRow = null;
    semanas.forEach((w) => {
      const row = w.rows.find((r) => r.user_id === m.user_id);
      if (!row) return;
      treinos += row.count;
      if (w.fechada) {
        fechados += row.pts;
        if (w.winners.indexOf(m.user_id) >= 0) vitorias++;
      } else {
        atualRow = row;
      }
    });
    const aoVivo = atualRow ? Math.max(0, atualRow.pts) : 0;
    return {
      user_id: m.user_id, nome: m.nome, is_me: !!m.is_me,
      fechados, aoVivo, total: fechados + aoVivo, treinos, vitorias,
      semanaCount: atualRow ? atualRow.count : 0,
      semanaBonus: atualRow ? atualRow.bonus : 0,
    };
  }).sort((a, b) => b.total - a.total || b.treinos - a.treinos || a.nome.localeCompare(b.nome));

  const ranked = totais.map((t, i) => ({ ...t, pos: i > 0 && t.total === totais[i - 1].total && t.treinos === totais[i - 1].treinos ? null : i + 1 }));
  for (let i = 0; i < ranked.length; i++) if (ranked[i].pos === null) ranked[i].pos = ranked[i - 1].pos;

  return { rules, status, semanas, totais: ranked };
}

// Quanto falta pra próxima faixa de pontos da semana ("falta 1 pra +5").
function desafioProximaFaixa(rules, count) {
  const r = desafioNormalizeRules(rules);
  if (count >= r.meta) return null;
  const atual = r.pontos[count];
  for (let n = count + 1; n <= r.meta; n++) {
    if (r.pontos[n] > atual) return { falta: n - count, pts: r.pontos[n] };
  }
  return null;
}

function desafioIniciais(nome) {
  const p = String(nome || "?").trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function desafioCorDe(members, userId) {
  const ids = (members || []).map((m) => m.user_id).sort();
  const i = ids.indexOf(userId);
  return DESAFIO_CORES[(i < 0 ? 0 : i) % DESAFIO_CORES.length];
}
function desafioDataCurta(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const mes = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${d} ${mes}`;
}
function desafioConviteLink(code) {
  try { return `${window.location.origin}${window.location.pathname}?desafio=${encodeURIComponent(code)}`; } catch (e) { return `?desafio=${code}`; }
}
// Reconcilia os check-ins que o app calculou com os que já estão no servidor (só os meus).
function desafioDiffCheckins(desejados, noServidor) {
  const key = (c) => `${c.date}|${c.tipo}`;
  const srv = new Map(noServidor.map((c) => [key(c), c]));
  const des = new Map(desejados.map((c) => [key(c), c]));
  const adicionar = desejados.filter((c) => !srv.has(key(c)));
  const atualizar = desejados.filter((c) => {
    const s = srv.get(key(c));
    return s && ((s.minutos || null) !== (c.minutos || null) || (s.label || null) !== (c.label || null));
  });
  const remover = noServidor.filter((c) => !des.has(key(c)));
  return { adicionar, atualizar, remover };
}

// Logger de erro fora do App (as telas de desafio ficam em componentes próprios).
let desafioUserIdAtual = null;
function desafioLogErro(context, message) {
  try {
    supabaseClient.from("client_errors").insert({
      user_id: desafioUserIdAtual, context, message: message ? String(message).slice(0, 2000) : null,
    }).then(() => {});
  } catch (e) {}
}

// Sincroniza MEUS check-ins com o servidor: calcula o que as sessões deste aparelho geram
// e aplica só a diferença (adiciona, corrige minutos, remove o que foi desmarcado).
async function syncDesafioCheckins(ch, userId, sessions, atividadeById, today) {
  const end = desafioEnd(ch);
  if (today < ch.start_date || today > end) return { changed: false, added: [] };
  const desired = desafioCheckinsFromSessions(sessions, atividadeById, ch.rules, ch.start_date, end < today ? end : today);
  const { data, error } = await supabaseClient
    .from("challenge_checkins").select("date,tipo,label,minutos")
    .eq("challenge_id", ch.id).eq("user_id", userId);
  if (error) return { changed: false, added: [], error };
  const diff = desafioDiffCheckins(desired, data || []);
  const upserts = [...diff.adicionar, ...diff.atualizar].map((c) => ({
    challenge_id: ch.id, user_id: userId, date: c.date, tipo: c.tipo, label: c.label || null, minutos: c.minutos || null, source: "app",
  }));
  let failed = null;
  if (upserts.length) {
    const r = await supabaseClient.from("challenge_checkins").upsert(upserts, { onConflict: "challenge_id,user_id,date,tipo" });
    if (r.error) failed = r.error;
  }
  for (const c of diff.remover) {
    const r = await supabaseClient.from("challenge_checkins").delete()
      .eq("challenge_id", ch.id).eq("user_id", userId).eq("date", c.date).eq("tipo", c.tipo);
    if (r.error) failed = r.error;
  }
  return { changed: !failed && (upserts.length > 0 || diff.remover.length > 0), added: diff.adicionar, error: failed };
}

// --- Engajamento: série de pontos por semana, avisos ("te passaram", "semana fechou") e cartões ---

// Pontos acumulados ao longo do desafio (semanas fechadas + a semana em andamento ao vivo).
function desafioSerie(ch, st, members) {
  const fechadas = st.semanas.filter((w) => w.fechada);
  const atual = st.semanas.find((w) => !w.fechada) || null;
  const labels = ["início"].concat(fechadas.map((w) => `S${w.num}`));
  if (atual) labels.push(`S${atual.num}*`);
  const series = (members || []).map((m) => {
    let acc = 0;
    const vals = [0];
    fechadas.forEach((w) => { const r = w.rows.find((x) => x.user_id === m.user_id); acc += r ? r.pts : 0; vals.push(acc); });
    if (atual) { const r = atual.rows.find((x) => x.user_id === m.user_id); vals.push(acc + Math.max(0, r ? r.pts : 0)); }
    return { user_id: m.user_id, nome: m.nome, is_me: !!m.is_me, cor: desafioCorDe(members, m.user_id), vals };
  });
  return { labels, series, temAoVivo: !!atual, liderId: st.totais[0] ? st.totais[0].user_id : null };
}

function desafioDadosCartaoGeral(ch, st, members) {
  const stakes = ch.stakes || {};
  const fim = st.status.fase === "fim";
  const ranking = st.totais.map((t) => ({ nome: t.nome, pts: t.total, cor: desafioCorDe(members, t.user_id) }));
  return {
    titulo: ch.nome,
    subtitulo: fim ? "Resultado final" : `Placar geral · semana ${st.status.semanaNum || 0} de ${ch.weeks}`,
    ranking,
    perdedor: null,
    aposta: null,
    rodape: fim && stakes.final ? `🏆 ${ranking[0] ? ranking[0].nome : ""} leva: ${stakes.final}` : "Parcial · negativos só valem no fim da semana",
  };
}
function desafioDadosCartaoSemana(ch, st, members, w) {
  const stakes = ch.stakes || {};
  const nomeDe = (uid) => { const m = (members || []).find((x) => x.user_id === uid); return m ? m.nome : "Alguém"; };
  const rows = w.rows.slice().sort((a, b) => b.pts - a.pts || b.count - a.count);
  const ranking = rows.map((r) => ({ nome: r.nome, pts: r.pts, cor: desafioCorDe(members, r.user_id) }));
  const perd = w.losers.length ? w.losers.map(nomeDe).join(" e ") : null;
  return {
    titulo: ch.nome,
    subtitulo: `Semana ${w.num} · ${desafioDataCurta(w.start)} a ${desafioDataCurta(w.end)}`,
    ranking,
    perdedor: perd,
    aposta: perd ? (stakes.semana || null) : null,
    rodape: w.winners.length ? null : "Semana empatada — ninguém paga nada 😅",
  };
}
function desafioDadosCartaoEvolucao(ch, st, members) {
  const serie = desafioSerie(ch, st, members);
  return {
    titulo: ch.nome,
    subtitulo: `Corrida dos pontos · semana ${st.status.semanaNum || ch.weeks} de ${ch.weeks}`,
    ranking: st.totais.map((t) => ({ nome: t.nome, pts: t.total, cor: desafioCorDe(members, t.user_id) })),
    serie,
    perdedor: null,
    aposta: null,
    rodape: "Quem vai chegar na frente?",
  };
}

// Foto do placar pra comparar na próxima abertura (o que mudou desde a última vez que a pessoa viu).
function desafioSnapDe(st) {
  const pos = {};
  st.totais.forEach((t) => { pos[t.user_id] = t.pos; });
  const atual = st.semanas.find((w) => !w.fechada);
  const bateu = {};
  const meta = st.rules.meta;
  st.totais.forEach((t) => { if (atual && t.semanaCount >= meta) bateu[t.user_id] = true; });
  return { pos, fechadas: st.semanas.filter((w) => w.fechada).length, semanaIdx: atual ? atual.idx : -1, bateu, fim: st.status.fase === "fim" };
}

// Avisos do desafio. `prev` é a foto anterior (null = primeira vez vendo: só lembretes e semana recém-fechada).
function desafioAvisos(ch, st, members, meId, today, prev) {
  const itens = [];
  const rules = st.rules;
  const me = st.totais.find((t) => t.user_id === meId);
  if (!me) return itens;
  const nomeDe = (uid) => { const m = (members || []).find((x) => x.user_id === uid); return m ? m.nome : "Alguém"; };
  const stakes = ch.stakes || {};
  const fechadas = st.semanas.filter((w) => w.fechada);
  const ultima = fechadas[fechadas.length - 1] || null;

  if (st.status.fase === "fim" && (!prev || !prev.fim)) {
    const c = st.totais[0];
    itens.push({ id: "fim", emoji: "🏆", texto: `Acabou! ${c.nome} é o campeão com ${desafioFmtPts(c.total)} pts${stakes.final ? ` e leva: ${stakes.final}` : ""}.`, acao: { tipo: "geral", rotulo: "Compartilhar resultado" } });
  }
  if (ultima && ((prev && fechadas.length > prev.fechadas) || (!prev && ultima.end >= addDays(today, -6)))) {
    let texto;
    if (ultima.winners.length === 0) texto = `Semana ${ultima.num} fechou empatada — ninguém paga nada.`;
    else {
      const gan = ultima.winners.map(nomeDe).join(" e ");
      const per = ultima.losers.map(nomeDe).join(" e ");
      const euPerdi = ultima.losers.indexOf(meId) >= 0;
      texto = `Semana ${ultima.num} fechou: 🏆 ${gan} · ☕ ${euPerdi ? "você paga" : `${per} paga`}${stakes.semana ? ` (${stakes.semana})` : ""}.`;
    }
    itens.push({ id: `semana-${ultima.num}`, emoji: "📅", texto, acao: { tipo: "semana", idx: ultima.idx, rotulo: "Compartilhar cartão" } });
  }
  if (st.status.fase === "rolando" && me.semanaCount < rules.meta && st.status.diasRestantesSemana <= 2) {
    const dias = st.status.diasRestantesSemana;
    const falta = rules.meta - me.semanaCount;
    const alcanca = Math.min(rules.meta, me.semanaCount + dias + 1);
    const pts = rules.pontos[alcanca];
    const quando = dias === 0 ? "Último dia da semana" : `Faltam ${dias} dia${dias === 1 ? "" : "s"} pra fechar a semana`;
    const texto = alcanca >= rules.meta
      ? `${quando}: você está com ${me.semanaCount}/${rules.meta}. Mais ${falta} treino${falta === 1 ? "" : "s"} garante ${desafioFmtPts(pts)} pts.`
      : `${quando}: você está com ${me.semanaCount}/${rules.meta}. Ainda dá pra chegar a ${desafioFmtPts(pts)} pts.`;
    itens.push({ id: "lembrete", emoji: "⏰", texto, lembrete: true });
  }
  if (prev && prev.pos && prev.pos[meId] != null && st.status.fase !== "antes") {
    const antes = prev.pos[meId];
    if (me.pos < antes) {
      itens.push({ id: "subiu", emoji: me.pos === 1 ? "👑" : "🚀", texto: me.pos === 1 ? "Você assumiu a liderança!" : `Você subiu pro ${me.pos}º lugar.` });
    } else if (me.pos > antes) {
      const passou = st.totais.filter((t) => t.user_id !== meId && prev.pos[t.user_id] != null && prev.pos[t.user_id] > antes && t.pos < me.pos);
      itens.push({ id: "caiu", emoji: "📉", texto: passou.length ? `${passou.map((t) => t.nome).join(" e ")} ${passou.length === 1 ? "te passou" : "passaram você"} — você está em ${me.pos}º.` : `Você caiu pro ${me.pos}º lugar.` });
    }
  }
  if (prev && st.status.fase === "rolando" && me.semanaCount < rules.meta) {
    const bateuAntes = prev.semanaIdx === (st.semanas.find((w) => !w.fechada) || {}).idx ? (prev.bateu || {}) : {};
    const novos = st.totais.filter((t) => t.user_id !== meId && t.semanaCount >= rules.meta && !bateuAntes[t.user_id]);
    if (novos.length) itens.push({ id: "bateu", emoji: "🔥", texto: `${novos.map((t) => t.nome).join(" e ")} já ${novos.length === 1 ? "bateu" : "bateram"} a meta da semana.` });
  }
  return itens;
}

const DESAFIO_SNAP_KEY = "treino-app:desafioSnap";
function desafioSnapLerTodos() {
  try { const o = JSON.parse(localStorage.getItem(DESAFIO_SNAP_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; }
}
function desafioSnapSalvarTodos(map) {
  try { localStorage.setItem(DESAFIO_SNAP_KEY, JSON.stringify(map)); } catch (e) {}
}

// Gráfico "corrida dos pontos": pontos acumulados semana a semana, uma linha por pessoa.
function DesafioEvolucao({ serie }) {
  const W = 340, H = 190, x0 = 22, x1 = W - 40, y0 = 14, y1 = H - 28;
  const [pronto, setPronto] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPronto(true), 60); return () => clearTimeout(t); }, []);
  if (!serie || serie.labels.length < 2) return null;
  const todos = serie.series.reduce((acc, x) => acc.concat(x.vals), [0]);
  let lo = Math.min.apply(null, todos), hi = Math.max.apply(null, todos);
  if (hi - lo < 4) { hi += 2; lo -= 2; }
  const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
  const n = serie.labels.length;
  const X = (i) => x0 + (i / (n - 1)) * (x1 - x0);
  const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  const lider = serie.series.find((x) => x.user_id === serie.liderId) || null;
  return (
    <svg className="gt-dsf-evo" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pontos acumulados por semana">
      {serie.labels.map((l, i) => (
        <g key={i}>
          <line x1={X(i)} x2={X(i)} y1={y0 - 4} y2={y1 + 4} stroke="var(--border)" strokeWidth="1" opacity="0.6" />
          <text x={X(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)" fontFamily="Inter, sans-serif">{l}</text>
        </g>
      ))}
      <line x1={x0 - 6} x2={x1 + 6} y1={Y(0)} y2={Y(0)} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />
      {serie.series.map((x) => {
        const pts = x.vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
        const ult = x.vals[x.vals.length - 1];
        return (
          <g key={x.user_id}>
            <polyline points={pts} fill="none" stroke={x.cor} strokeWidth={x.is_me ? 3.4 : 2.4} strokeLinecap="round" strokeLinejoin="round"
              pathLength="1" strokeDasharray="1" strokeDashoffset={pronto ? 0 : 1} style={{ transition: "stroke-dashoffset 1200ms ease-out" }} />
            {x.vals.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r="2.8" fill="var(--surface)" stroke={x.cor} strokeWidth="1.6" opacity={pronto ? 1 : 0} style={{ transition: "opacity 600ms ease 700ms" }} />)}
            <g style={{ opacity: pronto ? 1 : 0, transition: "opacity 500ms ease 900ms" }}>
              <circle cx={X(n - 1) + 14} cy={Y(ult)} r="11" fill={x.cor} stroke="#14161A" strokeWidth="2" />
              <text x={X(n - 1) + 14} y={Y(ult)} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="600" fontFamily="Oswald, sans-serif" fill="#14161A">{desafioIniciais(x.nome)}</text>
              {x === lider && ult > 0 && <text x={X(n - 1) + 14} y={Y(ult) - 15} textAnchor="middle" fontSize="11">👑</text>}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// Cartões de aviso (semana fechou, te passaram, lembrete…). `onAcao` abre o cartão pra compartilhar.
function DesafioAvisosCards({ avisos, resumos, desafios, onAcao, onAbrir }) {
  const linhas = [];
  (desafios || []).forEach((ch) => {
    (avisos[ch.id] || []).forEach((a) => linhas.push({ ch, a }));
  });
  if (linhas.length === 0) return null;
  return (
    <div className="gt-dsf-avisos">
      {linhas.map(({ ch, a }) => (
        <div key={`${ch.id}-${a.id}`} className={`gt-dsf-aviso ${a.lembrete ? "lembrete" : ""}`}>
          <span className="gt-dsf-aviso-emoji"><Ei e={a.emoji} size="1.3em" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="gt-dsf-hint" style={{ margin: 0, fontSize: 11 }}>{ch.nome}</div>
            <div>{a.texto}</div>
            {a.acao && resumos[ch.id] && <button className="gt-dsf-link" style={{ marginTop: 4 }} onClick={() => onAcao(ch.id, a.acao)}>{a.acao.rotulo} ↗</button>}
            {!a.acao && <button className="gt-dsf-link" style={{ marginTop: 4 }} onClick={() => onAbrir(ch.id)}>Abrir desafio</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function DesafioStepper({ value, min, max, step = 1, onChange, fmt }) {
  return (
    <div className="gt-dsf-stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label="diminuir">−</button>
      <span>{fmt ? fmt(value) : value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label="aumentar">+</button>
    </div>
  );
}

function DesafioAnel({ count, meta }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, meta > 0 ? count / meta : 0);
  const bateu = count >= meta;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${count} de ${meta} treinos na semana`}>
      <circle cx="52" cy="52" r={r} fill="none" stroke="var(--border)" strokeWidth="9" />
      <circle cx="52" cy="52" r={r} fill="none" stroke={bateu ? "var(--accent)" : "var(--accent-dim)"} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`} transform="rotate(-90 52 52)" />
      <text x="52" y="52" textAnchor="middle" dominantBaseline="central" fontFamily="Oswald, sans-serif" fontSize="28" fill="var(--text)">{count}<tspan fontSize="16" fill="var(--text-muted)">/{meta}</tspan></text>
    </svg>
  );
}

// Pista de corrida: uma raia por pessoa, o avatar avança conforme os pontos.
function DesafioPista({ totais, members }) {
  const W = 340;
  const laneH = 52;
  const [pronto, setPronto] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPronto(true), 60); return () => clearTimeout(t); }, []);
  if (!totais || totais.length === 0) return null;
  const vals = totais.map((t) => t.total);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(1, ...vals, lo + 1);
  const x0 = 30;
  const x1 = W - 52;
  const H = totais.length * laneH + 10;
  const lider = totais[0];
  const ultimo = totais[totais.length - 1];
  const temDisputa = totais.length >= 2 && lider.total > ultimo.total;
  return (
    <svg className="gt-dsf-pista" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pista de corrida do desafio">
      <defs>
        <pattern id="gt-dsf-xadrez" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="#F2F3F1" /><rect x="4" y="4" width="4" height="4" fill="#F2F3F1" />
          <rect x="4" width="4" height="4" fill="#14161A" /><rect y="4" width="4" height="4" fill="#14161A" />
        </pattern>
      </defs>
      {totais.map((t, i) => {
        const y = 5 + i * laneH;
        const frac = (t.total - lo) / (hi - lo);
        const x = x0 + frac * (x1 - x0);
        const cor = desafioCorDe(members, t.user_id);
        const ehLider = temDisputa && t.user_id === lider.user_id;
        const ehUltimo = temDisputa && t.user_id === ultimo.user_id && !ehLider;
        return (
          <g key={t.user_id}>
            <rect x="4" y={y + 14} width={W - 8} height="30" rx="15" fill="var(--surface-2)" stroke="var(--border)" />
            <line x1="22" y1={y + 29} x2={W - 22} y2={y + 29} stroke="var(--border)" strokeDasharray="3 6" />
            <rect x={W - 30} y={y + 15} width="16" height="28" fill="url(#gt-dsf-xadrez)" opacity="0.9" />
            <text x={W - 6} y={y + 33} textAnchor="end" fontFamily="Oswald, sans-serif" fontSize="12" fill="var(--text-muted)" />
            <g style={{ transform: `translate(${pronto ? x : x0}px, 0)`, transition: "transform 1100ms cubic-bezier(.2,.9,.25,1)" }}>
              <circle cx="0" cy={y + 29} r="17" fill={cor} stroke="#14161A" strokeWidth="3" />
              <text x="0" y={y + 29} textAnchor="middle" dominantBaseline="central" fontFamily="Oswald, sans-serif" fontSize="13" fontWeight="600" fill="#14161A">{desafioIniciais(t.nome)}</text>
              {ehLider && <text x="-22" y={y + 34} textAnchor="end" fontSize="14">👑</text>}
              {ehUltimo && <text x="23" y={y + 24} textAnchor="start" fontSize="13">☕</text>}
            </g>
            <text x="14" y={y + 10} fontFamily="Inter, sans-serif" fontSize="10.5" fill={t.is_me ? "var(--accent)" : "var(--text-muted)"}>{t.nome}{t.is_me ? " (você)" : ""}</text>
            <text x={W - 34} y={y + 10} textAnchor="end" fontFamily="Oswald, sans-serif" fontSize="12" fill="var(--text)">{desafioFmtPts(t.total)} pts</text>
          </g>
        );
      })}
    </svg>
  );
}

// Cartão pra compartilhar (4:5, bom pra story e feed). Desenhado direto no canvas.
async function desafioRenderCartao(d) {
  const W = 1080;
  const H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d");
  try {
    await Promise.all([document.fonts.load("600 64px Oswald"), document.fonts.load("500 30px Inter")]);
  } catch (e) {}
  const OSW = "Oswald, 'Arial Narrow', sans-serif";
  const INT = "Inter, Arial, sans-serif";
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1D2024");
  bg.addColorStop(1, "#0D0F12");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W * 0.78, H * 0.2, 10, W * 0.78, H * 0.2, 560);
  glow.addColorStop(0, "rgba(198,241,53,0.30)");
  glow.addColorStop(1, "rgba(198,241,53,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const fit = (txt, maxW) => { let s = String(txt); while (s.length > 1 && g.measureText(s).width > maxW) s = s.slice(0, -1); return s === String(txt) ? s : s.trimEnd() + "…"; };
  const logo = (x, y, s) => {
    g.fillStyle = "#C6F135";
    [[36, 126, 74], [98, 86, 114], [160, 46, 154]].forEach(([bx, by, bh]) => { rr(x + bx * s, y + by * s, 44 * s, bh * s, 14 * s); g.fill(); });
    g.beginPath(); g.arc(x + 182 * s, y + 25 * s, 13 * s, 0, Math.PI * 2); g.fill();
  };

  logo(70, 56, 0.42);
  g.fillStyle = "#C6F135";
  g.font = `600 40px ${OSW}`;
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.fillText("movo", 176, 124);

  g.fillStyle = "#F2F3F1";
  let tam = 78;
  g.font = `600 ${tam}px ${OSW}`;
  while (tam > 52 && g.measureText(d.titulo.toUpperCase()).width > W - 140) { tam -= 2; g.font = `600 ${tam}px ${OSW}`; }
  g.fillText(fit(d.titulo.toUpperCase(), W - 140), 70, 250);
  g.fillStyle = "#9AA0A6";
  g.font = `500 34px ${INT}`;
  g.fillText(d.subtitulo, 70, 306);

  if (d.serie) {
    // Gráfico de linhas: pontos acumulados semana a semana
    const sr = d.serie;
    const cx0 = 130, cx1 = W - 150, cy0 = 400, cy1 = 890;
    const todos = sr.series.reduce((acc, x) => acc.concat(x.vals), [0]);
    let lo = Math.min.apply(null, todos), hi = Math.max.apply(null, todos);
    if (hi - lo < 4) { hi += 2; lo -= 2; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = (i) => cx0 + (sr.labels.length <= 1 ? 0 : (i / (sr.labels.length - 1)) * (cx1 - cx0));
    const Y = (v) => cy1 - ((v - lo) / (hi - lo)) * (cy1 - cy0);
    g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 2;
    sr.labels.forEach((_, i) => { g.beginPath(); g.moveTo(X(i), cy0 - 20); g.lineTo(X(i), cy1 + 10); g.stroke(); });
    g.strokeStyle = "rgba(255,255,255,0.3)"; g.setLineDash([10, 12]);
    g.beginPath(); g.moveTo(cx0 - 30, Y(0)); g.lineTo(cx1 + 30, Y(0)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#6B7077"; g.font = `500 26px ${INT}`; g.textAlign = "center";
    sr.labels.forEach((l, i) => g.fillText(l, X(i), cy1 + 56));
    const ord = sr.series.slice().sort((p, q) => p.vals[p.vals.length - 1] - q.vals[q.vals.length - 1]);
    ord.forEach((x) => {
      g.strokeStyle = x.cor; g.lineWidth = 9; g.lineJoin = "round"; g.lineCap = "round";
      g.beginPath();
      x.vals.forEach((v, i) => { if (i === 0) g.moveTo(X(i), Y(v)); else g.lineTo(X(i), Y(v)); });
      g.stroke();
      x.vals.forEach((v, i) => { g.beginPath(); g.arc(X(i), Y(v), 9, 0, Math.PI * 2); g.fillStyle = "#14161A"; g.fill(); g.lineWidth = 5; g.strokeStyle = x.cor; g.stroke(); });
    });
    // Avatares nas pontas (desvia quando duas pontas ficam coladas)
    const pontas = ord.map((x) => ({ x, y: Y(x.vals[x.vals.length - 1]) })).sort((p, q) => p.y - q.y);
    for (let i = 1; i < pontas.length; i++) if (pontas[i].y - pontas[i - 1].y < 86) pontas[i].y = pontas[i - 1].y + 86;
    pontas.forEach(({ x, y }) => {
      const ax = X(x.vals.length - 1) + 54;
      g.beginPath(); g.arc(ax, y, 40, 0, Math.PI * 2); g.fillStyle = x.cor; g.fill();
      g.lineWidth = 6; g.strokeStyle = "#14161A"; g.stroke();
      g.fillStyle = "#14161A"; g.font = `600 32px ${OSW}`; g.textBaseline = "middle"; g.textAlign = "center";
      g.fillText(desafioIniciais(x.nome), ax, y + 2);
      g.textBaseline = "alphabetic";
    });
    // Legenda: nome + pontos
    const lider = sr.series.find((x) => x.user_id === sr.liderId) || ord[ord.length - 1];
    g.textAlign = "left";
    let lx = 70;
    sr.series.slice().sort((p, q) => q.vals[q.vals.length - 1] - p.vals[p.vals.length - 1]).slice(0, 4).forEach((x, i) => {
      const lyy = 1026 + Math.floor(i / 2) * 56;
      const lxx = i % 2 === 0 ? 70 : 560;
      g.beginPath(); g.arc(lxx + 14, lyy - 10, 14, 0, Math.PI * 2); g.fillStyle = x.cor; g.fill();
      g.fillStyle = "#F2F3F1"; g.font = `500 32px ${INT}`;
      g.fillText(fit(x.nome, 300) + (x === lider ? " 👑" : ""), lxx + 40, lyy);
      g.textAlign = "right"; g.fillStyle = "#C6F135"; g.font = `600 34px ${OSW}`;
      g.fillText(desafioFmtPts(x.vals[x.vals.length - 1]).replace("−", "-"), lxx + 440, lyy); g.textAlign = "left";
    });
  } else {
  // Pódio
  const top = d.ranking.slice(0, 3);
  const baseY = 1010;
  const colW = 270;
  const ordem = top.length === 1 ? [[0, 540, 400]] : top.length === 2 ? [[1, 330, 300], [0, 750, 400]] : [[1, 270, 330], [0, 540, 430], [2, 810, 290]];
  ordem.forEach(([idx, cx, h]) => {
    const p = top[idx];
    if (!p) return;
    const first = idx === 0;
    rr(cx - colW / 2 + 8, baseY - h, colW - 16, h, 26);
    if (first) { const gr = g.createLinearGradient(0, baseY - h, 0, baseY); gr.addColorStop(0, "#C6F135"); gr.addColorStop(1, "#8AA324"); g.fillStyle = gr; } else { g.fillStyle = "#2A2E35"; }
    g.fill();
    g.textAlign = "center";
    g.fillStyle = first ? "#14161A" : "#F2F3F1";
    g.font = `600 ${first ? 120 : 92}px ${OSW}`;
    g.fillText(desafioFmtPts(p.pts).replace("−", "-"), cx, baseY - h + (first ? 150 : 124));
    g.font = `500 28px ${INT}`;
    g.fillStyle = first ? "rgba(20,22,26,0.7)" : "#9AA0A6";
    g.fillText("pontos", cx, baseY - h + (first ? 196 : 164));
    g.font = `600 52px ${OSW}`;
    g.fillStyle = first ? "#14161A" : "#C6F135";
    g.fillText(`${idx + 1}º`, cx, baseY - 36);
    // avatar
    const ay = baseY - h - 64;
    g.beginPath(); g.arc(cx, ay, 52, 0, Math.PI * 2); g.fillStyle = p.cor; g.fill();
    g.lineWidth = 8; g.strokeStyle = "#14161A"; g.stroke();
    g.fillStyle = "#14161A"; g.font = `600 44px ${OSW}`; g.textBaseline = "middle";
    g.fillText(desafioIniciais(p.nome), cx, ay + 2);
    g.textBaseline = "alphabetic";
    if (first && p.pts > 0 || (first && d.ranking.length === 1)) { g.font = "64px sans-serif"; g.fillText("👑", cx, ay - 66); }
    g.fillStyle = "#F2F3F1";
    g.font = `600 36px ${INT}`;
    g.fillText(fit(p.nome, colW), cx, baseY + 54);
  });

  // Resto do ranking
  g.textAlign = "left";
  let y = baseY + 118;
  d.ranking.slice(3, 6).forEach((p, i) => {
    g.fillStyle = "#9AA0A6"; g.font = `600 34px ${OSW}`; g.fillText(`${i + 4}º`, 120, y);
    g.fillStyle = "#F2F3F1"; g.font = `500 32px ${INT}`; g.fillText(fit(p.nome, 560), 190, y);
    g.textAlign = "right"; g.fillStyle = "#C6F135"; g.font = `600 34px ${OSW}`; g.fillText(`${desafioFmtPts(p.pts).replace("−", "-")} pts`, W - 120, y); g.textAlign = "left";
    y += 52;
  });
  }

  // Faixa do perdedor / parcial
  const fy = H - 230;
  rr(70, fy, W - 140, 104, 28);
  g.fillStyle = d.perdedor ? "rgba(255,90,54,0.16)" : "rgba(198,241,53,0.12)";
  g.fill();
  g.lineWidth = 3; g.strokeStyle = d.perdedor ? "rgba(255,90,54,0.6)" : "rgba(198,241,53,0.5)"; g.stroke();
  g.textAlign = "center"; g.fillStyle = "#F2F3F1"; g.font = `600 38px ${INT}`;
  const linha = d.perdedor
    ? `☕ ${d.perdedor}${d.aposta ? " · " + d.aposta : " paga o café"}`
    : (d.rodape || "Parcial · a semana ainda não fechou");
  g.fillText(fit(linha, W - 220), W / 2, fy + 66);

  g.fillStyle = "#6B7077"; g.font = `500 28px ${INT}`;
  g.fillText("movo · todos os seus treinos numa só evolução", W / 2, H - 70);

  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  return blob;
}

function DesafioCartaoModal({ dados, onClose, showToast, onShared }) {
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let revoke = null;
    let vivo = true;
    desafioRenderCartao(dados).then((b) => {
      if (!vivo) return;
      if (!b) { setErro(true); return; }
      setBlob(b);
      revoke = URL.createObjectURL(b);
      setUrl(revoke);
    }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; if (revoke) URL.revokeObjectURL(revoke); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function compartilhar() {
    if (!blob) return;
    const file = new File([blob], "movo-desafio.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${dados.titulo} · ${dados.subtitulo}` });
        if (onShared) onShared();
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    baixar();
  }
  function baixar() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "movo-desafio.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (showToast) showToast("Imagem baixada");
    if (onShared) onShared();
  }
  return (
    <div className="gt-modal-backdrop" onClick={onClose}>
      <div className="gt-modal gt-dsf-cartao-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cartão pra compartilhar</h3>
        {erro && <p>Não consegui gerar a imagem agora. Tenta de novo em instantes.</p>}
        {!erro && !url && <p>Gerando…</p>}
        {url && <img className="gt-dsf-cartao-img" src={url} alt="Cartão do desafio" />}
        <div className="gt-modal-actions">
          <button className="gt-btn" onClick={compartilhar} disabled={!blob}>Compartilhar</button>
          <button className="gt-btn secondary" onClick={baixar} disabled={!blob}>Baixar</button>
        </div>
        <div className="gt-modal-actions" style={{ marginTop: 8 }}>
          <button className="gt-btn secondary" style={{ flex: 1 }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// Criar desafio: 3 passos (nome e datas, regras com modelos, aposta) + tela de convite.
const DESAFIO_ATIV_SUGESTOES = ["Corrida", "Caminhada", "Vôlei", "CrossFit", "Hyrox", "Natação", "Bike", "Yoga"];
function DesafioNomesAtividades({ nomes, onChange }) {
  const [txt, setTxt] = useState("");
  const tem = (n) => nomes.some((x) => desafioNomeNorm(x) === desafioNomeNorm(n));
  const alterna = (n) => onChange(tem(n) ? nomes.filter((x) => desafioNomeNorm(x) !== desafioNomeNorm(n)) : [...nomes, n].slice(0, 12));
  const extras = nomes.filter((n) => !DESAFIO_ATIV_SUGESTOES.some((s) => desafioNomeNorm(s) === desafioNomeNorm(n)));
  const add = () => { const t = txt.trim(); if (t && !tem(t)) onChange([...nomes, t.slice(0, 30)].slice(0, 12)); setTxt(""); };
  return (
    <div>
      <div className="gt-dsf-dias" style={{ flexWrap: "wrap" }}>
        {[...DESAFIO_ATIV_SUGESTOES, ...extras].map((n) => (
          <button key={n} type="button" className={`gt-dsf-dia gt-dsf-dia-txt ${tem(n) ? "on" : ""}`} aria-pressed={tem(n)} onClick={() => alterna(n)}>{n}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input className="gt-input" placeholder="Outra atividade (ex: Trilha)" value={txt} maxLength={30}
          onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="gt-btn secondary small" onClick={add}>Adicionar</button>
      </div>
    </div>
  );
}

function DesafioCriarModal({ onClose, onCreated, showToast, logEvent }) {
  const hoje = todayISO();
  const [step, setStep] = useState(1);
  const [nome, setNome] = useState("");
  const [weekStart, setWeekStart] = useState(1);
  const [startRaw, setStartRaw] = useState(hoje);
  const [semanas, setSemanas] = useState(4);
  const [modeloId, setModeloId] = useState("meta");
  const [rules, setRules] = useState(() => desafioNormalizeRules(desafioDefaultRules()));
  const [stakes, setStakes] = useState({ semana: "", final: "" });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [criado, setCriado] = useState(null);

  const inicio = desafioSnapStart(startRaw || hoje, weekStart);
  const fim = addDays(inicio, semanas * 7 - 1);

  function escolherModelo(m) {
    setModeloId(m.id);
    setRules(desafioNormalizeRules(desafioClone(m.rules)));
  }
  function editarRegras(next) {
    setModeloId("custom");
    setRules(desafioNormalizeRules(next));
  }
  function setPontos(i, v) {
    const pontos = rules.pontos.slice();
    pontos[i] = v;
    editarRegras({ ...rules, pontos });
  }
  function proximo() {
    setErro("");
    if (step === 1) {
      if (!nome.trim()) { setErro("Dá um nome pro desafio."); return; }
      setStep(2);
    } else if (step === 2) {
      if (!rules.academia.on && !rules.atividades.on) { setErro("Ligue ao menos um tipo de treino que conta."); return; }
      setStep(3);
    }
  }
  async function criar() {
    setSaving(true);
    setErro("");
    const { data, error } = await supabaseClient.rpc("create_challenge", {
      p_nome: nome.trim(), p_start: inicio, p_weeks: semanas, p_week_start: weekStart,
      p_rules: desafioNormalizeRules(rules), p_stakes: { semana: stakes.semana.trim(), final: stakes.final.trim() },
    });
    setSaving(false);
    if (error || !data) { setErro("Não consegui criar agora. Tenta de novo."); if (error) desafioLogErro("create_challenge", error.message); return; }
    if (logEvent) logEvent("desafio_criado");
    setCriado(Array.isArray(data) ? data[0] : data);
    if (onCreated) onCreated();
  }
  async function compartilharConvite() {
    const link = desafioConviteLink(criado.invite_code);
    const texto = `Topa o desafio "${criado.nome}" no Movo? Entra por aqui: ${link} (código ${criado.invite_code})`;
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(texto); showToast("Convite copiado"); } catch (e) { showToast("Copie o código: " + criado.invite_code); }
  }

  if (criado) {
    return (
      <div className="gt-focus">
        <div className="gt-focus-header">
          <button className="gt-focus-close" onClick={() => onClose(criado.id)}>✕</button>
          <div className="gt-focus-title-wrap"><div className="gt-focus-title">Desafio criado <Ei e="🎉" /></div></div>
        </div>
        <div className="gt-focus-body" style={{ padding: "8px 18px 24px" }}>
          <div className="gt-card" style={{ textAlign: "center" }}>
            <div className="gt-field-label">CÓDIGO DE CONVITE</div>
            <div className="gt-dsf-code">{criado.invite_code}</div>
            <p className="gt-dsf-hint">Quem tiver o código (ou abrir o link) entra no desafio. Chama a galera!</p>
            <button className="gt-btn" onClick={compartilharConvite}>Compartilhar convite</button>
          </div>
          <button className="gt-btn secondary" style={{ marginTop: 6 }} onClick={() => onClose(criado.id)}>Abrir desafio</button>
        </div>
      </div>
    );
  }

  const dd = (iso) => desafioDataCurta(iso);
  const pontosRows = [];
  for (let n = rules.meta; n >= 0; n--) pontosRows.push(n);

  return (
    <div className="gt-focus">
      <div className="gt-focus-header">
        <button className="gt-focus-close" onClick={() => onClose(null)}>✕</button>
        <div className="gt-focus-title-wrap">
          <div className="gt-focus-title">Novo desafio</div>
          <div className="gt-focus-progress-label">Passo {step} de 3</div>
        </div>
      </div>
      <div className="gt-focus-body" style={{ padding: "4px 18px 24px" }}>
        {step === 1 && (
          <div>
            <div className="gt-field-label">NOME</div>
            <input className="gt-input" placeholder="Ex: Desafio de outubro" value={nome} maxLength={50} onChange={(e) => setNome(e.target.value)} autoFocus />
            <div className="gt-field-label" style={{ marginTop: 16 }}>QUANDO COMEÇA</div>
            <input className="gt-input" type="date" value={startRaw} min={hoje} onChange={(e) => setStartRaw(e.target.value)} />
            <div className="gt-field-label" style={{ marginTop: 16 }}>A SEMANA COMEÇA NA</div>
            <select className="gt-input" value={weekStart} onChange={(e) => setWeekStart(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DESAFIO_SEMANA_NOMES[d]}</option>)}
            </select>
            <div className="gt-field-label" style={{ marginTop: 16 }}>DURAÇÃO</div>
            <DesafioStepper value={semanas} min={1} max={12} onChange={setSemanas} fmt={(v) => `${v} semana${v === 1 ? "" : "s"}`} />
            <div className="gt-dsf-resumo">
              Começa <b>{dd(inicio)}</b> ({DESAFIO_SEMANA_NOMES[weekdayOf(inicio)]}) e termina <b>{dd(fim)}</b>.
              {inicio !== startRaw && <span> A data foi ajustada pro primeiro dia de semana escolhido.</span>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="gt-field-label">MODELO</div>
            <div className="gt-dsf-modelos">
              {DESAFIO_MODELOS.map((m) => (
                <button key={m.id} type="button" className={`gt-dsf-modelo ${modeloId === m.id ? "on" : ""}`} onClick={() => escolherModelo(m)}>
                  <b>{m.nome}</b><span>{m.desc}</span>
                </button>
              ))}
            </div>
            {modeloId === "custom" && <div className="gt-dsf-hint" style={{ marginTop: 6 }}>Modelo personalizado — você mexeu nas regras.</div>}

            <div className="gt-field-label" style={{ marginTop: 18 }}>O QUE CONTA COMO TREINO</div>
            <div className="gt-card gt-dsf-regra">
              <label className="gt-dsf-check"><input type="checkbox" checked={rules.academia.on} onChange={(e) => editarRegras({ ...rules, academia: { ...rules.academia, on: e.target.checked } })} /> Treino de academia</label>
              {rules.academia.on && (
                <div>
                  <DesafioStepper value={rules.academia.minMin} min={0} max={120} step={5} onChange={(v) => editarRegras({ ...rules, academia: { ...rules.academia, minMin: v } })} fmt={(v) => (v === 0 ? "qualquer duração" : `${v} min ou mais`)} />
                  <div style={{ height: 6 }} />
                  <DesafioStepper value={rules.academia.minExs} min={0} max={15} onChange={(v) => editarRegras({ ...rules, academia: { ...rules.academia, minExs: v } })} fmt={(v) => (v === 0 ? "qualquer nº de exercícios" : `${v} exercício${v === 1 ? "" : "s"} feito${v === 1 ? "" : "s"} ou mais`)} />
                </div>
              )}
              <label className="gt-dsf-check" style={{ marginTop: 12 }}><input type="checkbox" checked={rules.atividades.on} onChange={(e) => editarRegras({ ...rules, atividades: { ...rules.atividades, on: e.target.checked } })} /> Atividades (corrida, vôlei, caminhada…)</label>
              {rules.atividades.on && (
                <div>
                  <DesafioStepper value={rules.atividades.minMin} min={0} max={120} step={5} onChange={(v) => editarRegras({ ...rules, atividades: { ...rules.atividades, minMin: v } })} fmt={(v) => (v === 0 ? "qualquer duração" : `${v} min ou mais`)} />
                  <div style={{ height: 6 }} />
                  <DesafioStepper value={rules.atividades.minKm} min={0} max={100} step={0.5} onChange={(v) => editarRegras({ ...rules, atividades: { ...rules.atividades, minKm: v } })} fmt={(v) => (v === 0 ? "sem distância mínima" : `${desafioFmtKm(v)} ou mais`)} />
                  <div className="gt-dsf-hint" style={{ margin: "10px 0 6px" }}>Quais atividades? Sem escolher nenhuma, todas contam. A comparação é pelo nome da atividade no app de cada pessoa.</div>
                  <DesafioNomesAtividades nomes={rules.atividades.nomes} onChange={(nomes) => editarRegras({ ...rules, atividades: { ...rules.atividades, nomes } })} />
                </div>
              )}
              <div className="gt-dsf-hint">Caminhada e passos entram como uma atividade do app. O tempo só é conferido se a pessoa registrar a duração (ou se você exigir abaixo).</div>
            </div>

            <div className="gt-field-label" style={{ marginTop: 18 }}>LIMITES</div>
            <div className="gt-card gt-dsf-regra">
              <div className="gt-dsf-hint" style={{ marginTop: 0 }}>Quantos treinos contam por dia</div>
              <select className="gt-input" value={rules.maxPorDia} onChange={(e) => editarRegras({ ...rules, maxPorDia: Number(e.target.value) })}>
                <option value={0}>Um de cada tipo (academia + corrida contam as duas)</option>
                <option value={1}>Só 1 por dia (dia ativo)</option>
                <option value={2}>Até 2 por dia</option>
                <option value={3}>Até 3 por dia</option>
              </select>
              <div className="gt-dsf-hint" style={{ margin: "12px 0 6px" }}>Dias da semana que valem</div>
              <div className="gt-dsf-dias">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = rules.dias.indexOf(d) >= 0;
                  return (
                    <button key={d} type="button" className={`gt-dsf-dia ${on ? "on" : ""}`} aria-pressed={on}
                      onClick={() => {
                        const next = on ? rules.dias.filter((x) => x !== d) : [...rules.dias, d];
                        if (next.length === 0) return;
                        editarRegras({ ...rules, dias: next.sort() });
                      }}>{DESAFIO_SEMANA_NOMES[d].slice(0, 3)}</button>
                  );
                })}
              </div>
              <label className="gt-dsf-check" style={{ marginTop: 12 }}><input type="checkbox" checked={rules.exigirDuracao} onChange={(e) => editarRegras({ ...rules, exigirDuracao: e.target.checked })} /> Exigir duração registrada (sem tempo, não conta)</label>
              <label className="gt-dsf-check" style={{ marginTop: 8 }}><input type="checkbox" checked={rules.exigirKm} onChange={(e) => editarRegras({ ...rules, exigirKm: e.target.checked })} /> Exigir distância registrada (sem km, não conta)</label>
              <div className="gt-dsf-hint">Só faz diferença se você definiu um mínimo de minutos ou de km acima. A distância vem do Strava; atividades sem distância seguem só a regra de minutos.</div>
            </div>

            <div className="gt-field-label" style={{ marginTop: 18 }}>META POR SEMANA</div>
            <DesafioStepper value={rules.meta} min={1} max={7} onChange={(v) => editarRegras(desafioSetMeta(rules, v))} fmt={(v) => `${v} treino${v === 1 ? "" : "s"}`} />

            <div className="gt-field-label" style={{ marginTop: 18 }}>PONTOS POR SEMANA</div>
            <div className="gt-card gt-dsf-regra">
              {pontosRows.map((n) => (
                <div key={n} className="gt-dsf-pontos-row">
                  <span>{n === rules.meta ? `${n} ou mais` : `${n} treino${n === 1 ? "" : "s"}`}</span>
                  <DesafioStepper value={rules.pontos[n]} min={-20} max={20} onChange={(v) => setPontos(n, v)} fmt={(v) => `${desafioFmtPts(v)} pts`} />
                </div>
              ))}
            </div>

            <div className="gt-field-label" style={{ marginTop: 18 }}>TREINAR JUNTO</div>
            <DesafioStepper value={rules.bonusJuntos} min={0} max={3} onChange={(v) => editarRegras({ ...rules, bonusJuntos: v })} fmt={(v) => (v === 0 ? "sem bônus" : `+${v} pt por vez, pra cada um`)} />
            <div className="gt-dsf-hint">Vale quando a outra pessoa confirma e as duas têm treino registrado no dia.</div>

            <div className="gt-dsf-resumo"><b>Resumo:</b> {desafioRegrasResumo(rules)}{rules.bonusJuntos > 0 ? ` · junto = ${desafioFmtPts(rules.bonusJuntos)}` : ""}</div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="gt-dsf-hint" style={{ marginTop: 0 }}>Opcional, mas é o que dá graça. Escreve o que está valendo.</p>
            <div className="gt-field-label">QUEM PERDE A SEMANA…</div>
            <input className="gt-input" placeholder="Ex: paga um café pra quem ganhou" value={stakes.semana} maxLength={80} onChange={(e) => setStakes({ ...stakes, semana: e.target.value })} />
            <div className="gt-field-label" style={{ marginTop: 16 }}>PRÊMIO FINAL</div>
            <input className="gt-input" placeholder="Ex: vale-presente dos perdedores" value={stakes.final} maxLength={80} onChange={(e) => setStakes({ ...stakes, final: e.target.value })} />
            <div className="gt-card" style={{ marginTop: 18 }}>
              <div className="gt-field-label">RESUMO</div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18 }}>{nome.trim()}</div>
              <div className="gt-dsf-hint">{dd(inicio)} → {dd(fim)} · {semanas} semana{semanas === 1 ? "" : "s"} · meta {rules.meta}/semana</div>
              <div className="gt-dsf-hint">{desafioRegrasResumo(rules)}</div>
              <div className="gt-dsf-hint">As regras ficam travadas quando o desafio começa. Nome e apostas dá pra editar depois.</div>
            </div>
          </div>
        )}
        {erro && <div style={{ color: "var(--warn)", fontSize: 13, marginTop: 12 }}>{erro}</div>}
      </div>
      <div className="gt-focus-footer gt-builder-footer">
        {step > 1 && <button className="gt-btn secondary" onClick={() => { setErro(""); setStep(step - 1); }}>Voltar</button>}
        {step < 3 && <button className="gt-btn" onClick={proximo}>Continuar</button>}
        {step === 3 && <button className="gt-btn" onClick={criar} disabled={saving}>{saving ? "Criando…" : "Criar desafio"}</button>}
      </div>
    </div>
  );
}

// Tela do desafio: minha semana, pista, placar, semanas, regras e gestão.
function DesafioDetalhe({ id, session, sessions, atividadeById, onClose, onChanged, showToast, logEvent }) {
  const meId = session.user.id;
  const [ov, setOv] = useState(null);
  const [erro, setErro] = useState(false);
  const [cartao, setCartao] = useState(null);
  const [juntoOpen, setJuntoOpen] = useState(false);
  const [juntoData, setJuntoData] = useState(todayISO());
  const [juntoCom, setJuntoCom] = useState([]);
  const [editando, setEditando] = useState(false);
  const [formNome, setFormNome] = useState("");
  const [formStakes, setFormStakes] = useState({ semana: "", final: "" });
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const hoje = todayISO();

  const carregar = useCallback(async () => {
    const { data, error } = await supabaseClient.rpc("challenge_overview", { p_id: id });
    if (error || !data) { setErro(true); if (error) desafioLogErro("challenge_overview", error.message); return null; }
    setErro(false);
    setOv(data);
    return data;
  }, [id]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const data = await carregar();
      if (!vivo || !data) return;
      // Reconcilia meus check-ins com as sessões deste aparelho e recarrega se algo mudou.
      const res = await syncDesafioCheckins(data.challenge, meId, sessions, atividadeById, todayISO());
      if (vivo && res.changed) carregar();
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const ch = ov && ov.challenge;
  const st = useMemo(() => (ov ? desafioStandings(ov.challenge, ov.members, ov.checkins, ov.together, hoje) : null), [ov, hoje]);

  if (erro) {
    return (
      <div className="gt-focus">
        <div className="gt-focus-header"><button className="gt-focus-close" onClick={onClose}>✕</button><div className="gt-focus-title-wrap"><div className="gt-focus-title">Desafio</div></div></div>
        <div className="gt-focus-body" style={{ padding: 18 }}><div className="gt-empty">Não consegui abrir esse desafio agora. Confira a conexão e tente de novo.</div><button className="gt-btn secondary" style={{ marginTop: 12 }} onClick={carregar}>Tentar de novo</button></div>
      </div>
    );
  }
  if (!ov || !st) {
    return (
      <div className="gt-focus">
        <div className="gt-focus-header"><button className="gt-focus-close" onClick={onClose}>✕</button><div className="gt-focus-title-wrap"><div className="gt-focus-title">Carregando…</div></div></div>
      </div>
    );
  }

  const rules = st.rules;
  const status = st.status;
  const souDono = ch.owner_id === meId;
  const stakes = ch.stakes || {};
  const me = st.totais.find((t) => t.is_me) || null;
  const meusCheckinsSemana = (() => {
    if (status.fase !== "rolando") return [];
    const wr = desafioWeekRange(ch, status.semanaIdx);
    return ov.checkins.filter((c) => c.user_id === meId && c.date >= wr.start && c.date <= wr.end).sort((a, b) => a.date.localeCompare(b.date));
  })();
  const faixa = me && status.fase === "rolando" ? desafioProximaFaixa(rules, me.semanaCount) : null;
  const pendentes = ov.together.filter((t) => t.to_user === meId && t.status === "pending");
  const nomeDe = (uid) => { const m = ov.members.find((x) => x.user_id === uid); return m ? m.nome : "Alguém"; };
  const outros = ov.members.filter((m) => m.user_id !== meId);
  const diaSemanaCurto = (iso) => DESAFIO_SEMANA_NOMES[weekdayOf(iso)].slice(0, 3);

  const dadosCartaoGeral = () => desafioDadosCartaoGeral(ch, st, ov.members);
  const dadosCartaoSemana = (w) => desafioDadosCartaoSemana(ch, st, ov.members, w);
  const dadosCartaoEvolucao = () => desafioDadosCartaoEvolucao(ch, st, ov.members);
  const serie = desafioSerie(ch, st, ov.members);

  async function responderJunto(t, status2) {
    const { error } = await supabaseClient.from("challenge_together").update({ status: status2 })
      .eq("challenge_id", id).eq("date", t.date).eq("from_user", t.from_user).eq("to_user", meId);
    if (error) { showToast("Não consegui salvar agora"); desafioLogErro("together_update", error.message); return; }
    showToast(status2 === "confirmed" ? "Confirmado ✓" : "Ok, não contou");
    carregar();
  }
  async function enviarJunto() {
    if (juntoCom.length === 0) return;
    const rows = juntoCom.map((uid) => ({ challenge_id: id, date: juntoData, from_user: meId, to_user: uid, status: "pending" }));
    const { error } = await supabaseClient.from("challenge_together").insert(rows);
    if (error && error.code !== "23505") { showToast("Não consegui enviar agora"); desafioLogErro("together_insert", error.message); return; }
    if (logEvent) logEvent("desafio_treinei_com");
    showToast(error ? "Esse pedido já existia" : "Pedido enviado — vale quando a pessoa confirmar");
    setJuntoOpen(false);
    setJuntoCom([]);
    carregar();
  }
  async function salvarEdicao() {
    const { error } = await supabaseClient.rpc("update_challenge", { p_id: id, p_nome: formNome, p_rules: ch.rules, p_stakes: { semana: formStakes.semana.trim(), final: formStakes.final.trim() } });
    if (error) { showToast("Não consegui salvar agora"); desafioLogErro("update_challenge", error.message); return; }
    setEditando(false);
    showToast("Desafio atualizado");
    await carregar();
    if (onChanged) onChanged();
  }
  async function sair() {
    if (!confirm("Sair deste desafio? Seus check-ins nele serão apagados.")) return;
    const { error } = await supabaseClient.rpc("leave_challenge", { p_id: id });
    if (error) { showToast("Não consegui sair agora"); return; }
    if (onChanged) onChanged();
    onClose();
  }
  async function excluir() {
    if (!confirm("Excluir o desafio pra todo mundo? Isso não dá pra desfazer.")) return;
    const { error } = await supabaseClient.rpc("delete_challenge", { p_id: id });
    if (error) { showToast("Não consegui excluir agora"); return; }
    if (onChanged) onChanged();
    onClose();
  }
  async function compartilharConvite() {
    const link = desafioConviteLink(ch.invite_code);
    const texto = `Topa o desafio "${ch.nome}" no Movo? Entra por aqui: ${link} (código ${ch.invite_code})`;
    try { if (navigator.share) { await navigator.share({ text: texto }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(texto); showToast("Convite copiado"); } catch (e) { showToast("Código: " + ch.invite_code); }
  }

  const fraseStatus = status.fase === "antes"
    ? `Começa em ${status.diasParaComecar} dia${status.diasParaComecar === 1 ? "" : "s"} (${desafioDataCurta(ch.start_date)})`
    : status.fase === "fim"
      ? "Desafio encerrado"
      : `Semana ${status.semanaNum} de ${ch.weeks} · ${status.diasRestantesSemana === 0 ? "último dia" : `faltam ${status.diasRestantesSemana} dia${status.diasRestantesSemana === 1 ? "" : "s"}`}`;
  const semanasFechadas = st.semanas.filter((w) => w.fechada).slice().reverse();
  const campeao = status.fase === "fim" ? st.totais[0] : null;

  return (
    <div className="gt-focus">
      <div className="gt-focus-header">
        <button className="gt-focus-close" onClick={onClose}>✕</button>
        <div className="gt-focus-title-wrap">
          <div className="gt-focus-title">{ch.nome}</div>
          <div className="gt-focus-progress-label">{fraseStatus} · {ov.members.length} pessoa{ov.members.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <div className="gt-focus-body" style={{ padding: "4px 16px 28px" }}>
        {campeao && (
          <div className="gt-card gt-dsf-campeao">
            <div style={{ fontSize: 34 }}><Ei e="🏆" size={40} /></div>
            <div className="gt-dsf-campeao-nome">{campeao.nome}</div>
            <div className="gt-dsf-hint">campeão com {desafioFmtPts(campeao.total)} pts{stakes.final ? ` · leva: ${stakes.final}` : ""}</div>
          </div>
        )}

        {status.fase === "rolando" && me && (
          <div className="gt-card gt-dsf-minha">
            <DesafioAnel count={me.semanaCount} meta={rules.meta} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="gt-field-label" style={{ marginBottom: 2 }}>MINHA SEMANA</div>
              <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 17 }}>
                {me.semanaCount >= rules.meta ? <>Meta batida! <Ei e="🔥" /></> : `${me.semanaCount} de ${rules.meta} treinos`}
              </div>
              <div className="gt-dsf-hint" style={{ marginTop: 2 }}>
                {faixa ? `Falta${faixa.falta === 1 ? "" : "m"} ${faixa.falta} pra ${desafioFmtPts(faixa.pts)} pts` : (me.semanaCount >= rules.meta ? `Garantiu ${desafioFmtPts(rules.pontos[Math.min(me.semanaCount, rules.meta)])} pts` : "Cada treino conta")}
                {me.semanaBonus > 0 && rules.bonusJuntos > 0 ? ` · +${me.semanaBonus * rules.bonusJuntos} de bônus` : ""}
              </div>
              {meusCheckinsSemana.length > 0 && (
                <div className="gt-dsf-chips">
                  {meusCheckinsSemana.map((c) => <span key={`${c.date}${c.tipo}`} className="gt-dsf-chip">{diaSemanaCurto(c.date)} · {c.label || "Treino"}</span>)}
                </div>
              )}
            </div>
          </div>
        )}
        {status.fase === "antes" && (
          <div className="gt-card"><div className="gt-dsf-hint" style={{ margin: 0 }}>Os treinos que você registrar a partir de {desafioDataCurta(ch.start_date)} contam automaticamente. Chama a galera enquanto isso</div></div>
        )}

        {pendentes.length > 0 && (
          <div className="gt-card gt-dsf-pend">
            <div className="gt-field-label">CONFIRMAR TREINO JUNTO</div>
            {pendentes.map((t) => (
              <div key={`${t.date}${t.from_user}`} className="gt-dsf-pend-row">
                <span><b>{nomeDe(t.from_user)}</b> disse que treinou com você em {desafioDataCurta(t.date)}</span>
                <div className="gt-dsf-pend-actions">
                  <button className="gt-btn small" onClick={() => responderJunto(t, "confirmed")}>Confirmar</button>
                  <button className="gt-btn secondary small" onClick={() => responderJunto(t, "declined")}>Não foi</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {status.fase !== "antes" && (
          <div className="gt-card">
            <div className="gt-dsf-sec-head"><div className="gt-field-label" style={{ marginBottom: 0 }}>PISTA</div><span className="gt-dsf-hint" style={{ margin: 0 }}>pontos ao vivo</span></div>
            <DesafioPista totais={st.totais} members={ov.members} />
          </div>
        )}

        {status.fase !== "antes" && serie.labels.length >= 3 && (
          <div className="gt-card">
            <div className="gt-dsf-sec-head"><div className="gt-field-label" style={{ marginBottom: 0 }}>CORRIDA DOS PONTOS</div><button className="gt-dsf-link" onClick={() => setCartao(dadosCartaoEvolucao())}>Compartilhar ↗</button></div>
            <DesafioEvolucao serie={serie} />
            {serie.temAoVivo && <div className="gt-dsf-hint" style={{ margin: "4px 0 0" }}>* semana em andamento (só pontos positivos)</div>}
          </div>
        )}

        <div className="gt-card">
          <div className="gt-dsf-sec-head"><div className="gt-field-label" style={{ marginBottom: 0 }}>PLACAR</div>{status.fase !== "antes" && <button className="gt-dsf-link" onClick={() => setCartao(dadosCartaoGeral())}>Compartilhar ↗</button>}</div>
          {st.totais.map((t, i) => (
            <div key={t.user_id} className="gt-dsf-rank-row">
              <div className="gt-dsf-pos">{t.pos}º</div>
              <div className="gt-dsf-avatar" style={{ background: desafioCorDe(ov.members, t.user_id) }}>{desafioIniciais(t.nome)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="gt-dsf-rank-nome" style={{ fontWeight: t.is_me ? 700 : 500 }}>{t.nome}{t.is_me ? " (você)" : ""}</div>
                <div className="gt-dsf-hint" style={{ margin: 0 }}>{status.fase === "rolando" ? `semana ${t.semanaCount}/${rules.meta} · ` : ""}{t.treinos} treino{t.treinos === 1 ? "" : "s"}{t.vitorias > 0 ? <> · <Ei e="🏆" /> {t.vitorias}</> : ""}</div>
              </div>
              <div className="gt-dsf-pts">{desafioFmtPts(t.total)}<small> pts</small></div>
            </div>
          ))}
          {status.fase === "rolando" && <div className="gt-dsf-hint" style={{ marginTop: 8 }}>Pontos da semana em andamento aparecem só se forem positivos. Os negativos só valem quando a semana fecha ({DESAFIO_SEMANA_NOMES[(ch.week_start + 6) % 7]}).</div>}
        </div>

        {status.fase !== "antes" && (
          <div className="gt-card">
            <div className="gt-field-label">TREINEI COM ALGUÉM</div>
            <p className="gt-dsf-hint" style={{ marginTop: 0 }}>Treinou junto com alguém do desafio? Avisa — vale +{rules.bonusJuntos || 0} pt pra cada um quando a pessoa confirmar{rules.bonusJuntos === 0 ? " (este desafio não tem bônus)" : ""}.</p>
            <button className="gt-btn secondary small" style={{ width: "100%" }} disabled={outros.length === 0 || rules.bonusJuntos === 0} onClick={() => { setJuntoData(hoje < ch.start_date ? ch.start_date : (hoje > desafioEnd(ch) ? desafioEnd(ch) : hoje)); setJuntoOpen(true); }}><Ei e="🤝" /> Treinei com alguém</button>
          </div>
        )}

        {semanasFechadas.length > 0 && (
          <div className="gt-card">
            <div className="gt-field-label">SEMANAS FECHADAS</div>
            {semanasFechadas.map((w) => (
              <div key={w.idx} className="gt-dsf-sem">
                <div className="gt-dsf-sem-head">
                  <b>Semana {w.num}</b><span className="gt-dsf-hint" style={{ margin: 0 }}>{desafioDataCurta(w.start)} – {desafioDataCurta(w.end)}</span>
                  <button className="gt-dsf-link" onClick={() => setCartao(dadosCartaoSemana(w))}>Compartilhar ↗</button>
                </div>
                {w.winners.length === 0 ? <div className="gt-dsf-hint" style={{ margin: 0 }}>Empate — ninguém ganha nem paga.</div> : (
                  <div className="gt-dsf-sem-lines">
                    <div><Ei e="🏆" /> {w.winners.map(nomeDe).join(" e ")} <span className="gt-dsf-hint" style={{ margin: 0 }}>({desafioFmtPts(w.rows.find((r) => r.user_id === w.winners[0]).pts)})</span></div>
                    <div><Ei e="☕" /> {w.losers.map(nomeDe).join(" e ")}{stakes.semana ? ` · ${stakes.semana}` : ""} <span className="gt-dsf-hint" style={{ margin: 0 }}>({desafioFmtPts(w.rows.find((r) => r.user_id === w.losers[0]).pts)})</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="gt-card">
          <button className="gt-dsf-collapse" onClick={() => setRegrasAbertas(!regrasAbertas)}>Regras e apostas {regrasAbertas ? "▴" : "▾"}</button>
          {regrasAbertas && (
            <div className="gt-dsf-regras-txt">
              <div><b>Conta:</b> {desafioContamTexto(rules)}.</div>
              <div><b>Limites:</b> {desafioLimitesTexto(rules)}.</div>
              <div><b>Meta:</b> {rules.meta} treino{rules.meta === 1 ? "" : "s"} por semana ({DESAFIO_SEMANA_NOMES[ch.week_start]} a {DESAFIO_SEMANA_NOMES[(ch.week_start + 6) % 7]}).</div>
              <div><b>Pontos:</b> {desafioRegrasResumo(rules)}</div>
              <div><b>Treinar junto:</b> {rules.bonusJuntos > 0 ? `${desafioFmtPts(rules.bonusJuntos)} pt por vez, pra cada um, com confirmação` : "sem bônus"}</div>
              <div><b>Semana:</b> {stakes.semana ? `quem perde ${stakes.semana}` : "sem aposta definida"}</div>
              <div><b>Final:</b> {stakes.final || "sem prêmio definido"}</div>
              <div className="gt-dsf-hint">Duração: {desafioDataCurta(ch.start_date)} a {desafioDataCurta(desafioEnd(ch))}. As regras ficam travadas depois que o desafio começa.</div>
            </div>
          )}
        </div>

        <div className="gt-card">
          <div className="gt-field-label">CONVITE</div>
          <div className="gt-dsf-convite">
            <span className="gt-dsf-code sm">{ch.invite_code}</span>
            <button className="gt-btn small" onClick={compartilharConvite}>Compartilhar</button>
          </div>
          {!editando && souDono && (
            <button className="gt-dsf-link" style={{ marginTop: 12 }} onClick={() => { setFormNome(ch.nome); setFormStakes({ semana: stakes.semana || "", final: stakes.final || "" }); setEditando(true); }}>✎ Editar nome e apostas</button>
          )}
          {editando && (
            <div className="gt-provas-form" style={{ marginTop: 12 }}>
              <input className="gt-input" value={formNome} maxLength={50} onChange={(e) => setFormNome(e.target.value)} placeholder="Nome do desafio" />
              <input className="gt-input" value={formStakes.semana} maxLength={80} onChange={(e) => setFormStakes({ ...formStakes, semana: e.target.value })} placeholder="Quem perde a semana…" />
              <input className="gt-input" value={formStakes.final} maxLength={80} onChange={(e) => setFormStakes({ ...formStakes, final: e.target.value })} placeholder="Prêmio final" />
              <div className="gt-provas-form-row">
                <button className="gt-btn small" onClick={salvarEdicao}>Salvar</button>
                <button className="gt-btn secondary small" onClick={() => setEditando(false)}>Cancelar</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {souDono
              ? <button className="gt-dsf-link danger" onClick={excluir}>Excluir desafio</button>
              : <button className="gt-dsf-link danger" onClick={sair}>Sair do desafio</button>}
          </div>
        </div>
      </div>

      {juntoOpen && (
        <div className="gt-modal-backdrop" onClick={() => setJuntoOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3><Ei e="🤝" /> Treinei com…</h3>
            <p>Marque quem treinou junto com você. A pessoa recebe o pedido e confirma.</p>
            <div className="gt-field-label">DIA</div>
            <input className="gt-input" type="date" value={juntoData} min={ch.start_date} max={hoje < desafioEnd(ch) ? hoje : desafioEnd(ch)} onChange={(e) => setJuntoData(e.target.value)} />
            <div className="gt-field-label" style={{ marginTop: 12 }}>COM QUEM</div>
            {outros.map((m) => (
              <label key={m.user_id} className="gt-dsf-check" style={{ padding: "6px 0" }}>
                <input type="checkbox" checked={juntoCom.includes(m.user_id)} onChange={(e) => setJuntoCom(e.target.checked ? [...juntoCom, m.user_id] : juntoCom.filter((x) => x !== m.user_id))} /> {m.nome}
              </label>
            ))}
            <div className="gt-modal-actions" style={{ marginTop: 14 }}>
              <button className="gt-btn" onClick={enviarJunto} disabled={juntoCom.length === 0 || !juntoData}>Enviar</button>
              <button className="gt-btn secondary" onClick={() => setJuntoOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {cartao && <DesafioCartaoModal dados={cartao} onClose={() => setCartao(null)} showToast={showToast} onShared={() => logEvent && logEvent("desafio_cartao_compartilhado")} />}
    </div>
  );
}

// Aba "Desafios" dentro de Evolução › Ranking: lista, criar e entrar por código/convite.
function DesafiosPanel({ session, desafios, desafiosOk, reload, sessions, atividadeById, showToast, logEvent, pendingCode, clearPendingCode, resumos, avisos, falhou }) {
  const [criarOpen, setCriarOpen] = useState(false);
  const [abertoId, setAbertoId] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [preview, setPreview] = useState(null); // { code, data }
  const [buscando, setBuscando] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [cartaoAviso, setCartaoAviso] = useState(null);
  const hoje = todayISO();

  function abrirCartaoAviso(chId, acao) {
    const r = resumos && resumos[chId];
    if (!r) return;
    if (acao.tipo === "geral") setCartaoAviso(desafioDadosCartaoGeral(r.ch, r.st, r.members));
    else if (acao.tipo === "semana") {
      const w = r.st.semanas.find((x) => x.idx === acao.idx);
      if (w) setCartaoAviso(desafioDadosCartaoSemana(r.ch, r.st, r.members, w));
    }
  }

  async function buscarConvite(code) {
    const c = String(code || "").trim().toUpperCase();
    if (!c) return;
    setBuscando(true);
    const { data, error } = await supabaseClient.rpc("challenge_preview", { p_code: c });
    setBuscando(false);
    if (error) { showToast("Não consegui conferir o convite agora"); desafioLogErro("challenge_preview", error.message); return; }
    if (!data) { showToast("Convite não encontrado"); return; }
    if (data.already_member) { showToast("Você já está nesse desafio"); setAbertoId(data.id); return; }
    setPreview({ code: c, data });
  }
  useEffect(() => {
    if (pendingCode && desafiosOk) { buscarConvite(pendingCode); if (clearPendingCode) clearPendingCode(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode, desafiosOk]);

  async function entrar() {
    if (!preview) return;
    setEntrando(true);
    const { data, error } = await supabaseClient.rpc("join_challenge", { p_code: preview.code });
    setEntrando(false);
    if (error) { showToast("Não consegui entrar agora"); desafioLogErro("join_challenge", error.message); return; }
    logEvent("desafio_entrou");
    setPreview(null);
    setCodigo("");
    await reload();
    if (data) setAbertoId(data);
  }

  function resumoLocal(ch) {
    const status = desafioStatus(ch, hoje);
    let linha;
    if (status.fase === "antes") linha = `Começa em ${status.diasParaComecar} dia${status.diasParaComecar === 1 ? "" : "s"}`;
    else if (status.fase === "fim") linha = "Encerrado";
    else linha = `Semana ${status.semanaNum} de ${ch.weeks}`;
    let prog = null;
    if (status.fase === "rolando") {
      const wr = desafioWeekRange(ch, status.semanaIdx);
      const rules = desafioNormalizeRules(ch.rules);
      const n = desafioContarLista(desafioCheckinsFromSessions(sessions, atividadeById, rules, wr.start, hoje), rules);
      prog = `${n}/${rules.meta} esta semana`;
    }
    return { linha, prog, fase: status.fase };
  }

  if (!desafiosOk) {
    return (
      <div className="gt-empty" style={{ marginTop: 12 }}>
        Os desafios ainda não foram ativados neste servidor.{session.user.email === ADMIN_EMAIL ? " (Admin: rode supabase/sql/challenges_setup.sql no Supabase.)" : ""}
      </div>
    );
  }

  const lista = desafios || [];
  const ativos = lista.filter((c) => desafioStatus(c, hoje).fase !== "fim");
  const encerrados = lista.filter((c) => desafioStatus(c, hoje).fase === "fim");
  const card = (ch) => {
    const r = resumoLocal(ch);
    return (
      <button key={ch.id} type="button" className="gt-dsf-card" onClick={() => setAbertoId(ch.id)}>
        <div className="gt-dsf-card-top">
          <span className="gt-dsf-card-nome">{ch.nome}</span>
          {r.prog && <span className="gt-dsf-card-prog">{r.prog}</span>}
        </div>
        <div className="gt-dsf-hint" style={{ margin: 0 }}>{r.linha} · {ch.members} pessoa{ch.members === 1 ? "" : "s"}</div>
      </button>
    );
  };

  return (
    <div style={{ marginTop: 12 }}>
      {desafios === null && <div className="gt-empty">Carregando…</div>}
      {falhou && (
        <div className="gt-card" style={{ marginBottom: 10 }}>
          <div className="gt-dsf-hint" style={{ margin: 0 }}>Não consegui atualizar seus desafios agora (conexão). {lista.length > 0 ? "Mostrando o que já estava carregado." : ""}</div>
          <button className="gt-btn secondary small" style={{ marginTop: 8 }} onClick={reload}>Tentar de novo</button>
        </div>
      )}
      {desafios !== null && lista.length === 0 && !falhou && (
        <div className="gt-card gt-dsf-vazio">
          <div style={{ fontSize: 38 }}><Ei e="🏁" size={44} /></div>
          <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 18, margin: "4px 0" }}>Bora competir?</div>
          <p className="gt-dsf-hint">Crie um desafio com os amigos: meta por semana, pontos, bônus por treinar junto e uma aposta pra dar graça.</p>
        </div>
      )}
      <DesafioAvisosCards avisos={avisos || {}} resumos={resumos || {}} desafios={lista} onAcao={abrirCartaoAviso} onAbrir={setAbertoId} />
      {ativos.map(card)}
      <button className="gt-btn" style={{ marginTop: 8 }} onClick={() => setCriarOpen(true)}>+ Novo desafio</button>
      <div className="gt-dsf-entrar">
        <input className="gt-input" placeholder="Tem um código? Digite aqui" value={codigo} maxLength={12} onChange={(e) => setCodigo(e.target.value.toUpperCase())} />
        <button className="gt-btn secondary small" disabled={!codigo.trim() || buscando} onClick={() => buscarConvite(codigo)}>{buscando ? "…" : "Entrar"}</button>
      </div>
      {encerrados.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="gt-field-label">ENCERRADOS</div>
          {encerrados.map(card)}
        </div>
      )}

      {criarOpen && (
        <DesafioCriarModal
          onClose={(idParaAbrir) => { setCriarOpen(false); if (idParaAbrir) setAbertoId(idParaAbrir); }}
          onCreated={() => reload()}
          showToast={showToast}
          logEvent={logEvent}
        />
      )}
      {abertoId && (
        <DesafioDetalhe
          id={abertoId}
          session={session}
          sessions={sessions}
          atividadeById={atividadeById}
          onClose={() => { setAbertoId(null); reload(); }}
          onChanged={reload}
          showToast={showToast}
          logEvent={logEvent}
        />
      )}
      {cartaoAviso && <DesafioCartaoModal dados={cartaoAviso} onClose={() => setCartaoAviso(null)} showToast={showToast} onShared={() => logEvent && logEvent("desafio_cartao_compartilhado")} />}
      {preview && (
        <div className="gt-modal-backdrop" onClick={() => setPreview(null)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Entrar no desafio?</h3>
            <p><b style={{ color: "var(--text)" }}>{preview.data.nome}</b><br />{preview.data.members} pessoa{preview.data.members === 1 ? "" : "s"} · {preview.data.weeks} semana{preview.data.weeks === 1 ? "" : "s"} · começa {desafioDataCurta(preview.data.start_date)}</p>
            <p>Só os dias e tipos de treino que contam pro placar ficam visíveis pro grupo. Cargas e fichas continuam privadas.</p>
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={entrar} disabled={entrando}>{entrando ? "Entrando…" : "Entrar"}</button>
              <button className="gt-btn secondary" onClick={() => setPreview(null)}>Agora não</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [treinos, setTreinos] = useState([]);
  const [atividades, setAtividades] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [sessions, setSessions] = useState({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingIsRedo, setOnboardingIsRedo] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provasOpen, setProvasOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false); // importar histórico de treinos
  const [treinoIAOpen, setTreinoIAOpen] = useState(false); // montar treinos de academia com IA
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState(null);
  const [semanaOpen, setSemanaOpen] = useState(false); // ajustar a semana com IA
  const [semanaDispensa, setSemanaDispensa] = useState(() => { try { return localStorage.getItem("treino-app:semanaDispensa") || ""; } catch (e) { return ""; } });
  const [treinoCorrida, setTreinoCorrida] = useState(null); // { data } quando a tela de treinos de corrida está aberta
  const [desafios, setDesafios] = useState(null); // lista de desafios em que estou (null = carregando)
  const [desafiosFalhou, setDesafiosFalhou] = useState(false); // true se não deu pra carregar a lista (rede)
  const [desafiosOk, setDesafiosOk] = useState(true); // false se as funções do banco ainda não existem
  const [desafioResumos, setDesafioResumos] = useState({}); // id -> { ch, members, st } (placar de cada desafio ativo)
  const [desafioAvisos_, setDesafioAvisos] = useState({}); // id -> avisos (semana fechou, te passaram, lembrete…)
  const [pendingInvite, setPendingInvite] = useState(() => {
    try { return localStorage.getItem("treino-app:desafioInvite") || null; } catch (e) { return null; }
  });
  const [provasBase, setProvasBase] = useState([]);
  const [provasUser, setProvasUser] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("treino-app:provas") || "null");
      if (raw && Array.isArray(raw.marcadas) && Array.isArray(raw.manuais)) return raw;
    } catch (e) {}
    return { marcadas: [], manuais: [] };
  });
  const provasUserRef = useRef(null);
  const [racesComp, setRacesComp] = useState([]); // provas cadastradas por qualquer pessoa (nuvem)
  const [amigosVao, setAmigosVao] = useState({}); // { provaId: [{ user_id, nome, km }] } só amigos aceitos
  const [provasAba, setProvasAba] = useState(null);
  const [provasMarcKickKey, setProvasMarcKickKey] = useState(0);
  const [provasVisivel, setProvasVisivel] = useState(true); // aparecer na lista de amigos que vão (e ver os amigos)
  const [menuOpen, setMenuOpen] = useState(false);
  const [participantes, setParticipantes] = useState({}); // { provaId: { total, por_km } }
  const [provasNuvemOk, setProvasNuvemOk] = useState(false);
  const provasNuvemOkRef = useRef(false);
  const provasErroLogado = useRef(false);
  const [planos, setPlanos] = useState(() => {
    try { const raw = JSON.parse(localStorage.getItem("treino-app:planos") || "[]"); return Array.isArray(raw) ? raw : []; } catch (e) { return []; }
  });
  const planosRef = useRef(planos);
  planosRef.current = planos;
  const [planoProva, setPlanoProva] = useState(null); // prova cujo plano de corrida está aberto
  const [planoRetomar, setPlanoRetomar] = useState(null); // { ctx, texto } ao abrir um plano que ficou pronto em segundo plano
  // Geração com IA em segundo plano: { id, kind, label, ctx, startedAt, status: rodando|pronto|erro, result }
  const [iaJob, setIaJob] = useState(() => {
    try { const r = JSON.parse(localStorage.getItem("treino-app:iaJob") || "null"); return r && r.id ? r : null; } catch (e) { return null; }
  });
  const iaJobRef = useRef(iaJob);
  iaJobRef.current = iaJob;
  const [agoraIA, setAgoraIA] = useState(Date.now());
  function salvarIaJob(j) {
    iaJobRef.current = j;
    setIaJob(j);
    try { if (j) localStorage.setItem("treino-app:iaJob", JSON.stringify(j)); else localStorage.removeItem("treino-app:iaJob"); } catch (e) {}
  }
  const [planoReplan, setPlanoReplan] = useState(false); // abre o plano direto no replanejamento
  const [planoDispensa, setPlanoDispensa] = useState(() => {
    try { const raw = JSON.parse(localStorage.getItem("treino-app:planoReplanDispensa") || "{}"); return raw && typeof raw === "object" ? raw : {}; } catch (e) { return {}; }
  });
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState(null);
  const [adminErrors, setAdminErrors] = useState(null);
  const [adminOverview, setAdminOverview] = useState(null);
  const [adminDaily, setAdminDaily] = useState(null);
  const [adminAiCost, setAdminAiCost] = useState(null); // gasto com IA em US$ (null se o SQL ainda não foi rodado)
  const [adminPlanUsage, setAdminPlanUsage] = useState(null); // [{ email, no_mes, total, ultima }] ou null se a função não existe ainda
  const [adminRaces, setAdminRaces] = useState(null); // provas da comunidade p/ moderar; null se a função não existe ainda
  const [adminGaps, setAdminGaps] = useState(null); // [{ nome, vezes, usuarios, ultima }] ou null se a função não existe ainda
  const [adminLogins, setAdminLogins] = useState(null); // [{ email, logins, logouts, ultimo_login }] ou null se a função não existe ainda
  const [adminEvents, setAdminEvents] = useState(null); // [{ name, total, usuarios }] ou null se a função não existe ainda
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
  const [authOtp, setAuthOtp] = useState("");
  const [authVerifying, setAuthVerifying] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null); // evento beforeinstallprompt (Android/Chrome), guardado pra disparar sob clique
  const [installBannerDismissed, setInstallBannerDismissed] = useState(() => {
    try { return localStorage.getItem("treino-app:installBannerDismissed") === "1"; } catch (e) { return false; }
  });
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  // "Puxar pra atualizar" (pull-to-refresh) feito na mão: o gesto nativo do
  // navegador/PWA instalado dependia do documento inteiro poder esticar
  // (rubber-band) no topo — exatamente a folga de altura que também causava
  // o cabeçalho sumir ao rolar à toa (ver .gt-shell/overscroll-behavior).
  // Travar essa folga resolveu o bug do cabeçalho mas também desativou o
  // puxar-pra-atualizar nativo, então reimplementamos o gesto à mão, restrito
  // ao conteúdo (.gt-body), sem precisar deixar o documento esticar de novo.
  // Trava de rolagem do documento: na tela principal só o conteúdo (.gt-body) rola. Se algo
  // (teclado abrindo/fechando, foco em campo, barra do navegador) empurrar o documento ou o
  // .gt-shell, o cabeçalho com o menu ☰ some. Aqui devolvemos tudo ao topo na hora.
  useEffect(() => {
    function recentrar() {
      try {
        const sh = document.querySelector(".gt-shell");
        if (!sh) return;
        if (window.scrollY) window.scrollTo(0, 0);
        if (document.documentElement.scrollTop) document.documentElement.scrollTop = 0;
        if (document.body.scrollTop) document.body.scrollTop = 0;
        if (sh.scrollTop) sh.scrollTop = 0;
      } catch (e) {}
    }
    function aoRolar(e) {
      const t = e.target;
      if (t === document || t === document.documentElement || t === document.body || (t && t.classList && t.classList.contains("gt-shell"))) recentrar();
    }
    function aoSairDoCampo() { setTimeout(recentrar, 120); setTimeout(recentrar, 450); }
    document.addEventListener("scroll", aoRolar, true);
    document.addEventListener("focusout", aoSairDoCampo);
    const vv = window.visualViewport;
    if (vv) vv.addEventListener("resize", aoSairDoCampo);
    return () => {
      document.removeEventListener("scroll", aoRolar, true);
      document.removeEventListener("focusout", aoSairDoCampo);
      if (vv) vv.removeEventListener("resize", aoSairDoCampo);
    };
  }, []);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [pendingFichaPrompt, setPendingFichaPrompt] = useState(null); // { item, date, treinoNome, changes }
  const pullStartYRef = useRef(null);
  const PULL_REFRESH_THRESHOLD = 70;
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
  const planosTimer = useRef(null);
  const planosErroLogado = useRef(false);
  const STORAGE_PREFIX = "treino-app:";
  const sessionRef = useRef(null);
  sessionRef.current = session;
  const cloudSyncedRef = useRef(false);
  cloudSyncedRef.current = cloudSynced;
  const dataRef = useRef({});
  dataRef.current = { treinos, atividades, schedule, sessions };
  // Como o login foi feito ("login_codigo" ou "login_link"), pendente de
  // registro assim que a sessão aparecer — ver efeito de autenticação.
  const loginMethodRef = useRef(OPENED_VIA_LOGIN_LINK ? "login_link" : null);

  // --- Autenticação: verifica sessão existente e escuta mudanças (login,
  // logout, ou o clique no link mágico do e-mail). ---
  useEffect(() => {
    let mounted = true;
    function registerLoginIfPending(sess) {
      if (sess && loginMethodRef.current) {
        logEventFor(sess.user.id, loginMethodRef.current);
        loginMethodRef.current = null;
      }
    }
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const gotSession = data.session || null;
      setSession(gotSession);
      setAuthChecked(true);
      registerLoginIfPending(gotSession);
    });
    const { data: sub } = supabaseClient.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession || null);
      if (event === "SIGNED_IN") registerLoginIfPending(newSession);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // --- Captura o prompt nativo de instalação (Android/Chrome) assim que o
  // navegador oferece — sem isso, o Chrome só mostra o convite sozinho às
  // vezes, de um jeito que muita gente não repara. Guardamos o evento pra
  // disparar sob um botão nosso, visível de verdade. ---
  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
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
          // Planos de corrida vivem numa coluna própria (`planos`); se ela ainda não existe no
          // banco, `data.planos` vem indefinido e os planos ficam só neste aparelho.
          if (Array.isArray(data.planos)) {
            if (data.planos.length) {
              setPlanos(data.planos);
              try { localStorage.setItem("treino-app:planos", JSON.stringify(data.planos)); } catch (e) {}
            } else {
              try {
                const loc = JSON.parse(localStorage.getItem("treino-app:planos") || "[]");
                if (Array.isArray(loc) && loc.length) pushPlanos(loc, session.user.id);
              } catch (e) {}
            }
          }
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

  // Digitar o código de 6 dígitos (em vez de tocar no link) é o caminho que
  // funciona de dentro do próprio app instalado (PWA) — tocar no link do
  // e-mail abre numa aba/app de navegador separado em vez de voltar pro app
  // instalado, e a sessão criada lá não chega no app. Digitando o código
  // aqui dentro, o login acontece sem sair do app.
  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (!authOtp.trim()) return;
    setAuthVerifying(true);
    setAuthError("");
    loginMethodRef.current = "login_codigo";
    const { error } = await supabaseClient.auth.verifyOtp({
      email: authEmail,
      token: authOtp.trim(),
      type: "email",
    });
    setAuthVerifying(false);
    if (error) loginMethodRef.current = null;
    if (error) setAuthError("Código inválido ou expirado. Confira o e-mail mais recente ou peça um novo.");
    // Se não deu erro, o onAuthStateChange cuida de atualizar a sessão.
  }

  function handleLogout() {
    logEvent("logout");
    supabaseClient.auth.signOut();
  }

  function dismissInstallBanner() {
    setInstallBannerDismissed(true);
    try { localStorage.setItem("treino-app:installBannerDismissed", "1"); } catch (e) {}
  }

  async function handleInstallClick() {
    if (installPrompt) {
      // Android/Chrome: dispara o prompt nativo de verdade.
      installPrompt.prompt();
      try { await installPrompt.userChoice; } catch (e) {}
      setInstallPrompt(null);
      dismissInstallBanner();
    } else {
      // iOS (e qualquer navegador sem o evento) não tem instalação por
      // botão — só dá pra orientar o passo a passo manual.
      setInstallHelpOpen(true);
    }
  }

  // --- Puxar pra atualizar (pull-to-refresh manual na .gt-body) ---
  function handleBodyTouchStart(e) {
    if (pullRefreshing) return;
    // Só começa a contar o puxão se já estiver no topo do scroll — senão é
    // só rolagem normal do conteúdo, não um pedido de atualizar.
    if (e.currentTarget.scrollTop > 0) { pullStartYRef.current = null; return; }
    pullStartYRef.current = e.touches[0].clientY;
  }
  function handleBodyTouchMove(e) {
    if (pullStartYRef.current === null || pullRefreshing) return;
    if (e.currentTarget.scrollTop > 0) { pullStartYRef.current = null; setPullDistance(0); return; }
    const delta = e.touches[0].clientY - pullStartYRef.current;
    // Resistência (puxa o dobro pra render metade) + teto, pra não esticar
    // infinito e parecer mais com o gesto nativo de "borracha".
    setPullDistance(delta > 0 ? Math.min(delta * 0.5, 90) : 0);
  }
  function handleBodyTouchEnd() {
    if (pullStartYRef.current === null) return;
    pullStartYRef.current = null;
    if (pullDistance >= PULL_REFRESH_THRESHOLD) {
      setPullRefreshing(true);
      setPullDistance(PULL_REFRESH_THRESHOLD);
      setTimeout(() => window.location.reload(), 200);
    } else {
      setPullDistance(0);
    }
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

  async function adminEsconderProva(r, oculta) {
    const { error } = await supabaseClient.rpc("admin_set_race_oculta", { p_id: r.id, p_oculta: oculta });
    if (error) { showToast("Não consegui alterar a prova"); logClientError("admin_set_race_oculta", error.message); return; }
    setAdminRaces((lista) => (lista || []).map((x) => (x.id === r.id ? { ...x, oculta } : x)));
    showToast(oculta ? "Prova escondida de todos" : "Prova visível de novo");
  }
  async function loadAdminData() {
    setAdminLoading(true);
    const [usersRes, errorsRes, overviewRes, dailyRes, eventsRes, loginsRes, gapsRes, planUsageRes] = await Promise.all([
      supabaseClient.rpc("admin_usage_stats"),
      supabaseClient.rpc("admin_client_errors", { limit_n: 50 }),
      supabaseClient.rpc("admin_overview_stats"),
      supabaseClient.rpc("admin_daily_active", { dias: 14 }),
      supabaseClient.rpc("admin_event_counts", { dias: 30 }),
      supabaseClient.rpc("admin_login_stats", { dias: 7 }),
      supabaseClient.rpc("admin_exercise_gaps", { dias: 90 }),
      supabaseClient.rpc("admin_plan_usage"),
    ]);
    try {
      const fbRes = await supabaseClient.rpc("admin_feedback_list", { limit_n: 100 });
      setAdminFeedback(fbRes.error ? null : fbRes.data || []);
    } catch (e) { setAdminFeedback(null); }
    setAdminPlanUsage(planUsageRes.error ? null : planUsageRes.data || []);
    try {
      const custoRes = await supabaseClient.rpc("admin_ai_cost");
      setAdminAiCost(custoRes.error ? null : (custoRes.data || [])[0] || null);
    } catch (e) { setAdminAiCost(null); }
    try {
      const racesRes = await supabaseClient.rpc("admin_shared_races");
      setAdminRaces(racesRes.error ? null : racesRes.data || []);
    } catch (e) { setAdminRaces(null); }
    setAdminGaps(gapsRes.error ? null : gapsRes.data || []);
    setAdminUsers(usersRes.error ? [] : usersRes.data || []);
    setAdminErrors(errorsRes.error ? [] : errorsRes.data || []);
    setAdminOverview(overviewRes.error ? null : (overviewRes.data || [])[0] || null);
    setAdminDaily(dailyRes.error ? [] : dailyRes.data || []);
    setAdminEvents(eventsRes.error ? null : eventsRes.data || []);
    setAdminLogins(loginsRes.error ? null : loginsRes.data || []);
    setAdminLoading(false);
  }

  async function enviarFeedback({ tipo, mensagem, contato }) {
    if (!session) return { ok: false };
    const { data, error } = await supabaseClient
      .from("user_feedback")
      .insert({ user_id: session.user.id, tipo, mensagem, contato, versao: APP_BUILD })
      .select("id")
      .single();
    if (error) {
      const limite = /limite_feedback/.test(error.message || "");
      if (!limite) logClientError("feedback_enviar", error.message);
      return { ok: false, limite };
    }
    logEvent("feedback_enviado");
    try {
      // e-mail é opcional: se a função não existir ou falhar, o feedback já está salvo
      fetch(`${SUPABASE_URL}/functions/v1/notificar-feedback`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id }),
      }).catch(() => {});
    } catch (e) {}
    return { ok: true };
  }
  async function adminMarcarFeedback(f, lido) {
    const { error } = await supabaseClient.rpc("admin_feedback_lido", { p_id: f.id, p_lido: lido });
    if (error) { showToast("Não consegui atualizar"); logClientError("admin_feedback_lido", error.message); return; }
    setAdminFeedback((l) => (l || []).map((x) => (x.id === f.id ? { ...x, lido } : x)));
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

  function logEvent(name) {
    logEventFor(sessionRef.current ? sessionRef.current.user.id : null, name);
  }

  // --- Provas: base de races.json (carga semanal) + provas da comunidade (nuvem) + o que a
  // pessoa marcou. Marcações vão pra tabela race_entries; localStorage é o espelho/fallback. ---
  useEffect(() => {
    let cancelled = false;
    fetch("races.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => { if (!cancelled && doc && Array.isArray(doc.provas)) setProvasBase(doc.provas); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  provasUserRef.current = provasUser;
  provasNuvemOkRef.current = provasNuvemOk;
  function saveProvasUser(next) {
    provasUserRef.current = next;
    setProvasUser(next);
    try { localStorage.setItem("treino-app:provas", JSON.stringify(next)); } catch (e) {}
  }
  function provaErroNuvem(ctx, error) {
    if (error && !provasErroLogado.current) { provasErroLogado.current = true; logClientError(ctx, error.message || String(error)); }
  }
  // Sobe (ou apaga) a marcação da prova na nuvem. Falha em silêncio: o aparelho já guardou.
  function entradaProvaNuvem(id, km, apagar) {
    const sess = sessionRef.current;
    if (!sess || !provasNuvemOkRef.current) return;
    const uid = sess.user.id;
    const q = apagar
      ? supabaseClient.from("race_entries").delete().eq("user_id", uid).eq("race_id", id)
      : supabaseClient.from("race_entries").upsert({ user_id: uid, race_id: id, km: km > 0 ? km : null }, { onConflict: "user_id,race_id" });
    q.then(({ error }) => provaErroNuvem("race_entries_sync", error), (e) => provaErroNuvem("race_entries_sync", e));
  }
  function provaDeCompartilhada(row) {
    return {
      id: `u-${row.id}`,
      nome: row.nome,
      data_inicio: row.data_inicio,
      data_fim: row.data_fim || null,
      cidade: row.cidade || "",
      uf: row.uf || "",
      modalidade: row.modalidade || "corrida",
      distancias: Array.isArray(row.distancias) ? row.distancias : [],
      link_oficial: row.link_oficial || null,
      fonte: "comunidade",
      compartilhada: true,
    };
  }

  // Ao entrar: carrega as provas da comunidade e as minhas marcações da nuvem. Se a nuvem ainda
  // não tem nada meu, sobe o que já estava marcado no aparelho. Se as tabelas não existem
  // (SQL não rodado), tudo segue só local.
  useEffect(() => {
    if (!session || !cloudSynced) return;
    let cancelled = false;
    (async () => {
      try {
        const uid = session.user.id;
        const desde = addDays(todayISO(), -30);
        const [ent, sh] = await Promise.all([
          supabaseClient.from("race_entries").select("race_id,km").eq("user_id", uid),
          supabaseClient.from("shared_races").select("*").gte("data_inicio", desde),
        ]);
        if (cancelled) return;
        if (ent.error || sh.error) { provaErroNuvem("races_cloud_load", ent.error || sh.error); return; }
        provasNuvemOkRef.current = true;
        setProvasNuvemOk(true);
        setRacesComp((sh.data || []).map(provaDeCompartilhada));
        try {
          const pv = await supabaseClient.from("race_privacy").select("visivel_amigos").eq("user_id", uid).maybeSingle();
          if (!cancelled && !pv.error && pv.data) setProvasVisivel(pv.data.visivel_amigos !== false);
        } catch (e) {}
        const rows = ent.data || [];
        const atual = provasUserRef.current;
        if (rows.length > 0) {
          const kms = {};
          rows.forEach((x) => { if (Number(x.km) > 0) kms[x.race_id] = Number(x.km); });
          saveProvasUser({ ...atual, marcadas: rows.map((x) => x.race_id), kms });
        } else if (atual.marcadas.length > 0) {
          const lote = atual.marcadas.map((id) => ({ user_id: uid, race_id: id, km: ((atual.kms || {})[id] > 0) ? atual.kms[id] : null }));
          const { error } = await supabaseClient.from("race_entries").upsert(lote, { onConflict: "user_id,race_id" });
          provaErroNuvem("race_entries_seed", error);
        }
      } catch (e) { provaErroNuvem("races_cloud_exception", e); }
    })();
    return () => { cancelled = true; };
  }, [session && session.user.id, cloudSynced]);

  const provasTodas = (() => {
    const vistos = new Set();
    return [...provasBase, ...racesComp, ...provasUser.manuais].filter((r) => !vistos.has(r.id) && vistos.add(r.id));
  })();
  const provasHoje = todayISO();
  const proximaProva = provasTodas
    .filter((r) => provasUser.marcadas.includes(r.id) && provaFim(r) >= provasHoje)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0] || null;
  function saudacaoHoje() {
    const h = new Date().getHours();
    const base = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    const nome = ((displayName || "").trim().split(/\s+/)[0]) || "";
    return nome ? `${base}, ${nome}` : base;
  }
  function openProvas(aba) { setProvasAba(typeof aba === "string" ? aba : null); setProvasOpen(true); logEvent("provas_aberta"); }

  // Quantas pessoas vão em cada prova (só números). Atualiza ao abrir e quando minhas marcações mudam.
  const provasMarcKey = provasUser.marcadas.join(",") + "|" + JSON.stringify(provasUser.kms || {}) + "|" + provasMarcKickKey;
  useEffect(() => {
    if (!provasOpen || !session || !provasNuvemOk) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const ids = provasTodas.filter((r) => provaFim(r) >= provasHoje).map((r) => r.id).slice(0, 300);
        if (!ids.length) return;
        const { data, error } = await supabaseClient.rpc("race_participants", { p_ids: ids });
        if (cancelled) return;
        if (error) { provaErroNuvem("race_participants", error); return; }
        const mapa = {};
        (data || []).forEach((x) => { mapa[x.race_id] = { total: Number(x.total) || 0, por_km: x.por_km || {} }; });
        setParticipantes(mapa);
        const fr = await supabaseClient.rpc("race_friends", { p_ids: ids });
        if (cancelled) return;
        if (!fr.error) {
          const am = {};
          (fr.data || []).forEach((x) => { (am[x.race_id] = am[x.race_id] || []).push({ user_id: x.user_id, nome: x.nome, km: Number(x.km) || 0 }); });
          setAmigosVao(am);
        } else provaErroNuvem("race_friends", fr.error);
      } catch (e) { provaErroNuvem("race_participants_exception", e); }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [provasOpen, provasNuvemOk, provasBase.length, racesComp.length, provasMarcKey]);

  async function mudarProvasVisivel(v) {
    const anterior = provasVisivel;
    setProvasVisivel(v);
    if (!sessionRef.current) return;
    const { error } = await supabaseClient.from("race_privacy").upsert({ user_id: sessionRef.current.user.id, visivel_amigos: v, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) { setProvasVisivel(anterior); showToast("Não consegui salvar essa opção agora"); provaErroNuvem("race_privacy", error); return; }
    showToast(v ? "Seus amigos veem quando você vai em uma prova" : "Você não aparece mais — e também não vê os amigos nas provas");
    setProvasMarcKickKey((k) => k + 1);
  }
  function toggleProva(r) {
    const going = provasUser.marcadas.includes(r.id);
    const { [r.id]: _km, ...kmsRest } = provasUser.kms || {};
    saveProvasUser({
      ...provasUser,
      marcadas: going ? provasUser.marcadas.filter((id) => id !== r.id) : [...provasUser.marcadas, r.id],
      kms: going ? kmsRest : (provasUser.kms || {}),
    });
    entradaProvaNuvem(r.id, (provasUser.kms || {})[r.id] || 0, going);
    if (!going) logEvent("prova_marcada");
  }
  // Marca a prova guardando a distância que a pessoa vai correr (0 = não definida).
  function marcarProva(r, km) {
    saveProvasUser({
      ...provasUser,
      marcadas: provasUser.marcadas.includes(r.id) ? provasUser.marcadas : [...provasUser.marcadas, r.id],
      kms: km > 0 ? { ...(provasUser.kms || {}), [r.id]: km } : (provasUser.kms || {}),
    });
    entradaProvaNuvem(r.id, km, false);
    logEvent("prova_marcada");
    if (km > 0) logEvent("prova_km_definida");
  }
  function setProvaKm(r, km) {
    const { [r.id]: _km, ...kmsRest } = provasUser.kms || {};
    saveProvasUser({ ...provasUser, kms: km > 0 ? { ...kmsRest, [r.id]: km } : kmsRest });
    if (provasUser.marcadas.includes(r.id)) entradaProvaNuvem(r.id, km, false);
  }
  function provaComKm(r) { return { ...r, kmEscolhido: (provasUser.kms || {})[r.id] || 0 }; }
  // Cadastra a prova: com a nuvem ativa ela vira de todos (sem duplicar); senão fica só no aparelho.
  async function addProvaManual(r, km) {
    const norm = (x) => normalizeSearch(x || "");
    const igual = provasTodas.find((x) => x.data_inicio === r.data_inicio && norm(x.nome) === norm(r.nome));
    let final = r;
    let compartilhada = false;
    if (igual) {
      final = igual;
      showToast("Essa prova já está na lista — marquei pra você");
    } else if (sessionRef.current && provasNuvemOkRef.current) {
      try {
        const { data, error } = await supabaseClient.rpc("share_race", {
          p_nome: r.nome, p_data: r.data_inicio, p_data_fim: r.data_fim || null, p_cidade: r.cidade || "", p_uf: r.uf || "",
          p_modalidade: r.modalidade, p_distancias: r.distancias || [], p_link: r.link_oficial || null,
        });
        if (!error && data && data.id) {
          final = provaDeCompartilhada(data);
          compartilhada = true;
          setRacesComp((prev) => (prev.some((x) => x.id === final.id) ? prev : [...prev, final]));
          if (data.nova === false) showToast("Essa prova já estava cadastrada — marquei pra você");
        } else provaErroNuvem("share_race", error || new Error("resposta_vazia"));
      } catch (e) { provaErroNuvem("share_race_exception", e); }
    }
    const atual = provasUserRef.current;
    const jaLocal = atual.manuais.some((x) => x.id === final.id);
    saveProvasUser({
      ...atual,
      marcadas: atual.marcadas.includes(final.id) ? atual.marcadas : [...atual.marcadas, final.id],
      manuais: (compartilhada || igual || jaLocal) ? atual.manuais : [...atual.manuais, final],
      kms: km > 0 ? { ...(atual.kms || {}), [final.id]: km } : (atual.kms || {}),
    });
    entradaProvaNuvem(final.id, km, false);
    logEvent("prova_manual_criada");
  }
  function removeProvaManual(id) {
    const { [id]: _km, ...kmsRest } = provasUser.kms || {};
    saveProvasUser({ ...provasUser, marcadas: provasUser.marcadas.filter((x) => x !== id), manuais: provasUser.manuais.filter((r) => r.id !== id), kms: kmsRest });
    entradaProvaNuvem(id, 0, true);
  }

  // --- Planos de corrida: guardados no aparelho e, se a coluna `planos` existir em app_data,
  // também na nuvem (upsert separado pra não atrapalhar o salvamento do resto). ---
  function pushPlanos(next, uid) {
    supabaseClient.from("app_data").upsert({ user_id: uid, planos: next, updated_at: new Date().toISOString() }).then(({ error }) => {
      if (error && !planosErroLogado.current) { planosErroLogado.current = true; logClientError("planos_sync", error.message); }
    });
  }
  function savePlanos(next) {
    planosRef.current = next;
    setPlanos(next);
    try { localStorage.setItem("treino-app:planos", JSON.stringify(next)); } catch (e) {}
    if (!sessionRef.current || !cloudSyncedRef.current) return;
    clearTimeout(planosTimer.current);
    planosTimer.current = setTimeout(() => pushPlanos(next, sessionRef.current.user.id), 500);
  }
  // Treinos de corrida avulsos moram num plano especial ("avulso"): a biblioteca fica em `biblioteca`
  // e cada treino agendado vira uma sessão com data (aparece na agenda como as sessões de plano).
  const planoAvulso = planos.find((p) => p.tipo === "avulso") || null;
  function novoAvulso(extra) { return { id: "plano-avulsos", tipo: "avulso", provaId: "avulsos", provaNome: "Treinos de corrida", provaData: "", provaKm: 0, params: {}, sessoes: [], biblioteca: [], ...(planosRef.current.find((p) => p.tipo === "avulso") || {}), ...extra }; }
  function salvarAvulso(next) { savePlanos([...planos.filter((p) => p.tipo !== "avulso"), next]); }
  function salvarTreinoCorrida(t) {
    const item = { ...t, id: `tc-${Date.now()}`, criadoEm: todayISO() };
    const atual = novoAvulso({});
    salvarAvulso({ ...atual, biblioteca: [...(atual.biblioteca || []), item] });
    logEvent("treino_corrida_salvo");
    showToast("Treino salvo");
    return item;
  }
  function agendarTreinoCorrida(t, iso) {
    // lê o estado mais recente pelo ref (salvarTreinoCorrida acabou de rodar na mesma ação)
    const atual = planosRef.current.find((p) => p.tipo === "avulso") || novoAvulso({});
    const sessao = { data: iso, fase: "", tipo: t.tipo, titulo: t.titulo, distanciaKm: t.distanciaKm, duracaoMin: t.duracaoMin, esforco: t.esforco, pace: t.pace, detalhes: t.detalhes, etapas: t.etapas, avulsoId: t.id };
    const bib = (atual.biblioteca || []).some((x) => x.id === t.id) ? atual.biblioteca : [...(atual.biblioteca || []), t];
    salvarAvulso({ ...atual, biblioteca: bib, sessoes: [...(atual.sessoes || []), sessao] });
    logEvent("treino_corrida_agendado");
    showToast(`Treino agendado para ${planoDataBR(iso).slice(0, 5)}`);
  }
  function excluirTreinoCorrida(t) {
    const atual = planosRef.current.find((p) => p.tipo === "avulso");
    if (!atual) return;
    salvarAvulso({ ...atual, biblioteca: (atual.biblioteca || []).filter((x) => x.id !== t.id) });
  }
  function removerSessaoAvulsa(plano, idx) {
    salvarAvulso({ ...plano, sessoes: plano.sessoes.filter((_, i) => i !== idx) });
    showToast("Treino removido do dia");
  }
  function openMeta() { setPlanoRetomar(null); setPlanoReplan(false); setPlanoProva({ id: `meta-${Date.now()}`, meta: true, nome: "", data_inicio: "", data_fim: null, modalidade: "corrida", distancias: [], kmEscolhido: 0 }); logEvent("meta_corrida_aberta"); }
  function openPlano(r, replan) { setPlanoRetomar(null); setPlanoReplan(!!replan); setPlanoProva(provaComKm(r)); logEvent(replan ? "plano_corrida_replan_aberto" : "plano_corrida_aberto"); }
  function provaDoPlano(plano) {
    return provasTodas.find((r) => r.id === plano.provaId) || { id: plano.provaId, nome: plano.provaNome, data_inicio: plano.provaData, data_fim: null, modalidade: "corrida", distancias: plano.provaKm ? [plano.provaKm] : [], ...(plano.tipo === "meta" ? { meta: true } : {}) };
  }
  function dispensarReplan(plano) {
    const next = { ...planoDispensa, [plano.id]: addDays(todayISO(), 3) };
    setPlanoDispensa(next);
    try { localStorage.setItem("treino-app:planoReplanDispensa", JSON.stringify(next)); } catch (e) {}
  }
  // Planos que ficaram pra trás (ou cuja prova mudou de data) e valem um convite pra replanejar.
  function planosParaReplanejar() {
    const hoje = todayISO();
    const out = [];
    planos.forEach((plano) => {
      if (plano.tipo === "avulso") return;
      const prova = provaDoPlano(plano);
      if (diasAte(prova.data_inicio, hoje) < 7) return;
      if (planoDispensa[plano.id] && planoDispensa[plano.id] > hoje) return;
      const sit = planoSituacao(plano, hoje, (d) => planoCorridaFeitaNoDia(sessions, atividadeById, d), prova.data_inicio);
      if (sit.atrasado || sit.dataMudou) out.push({ plano, prova, sit });
    });
    return out;
  }
  // Uso mensal da geração com IA (null se o SQL ainda não foi rodado ou deu erro de rede).
  async function planoUsoIA() {
    try {
      const { data, error } = await supabaseClient.rpc("plan_generation_usage", { max_per_month: 3 });
      return error || !data ? null : data;
    } catch (e) { return null; }
  }
  // Pede a geração à edge function `gerar-plano`. No modo novo ela responde na hora com o id de uma tarefa
  // que roda no servidor (o app consulta o resultado); numa função antiga, a resposta final vem em stream.
  async function planoIniciarIA(prompt, provaNome, ctx) {
    const sess = sessionRef.current;
    if (!sess) return { ok: false, mensagem: "Entre na sua conta para gerar o plano." };
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gerar-plano`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sess.access_token}`, apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, prova: provaNome, modo: "job" }),
      });
      const linhas = (await resp.text()).split("\n").map((l) => l.trim()).filter(Boolean);
      let obj = null;
      try { obj = JSON.parse(linhas[linhas.length - 1]); } catch (e) {}
      if (!obj) { logClientError("plano_ia", `resposta_invalida_${resp.status}`); return { ok: false, mensagem: "A resposta da IA veio incompleta. Tente de novo." }; }
      const base = { kind: "plano_corrida", label: provaNome, ctx, startedAt: Date.now() };
      if (obj.ok && obj.job) { salvarIaJob({ ...base, id: obj.job, status: "rodando" }); return { ok: true }; }
      if (obj.ok && obj.texto) { salvarIaJob({ ...base, id: `direto-${Date.now()}`, status: "pronto", result: obj }); return { ok: true }; }
      if (!obj.ok) {
        logClientError("plano_ia", `${obj.erro || "erro"} (http ${resp.status}): ${obj.mensagem || ""}`);
        if (obj.erro && obj.erro !== "limite") return { ...obj, mensagem: `${obj.mensagem || "Não consegui gerar o plano."} [${obj.erro}, http ${resp.status}]` };
      }
      return obj;
    } catch (e) {
      const det = `${(e && e.name) || "Erro"}: ${(e && e.message) || "?"}`;
      logClientError("plano_ia_rede", `${det} | online=${navigator.onLine} | app=${APP_BUILD}`);
      return { ok: false, mensagem: `Não consegui falar com o servidor. Tente de novo. [${det} · app ${APP_BUILD}]` };
    }
  }
  // Consulta a tarefa em andamento (a cada 3 s e quando o app volta ao primeiro plano).
  useEffect(() => {
    if (!iaJob || iaJob.status !== "rodando" || !session) return;
    let vivo = true;
    const id0 = iaJob.id;
    const tick = async () => {
      try {
        const { data, error } = await supabaseClient.from("ai_jobs").select("status,result").eq("id", id0).maybeSingle();
        const atual = iaJobRef.current;
        if (!vivo || error || !atual || atual.id !== id0 || atual.status !== "rodando") return;
        if (!data) { salvarIaJob({ ...atual, status: "erro", result: { ok: false, mensagem: "Não encontrei essa geração. Tente de novo." } }); return; }
        if (data.status !== "rodando") {
          if (data.status === "pronto") iaRegistrarDuracao((Date.now() - atual.startedAt) / 1000);
          else if (data.status === "erro") logClientError("plano_ia", `${(data.result && data.result.erro) || "erro"}: ${(data.result && data.result.mensagem) || ""}`);
          salvarIaJob({ ...atual, status: data.status, result: data.result });
        } else if (Date.now() - atual.startedAt > 6 * 60 * 1000) {
          await supabaseClient.rpc("expire_stale_ai_jobs");
        }
      } catch (e) {}
    };
    tick();
    const t = setInterval(tick, 3000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    const rel = setInterval(() => setAgoraIA(Date.now()), 1000);
    return () => { vivo = false; clearInterval(t); clearInterval(rel); document.removeEventListener("visibilitychange", onVis); };
  }, [iaJob && iaJob.id, iaJob && iaJob.status, !!session]);
  // Avisa quando o plano fica pronto e a tela do plano não está aberta.
  const jobProvaId = iaJob && iaJob.ctx && iaJob.ctx.provaProp ? iaJob.ctx.provaProp.id : null;
  useEffect(() => {
    if (iaJob && iaJob.status === "pronto" && !(planoProva && planoProva.id === jobProvaId)) showToast("✨ Seu plano de corrida está pronto");
  }, [iaJob && iaJob.status]);
  function abrirPlanoPronto() {
    const j = iaJobRef.current;
    if (!j || j.status !== "pronto" || !j.result || !j.result.texto) return;
    setPlanoReplan(!!(j.ctx && j.ctx.replan));
    setPlanoRetomar({ ctx: j.ctx, texto: j.result.texto });
    setPlanoProva(j.ctx.provaProp);
    logEvent("plano_corrida_ia_retomado");
  }
  function salvarPlano(plano) {
    savePlanos([...planos.filter((p) => p.provaId !== plano.provaId), plano]);
    if (iaJobRef.current && iaJobRef.current.status !== "rodando" && iaJobRef.current.ctx && iaJobRef.current.ctx.provaProp && iaJobRef.current.ctx.provaProp.id === plano.provaId) salvarIaJob(null);
    setPlanoRetomar(null);
    setPlanoProva(null);
    showToast("Plano salvo");
  }
  function excluirPlano(plano) {
    savePlanos(planos.filter((p) => p.id !== plano.id));
    setPlanoProva(null);
    showToast("Plano excluído");
  }
  function setSessaoPlanoStatus(planoId, idx, status) {
    savePlanos(planos.map((p) => (p.id !== planoId ? p : {
      ...p,
      sessoes: p.sessoes.map((s, i) => {
        if (i !== idx) return s;
        const { status: atual, ...resto } = s;
        return atual === status ? resto : { ...resto, status };
      }),
    })));
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

  // --- Sobe uma chave pra nuvem, com uma retentativa automática: falha de
  // rede (ex: "TypeError: Load failed" do Safari/iOS num momento de sinal
  // ruim) costuma ser passageira, então uma segunda tentativa alguns
  // segundos depois resolve sozinha na maioria das vezes, sem incomodar a
  // pessoa. Só avisa (toast) e registra o erro se a retentativa também
  // falhar — a mudança já está salva no aparelho de qualquer forma (feito
  // antes disso, em localStorage), só não foi pra nuvem ainda. ---
  const syncToCloud = useCallback((key, value, isRetry) => {
    if (!sessionRef.current) return;
    const payload = {
      user_id: sessionRef.current.user.id,
      ...dataRef.current,
      [key]: value,
      updated_at: new Date().toISOString(),
    };
    supabaseClient.from("app_data").upsert(payload).then(({ error }) => {
      if (!error) return;
      console.error("Erro ao sincronizar com a nuvem:", error);
      if (!isRetry) { setTimeout(() => syncToCloud(key, value, true), 4000); return; }
      logClientError("persist_upsert", error.message);
      showToast("Sem conexão — salvo só neste aparelho");
    });
  }, [showToast]);

  const persist = useCallback((key, value, msg) => {
    clearTimeout(saveTimer.current[key]);
    saveTimer.current[key] = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        if (msg) showToast(msg);
      } catch (e) { showToast("Erro ao salvar"); }
      if (sessionRef.current && cloudSyncedRef.current) syncToCloud(key, value, false);
    }, 300);
  }, [showToast, syncToCloud]);

  const updateTreinos = (next) => { setTreinos(next); persist("treinos", next, "Treino salvo"); };
  const updateAtividades = (next) => { setAtividades(next); persist("atividades", next, "Salvo"); };
  const updateSchedule = (next) => { setSchedule(next); persist("schedule", next, "Agenda salva"); };
  const updateSessions = (next) => { setSessions(next); persist("sessions", next); };


  const treinoById = useCallback((id) => treinos.find((t) => t.id === id), [treinos]);
  const atividadeById = useCallback((id) => atividades.find((a) => a.id === id), [atividades]);

  // --- Desafios: lista, check-ins automáticos e convite por link ---
  const desafioHoje = (() => {
    if (!desafios || desafios.length === 0) return null;
    const ativos = desafios.filter((c) => desafioStatus(c, provasHoje).fase === "rolando")
      .sort((a, b) => desafioEnd(a).localeCompare(desafioEnd(b)));
    const ch = ativos[0];
    if (!ch) return null;
    const stt = desafioStatus(ch, provasHoje);
    const wr = desafioWeekRange(ch, stt.semanaIdx);
    const rules = desafioNormalizeRules(ch.rules);
    const n = desafioContarLista(desafioCheckinsFromSessions(sessions, atividadeById, rules, wr.start, provasHoje), rules);
    return { ch, n, meta: rules.meta };
  })();
  const desafioHojeAviso = (() => {
    if (!desafioHoje) return null;
    const lista = desafioAvisos_[desafioHoje.ch.id] || [];
    return lista.find((a) => !a.lembrete) || lista[0] || null;
  })();
  const desafioTemAviso = Object.keys(desafioAvisos_).some((id) => (desafioAvisos_[id] || []).length > 0);
  useEffect(() => { desafioUserIdAtual = session ? session.user.id : null; }, [session]);

  const loadDesafios = useCallback(async (isRetry) => {
    if (!sessionRef.current) return;
    const { data, error } = await supabaseClient.rpc("my_challenges");
    if (error) {
      const faltando = /does not exist|could not find|PGRST202|42883|schema cache/i.test(`${error.code || ""} ${error.message || ""}`);
      if (faltando) { setDesafiosOk(false); setDesafios([]); return; }
      // Falha de rede (ex.: "TypeError: Load failed" do Safari/Chrome com sinal ruim): tenta de novo uma vez,
      // não apaga a lista que já estava na tela e só registra o erro se a segunda tentativa também falhar.
      if (!isRetry) { setTimeout(() => loadDesafios(true), 3500); return; }
      logClientError("my_challenges", error.message);
      setDesafiosFalhou(true);
      setDesafios((atual) => atual || []);
      return;
    }
    setDesafiosFalhou(false);
    setDesafiosOk(true);
    const lista = Array.isArray(data) ? data : [];
    setDesafios(lista);
    // Placar de cada desafio em andamento (ou recém-encerrado): alimenta avisos e lembretes.
    try {
      const hoje = todayISO();
      const alvo = lista.filter((c) => { const f = desafioStatus(c, hoje).fase; return f === "rolando" || (f === "fim" && desafioEnd(c) >= addDays(hoje, -7)); }).slice(0, 6);
      const snaps = desafioSnapLerTodos();
      const res = {};
      const av = {};
      await Promise.all(alvo.map(async (c) => {
        const { data: ov, error: e2 } = await supabaseClient.rpc("challenge_overview", { p_id: c.id });
        if (e2 || !ov) return;
        const st = desafioStandings(ov.challenge, ov.members, ov.checkins, ov.together, hoje);
        res[c.id] = { ch: ov.challenge, members: ov.members, st };
        av[c.id] = desafioAvisos(ov.challenge, st, ov.members, sessionRef.current.user.id, hoje, snaps[c.id] || null);
      }));
      setDesafioResumos(res);
      setDesafioAvisos(av);
    } catch (e) { desafioLogErro("desafio_resumos", e && e.message); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session || !cloudSynced) return;
    loadDesafios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, cloudSynced]);

  // Chegou por um convite: depois do onboarding, leva direto pra aba onde o convite é confirmado.
  useEffect(() => {
    if (!pendingInvite || !session || !cloudSynced || needsOnboarding) return;
    setTab("desafios");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite, session, cloudSynced, needsOnboarding]);
  // Ao abrir a aba Desafios, atualiza os placares e, depois de alguns segundos, marca os avisos como vistos.
  useEffect(() => {
    if (tab !== "desafios" || !session || !cloudSynced || !desafiosOk) return;
    loadDesafios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => {
    if (tab !== "desafios") return;
    const ids = Object.keys(desafioResumos);
    if (ids.length === 0) return;
    const t = setTimeout(() => {
      const snaps = desafioSnapLerTodos();
      ids.forEach((id) => { snaps[id] = desafioSnapDe(desafioResumos[id].st); });
      desafioSnapSalvarTodos(snaps);
    }, 3500);
    return () => clearTimeout(t);
  }, [tab, desafioResumos]);
  function clearPendingInvite() {
    try { localStorage.removeItem("treino-app:desafioInvite"); } catch (e) {}
    setPendingInvite(null);
  }

  // Check-ins: sempre que as sessões mudam, reconcilia (com atraso) os meus check-ins nos desafios ativos.
  useEffect(() => {
    if (!session || !loaded || !cloudSynced || !desafios || desafios.length === 0) return;
    const t = setTimeout(async () => {
      const hoje = todayISO();
      let mudou = false;
      for (const ch of desafios) {
        if (hoje < ch.start_date || hoje > desafioEnd(ch)) continue;
        const res = await syncDesafioCheckins(ch, session.user.id, sessions, atividadeById, hoje);
        if (res.added && res.added.some((c) => c.date === hoje)) showToast(`✓ Conta pro desafio ${ch.nome}`);
        if (res.changed) mudou = true;
      }
      if (mudou) loadDesafios();
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, desafios, atividadeById, session, loaded, cloudSynced]);

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

  // Fotografia da semana atual (usada pelo card "Sua semana mudou" e pelo ajuste com IA).
  const fatosSemana = useMemo(
    () => semanaFatos({ hojeISO: todayISO(), schedule, sessions, planos, treinoById, atividadeById }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, planos, schedule, treinos, atividades, selectedDate]
  );
  function dispensarSemana() {
    setSemanaDispensa(fatosSemana.assinatura);
    try { localStorage.setItem("treino-app:semanaDispensa", fatosSemana.assinatura); } catch (e) {}
  }

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
    const anterior = (session.cargas || {})[key];
    if (anterior && anterior.distanciaKm) entry.distanciaKm = anterior.distanciaKm; // vem do Strava; não perder ao editar duração/esforço
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
      duracaoMin: existing && existing.duracaoMin != null ? String(existing.duracaoMin) : "",
      rpe: existing && existing.rpe != null ? String(existing.rpe) : "",
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

  // --- Ajustes do treino de hoje (não mexem na ficha) ---
  function addSetToExercise(item, ex) {
    const key = itemKey(item);
    const prev = (dayLog[key] || {})[ex.id] || { status: undefined, comentario: "", sets: [] };
    const sets = [...(prev.sets || [])];
    const last = sets[sets.length - 1];
    sets.push({ peso: last ? last.peso : "", reps: last ? last.reps : (parseFirstNumber(ex.repeticoes) || "") });
    patchItemLog(key, { [ex.id]: { ...prev, sets } });
  }
  function removeLastSet(item, ex) {
    const key = itemKey(item);
    const prev = (dayLog[key] || {})[ex.id];
    if (!prev || !prev.sets || prev.sets.length <= 1) return;
    patchItemLog(key, { [ex.id]: { ...prev, sets: prev.sets.slice(0, -1) } });
  }
  function addExerciseToday(item, catalogEx) {
    const session = ensureSessionShape();
    const treino = resolveTreinoForDay(treinoById(item.id), session);
    if (!treino) return;
    const flat = flattenExercicios(treino);
    if (flat.some((e) => e.nome === catalogEx.nome)) { showToast("Esse exercício já tá no treino de hoje"); return; }
    const ids = new Set(flat.map((e) => e.id));
    const baseId = slugify(catalogEx.nome);
    let id = baseId;
    let i = 2;
    while (ids.has(id)) { id = `${baseId}-${i}`; i++; }
    const exercicio = {
      id, nome: catalogEx.nome, series: catalogEx.series, repeticoes: catalogEx.repeticoes,
      descricao: catalogEx.descricao || "", observacoes: "", videoUrl: catalogEx.videoUrl || "",
    };
    const prevAj = (session.ajustes && session.ajustes[item.id]) || { added: [] };
    const ajustes = { ...(session.ajustes || {}), [item.id]: { ...prevAj, added: [...(prevAj.added || []), exercicio] } };
    updateSessions({ ...sessions, [selectedDate]: { ...session, ajustes } });
    showToast(`${catalogEx.nome} adicionado a hoje`);
  }
  function removeAddedExercise(item, exId) {
    const session = ensureSessionShape();
    const prevAj = (session.ajustes && session.ajustes[item.id]) || { added: [] };
    const ajustes = { ...(session.ajustes || {}), [item.id]: { ...prevAj, added: (prevAj.added || []).filter((e) => e.id !== exId) } };
    const key = itemKey(item);
    const treinoLog = { ...(session.log[key] || {}) };
    delete treinoLog[exId];
    updateSessions({ ...sessions, [selectedDate]: { ...session, ajustes, log: { ...session.log, [key]: treinoLog } } });
  }

  function saveFichaPrompt() {
    const p = pendingFichaPrompt;
    if (!p) return;
    const ficha = treinoById(p.item.id);
    if (ficha) updateTreinos(treinos.map((t) => (t.id === ficha.id ? applyFichaChanges(ficha, p.changes) : t)));
    logEvent("ficha_salva_com_ajustes");
    setPendingFichaPrompt(null);
    showToast("Ficha atualizada");
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

  function finishTreino(item, treino, elapsedMin) {
    setFocusTreino(null);
    setExpandedEx(null);
    // Congela a ficha como estava hoje: se a pessoa salvar ajustes na ficha
    // (ou editar depois), este dia continua mostrando o treino como foi feito.
    const session = ensureSessionShape();
    const fichaAtual = treinoById(item.id);
    let sessionNow = session;
    if (fichaAtual && !(session.base && session.base[item.id])) {
      sessionNow = { ...session, base: { ...(session.base || {}), [item.id]: JSON.parse(JSON.stringify(fichaAtual)) } };
      updateSessions({ ...sessions, [selectedDate]: sessionNow });
    }
    const baseTreino = aplicarSemanaTreino((sessionNow.base && sessionNow.base[item.id]) || fichaAtual, sessionNow);
    const changes = baseTreino ? computeFichaChanges(baseTreino, sessionNow, itemKey(item)) : [];
    // Só pular exercício não dispara a pergunta (é comum pular por falta de
    // tempo, sem querer mudar a ficha) — precisa ter adicionado exercício
    // ou mudado o número de séries.
    const temAjuste = changes.some((c) => c.kind !== "skipped");
    logEvent("treino_concluido");
    if (temAjuste) logEvent("treino_concluido_com_ajuste");
    setPendingFichaPrompt(temAjuste ? { item, date: selectedDate, treinoNome: baseTreino.nome, changes } : null);
    setRpeModal({ item, date: selectedDate, label: treino ? treino.nome : "treino", duracaoMin: elapsedMin > 0 ? String(elapsedMin) : "", rpe: "", dor: null });
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
              <div>Mandamos um e-mail pra <b>{authEmail}</b>.</div>
              <form onSubmit={handleVerifyOtp}>
                <div className="gt-field-label" style={{ marginTop: 14, marginBottom: 8 }}>CÓDIGO DO E-MAIL</div>
                <input
                  className="gt-select"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={10}
                  value={authOtp}
                  onChange={(e) => setAuthOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
                {authError && <div className="gt-error">{authError}</div>}
                <button className="gt-btn" style={{ marginTop: 14 }} type="submit" disabled={authVerifying || authOtp.length < 6}>
                  {authVerifying ? "Entrando…" : "Entrar com o código"}
                </button>
              </form>
              <div className="gt-field-label" style={{ marginTop: 14 }}>
                Se o app abriu instalado (ícone na tela), digitar o código acima é mais confiável do que tocar no link — o link pode abrir numa aba separada e não voltar pro app.
              </div>
              <button
                type="button"
                className="gt-link-btn"
                style={{ marginTop: 10 }}
                onClick={() => { setAuthSent(false); setAuthOtp(""); setAuthError(""); }}
              >
                Usar outro e-mail / pedir um novo código
              </button>
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
    const treino = resolveTreinoForDay(treinoById(focusTreino.id), sessions[selectedDate]);
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
            addSetToExercise={addSetToExercise}
            removeLastSet={removeLastSet}
            addExerciseToday={(ex) => addExerciseToday(focusTreino, ex)}
            removeAddedExercise={(exId) => removeAddedExercise(focusTreino, exId)}
            onClose={() => { setFocusTreino(null); setExpandedEx(null); }}
            onFinish={(elapsedMin) => finishTreino(focusTreino, treino, elapsedMin)}
            showToast={showToast}
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
          <button type="button" className="gt-menu-btn" onClick={() => setMenuOpen(true)} title="Menu" aria-label="Abrir menu">
            <span /><span /><span />
            {(planosParaReplanejar().length > 0) && <i className="gt-menu-dot" />}
          </button>
          <div className="gt-title">{tab === "hoje" ? saudacaoHoje() : tab === "treinos" ? "Treinos" : tab === "desafios" ? "Desafios" : "Evolução"}</div>
          <MovoLockup size={24} />
        </div>
      </div>

      {!isStandaloneDisplay() && !installBannerDismissed && (
        <div className="gt-install-banner">
          <div className="gt-install-banner-text"><Ei e="📲" /> Instale o Movo na tela inicial — abre mais rápido, igual um app de verdade.</div>
          <div className="gt-install-banner-actions">
            <button type="button" className="gt-install-banner-btn" onClick={handleInstallClick}>Instalar</button>
            <button type="button" className="gt-install-banner-dismiss" onClick={dismissInstallBanner} title="Fechar">✕</button>
          </div>
        </div>
      )}

      <div
        className="gt-body"
        onTouchStart={handleBodyTouchStart}
        onTouchMove={handleBodyTouchMove}
        onTouchEnd={handleBodyTouchEnd}
        onTouchCancel={handleBodyTouchEnd}
      >
        {(pullDistance > 0 || pullRefreshing) && (
          <div
            className="gt-pull-indicator"
            style={{ height: pullDistance, opacity: Math.min(pullDistance / PULL_REFRESH_THRESHOLD, 1) }}
          >
            {pullRefreshing ? "Atualizando…" : pullDistance >= PULL_REFRESH_THRESHOLD ? "Solte pra atualizar" : "Puxe pra atualizar"}
          </div>
        )}
        {tab === "hoje" && (
          <div>
            {desafioHoje && (
              <button type="button" className={`gt-desafio-chip ${desafioHojeAviso && desafioHojeAviso.lembrete ? "alerta" : ""}`} onClick={() => setTab("desafios")}>
                <span className="row">
                  <span><Ei e="🏆" /></span>
                  <span className="nm">{desafioHoje.ch.nome}</span>
                  <b>{desafioHoje.n}/{desafioHoje.meta} esta semana</b>
                </span>
                {desafioHojeAviso && <span className="aviso"><Ei e={desafioHojeAviso.emoji} /> {desafioHojeAviso.texto}</span>}
              </button>
            )}
            {proximaProva && (
              <div className="gt-prova-hoje">
                <button type="button" className="gt-prova-chip" onClick={() => openProvas("minhas")}>
                  <span><Ei e="🏁" /></span>
                  <span className="nm">{proximaProva.nome}</span>
                  <b>{provaDiasLabel(proximaProva, provasHoje)}</b>
                </button>
                {proximaProva.modalidade === "corrida" && (
                  <button type="button" className="gt-prova-plano-btn" onClick={() => openPlano(proximaProva)}>
                    <Ei e="🏃" /> {planos.some((p) => p.provaId === proximaProva.id) ? "Ver plano de treino" : "Criar plano de treino pra essa prova"}
                  </button>
                )}
              </div>
            )}
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
                  <div className="gt-stat-chip"><Ei e="🔥" /> {streakInfo.streak} dia{streakInfo.streak > 1 ? "s" : ""} seguido{streakInfo.streak > 1 ? "s" : ""}</div>
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

            {selectedDate === todayISO() && fatosSemana.gatilho && semanaDispensa !== fatosSemana.assinatura && (
              <div className="gt-sem-aviso alerta">
                <div className="hd"><Icon name="ajustar" weight="duotone" size={14} className="gt-ico-inl" /> Sua semana mudou</div>
                <div className="de">{fatosSemana.sinais.slice(0, 2).map((x) => x.texto).join(" ")} Quer ver um ajuste para o que ainda falta?</div>
                <div className="ac">
                  <button type="button" className="on" onClick={() => { logEvent("semana_card_aberto"); setSemanaOpen(true); }}>Ver ajuste</button>
                  <button type="button" onClick={dispensarSemana}>Agora não</button>
                </div>
              </div>
            )}
            {selectedDate === todayISO() && fatosSemana.ajusteAtivo && (
              <div className="gt-streak-row"><div className="gt-stat-chip" style={{ cursor: "pointer" }} onClick={() => setSemanaOpen(true)}>↻ Semana ajustada · ver ou desfazer</div></div>
            )}
            {iaJob && !(planoProva && planoProva.id === jobProvaId) && (() => {
              const seg = Math.max(0, Math.floor((agoraIA - iaJob.startedAt) / 1000));
              const falhou = iaJob.status === "erro" || (iaJob.status === "pronto" && !(iaJob.result && iaJob.result.texto));
              return (
                <div className={`gt-plano-hoje ${falhou ? "alerta" : ""}`}>
                  <div className="hd"><Ei e="✨" /> Plano com IA · {iaJob.label}</div>
                  {iaJob.status === "rodando" && <div className="de">Gerando seu plano… {Math.floor(seg / 60)}:{String(seg % 60).padStart(2, "0")}. Pode usar o app normalmente: avisamos quando ficar pronto.</div>}
                  {iaJob.status === "pronto" && !falhou && (
                    <>
                      <div className="de">Seu plano está pronto. Confira e salve para ele entrar na sua agenda.</div>
                      <div className="ac">
                        <button type="button" className="on" onClick={abrirPlanoPronto}>Ver plano</button>
                        <button type="button" onClick={() => { if (window.confirm("Descartar este plano? A geração já foi contada no seu limite do mês.")) salvarIaJob(null); }}>Descartar</button>
                      </div>
                    </>
                  )}
                  {falhou && (
                    <>
                      <div className="de">{(iaJob.result && iaJob.result.mensagem) || "Não consegui gerar o plano. Tente de novo."}</div>
                      <div className="ac"><button type="button" className="on" onClick={() => salvarIaJob(null)}>Ok</button></div>
                    </>
                  )}
                </div>
              );
            })()}

            {selectedDate === todayISO() && planosParaReplanejar().map(({ plano, prova, sit }) => (
              <div className="gt-plano-hoje alerta" key={`replan-${plano.id}`}>
                <div className="hd"><Ei e="🔄" /> Plano · {plano.provaNome}</div>
                <div className="de">{sit.atrasado ? `Você ficou ${sit.faltou} de ${sit.recentes} sessões sem registro nas últimas 2 semanas. ` : ""}{sit.dataMudou ? "A data da prova mudou. " : ""}Quer replanejar a partir de hoje?</div>
                <div className="ac">
                  <button type="button" className="on" onClick={() => openPlano(prova, true)}>Replanejar</button>
                  <button type="button" onClick={() => dispensarReplan(plano)}>Agora não</button>
                </div>
              </div>
            ))}
            {planoSessoesDoDia(planos, selectedDate).map(({ plano, sessao, idx }) => {
              const t = PLANO_TIPOS[sessao.tipo] || PLANO_TIPOS.rodagem;
              const meta = [sessao.distanciaKm ? `${String(sessao.distanciaKm).replace(".", ",")} km` : "", sessao.duracaoMin ? `${sessao.duracaoMin} min` : "", sessao.esforco, sessao.pace ? `pace ${sessao.pace}` : ""].filter(Boolean).join(" · ");
              const chave = `plano:${plano.id}:${idx}`;
              const aberto = expandedItem === chave;
              return (
                <div className="gt-plano-hoje" key={`${plano.id}-${idx}`}>
                  <div className="gt-plano-row" onClick={() => setExpandedItem(aberto ? null : chave)}>
                    <div className="gt-plano-main">
                      <div className="hd"><Ei e="🏃" /> {plano.tipo === "avulso" ? "Treino de corrida" : `Plano · ${plano.provaNome}`}{sessao.fase ? ` · ${sessao.fase}` : ""}{sessao.ajuste ? " · ↻ ajustado" : ""}</div>
                      <div className="ti"><Ei e={t.emoji} /> {sessao.titulo}</div>
                      {meta && <div className="mt">{meta}</div>}
                    </div>
                    <div className="gt-chevron">{aberto ? "▲" : "▼"}</div>
                  </div>
                  {aberto && sessao.detalhes && <div className="de">{sessao.detalhes}</div>}
                  {aberto && <PlanoEtapas etapas={sessao.etapas} paceBase={planoParsePace(plano.params && plano.params.paceTxt)} />}
                  {sessao.tipo !== "prova" && (
                    <div className="ac">
                      <button type="button" className={sessao.status === "feito" ? "on" : ""} onClick={() => setSessaoPlanoStatus(plano.id, idx, "feito")}>{sessao.status === "feito" ? "✓ Fiz" : "Fiz"}</button>
                      <button type="button" className={sessao.status === "pulou" ? "on" : ""} onClick={() => setSessaoPlanoStatus(plano.id, idx, "pulou")}>{sessao.status === "pulou" ? "Pulei" : "Pulei"}</button>
                      {aberto && plano.tipo === "avulso" && <button type="button" title="Remover este treino do dia" onClick={() => removerSessaoAvulsa(plano, idx)}>Remover</button>}
                    </div>
                  )}
                </div>
              );
            })}

            {dayItems.length === 0 && planoSessoesDoDia(planos, selectedDate).length === 0 && <div className="gt-empty">Nada na agenda pra este dia.</div>}

            {dayItems.map((item) => {
              const key = itemKey(item);
              const isExtra = !scheduledItems.some((it) => it.tipo === item.tipo && it.id === item.id);
              if (item.tipo === "treino") {
                const treino = resolveTreinoForDay(treinoById(item.id), sessions[selectedDate]);
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
                      {treino.ajustadoSemana && <span className="gt-item-tag auto-done" title="Ajustado na revisão da semana">↻ AJUSTADO</span>}
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
                // Descanso não tem "fui/não fui" — só estar no dia já registra
                // (não tem o que confirmar num dia de folga).
                const done = atividade.descanso || log.status === "fui";
                return (
                  <div className={`gt-item-card ${done ? "done" : ""} ${!atividade.descanso && log.status === "nao-fui" ? "skipped" : ""}`} key={key}>
                    <div className="gt-item-row" onClick={() => setExpandedItem(isOpen ? null : key)}>
                      <span className="gt-item-tag">{atividade.descanso ? "DESCANSO" : "ATIVIDADE"}</span>
                      {atividade.descanso && <span className="gt-item-tag auto-done" title="Registrado automaticamente">✓ registrado</span>}
                      <div className="gt-item-main">
                        <div className="gt-item-nm">{atividade.nome}</div>
                        {log.comentario && <div className="gt-item-meta">{log.comentario.slice(0, 40)}{log.comentario.length > 40 ? "…" : ""}</div>}
                      </div>
                      <div className="gt-chevron">{isOpen ? "▲" : "▼"}</div>
                      {!atividade.descanso && (
                        <div className="gt-status-toggle" onClick={(e) => e.stopPropagation()}>
                          <button className={`gt-status-btn fui ${log.status === "fui" ? "on" : ""}`} onClick={() => setAtividadeStatus(item, "fui")}>FUI</button>
                          <button className={`gt-status-btn nao ${log.status === "nao-fui" ? "on" : ""}`} onClick={() => setAtividadeStatus(item, "nao-fui")}>NÃO FUI</button>
                        </div>
                      )}
                      <button className="gt-item-extra-x" title="Remover do dia" onClick={(e) => { e.stopPropagation(); removeForToday(item, isExtra); }}>✕</button>
                    </div>
                    {isOpen && (
                      <div className="gt-atividade-body">
                        {atividade.descanso && (
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
                <button type="button" className="gt-btn secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => { setAddingExtra(false); setTreinoCorrida({ data: selectedDate }); }}><Ei e="🏃" /> Montar treino de corrida</button>
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
              </div>
            )}
          </div>
        )}

        {tab === "desafios" && (
          <div>
            {session && (
              <DesafiosPanel
                session={session}
                desafios={desafios}
                desafiosOk={desafiosOk}
                reload={() => loadDesafios()}
                sessions={sessions}
                atividadeById={atividadeById}
                showToast={showToast}
                logEvent={logEvent}
                pendingCode={pendingInvite}
                clearPendingCode={clearPendingInvite}
                resumos={desafioResumos}
                avisos={desafioAvisos_}
                falhou={desafiosFalhou}
              />
            )}
            {!session && <div className="gt-empty" style={{ marginTop: 12 }}>Entre com sua conta pra criar ou entrar em desafios.</div>}
          </div>
        )}
      </div>

      <div className="gt-tabbar">
        <button className={`gt-tab ${tab === "hoje" ? "active" : ""}`} onClick={() => setTab("hoje")}><span className="ic"><NavIcon name="hoje" active={tab === "hoje"} /></span>Hoje</button>
        <button className={`gt-tab ${tab === "treinos" ? "active" : ""}`} onClick={() => setTab("treinos")}><span className="ic"><NavIcon name="treinos" active={tab === "treinos"} /></span>Treinos</button>
        <button className={`gt-tab ${tab === "desafios" ? "active" : ""}`} onClick={() => setTab("desafios")}><span className="ic"><NavIcon name="desafios" active={tab === "desafios"} /></span>Desafios{desafioTemAviso && tab !== "desafios" && <span className="gt-tab-dot" />}</button>
        <button className={`gt-tab ${tab === "evolucao" ? "active" : ""}`} onClick={() => setTab("evolucao")}><span className="ic"><NavIcon name="evolucao" active={tab === "evolucao"} /></span>Evolução</button>
      </div>

          {menuOpen && (() => {
        const ir = (fn) => () => { setMenuOpen(false); fn(); };
        const nPlanos = planosParaReplanejar().length;
        const nome = (displayName || "").trim() || (session.user.email || "").split("@")[0];
        const item = (ic, txt, fn, extra) => (
          <button type="button" className={`gt-menu-item ${extra && extra.ativo ? "ativo" : ""}`} onClick={ir(fn)}>
            <span className="ic"><Icon name={ic} weight={extra && extra.ativo ? "fill" : "duotone"} size={22} /></span><span className="tx">{txt}</span>{extra && extra.dot && <i className="gt-menu-dot inline" />}
          </button>
        );
        return (
          <div className="gt-menu-backdrop" onClick={() => setMenuOpen(false)}>
            <nav className="gt-menu" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
              <div className="gt-menu-user">
                <MovoLockup size={16} />
                <div className="nm">{nome}</div>
                <div className="em">{session.user.email}</div>
              </div>
              <div className="gt-menu-sec">Navegar</div>
              {item("hoje", "Hoje", () => setTab("hoje"), { ativo: tab === "hoje" })}
              {item("treinos", "Treinos", () => setTab("treinos"), { ativo: tab === "treinos" })}
              {item("desafios", "Desafios", () => setTab("desafios"), { ativo: tab === "desafios", dot: desafioTemAviso })}
              {item("evolucao", "Evolução", () => setTab("evolucao"), { ativo: tab === "evolucao" })}
              <div className="gt-menu-sec">Musculação</div>
              {item("treinos", "Minhas fichas", () => setTab("treinos"))}
              {item("ia", "Montar treino com IA", () => setTreinoIAOpen(true))}
              {item("ajustar", "Ajustar minha semana", () => setSemanaOpen(true), { dot: fatosSemana.gatilho && semanaDispensa !== fatosSemana.assinatura })}
              {item("novo", "Nova ficha", openNovoTreinoChooser)}
              {item("fichas", "Fichas prontas", openTemplates)}
              <div className="gt-menu-sec">Corrida</div>
              {item("provas", "Provas", () => openProvas("explorar"))}
              {item("corrida", "Minhas provas e planos", () => openProvas("minhas"), { dot: nPlanos > 0 })}
              {item("metas", "Metas de corrida", () => openProvas("metas"))}
              {item("raio", "Treinos de corrida", () => setTreinoCorrida({ data: todayISO() }))}
              <div className="gt-menu-sec">Dados</div>
              {item("importar", "Importar histórico", () => setHistOpen(true))}
              <div className="gt-menu-sec">Social</div>
              {item("amigos", "Amigos e ranking", () => setSettingsOpen(true))}
              <div className="gt-menu-sec">Conta</div>
              {item("config", "Configurações", () => setSettingsOpen(true))}
              {item("ajuda", "Ajuda", () => setHelpOpen(true))}
              {item("feedback", "Enviar feedback", () => setFeedbackOpen(true))}
              {session.user.email === ADMIN_EMAIL && <button type="button" className="gt-menu-item" title="Painel de uso (admin)" onClick={ir(openAdmin)}><span className="ic"><Icon name="admin" weight="duotone" size={22} /></span><span className="tx">Painel de uso (admin)</span></button>}
              <button type="button" className="gt-menu-item sair" onClick={ir(handleLogout)} title={session.user.email}>
                <span className="ic"><Icon name="sair" weight="duotone" size={22} /></span><span className="tx">Sair</span>
              </button>
            </nav>
          </div>
        );
      })()}

      {toast && <div className="gt-toast">{toast}</div>}

      {rpeModal && (
        <RpeModal
          rpeModal={rpeModal}
          setRpeModal={setRpeModal}
          onSave={saveRpeModal}
          onSkip={() => setRpeModal(null)}
        />
      )}

      {/* Só aparece depois do modal de esforço (se houver), pra não empilhar duas perguntas. */}
      {!rpeModal && pendingFichaPrompt && (
        <FichaPromptModal
          prompt={pendingFichaPrompt}
          setPrompt={setPendingFichaPrompt}
          onSave={saveFichaPrompt}
          onSkip={() => setPendingFichaPrompt(null)}
        />
      )}

      {novoTreinoChooserOpen && (
        <div className="gt-modal-backdrop" onClick={() => setNovoTreinoChooserOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Novo treino</h3>
            <p>Como você quer criar essa ficha?</p>
            <div className="gt-choice-cards">
              <button type="button" className="gt-choice-card" onClick={startManualBuilderBlank}>
                <div className="gt-choice-icon"><Ei e="🏋️" /></div>
                <div className="gt-choice-title">Montar manualmente</div>
                <div className="gt-choice-desc">Escolha exercícios de um catálogo e monte a ficha do seu jeito.</div>
              </button>
              <button type="button" className="gt-choice-card" onClick={openTemplates}>
                <div className="gt-choice-icon"><Ei e="📋" /></div>
                <div className="gt-choice-title">Usar sugestão pronta</div>
                <div className="gt-choice-desc">Full body, core, reabilitação de ombro/joelho, push/pull/legs e outras — ajuste antes de salvar.</div>
              </button>
              <button type="button" className="gt-choice-card" onClick={() => { setNovoTreinoChooserOpen(false); setTreinoIAOpen(true); }}>
                <div className="gt-choice-icon"><Ei e="✨" /></div>
                <div className="gt-choice-title">Montar com IA</div>
                <div className="gt-choice-desc">Responda algumas perguntas (objetivo, dias, foco, meta) e receba uma proposta de fichas.</div>
              </button>
              <button type="button" className="gt-choice-card" onClick={() => { setNovoTreinoChooserOpen(false); openImportNew(); }}>
                <div className="gt-choice-icon"><Ei e="📥" /></div>
                <div className="gt-choice-title">Colar JSON</div>
                <div className="gt-choice-desc">Já tem o treino pronto de outra IA? Cole o resultado em JSON.</div>
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
            <button className="gt-btn secondary gt-copy-prompt-btn" type="button" onClick={handleCopyPrompt}><Ei e="📋" /> Copiar prompt de formato</button>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder={EXEMPLO_JSON} spellCheck={false} />
            {importError && <div className="gt-error">{importError}</div>}
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={handleImport}>{editingTreinoId ? "Salvar alterações" : "Importar"}</button>
              <button className="gt-btn secondary" onClick={() => { setImportOpen(false); setEditingTreinoId(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {semanaOpen && (
        <AjustarSemanaModal
          fatosBase={fatosSemana} treinoById={treinoById} sessions={sessions}
          gerarFatos={(opts) => semanaFatos({ hojeISO: todayISO(), schedule, sessions, planos, treinoById, atividadeById, ...opts })}
          getToken={() => (sessionRef.current ? sessionRef.current.access_token : "")}
          onAplicar={(prop) => {
            const id = `sem-${Date.now().toString(36)}`;
            const r = semanaAplicar(prop, { sessions, planos, treinoById }, id);
            updateSessions(r.sessions);
            savePlanos(r.planos);
            return { id, n: r.n };
          }}
          onDesfazer={(id) => {
            const r = semanaDesfazer(id, { sessions, planos });
            updateSessions(r.sessions);
            savePlanos(r.planos);
            showToast("Ajuste da semana desfeito");
          }}
          onEvent={(n) => logEvent(n)}
          onErro={(c, m) => logClientError(c, m)}
          onClose={() => setSemanaOpen(false)}
        />
      )}
      {treinoIAOpen && (
        <GerarTreinoIAModal
          getToken={() => (sessionRef.current ? sessionRef.current.access_token : "")}
          onAbrirNoBuilder={(lista) => {
            setTreinoIAOpen(false);
            setBuilderEditingId(null);
            setBuilderTreinos(lista);
            setBuilderSnapshot(JSON.stringify([]));
            setBuilderIndex(0);
          }}
          onEvent={(n) => logEvent(n)}
          onErro={(c, m) => logClientError(c, m)}
          onClose={() => setTreinoIAOpen(false)}
        />
      )}
      {histOpen && (
        <ImportarHistoricoModal
          treinos={treinos} sessions={sessions} schedule={schedule} atividades={atividades} hojeISO={todayISO()}
          getToken={() => (sessionRef.current ? sessionRef.current.access_token : "")}
          onAplicar={(plano, impId) => {
            const r = histAplicar(plano, { treinos, atividades, sessions, schedule }, impId);
            updateTreinos(r.treinos); updateAtividades(r.atividades); updateSessions(r.sessions);
            return r.resumo;
          }}
          onDesfazer={(impId) => {
            const r = histDesfazer(impId, { treinos, atividades, sessions });
            updateTreinos(r.treinos); updateAtividades(r.atividades); updateSessions(r.sessions);
            showToast("Importação desfeita");
          }}
          onEvent={(n) => logEvent(n)}
          onErro={(c, m) => logClientError(c, m)}
          onClose={() => setHistOpen(false)}
        />
      )}
      {treinoCorrida && (
        <TreinoCorridaModal
          biblioteca={(planoAvulso && planoAvulso.biblioteca) || []}
          dataInicial={treinoCorrida.data}
          paceBase={(planoHistoricoCorrida(sessions, atividadeById, todayISO(), 8) || {}).paceMin || 0}
          onSalvar={salvarTreinoCorrida}
          onAgendar={agendarTreinoCorrida}
          onExcluir={excluirTreinoCorrida}
          onClose={() => setTreinoCorrida(null)}
        />
      )}

      {provasOpen && (
        <ProvasModal
          onMeta={() => { setProvasOpen(false); openMeta(); }}
          onVerMeta={(pl) => { setProvasOpen(false); openPlano(provaDoPlano(pl)); }}
          participantes={participantes}
          amigosVao={amigosVao}
          abaInicial={provasAba}
          nuvem={provasNuvemOk}
          verAmigos={provasVisivel}
          onVerAmigos={() => { setProvasOpen(false); setSettingsOpen(true); }}
          provas={provasTodas}
          marcadas={provasUser.marcadas}
          kms={provasUser.kms || {}}
          planos={planos}
          hojeISO={provasHoje}
          onToggle={toggleProva}
          onMarcar={marcarProva}
          onKm={setProvaKm}
          onPlano={openPlano}
          onAddManual={addProvaManual}
          onRemoveManual={removeProvaManual}
          onLinkClick={() => logEvent("prova_link_clicado")}
          onClose={() => setProvasOpen(false)}
        />
      )}

      {planoProva && (
        <PlanoCorridaModal
          prova={planoProva}
          hojeISO={provasHoje}
          schedule={schedule}
          sessions={sessions}
          atividadeById={atividadeById}
          stravaConnected={stravaConnected}
          planoExistente={planos.find((p) => p.provaId === planoProva.id) || null}
          modoReplan={planoReplan}
          usoIA={planoUsoIA}
          job={iaJob}
          onIniciarIA={planoIniciarIA}
          onDescartarJob={() => { if (iaJobRef.current && iaJobRef.current.status !== "rodando") salvarIaJob(null); }}
          retomar={planoRetomar}
          onSave={salvarPlano}
          onDelete={excluirPlano}
          onOpenSettings={() => { setPlanoProva(null); setProvasOpen(false); setSettingsOpen(true); }}
          onEvent={logEvent}
          onClose={() => { setPlanoProva(null); setPlanoReplan(false); setPlanoRetomar(null); }}
        />
      )}

      {feedbackOpen && <FeedbackModal onEnviar={enviarFeedback} onClose={() => setFeedbackOpen(false)} />}

      {helpOpen && (
        <div className="gt-modal-backdrop" onClick={() => setHelpOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Como usar o app</h3>
            <div className="gt-help-content">
              <div className="gt-help-item"><b>Hoje</b> — o que está na agenda do dia selecionado (treinos e atividades). Marque cada exercício como feito/pulado, e a atividade como "fui" ou "não fui". Use as setas ou "Voltar pra hoje" pra navegar entre os dias.</div>
              <div className="gt-help-item"><b>Ajustar só o dia</b> — na aba Hoje, dá pra adicionar um treino ou atividade avulsa só naquele dia ("+ Adicionar avulso"), sem mexer na agenda fixa da semana.</div>
              <div className="gt-help-item"><b>Treinos</b> — a lista das suas fichas de academia. Toque numa ficha e em "Editar" pra mudar séries, exercícios etc. de forma permanente (isso é o treino-padrão, vale pra sempre que ele aparecer na agenda).</div>
              <div className="gt-help-item"><b>Novo treino</b> — em Treinos, "+ Novo treino" abre 4 jeitos de criar: montar na mão escolhendo exercícios de um catálogo, usar uma ficha pronta (full body, core, reabilitação de ombro/joelho, etc. — dá pra ajustar antes de salvar), "Montar com IA" (você responde objetivo, dias por semana, tempo, foco, meta e limitações, e a IA propõe as fichas — até 5 vezes por mês), ou colar um JSON gerado por outra IA. Use "Copiar prompt de formato" pra levar um texto pronto pro Claude (ou outra IA) gerar o JSON certo. Dá pra importar vários treinos de uma vez (ex: perna e costas juntos) colando uma lista em vez de um treino só. Também dá pra incluir um link do YouTube por exercício ("videoUrl") — ele fica escondido, aparecendo só um botão "Ver vídeo" dentro do exercício, que toca o vídeo ali mesmo no app.</div>
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

      {installHelpOpen && (
        <div className="gt-modal-backdrop" onClick={() => setInstallHelpOpen(false)}>
          <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Instalar o Movo</h3>
            {isIOSDevice() ? (
              <div className="gt-install-steps">
                <div className="gt-install-step">
                  <div className="gt-install-step-num">1</div>
                  <div className="gt-install-step-text">No Safari, toque no ícone de <b>compartilhar</b> (o quadrado com uma seta pra cima) — geralmente embaixo da tela, no meio.</div>
                </div>
                <div className="gt-install-step">
                  <div className="gt-install-step-num">2</div>
                  <div className="gt-install-step-text">Role a lista de opções e toque em <b>"Adicionar à Tela de Início"</b>.</div>
                </div>
                <div className="gt-install-step">
                  <div className="gt-install-step-num">3</div>
                  <div className="gt-install-step-text">Toque em <b>"Adicionar"</b> no canto superior direito. Pronto — o ícone do Movo aparece na tela inicial, igual um app normal.</div>
                </div>
              </div>
            ) : (
              <div className="gt-install-steps">
                <div className="gt-install-step">
                  <div className="gt-install-step-num">1</div>
                  <div className="gt-install-step-text">Abre o menu do navegador (geralmente três pontinhos ⋮ no canto superior direito).</div>
                </div>
                <div className="gt-install-step">
                  <div className="gt-install-step-num">2</div>
                  <div className="gt-install-step-text">Procure por <b>"Instalar app"</b> ou <b>"Adicionar à tela inicial"</b> e toque.</div>
                </div>
              </div>
            )}
            <div className="gt-modal-actions">
              <button className="gt-btn" onClick={() => setInstallHelpOpen(false)}>Entendi</button>
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

            {!isStandaloneDisplay() && (
              <div className="gt-settings-group">
                <div className="gt-settings-group-title">App</div>
                <div className="gt-settings-card">
                  <div className="gt-settings-label-row">
                    <div className="gt-settings-label">Instalar na tela inicial</div>
                  </div>
                  <div className="gt-settings-hint">Abre mais rápido e em tela cheia, igual um app de verdade — sem precisar do navegador toda vez.</div>
                  <button type="button" className="gt-btn secondary gt-settings-install-row" onClick={handleInstallClick}><Ei e="📲" /> Instalar o app</button>
                </div>
              </div>
            )}

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
                  <label className="gt-plano-chk" style={{ marginTop: 14 }}>
                    <input type="checkbox" checked={provasVisivel} onChange={(e) => mudarProvasVisivel(e.target.checked)} /> Aparecer para meus amigos nas provas que eu for
                  </label>
                  <div className="gt-settings-hint">Se desligar, seus amigos não veem as provas que você marcou e você também não vê as deles. Você continua entrando na contagem de pessoas, sem nome.</div>
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
                  <button className="gt-btn secondary" onClick={openOnboardingRedo}><Ei e="🔄" /> Refazer configuração inicial</button>
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
                    <button className="gt-btn secondary" onClick={() => { setSettingsOpen(false); openAdmin(); }}><Ei e="📊" /> Ver uso</button>
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
        <div className="gt-focus gt-admin-screen">
          <div className="gt-focus-header">
            <button className="gt-focus-close" onClick={() => setAdminOpen(false)}>✕</button>
            <div className="gt-focus-title-wrap">
              <div className="gt-focus-title">Uso do Movo</div>
            </div>
            <button className="gt-admin-refresh" onClick={loadAdminData} title="Atualizar"><Ei e="🔄" /></button>
          </div>
          <div className="gt-focus-body gt-builder-body">
            {adminLoading && <div className="gt-empty">Carregando…</div>}
            {!adminLoading && adminOverview && (
              <div className="gt-kpi-grid">
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">{adminOverview.total_usuarios ?? 0}</div>
                  <div className="gt-kpi-label">USUÁRIOS CADASTRADOS</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">{adminOverview.ativos_hoje ?? 0}</div>
                  <div className="gt-kpi-label">ATIVOS HOJE</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">{adminOverview.ativos_7d ?? 0}</div>
                  <div className="gt-kpi-label">ATIVOS NA SEMANA (7D)</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">{adminOverview.ativos_30d ?? 0}</div>
                  <div className="gt-kpi-label">ATIVOS NO MÊS (30D)</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">+{adminOverview.novos_7d ?? 0}</div>
                  <div className="gt-kpi-label">NOVOS CADASTROS (7D)</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">+{adminOverview.novos_30d ?? 0}</div>
                  <div className="gt-kpi-label">NOVOS CADASTROS (30D)</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">{adminOverview.completaram_onboarding ?? 0}</div>
                  <div className="gt-kpi-label">COMPLETARAM ONBOARDING</div>
                </div>
                <div className="gt-kpi-card">
                  <div className="gt-kpi-value">{adminOverview.conectaram_strava ?? 0}</div>
                  <div className="gt-kpi-label">CONECTADOS AO STRAVA</div>
                </div>
                <div className="gt-kpi-card" style={{ gridColumn: "1 / -1" }}>
                  <div className="gt-kpi-value">{adminOverview.tamanho_banco_mb ?? 0} MB <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/ 500 MB</span></div>
                  <div className="gt-kpi-label">BANCO DE DADOS (plano grátis do Supabase) · {Math.min(100, Math.round(((adminOverview.tamanho_banco_mb ?? 0) / 500) * 100))}% usado</div>
                </div>
              </div>
            )}
            {!adminLoading && !adminOverview && adminUsers && (
              <div className="gt-settings-hint" style={{ marginBottom: 12 }}>
                Painel geral indisponível — falta rodar a função admin_overview_stats/admin_daily_active no banco (peça pro Claude).
              </div>
            )}
            {!adminLoading && adminDaily && adminDaily.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="gt-field-label" style={{ marginBottom: 8 }}>USUÁRIOS ATIVOS POR DIA · últimos {adminDaily.length} dias</div>
                <AdminDailyChart series={adminDaily} />
              </div>
            )}
            {!adminLoading && adminEvents && (() => {
              const ev = (n) => adminEvents.find((e) => e.name === n) || { total: 0, usuarios: 0 };
              const concl = Number(ev("treino_concluido").total);
              const comAj = Number(ev("treino_concluido_com_ajuste").total);
              const salvou = Number(ev("ficha_salva_com_ajustes").total);
              const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");
              return (
                <div style={{ marginBottom: 16 }}>
                  <div className="gt-field-label" style={{ marginBottom: 8 }}>AJUSTES NO TREINO · últimos 30 dias</div>
                  <div className="gt-kpi-grid">
                    <div className="gt-kpi-card"><div className="gt-kpi-value">{concl}</div><div className="gt-kpi-label">TREINOS CONCLUÍDOS</div></div>
                    <div className="gt-kpi-card"><div className="gt-kpi-value">{comAj} <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{pct(comAj, concl)}</span></div><div className="gt-kpi-label">COM AJUSTE ({ev("treino_concluido_com_ajuste").usuarios} usuário{Number(ev("treino_concluido_com_ajuste").usuarios) === 1 ? "" : "s"})</div></div>
                    <div className="gt-kpi-card" style={{ gridColumn: "1 / -1" }}><div className="gt-kpi-value">{salvou} <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{pct(salvou, comAj)} dos ajustados</span></div><div className="gt-kpi-label">SALVARAM NA FICHA</div></div>
                  </div>
                </div>
              );
            })()}
            {!adminLoading && adminGaps && (
              <div style={{ marginBottom: 16 }}>
                <div className="gt-field-label" style={{ marginBottom: 8 }}>EXERCÍCIOS FORA DO CATÁLOGO · últimos 90 dias</div>
                {adminGaps.length === 0 && <div className="gt-empty">Ninguém criou exercício livre ainda.</div>}
                {adminGaps.slice(0, 15).map((g) => (
                  <div className="gt-admin-login-row" key={g.nome}>
                    <div className="gt-admin-login-email">{g.nome}</div>
                    <div className="gt-admin-login-count">{Number(g.vezes)}x · {Number(g.usuarios)} pessoa{Number(g.usuarios) === 1 ? "" : "s"}</div>
                  </div>
                ))}
                <div className="gt-settings-hint" style={{ marginTop: 6 }}>Nomes que as pessoas digitaram em "Não achou? Adicionar…". Os mais repetidos são candidatos a entrar no catálogo.</div>
              </div>
            )}
            {!adminLoading && adminAiCost && (
              <div style={{ marginBottom: 16 }}>
                <div className="gt-field-label" style={{ marginBottom: 8 }}>GASTO COM IA (API da Anthropic)</div>
                {(() => {
                  const usd = (n) => `US$ ${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: Number(n) < 1 ? 4 : 2 })}`;
                  const ch = Number(adminAiCost.chamadas) || 0;
                  return (
                    <>
                      <div className="gt-kpi-grid" style={{ marginBottom: 8 }}>
                        <div className="gt-kpi-card"><div className="gt-kpi-value">{usd(adminAiCost.total_usd)}</div><div className="gt-kpi-label">TOTAL · TODOS OS USUÁRIOS</div></div>
                        <div className="gt-kpi-card"><div className="gt-kpi-value">{usd(adminAiCost.mes_usd)}</div><div className="gt-kpi-label">ESTE MÊS</div></div>
                      </div>
                      <div className="gt-settings-hint">{ch} chamada{ch === 1 ? "" : "s"} ({Number(adminAiCost.falhas)} com falha, que também custam) · {ch ? usd(Number(adminAiCost.total_usd) / ch) : usd(0)} por chamada · {Number(adminAiCost.tokens_in).toLocaleString("pt-BR")} tokens de entrada, {Number(adminAiCost.tokens_out).toLocaleString("pt-BR")} de saída. Estimativa pelos preços configurados na função; o valor oficial está no Console da Anthropic. Só conta a partir do primeiro registro{adminAiCost.desde ? ` (${new Date(adminAiCost.desde).toLocaleDateString("pt-BR")})` : ""}.</div>
                    </>
                  );
                })()}
              </div>
            )}
            {!adminLoading && adminPlanUsage && (
              <div style={{ marginBottom: 16 }}>
                <div className="gt-field-label" style={{ marginBottom: 8 }}>PLANOS DE CORRIDA COM IA · este mês</div>
                {adminPlanUsage.length === 0 && <div className="gt-empty">Ninguém gerou plano com IA ainda.</div>}
                {adminPlanUsage.length > 0 && (() => {
                  const noMes = adminPlanUsage.reduce((t, u) => t + Number(u.no_mes), 0);
                  const pessoas = adminPlanUsage.filter((u) => Number(u.no_mes) > 0).length;
                  const total = adminPlanUsage.reduce((t, u) => t + Number(u.total), 0);
                  return (
                    <div className="gt-kpi-grid" style={{ marginBottom: 8 }}>
                      <div className="gt-kpi-card"><div className="gt-kpi-value">{noMes}</div><div className="gt-kpi-label">PLANOS NO MÊS ({pessoas} pessoa{pessoas === 1 ? "" : "s"})</div></div>
                      <div className="gt-kpi-card"><div className="gt-kpi-value">{total}</div><div className="gt-kpi-label">PLANOS NO TOTAL</div></div>
                    </div>
                  );
                })()}
                {adminPlanUsage.slice(0, 15).map((u) => (
                  <div className="gt-admin-login-row" key={u.email}>
                    <div className="gt-admin-login-email">{u.email}</div>
                    <div className={`gt-admin-login-count ${Number(u.no_mes) >= 3 ? "warn" : ""}`}>{Number(u.no_mes)}/3 no mês · {Number(u.total)} no total</div>
                  </div>
                ))}
                <div className="gt-settings-hint" style={{ marginTop: 6 }}>Gerações pedidas à IA (o limite é 3 por pessoa por mês). O gasto em dólares está no bloco acima.</div>
              </div>
            )}
            {!adminLoading && adminRaces && (
              <div style={{ marginBottom: 16 }}>
                <div className="gt-field-label" style={{ marginBottom: 8 }}>PROVAS CADASTRADAS PELA COMUNIDADE</div>
                {adminRaces.length === 0 && <div className="gt-empty">Ninguém cadastrou prova ainda.</div>}
                {adminRaces.slice(0, 30).map((r) => (
                  <div className="gt-admin-login-row" key={r.id} style={{ alignItems: "center", opacity: r.oculta ? 0.55 : 1 }}>
                    <div className="gt-admin-login-email">
                      {r.nome}
                      <div className="gt-settings-hint" style={{ margin: 0 }}>{r.data_inicio.split("-").reverse().join("/")}{r.cidade ? ` · ${r.cidade}${r.uf ? "/" + r.uf : ""}` : ""} · por {r.criada_por_email || "?"}</div>
                    </div>
                    <button type="button" className="gt-btn secondary small" onClick={() => adminEsconderProva(r, !r.oculta)}>{r.oculta ? "Mostrar" : "Esconder"}</button>
                  </div>
                ))}
                <div className="gt-settings-hint" style={{ marginTop: 6 }}>Esconder tira a prova da lista de todo mundo (quem já marcou continua com a marcação).</div>
              </div>
            )}
            {!adminLoading && adminLogins && (
              <div style={{ marginBottom: 16 }}>
                <div className="gt-field-label" style={{ marginBottom: 8 }}>LOGINS POR USUÁRIO · últimos 7 dias</div>
                {adminLogins.length === 0 && <div className="gt-empty">Nenhum login registrado ainda.</div>}
                {adminLogins.map((u) => {
                  const logins = Number(u.logins), logouts = Number(u.logouts);
                  const semSair = logins - logouts;
                  return (
                    <div className="gt-admin-login-row" key={u.email}>
                      <div className="gt-admin-login-email">{u.email}</div>
                      <div className={`gt-admin-login-count ${semSair >= 3 ? "warn" : ""}`}>
                        {logins} login{logins === 1 ? "" : "s"} · {logouts} saída{logouts === 1 ? "" : "s"}{semSair >= 3 ? " ⚠" : ""}
                      </div>
                    </div>
                  );
                })}
                <div className="gt-settings-hint" style={{ marginTop: 6 }}><Ei e="⚠" /> = 3 ou mais logins sem ter tocado em "Sair": a sessão está caindo sozinha.</div>
              </div>
            )}
            {!adminLoading && adminUsers && (
              <>
                <div className="gt-admin-summary">{adminUsers.length} usuário{adminUsers.length === 1 ? "" : "s"}</div>
                <div className="gt-admin-list">
                  {adminUsers.map((u) => (
                    <div className="gt-admin-user-card" key={u.user_id}>
                      <div className="gt-admin-user-email">{u.nome ? `${u.nome} (${u.email})` : u.email}</div>
                      <div className="gt-admin-user-row">Cadastrou: {u.cadastrou_em ? new Date(u.cadastrou_em).toLocaleDateString("pt-BR") : "—"} · Último login: {u.ultimo_login ? new Date(u.ultimo_login).toLocaleDateString("pt-BR") : "—"}</div>
                      <div className="gt-admin-user-row">Último acesso real: {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString("pt-BR") : "—"}</div>
                      <div className="gt-admin-user-row">Onboarding: {u.fez_onboarding ? "sim" : "não"} · Strava: {u.conectou_strava ? "conectado" : "não"}</div>
                      <div className="gt-admin-user-row">Acessos ao app: {u.acessos_7d ?? 0} (7d) · {u.acessos_30d ?? 0} (30d) · {u.dias_com_acesso_7d ?? 0} dias diferentes (7d)</div>
                      <div className="gt-admin-user-row">Dias com treino logado*: {u.dias_ativos_7d ?? 0} (7d) · {u.dias_ativos_30d ?? 0} (30d)</div>
                    </div>
                  ))}
                  {adminUsers.length === 0 && <div className="gt-empty">Nenhum usuário ainda.</div>}
                </div>
                <div className="gt-settings-hint" style={{ marginTop: -2 }}>* Dias com treino logado conta a data do treino, não quando ele foi salvo — sincronizar o Strava pela primeira vez importa até 30 dias pra trás de uma vez, então esse número pode subir bastante sem a pessoa ter aberto o app naqueles dias. "Último login" é só quando a sessão expira e a pessoa precisa logar de novo (pode ficar parado por semanas mesmo com uso diário) — "último acesso real" e "acessos ao app" é que mostram se a pessoa tá de fato abrindo o app.</div>
                {adminFeedback && (
                  <>
                    <div className="gt-settings-label" style={{ marginTop: 16 }}>Feedback dos usuários{adminFeedback.filter((f) => !f.lido).length ? ` (${adminFeedback.filter((f) => !f.lido).length} novo${adminFeedback.filter((f) => !f.lido).length === 1 ? "" : "s"})` : ""}</div>
                    <div className="gt-admin-list">
                      {adminFeedback.map((f) => (
                        <div className={`gt-fb-item ${f.lido ? "" : "novo"}`} key={f.id}>
                          <div className="gt-admin-user-row">{new Date(f.created_at).toLocaleString("pt-BR")} · {f.email || "—"} · <b>{f.tipo}</b> · {f.versao || "?"}{f.contato ? "" : " · não quer resposta"}</div>
                          <div className="gt-fb-msg">{f.mensagem}</div>
                          <div className="gt-modal-actions" style={{ marginTop: 0 }}>
                            {f.email && f.contato && <a className="gt-btn secondary small" href={`mailto:${f.email}?subject=${encodeURIComponent("Sobre seu feedback no Movo")}`}>Responder</a>}
                            <button className="gt-btn secondary small" onClick={() => adminMarcarFeedback(f, !f.lido)}>{f.lido ? "Marcar como novo" : "Marcar como lido"}</button>
                          </div>
                        </div>
                      ))}
                      {adminFeedback.length === 0 && <div className="gt-empty">Nenhum feedback ainda.</div>}
                    </div>
                  </>
                )}
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
            <div style={{ height: 24 }} />
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
    // Nome vazio não vale: mantém o nome que a ficha tinha ao abrir.
    const nomeOriginal = editingTreinoSnapshot ? JSON.parse(editingTreinoSnapshot).nome : editingTreino.nome;
    const nome = (editingTreino.nome || "").trim() || nomeOriginal;
    setTreinoEdits((prev) => ({ ...prev, [editingTreino.id]: { ...editingTreino, nome } }));
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
              {[0, 2, 3, 4, 5, 6, 7].map((n) => (
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
              <input
                type="text"
                className="gt-focus-title gt-focus-title-input"
                value={editingTreino.nome}
                maxLength={60}
                placeholder="Nome do treino"
                aria-label="Nome do treino"
                onChange={(e) => setEditingTreino((prev) => ({ ...prev, nome: e.target.value }))}
              />
              <div className="gt-focus-title-hint">✎ toque no nome pra renomear</div>
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

// mm:ss pro timer de descanso (nunca passa de 99:59 na prática, não precisa de horas).
function formatRestTime(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// navigator.vibrate() e o toast só surtem efeito com a página em primeiro
// plano — o navegador ignora vibração e ninguém vê o toast se o app estiver
// minimizado/em segundo plano. Uma notificação do sistema (via service
// worker) é o único dos três avisos que aparece mesmo assim, então ela é o
// aviso principal quando o descanso acaba; vibrate+toast continuam só como
// reforço pra quando o app já está na tela.
function notifyRestDone(label) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const title = "Descanso acabou";
    const body = label ? `Hora de voltar — ${label}` : "Hora de voltar pro próximo exercício";
    const opts = { body, icon: "./icon-192.png", badge: "./icon-192.png", vibrate: [200, 100, 200], tag: "movo-rest-timer", renotify: true };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)).catch(() => { try { new Notification(title, { body }); } catch (e) {} });
    } else {
      new Notification(title, { body });
    }
  } catch (e) {}
}

function TreinoFocusView({ treino, item, treinoLog, selectedDate, expandedEx, setExpandedEx, ensureSetsForExpand, updateSetField, updateExComentario, cycleExercicioStatus, addSetToExercise, removeLastSet, addExerciseToday, removeAddedExercise, onClose, onFinish, showToast }) {
  const flat = flattenExercicios(treino);
  const doneCount = flat.filter((ex) => treinoLog[ex.id]?.status === "feito").length;
  const skippedCount = flat.filter((ex) => treinoLog[ex.id]?.status === "pulei").length;
  const key = itemKey(item);
  const [videoOpenId, setVideoOpenId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerGrupo, setPickerGrupo] = useState(CATALOG_GRUPOS[0].label);
  const addedIds = new Set(((treino.blocos.find((b) => b.nome === ADDED_BLOCO_NOME) || {}).exercicios || []).map((e) => e.id));

  // --- Timer de descanso entre séries. Fica num estado só (não um por
  // exercício) porque só dá pra descansar de uma coisa por vez — e mora
  // aqui em cima, fora do detalhe de qualquer exercício (tanto o botão de
  // iniciar quanto a barra rodando), pra sobreviver a fechar o acordeão do
  // exercício ou abrir outro enquanto conta. ---
  const [restTimer, setRestTimer] = useState(null); // { exNome, endsAt, totalSec }
  const [restRemaining, setRestRemaining] = useState(0);

  useEffect(() => {
    if (!restTimer) return;
    const tick = () => {
      const rem = Math.max(0, Math.round((restTimer.endsAt - Date.now()) / 1000));
      setRestRemaining(rem);
      if (rem === 0) {
        setRestTimer(null);
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
        notifyRestDone(restTimer.exNome);
        if (showToast) showToast(restTimer.exNome ? `Descanso acabou — ${restTimer.exNome}` : "Descanso acabou");
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restTimer, showToast]);

  function startRest(seconds, exNome) {
    // Pede permissão de notificação no primeiro uso (dentro do clique, pra
    // não perder o gesto do usuário) — é o aviso que sobrevive ao app em
    // segundo plano; sem ele, só sobra vibração/toast, que o navegador
    // ignora/esconde quando a página não está em primeiro plano.
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try { Notification.requestPermission(); } catch (e) {}
    }
    setRestTimer({ exNome: exNome || null, endsAt: Date.now() + seconds * 1000, totalSec: seconds });
  }
  function adjustRest(delta) {
    setRestTimer((rt) => (rt ? { ...rt, endsAt: rt.endsAt + delta * 1000 } : rt));
  }
  function stopRest() { setRestTimer(null); }

  // Nome do exercício atualmente aberto (se houver), só pra dar contexto no
  // rótulo do descanso — o timer em si não depende de nenhum exercício.
  let currentExNome = null;
  if (expandedEx && expandedEx.startsWith(key + "#")) {
    const openExId = expandedEx.slice(key.length + 1);
    const openEx = flat.find((e) => String(e.id) === openExId);
    if (openEx) currentExNome = openEx.nome;
  }

  // --- Timer do treino todo: início manual, parado ao concluir (lá em
  // baixo), e usado pra pré-preencher a duração no modal de RPE. ---
  // O início fica salvo no aparelho (por dia + treino): recarregar a página, o navegador
  // descartar a aba em segundo plano ou fechar e reabrir o treino não zera o cronômetro.
  // Passadas 5 horas, considera esquecido e volta pro "iniciar treino".
  const workoutStartKey = `treino-app:workoutStart:${selectedDate || todayISO()}:${key}`;
  const [workoutStart, setWorkoutStartState] = useState(() => {
    try {
      const v = Number(localStorage.getItem(workoutStartKey));
      return v > 0 && Date.now() - v < 5 * 3600 * 1000 && v <= Date.now() ? v : null;
    } catch (e) { return null; }
  });
  const setWorkoutStart = (v) => {
    setWorkoutStartState(v);
    try { if (v) localStorage.setItem(workoutStartKey, String(v)); else localStorage.removeItem(workoutStartKey); } catch (e) {}
  };
  const [workoutElapsed, setWorkoutElapsed] = useState(0);

  useEffect(() => {
    if (!workoutStart) return;
    const tick = () => setWorkoutElapsed(Math.floor((Date.now() - workoutStart) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [workoutStart]);

  function handleFinish() {
    const elapsedMin = workoutStart ? Math.max(1, Math.round((Date.now() - workoutStart) / 60000)) : 0;
    try { localStorage.removeItem(workoutStartKey); } catch (e) {}
    onFinish(elapsedMin);
  }

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

      <div className="gt-focus-timers">
        {workoutStart ? (
          <div className="gt-workout-timer-running">
            <span className="gt-workout-timer-dot" />
            {formatRestTime(workoutElapsed)}
          </div>
        ) : (
          <button type="button" className="gt-workout-timer-start" onClick={() => setWorkoutStart(Date.now())}>
            ▶ iniciar treino
          </button>
        )}
        <div className="gt-rest-timer-slot">
          {restTimer ? (
            <div className="gt-rest-bar">
              <div className="gt-rest-bar-main">
                <div className="gt-rest-bar-time">{formatRestTime(restRemaining)}</div>
                <div className="gt-rest-bar-label">descanso{restTimer.exNome ? ` · ${restTimer.exNome}` : ""}</div>
              </div>
              <div className="gt-rest-bar-actions">
                <button type="button" onClick={() => adjustRest(-15)}>-15s</button>
                <button type="button" onClick={() => adjustRest(15)}>+15s</button>
                <button type="button" className="gt-rest-bar-stop" onClick={stopRest}>✕</button>
              </div>
            </div>
          ) : (
            <button type="button" className="gt-rest-start-btn" onClick={() => startRest(75, currentExNome)}><Ei e="⏱" /> descanso</button>
          )}
        </div>
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
                      <div className="gt-ex-target">
                        {(exLog?.sets?.length || 0) > 0 ? exLog.sets.length : ex.series}x {ex.repeticoes}
                        {(exLog?.sets?.length || 0) > 0 && exLog.sets.length !== ex.series && <span className="gt-ex-adjusted">ajustado</span>}
                      </div>
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
                      {ex.observacoes && <div className="gt-ex-obs"><Ei e="⚠" /> {ex.observacoes}</div>}
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
                      <div className="gt-set-adjust">
                        <button type="button" onClick={() => addSetToExercise(item, ex)}>+ série</button>
                        {(exLog?.sets?.length || 0) > 1 && <button type="button" onClick={() => removeLastSet(item, ex)}>− série</button>}
                        {addedIds.has(ex.id) && <button type="button" onClick={() => { removeAddedExercise(ex.id); setExpandedEx(null); }}>remover de hoje</button>}
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
        <button className="gt-add-extra-card" type="button" onClick={() => setPickerOpen(true)}>
          <span className="plus">+</span> Adicionar exercício hoje
        </button>
        <div style={{ height: 76 }} />
      </div>

      <div className="gt-focus-footer">
        <button className="gt-btn" onClick={handleFinish}>Concluir treino</button>
      </div>

      {pickerOpen && (
        <ExercisePickerModal
          search={pickerSearch}
          setSearch={setPickerSearch}
          grupo={pickerGrupo}
          setGrupo={setPickerGrupo}
          isAdded={(c) => flat.some((e) => e.nome === c.nome)}
          onAdd={addExerciseToday}
          canRemove={(c) => flat.some((e) => e.nome === c.nome && addedIds.has(e.id))}
          onRemove={(c) => { const e = flat.find((x) => x.nome === c.nome && addedIds.has(x.id)); if (e) removeAddedExercise(e.id); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function FichaPromptModal({ prompt, setPrompt, onSave, onSkip }) {
  const anyOn = prompt.changes.some((c) => c.on);
  function toggle(idx) {
    setPrompt({ ...prompt, changes: prompt.changes.map((c, i) => (i === idx ? { ...c, on: !c.on } : c)) });
  }
  function label(c) {
    if (c.kind === "added") return `Adicionar à ficha: ${c.nome}`;
    if (c.kind === "series") return `${c.nome}: ${c.from} → ${c.to} séries`;
    return `Remover da ficha: ${c.nome} (pulado hoje)`;
  }
  return (
    <div className="gt-modal-backdrop" onClick={onSkip}>
      <div className="gt-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Manter na ficha?</h3>
        <p>Você ajustou "{prompt.treinoNome}" hoje. Marque o que vale a partir de agora — os treinos que você já fez continuam como foram.</p>
        <div className="gt-ficha-changes">
          {prompt.changes.map((c, i) => (
            <label className="gt-ficha-change" key={`${c.kind}-${c.exId}`}>
              <input type="checkbox" checked={c.on} onChange={() => toggle(i)} />
              <span>{label(c)}</span>
            </label>
          ))}
        </div>
        <div className="gt-modal-actions">
          <button className="gt-btn" disabled={!anyOn} onClick={onSave}>Salvar na ficha</button>
          <button className="gt-btn secondary" onClick={onSkip}>Só hoje</button>
        </div>
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

// Gráfico simples de usuários ativos por dia (painel admin) — mesma estrutura
// de barra do FrequencyChart, mas sobre dados de admin_daily_active (um
// usuário é "ativo" num dia se abriu o app, via app_opens).
function AdminDailyChart({ series }) {
  const W = 320, H = 150, PAD_L = 24, PAD_R = 8, PAD_T = 12, PAD_B = 20;
  const [hover, setHover] = useState(null);
  useEffect(() => { setHover(null); }, [series]);
  const counts = series.map((d) => Number(d.usuarios_ativos) || 0);
  const max = Math.max(1, ...counts);
  const barW = series.length ? (W - PAD_L - PAD_R) / series.length : W - PAD_L - PAD_R;
  const yFor = (v) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);

  return (
    <div style={{ width: "100%" }}>
      {series.length === 0 ? (
        <div className="gt-empty">Sem dados ainda.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 150, overflow: "visible" }}>
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T} y2={PAD_T} stroke="#2C3038" strokeWidth="1" />
          <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#2C3038" strokeWidth="1" />
          <text x={2} y={PAD_T + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">{max}</text>
          <text x={2} y={H - PAD_B + 4} fontSize="10" fill="#9AA0A6" fontFamily="Roboto Mono, monospace">0</text>
          {series.map((d, i) => (
            <rect
              key={d.dia}
              x={PAD_L + i * barW + 1} y={yFor(counts[i])} width={Math.max(1, barW - 2)} height={Math.max(0, H - PAD_B - yFor(counts[i]))}
              fill={hover === i ? "#F2F3F1" : "#C6F135"}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}
              style={{ cursor: "pointer" }}
            />
          ))}
        </svg>
      )}
      {hover !== null && series[hover] && (
        <div className="gt-chart-tooltip" style={{ display: "inline-block" }}>
          <div>{new Date(series[hover].dia + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</div>
          <div style={{ color: "#C6F135" }}>{series[hover].usuarios_ativos} usuário{Number(series[hover].usuarios_ativos) === 1 ? "" : "s"} ativo{Number(series[hover].usuarios_ativos) === 1 ? "" : "s"}</div>
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


