import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    return await handle(req);
  } catch (e) {
    console.error("sync-estado: erro não tratado", e);
    return json({ error: "internal_error" }, 500);
  }
});

async function handle(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") {
    return json({ error: "bad_request" }, 400);
  }

  if (body.action === "refill") {
    const { data, error } = await admin.rpc("rpc_refill", { p_user: userId }).single();
    if (error || !data) {
      return json({ error: "refill_rejected" }, 429);
    }
    return json({ coins: data.coins, wins: data.wins });
  }

  if (body.action === "round_start") {
    const { data, error } = await admin.rpc("rpc_round_start", { p_user: userId }).single();
    if (error || !data) {
      return json({ error: "round_start_rejected" }, 400);
    }
    return json({ coins: data.coins, wins: data.wins });
  }

  if (body.action === "capture") {
    const plushId = Number(body.plushId);
    if (!Number.isInteger(plushId) || plushId < 0 || plushId >= 43) {
      return json({ error: "bad_plush_id" }, 400);
    }
    const { data, error } = await admin.rpc("rpc_capture", { p_user: userId, p_plush_id: plushId }).single();
    if (error || !data) {
      return json({ error: "capture_rejected" }, 400);
    }
    return json({ coins: data.coins, wins: data.wins, plushId, count: data.count });
  }

  if (body.action === "sell") {
    const plushId = Number(body.plushId);
    const qty = Number(body.qty);
    if (!Number.isInteger(plushId) || plushId < 0 || plushId >= 43 || !Number.isInteger(qty) || qty < 1) {
      return json({ error: "bad_sale" }, 400);
    }
    const { data, error } = await admin.rpc("rpc_sell", { p_user: userId, p_plush_id: plushId, p_qty: qty }).single();
    if (error || !data) {
      return json({ error: "sale_rejected" }, 400);
    }
    return json({ coins: data.coins, wins: data.wins, plushId, count: data.count });
  }

  // ---- estado que antes ficava só no aparelho (migração 0006) ----
  const int = (v: unknown, lo: number, hi: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  };
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  };
  const call = async (fn: string, args: Record<string, unknown>, rejected: string) => {
    const { data, error } = await admin.rpc(fn, { p_user: userId, ...args }).single();
    if (error || !data) return json({ error: rejected, detail: error?.message ?? null }, 400);
    return json(data);
  };

  if (body.action === "buy") {
    const item = typeof body.item === "string" ? body.item : "";
    if (item !== "food" && !/^stone_[0-7]$/.test(item)) return json({ error: "bad_item" }, 400);
    return call("rpc_buy", { p_item: item }, "buy_rejected");
  }
  if (body.action === "swap") return call("rpc_swap", {}, "swap_rejected");
  if (body.action === "giant_round_start") return call("rpc_giant_round_start", {}, "giant_round_rejected");
  if (body.action === "giant_capture") {
    const p = int(body.plushId, 0, 19);
    if (p === null) return json({ error: "bad_plush_id" }, 400);
    const L = await lendarios();  // 💎 raro: chance vem do data/lendarios.json (sem o arquivo, sem diamante)
    return call("rpc_giant_capture", { p_plush: p, p_dchance: L?.diamantes?.gigante_chance ?? 0 }, "giant_capture_rejected");
  }
  if (body.action === "sell_giant") {
    const p = int(body.plushId, 0, 19);
    if (p === null) return json({ error: "bad_plush_id" }, 400);
    return call("rpc_sell_giant", { p_plush: p }, "sell_giant_rejected");
  }
  if (body.action === "giant_evolve" || body.action === "use_stone") {
    const p = int(body.plushId, 0, 19), st = int(body.stone, 0, 7);
    if (p === null || st === null) return json({ error: "bad_request" }, 400);
    return call(body.action === "giant_evolve" ? "rpc_giant_evolve" : "rpc_use_stone", { p_plush: p, p_stone: st }, body.action + "_rejected");
  }
  if (body.action === "care") {
    const p = int(body.plushId, 0, 52), kind = body.kind;
    if (p === null || !["f", "l", "p"].includes(kind)) return json({ error: "bad_request" }, 400);
    return call("rpc_care", { p_plush: p, p_kind: kind, p_f: num(body.f), p_l: num(body.l), p_p: num(body.p) }, "care_rejected");
  }
  if (body.action === "battle") {
    const p = int(body.plushId, 0, 52);
    if (p === null) return json({ error: "bad_plush_id" }, 400);
    return call("rpc_battle", { p_plush: p, p_win: body.win === true }, "battle_rejected");
  }
  if (body.action === "import_local") {
    const d = body.data && typeof body.data === "object" ? body.data : {};
    return call("rpc_import_local", { p_data: d }, "import_rejected");
  }

  if (body.action === "mission_claim") {
    const id = typeof body.id === "string" ? body.id : "";
    const defs = await missoes();
    if (!defs) return json({ error: "missoes_indisponiveis" }, 503);
    const i = defs.percurso.findIndex((m) => m.id === id);
    let m: Missao | undefined, daily = false, prev: string | null = null;
    if (i >= 0) { m = defs.percurso[i]; prev = i > 0 ? defs.percurso[i - 1].id : null; }
    else { m = diariasDoDia(defs, hojeBR()).find((x) => x.id === id); daily = true; }
    if (!m) return json({ error: "missao_nao_disponivel" }, 400);
    return call("rpc_mission_claim", { p_mission: m.id, p_daily: daily, p_kind: m.tipo, p_target: m.meta, p_reward: m.premio, p_prev: prev }, "mission_rejected");
  }

  // ---- aventura: fases e regras vêm do data/aventura.json publicado; o banco só guarda progresso e energia ----
  if (body.action === "adv_start" || body.action === "adv_end" || body.action === "adv_rest") {
    const A = await aventura();
    if (!A) return json({ error: "aventura_indisponivel" }, 503);
    const E = A.energia;
    if (body.action === "adv_rest") {
      const p = int(body.plushId, 0, 52);
      if (p === null) return json({ error: "bad_plush_id" }, 400);
      return call("rpc_adv_rest", { p_plush: p, p_cost: E.descanso_preco, p_max: E.max, p_regen_min: E.recarga_min }, "adv_rest_rejected");
    }
    const f = faseDaAventura(A, typeof body.stage === "string" ? body.stage : "");
    if (!f) return json({ error: "fase_nao_existe" }, 400);
    if (body.action === "adv_start") {
      const p = int(body.plushId, 0, 52);
      if (p === null) return json({ error: "bad_plush_id" }, 400);
      return call("rpc_adv_start", { p_plush: p, p_stage: f.fase.id, p_prev: f.anterior, p_max: E.max, p_regen_min: E.recarga_min }, "adv_start_rejected");
    }
    const niveis = f.fase.inimigos.map((x) => x[1]).concat(f.fase.chefe ? [f.fase.chefe[1]] : []);
    const minLv = Math.max(1, Math.max(...niveis) - (A.nivel_min_folga ?? 6));
    const estrelas = int(body.stars, 1, 3) ?? 1;
    const L = await lendarios(), DM = L?.diamantes, ch = L?.chocar;
    return call("rpc_adv_end", {
      p_stage: f.fase.id, p_win: body.win === true, p_stars: estrelas, p_reward: f.fase.premio,
      p_xp_win: A.xp.vitoria, p_xp_lose: A.xp.derrota, p_min_sec: A.tempo_min_seg ?? 10, p_min_lv: minLv,
      p_boss: !!f.fase.chefe && !f.desafio, p_chance: f.fase.chefe && !f.desafio ? A.chefe_pedra.chance : 0, p_stones: A.chefe_pedra.pedras,
      // 💎: 1ª vitória no chefão do mundo e todas as fases do mundo com 3 estrelas (uma vez só, o banco guarda)
      p_world: f.mundo ? f.mundo.id : null, p_world_stages: f.mundo ? f.mundo.fases.map((x) => x.id) : null,
      p_boss_diamonds: DM?.chefe_do_mundo ?? 0, p_world_diamonds: DM?.mundo_3_estrelas ?? 0,
      // Desafio Lendário: lendário do dia e chance do ovo (sorteada só na 1ª vitória do dia)
      p_leg: f.desafio ? legDoDia(hojeBR()) : -1, p_leg_chance: f.desafio ? (A.desafio?.chance_ovo ?? 0) : 0,
      p_egg_min: ch?.dias_min ?? 7, p_egg_max: ch?.dias_max ?? 90,
    }, "adv_end_rejected");
  }

  // ---- lendários: máquina de ovos, loja de diamantes e carinho para chocar (regras em data/lendarios.json) ----
  if (body.action === "egg_round_start" || body.action === "egg_capture" || body.action === "egg_buy" || body.action === "egg_care") {
    const L = await lendarios();
    if (!L) return json({ error: "lendarios_indisponivel" }, 503);
    const ch = L.chocar;
    if (body.action === "egg_round_start") return call("rpc_egg_round_start", { p_cost: L.maquina.preco }, "egg_round_rejected");
    if (body.action === "egg_capture" || body.action === "egg_buy") {
      const leg = int(body.leg, 0, 9);
      if (leg === null) return json({ error: "bad_leg" }, 400);
      if (body.action === "egg_capture") {
        return call("rpc_egg_capture", { p_leg: leg, p_chance: L.maquina.chance_ovo, p_fake: L.maquina.ovo_falso_moedas, p_min: ch.dias_min, p_max: ch.dias_max }, "egg_capture_rejected");
      }
      return call("rpc_egg_buy", { p_leg: leg, p_price: L.loja.preco_ovo_diamantes, p_min: ch.dias_min, p_max: ch.dias_max }, "egg_buy_rejected");
    }
    const egg = Number(body.eggId);
    if (!Number.isSafeInteger(egg) || egg < 1) return json({ error: "bad_egg" }, 400);
    return call("rpc_egg_care", { p_egg: egg, p_birth_xp: Math.max(0, (ch.nivel_ao_nascer - 1) * 4) }, "egg_care_rejected");
  }

  return json({ error: "unknown_action" }, 400);
}

// ---- missões: a lista (conteúdo do jogo) é o data/missoes.json publicado com o site; o banco só guarda o progresso ----
type Missao = { id: string; tipo: string; meta: number; premio: number };
type Missoes = { percurso: Missao[]; diarias: Missao[]; diarias_por_dia?: number };
const MISSOES_URL = Deno.env.get("MISSOES_URL") ?? "https://joaobazanela.github.io/garro-app/data/missoes.json";
let cacheMissoes: { t: number; d: Missoes } | null = null;
async function missoes(): Promise<Missoes | null> {
  if (cacheMissoes && Date.now() - cacheMissoes.t < 5 * 60 * 1000) return cacheMissoes.d;
  try {
    const r = await fetch(MISSOES_URL, { headers: { "cache-control": "no-cache" } });
    if (!r.ok) return cacheMissoes?.d ?? null;
    const d = await r.json() as Missoes;
    if (!Array.isArray(d.percurso) || !Array.isArray(d.diarias)) return cacheMissoes?.d ?? null;
    cacheMissoes = { t: Date.now(), d };
    return d;
  } catch (_e) {
    return cacheMissoes?.d ?? null;
  }
}
// dia no horário de Brasília (igual ao g_today() do banco)
function hojeBR(): string {
  return new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
}
// mesmo sorteio do js/missoes.js: as 3 diárias do dia são iguais para todos
function diariasDoDia(d: Missoes, dia: string): Missao[] {
  const n = d.diarias.length, k = Math.min(d.diarias_por_dia ?? 3, n), out: number[] = [];
  let s = (Math.floor(Date.parse(dia + "T00:00:00Z") / 864e5) * 2654435761) >>> 0;
  while (out.length < k) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const i = s % n; if (!out.includes(i)) out.push(i); }
  return out.map((i) => d.diarias[i]);
}

// ---- aventura ----
type Fase = { id: string; premio: number; inimigos: [number, number][]; chefe?: [number, number] };
type Desafio = { id: string; depois_de: string; nivel: number; chance_ovo: number; premio?: number };
type Aventura = {
  energia: { max: number; recarga_min: number; descanso_preco: number };
  xp: { vitoria: number; derrota: number };
  tempo_min_seg?: number; nivel_min_folga?: number;
  chefe_pedra: { chance: number; pedras: number[] };
  mundos: { id: string; fases: Fase[] }[];
  desafio?: Desafio;
};
const AVENTURA_URL = Deno.env.get("AVENTURA_URL") ?? "https://joaobazanela.github.io/garro-app/data/aventura.json";
let cacheAventura: { t: number; d: Aventura } | null = null;
async function aventura(): Promise<Aventura | null> {
  if (cacheAventura && Date.now() - cacheAventura.t < 5 * 60 * 1000) return cacheAventura.d;
  try {
    const r = await fetch(AVENTURA_URL, { headers: { "cache-control": "no-cache" } });
    if (!r.ok) return cacheAventura?.d ?? null;
    const d = await r.json() as Aventura;
    if (!Array.isArray(d.mundos) || !d.energia || !d.chefe_pedra) return cacheAventura?.d ?? null;
    cacheAventura = { t: Date.now(), d };
    return d;
  } catch (_e) {
    return cacheAventura?.d ?? null;
  }
}
// fase pelo id + id da fase anterior (a 1ª fase de cada mundo depende da última do mundo anterior).
// O Desafio Lendário é uma fase à parte: o chefão é o lendário do dia (troca todo dia).
type FaseAchada = { fase: Fase; anterior: string | null; mundo?: { id: string; fases: Fase[] }; desafio?: boolean };
function faseDaAventura(a: Aventura, id: string): FaseAchada | null {
  const d = a.desafio;
  if (d && id === d.id) return { fase: { id: d.id, premio: d.premio ?? 0, inimigos: [], chefe: [43 + legDoDia(hojeBR()), d.nivel] }, anterior: d.depois_de, desafio: true };
  const todas = a.mundos.flatMap((m) => m.fases);
  const i = todas.findIndex((f) => f.id === id);
  if (i < 0) return null;
  return { fase: todas[i], anterior: i > 0 ? todas[i - 1].id : null, mundo: a.mundos.find((m) => m.fases.some((f) => f.id === id)) };
}
// lendário do dia (0–9): igual ao js/aventura.js — muda à meia-noite de Brasília
function legDoDia(dia: string): number {
  return Math.floor(Date.parse(dia + "T00:00:00Z") / 864e5) % 10;
}

// ---- lendários ----
type Lendarios = {
  diamantes: { chefe_do_mundo: number; mundo_3_estrelas: number; gigante_chance: number };
  maquina: { preco: number; chance_ovo: number; ovo_falso_moedas: number };
  loja: { preco_ovo_diamantes: number };
  chocar: { dias_min: number; dias_max: number; nivel_ao_nascer: number };
};
const LENDARIOS_URL = Deno.env.get("LENDARIOS_URL") ?? "https://joaobazanela.github.io/garro-app/data/lendarios.json";
let cacheLendarios: { t: number; d: Lendarios } | null = null;
async function lendarios(): Promise<Lendarios | null> {
  if (cacheLendarios && Date.now() - cacheLendarios.t < 5 * 60 * 1000) return cacheLendarios.d;
  try {
    const r = await fetch(LENDARIOS_URL, { headers: { "cache-control": "no-cache" } });
    if (!r.ok) return cacheLendarios?.d ?? null;
    const d = await r.json() as Lendarios;
    if (!d.maquina || !d.chocar || !d.loja || !d.diamantes) return cacheLendarios?.d ?? null;
    cacheLendarios = { t: Date.now(), d };
    return d;
  } catch (_e) {
    return cacheLendarios?.d ?? null;
  }
}
