-- 0014 — Nova progressão (pedido dos administradores, só eles jogavam):
--  • pedra de evolução custa 200 moedas (antes 400);
--  • evoluir: no Nv 100, com 5 pedras do grupo do bichinho, de uma vez (antes: 1ª pedra evoluía e ia ao Nv 30);
--    pedras não dão mais níveis; renascer continua no Nv 100 e agora vale para todos (redondos e lendários também);
--  • redondos vão até o Nv 100;
--  • na máquina só há redondos; ao pegar um, ele pode virar um grande do mesmo grupo de pedra (sorteio aqui);
--  • máquina gigante só com todos os normais; ovos com todos os normais e todos os gigantes;
--    épicos (ids 53 a 56: Fogo, Água, Ar, Terra) com tudo isso e todos os lendários;
--  • cada partida da Aventura custa moedas (data/aventura.json → custo_moedas).
-- Só ESTADO no banco. As regras ficam em data/regras.json, data/lendarios.json e data/aventura.json e chegam pela sync-estado.

-- ---------- ids 53 a 56 (épicos) cabem nas tabelas ----------
alter table public.collection drop constraint if exists collection_plush_id_check;
alter table public.collection add constraint collection_plush_id_check check (plush_id >= 0 and plush_id < 57);
alter table public.plush_care drop constraint if exists plush_care_plush_id_check;
alter table public.plush_care add constraint plush_care_plush_id_check check (plush_id >= 0 and plush_id < 57);
alter table public.adventure_energy drop constraint if exists adventure_energy_plush_id_check;
alter table public.adventure_energy add constraint adventure_energy_plush_id_check check (plush_id >= 0 and plush_id < 57);

alter table public.plush_care add column if not exists evolved boolean not null default false;
update public.plush_care set evolved = true where plush_id < 20 and rebirths > 0;   -- quem já tinha renascido já era evoluído
alter table public.player_state add column if not exists pending_epic boolean not null default false;
alter table public.player_state add column if not exists epic_firm boolean not null default false;

-- ---------- curva: todos até o Nv 100 (redondos: linear 12) ----------
create or replace function public.g_xp_total(p_plush integer, p_lv integer)
returns integer language sql immutable as $$
  select (case when p_plush < 20 or p_plush >= 43 then 10 else 12 end) * n + round(30 * (n::numeric ^ 3) / 1000)::integer
  from (select greatest(0, least(p_lv, 100) - 1) as n) q
$$;
create or replace function public.g_lv_xp(p_plush integer, p_xp integer)
returns integer language sql immutable as $$
  select max(l) from generate_series(1, 100) l where public.g_xp_total(p_plush, l) <= greatest(0, p_xp)
$$;

-- grupo de pedra de cada bichinho normal (0 Fogo, 1 Ar, 2 Terra, 3 Planta, 4 Fantasma, 6 Luz, 7 Sombria) — igual ao STONE_OF do jogo
create or replace function public.g_stone_of(p_plush integer)
returns integer language sql immutable as $$
  select (array[2,1,0,1,7,3,1,1,0,6,3,0,1,2,7,1,0,6,4,6,1,1,3,6,1,7,6,3,1,2,7,2,0,1,4,2,0,2,1,0,1,6,3])[p_plush + 1]
$$;

-- coleção completa de cada etapa
create or replace function public.g_tem_normais(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select count(*) = 43 from public.collection where user_id = p_user and plush_id < 43 and count >= 1 $$;
create or replace function public.g_tem_gigantes(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select count(*) = 20 from public.giants where user_id = p_user and count >= 1 $$;
create or replace function public.g_tem_lendarios(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select count(*) = 10 from public.collection where user_id = p_user and plush_id between 43 and 52 and count >= 1 $$;

-- ---------- pedra: 200 moedas ----------
create or replace function public.rpc_buy(p_user uuid, p_item text)
returns table(coins integer, item text, qty integer)
language plpgsql security definer set search_path = public as $$
declare c integer; q integer;
begin
  if p_item = 'food' then c := public.g_spend(p_user, 5);
  elsif p_item ~ '^stone_[0-7]$' then c := public.g_spend(p_user, 200);
  else raise exception 'item_invalido'; end if;
  q := public.g_item_add(p_user, p_item, 1);
  if p_item like 'stone_%' then perform public.g_count(p_user,'stone',1); end if;
  return query select c, p_item, q;
end; $$;

-- ---------- evoluir: Nv 100 + N pedras do grupo, de uma vez; fica no Nv 100 ----------
drop function if exists public.rpc_use_stone(uuid, integer, integer, integer, integer);
create or replace function public.rpc_use_stone(p_user uuid, p_plush integer, p_stone integer, p_lv integer, p_need integer)
returns table(stones integer, xp integer, rebirths integer, evolved boolean)
language plpgsql security definer set search_path = public as $$
declare q integer; x integer; rb integer; ev boolean;
begin
  if p_plush < 0 or p_plush >= 20 or p_stone < 0 or p_stone > 7 or p_lv < 10 or p_lv > 100 or p_need < 1 or p_need > 20 then raise exception 'bad_request'; end if;
  if public.g_stone_of(p_plush) <> p_stone then raise exception 'pedra_errada'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, 0) on conflict do nothing;
  select pc.xp, pc.rebirths, pc.evolved into x, rb, ev from public.plush_care pc where pc.user_id = p_user and pc.plush_id = p_plush for update;
  if ev then raise exception 'ja_evoluiu'; end if;
  if public.g_lv_xp(p_plush, x) < p_lv then raise exception 'nivel_baixo'; end if;
  q := public.g_item_add(p_user, 'stone_' || p_stone, -p_need);                     -- sem pedras suficientes: sem_item
  update public.plush_care pc set evolved = true, stone_pending = 0, updated_at = now() where pc.user_id = p_user and pc.plush_id = p_plush;
  perform public.g_count(p_user, 'stone', p_need);
  return query select q, x, rb, true;
end; $$;

-- renascer: qualquer bichinho no Nv 100; volta ao 1, mantém a forma e soma 1 renascimento
create or replace function public.rpc_rebirth(p_user uuid, p_plush integer)
returns table(xp integer, rebirths integer) language plpgsql security definer set search_path = public as $$
declare x integer; rb integer;
begin
  if p_plush < 0 or p_plush >= 57 then raise exception 'bad_request'; end if;
  select pc.xp into x from public.plush_care pc where pc.user_id = p_user and pc.plush_id = p_plush for update;
  if not found or public.g_lv_xp(p_plush, x) < 100 then raise exception 'nivel_baixo'; end if;
  update public.plush_care pc set xp = 0, rebirths = pc.rebirths + 1, stone_pending = 0, updated_at = now()
  where pc.user_id = p_user and pc.plush_id = p_plush returning pc.rebirths into rb;
  return query select 0, rb;
end; $$;

-- ---------- máquina: só redondos; chance de virar um grande do mesmo grupo ----------
drop function if exists public.rpc_capture(uuid, integer);
create or replace function public.rpc_capture(p_user uuid, p_plush_id integer, p_chance real)
returns table(coins integer, wins integer, count integer, plush_id integer, transformed boolean)
language plpgsql security definer set search_path = public as $$
declare updated_coins integer; updated_wins integer; updated_count integer; pid integer := p_plush_id; tr boolean := false;
begin
  if p_plush_id < 20 or p_plush_id >= 43 then raise exception 'bad_plush_id'; end if;   -- na máquina só há redondos
  if p_chance < 0 or p_chance > 0.5 then raise exception 'regra_invalida'; end if;
  update public.player_state set wins = player_state.wins + 1, pending_round = false, last_action_at = now()
  where user_id = p_user and pending_round = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;
  if not found then raise exception 'capture_rejected'; end if;
  if random() < p_chance then
    select g into pid from generate_series(0, 19) g where public.g_stone_of(g) = public.g_stone_of(p_plush_id) order by random() limit 1;
    tr := pid is not null; pid := coalesce(pid, p_plush_id);
  end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, pid, 1)
  on conflict on constraint collection_pkey do update set count = collection.count + 1
  returning collection.count into updated_count;
  if updated_count > 1 then perform public.g_xp_add(p_user, pid, case when pid < 20 then 20 else 5 end); end if;
  perform public.g_count(p_user,'capture',1);
  return query select updated_coins, updated_wins, updated_count, pid, tr;
end; $$;

-- ---------- travas das máquinas ----------
create or replace function public.rpc_giant_round_start(p_user uuid)
returns table(coins integer, wins integer) language plpgsql security definer set search_path = public as $$
declare c integer; w integer;
begin
  if not public.g_tem_normais(p_user) then raise exception 'falta_normais'; end if;
  update public.player_state set coins = player_state.coins - 50, pending_giant = true, last_action_at = now()
  where user_id = p_user and player_state.coins >= 50
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'giant_round_rejected'; end if;
  perform public.g_count(p_user,'giant_play',1);
  return query select c, w;
end; $$;

create or replace function public.rpc_egg_round_start(p_user uuid, p_cost integer, p_grip real)
returns table(coins integer, wins integer, firm boolean) language plpgsql security definer set search_path = public as $$
declare c integer; w integer; f boolean := random() < p_grip;
begin
  if p_cost < 50 or p_cost > 5000 or p_grip < 0 or p_grip > 0.5 then raise exception 'regra_invalida'; end if;
  if not public.g_tem_normais(p_user) or not public.g_tem_gigantes(p_user) then raise exception 'falta_colecao'; end if;
  update public.player_state set coins = player_state.coins - p_cost, pending_egg = true, egg_firm = f, last_action_at = now()
  where user_id = p_user and player_state.coins >= p_cost
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'egg_round_rejected'; end if;
  return query select c, w, f;
end; $$;

-- ---------- máquina do épico ----------
create or replace function public.rpc_epic_round_start(p_user uuid, p_cost integer, p_grip real)
returns table(coins integer, wins integer, firm boolean) language plpgsql security definer set search_path = public as $$
declare c integer; w integer; f boolean := random() < p_grip;
begin
  if p_cost < 100 or p_cost > 10000 or p_grip < 0 or p_grip > 0.3 then raise exception 'regra_invalida'; end if;
  if not public.g_tem_normais(p_user) or not public.g_tem_gigantes(p_user) or not public.g_tem_lendarios(p_user) then raise exception 'falta_colecao'; end if;
  update public.player_state set coins = player_state.coins - p_cost, pending_epic = true, epic_firm = f, last_action_at = now()
  where user_id = p_user and player_state.coins >= p_cost
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'epic_round_rejected'; end if;
  return query select c, w, f;
end; $$;

-- o épico pego é sempre o épico do dia (a sync-estado escolhe, o jogo não)
create or replace function public.rpc_epic_capture(p_user uuid, p_birth_lv integer, p_epic integer)
returns table(coins integer, count integer, xp integer, epic integer) language plpgsql security definer set search_path = public as $$
declare c integer; f boolean; n integer; x integer;
begin
  if p_birth_lv < 1 or p_birth_lv > 100 or p_epic < 53 or p_epic > 56 then raise exception 'regra_invalida'; end if;
  update public.player_state set pending_epic = false, last_action_at = now()
  where user_id = p_user and pending_epic = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'
  returning player_state.coins, player_state.epic_firm into c, f;
  if not found then raise exception 'epic_capture_rejected'; end if;
  if not f then raise exception 'epic_not_firm'; end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, p_epic, 1)
  on conflict on constraint collection_pkey do update set count = collection.count + 1 returning collection.count into n;
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_epic, public.g_xp_total(p_epic, p_birth_lv))
  on conflict (user_id, plush_id) do update set xp = greatest(plush_care.xp, public.g_xp_total(p_epic, p_birth_lv)), updated_at = now()
  returning plush_care.xp into x;
  perform public.g_count(p_user, 'capture', 1);
  return query select c, n, x, p_epic;
end; $$;

-- ---------- Aventura: cada partida custa moedas ----------
drop function if exists public.rpc_adv_start(uuid, integer, text, text, integer, integer);
create or replace function public.rpc_adv_start(p_user uuid, p_plush integer, p_stage text, p_prev text, p_max integer, p_regen_min integer, p_cost integer)
returns table(energy integer, since timestamptz, coins integer) language plpgsql security definer set search_path = public as $$
declare e integer; s timestamptz; c integer;
begin
  if p_plush < 0 or p_plush >= 57 then raise exception 'bad_plush_id'; end if;
  if p_cost < 0 or p_cost > 1000 then raise exception 'regra_invalida'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  if p_prev is not null then
    perform 1 from public.adventure_progress where user_id = p_user and stage = p_prev;
    if not found then raise exception 'fase_bloqueada'; end if;
  end if;
  e := public.g_adv_energy(p_user, p_plush, p_max, p_regen_min);
  if e < 1 then raise exception 'cansado'; end if;
  if p_cost > 0 then c := public.g_spend(p_user, p_cost); else select ps.coins into c from public.player_state ps where ps.user_id = p_user; end if;
  update public.adventure_energy ae set energy = e - 1, since = case when e >= p_max then now() else ae.since end
    where ae.user_id = p_user and ae.plush_id = p_plush returning ae.since into s;
  insert into public.adventure_run (user_id, plush_id, stage, started_at) values (p_user, p_plush, p_stage, now())
  on conflict (user_id) do update set plush_id = excluded.plush_id, stage = excluded.stage, started_at = now();
  return query select e - 1, s, c;
end; $$;

-- ---------- os épicos também cuidam, lutam e jogam ----------
create or replace function public.rpc_care(p_user uuid, p_plush integer, p_kind text, p_f real, p_l real, p_p real)
returns table(xp integer, food integer) language plpgsql security definer set search_path = public as $$
declare x integer; fd integer; gain integer; hoje date := (now() at time zone 'America/Sao_Paulo')::date; ja integer;
begin
  if p_plush < 0 or p_plush >= 57 then raise exception 'bad_plush_id'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  update public.player_state set care_at = now() where user_id = p_user and (care_at is null or now() - care_at > interval '0.8 seconds');
  if not found then raise exception 'rapido_demais'; end if;
  gain := case p_kind when 'f' then 6 when 'l' then 2 when 'p' then 5 else null end;
  if gain is null then raise exception 'acao_invalida'; end if;
  if p_kind = 'f' then fd := public.g_item_add(p_user, 'food', -1);
  else select qty into fd from public.inventory where user_id = p_user and item = 'food'; end if;
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, 0) on conflict (user_id, plush_id) do nothing;
  select case when pc.care_dia = hoje then pc.care_xp_dia else 0 end into ja from public.plush_care pc where pc.user_id = p_user and pc.plush_id = p_plush;
  gain := greatest(0, least(gain, 30 - coalesce(ja, 0)));
  x := public.g_xp_add(p_user, p_plush, gain);
  update public.plush_care set f = least(greatest(p_f,0),100), l = least(greatest(p_l,0),100), p = least(greatest(p_p,0),100),
    care_dia = hoje, care_xp_dia = coalesce(ja, 0) + gain, updated_at = now()
  where user_id = p_user and plush_id = p_plush;
  perform public.g_count(p_user, case p_kind when 'f' then 'feed' when 'l' then 'pet' else 'play' end, 1);
  return query select x, coalesce(fd, 0);
end; $$;

create or replace function public.rpc_battle(p_user uuid, p_plush integer, p_win boolean)
returns table(coins integer, xp integer, paid boolean) language plpgsql security definer set search_path = public as $$
declare c integer; x integer; pay boolean := false; st public.player_state;
begin
  if p_plush < 0 or p_plush >= 57 then raise exception 'bad_plush_id'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  select * into st from public.player_state where user_id = p_user for update;
  if st.battle_at is not null and now() - st.battle_at < interval '3 seconds' then raise exception 'rapido_demais'; end if;
  if st.battle_hour_start is null or now() - st.battle_hour_start > interval '1 hour' then st.battle_hour_start := now(); st.battle_coins := 0; end if;
  if p_win and st.battle_coins < 5 then pay := true; st.battle_coins := st.battle_coins + 1; end if;
  update public.player_state set battle_at = now(), battle_hour_start = st.battle_hour_start, battle_coins = st.battle_coins,
    coins = player_state.coins + (case when pay then 1 else 0 end)
  where user_id = p_user returning player_state.coins into c;
  x := public.g_xp_add(p_user, p_plush, case when p_win then 10 else 4 end);
  if p_win then perform public.g_count(p_user,'battle_win',1); end if;
  return query select c, x, pay;
end; $$;

-- só a Edge Function (service_role) chama as ações
do $$ declare f text; begin
  foreach f in array array['rpc_buy(uuid,text)','rpc_use_stone(uuid,integer,integer,integer,integer)','rpc_rebirth(uuid,integer)',
    'rpc_capture(uuid,integer,real)','rpc_giant_round_start(uuid)','rpc_egg_round_start(uuid,integer,real)',
    'rpc_epic_round_start(uuid,integer,real)','rpc_epic_capture(uuid,integer,integer)',
    'rpc_adv_start(uuid,integer,text,text,integer,integer,integer)','rpc_care(uuid,integer,text,real,real,real)','rpc_battle(uuid,integer,boolean)',
    'g_tem_normais(uuid)','g_tem_gigantes(uuid)','g_tem_lendarios(uuid)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
