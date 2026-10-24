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
    return call("rpc_giant_capture", { p_plush: p }, "giant_capture_rejected");
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
    const p = int(body.plushId, 0, 42), kind = body.kind;
    if (p === null || !["f", "l", "p"].includes(kind)) return json({ error: "bad_request" }, 400);
    return call("rpc_care", { p_plush: p, p_kind: kind, p_f: num(body.f), p_l: num(body.l), p_p: num(body.p) }, "care_rejected");
  }
  if (body.action === "battle") {
    const p = int(body.plushId, 0, 42);
    if (p === null) return json({ error: "bad_plush_id" }, 400);
    return call("rpc_battle", { p_plush: p, p_win: body.win === true }, "battle_rejected");
  }
  if (body.action === "import_local") {
    const d = body.data && typeof body.data === "object" ? body.data : {};
    return call("rpc_import_local", { p_data: d }, "import_rejected");
  }

  return json({ error: "unknown_action" }, 400);
});
