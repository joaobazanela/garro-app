-- 0016 — Bolinhas: os redondos 20..39 passam a ser a "bolinha" de cada grande (20+k ↔ grande k, mesmo elemento e pedra).
--  • 10 bolinhas iguais + 5 pedras do grupo = o grande evoluído (novo entra no Nv 1; se já tinha o grande, ele evolui e mantém o nível);
--  • os redondos 40, 41 e 42 foram aposentados (saem da máquina e da coleção completa; quem tem continua com eles no banco);
--  • a coleção completa de normais agora são 40 (grandes 0..19 + bolinhas 20..39).
-- As quantidades vêm do data/regras.json (EVOLUCAO.bolinhas e EVOLUCAO.pedras) pela sync-estado; o banco só aceita valores sensatos.

-- pedra de cada bichinho (bolinha 20+k = pedra do grande k)
create or replace function public.g_stone_of(p_plush integer)
returns integer language sql immutable as $$
  select (array[2,1,0,1,7,3,1,1,0,6,3,0,1,2,7,1,0,6,4,6,2,1,0,1,7,3,1,1,0,6,3,0,1,2,7,1,0,6,4,6,1,6,3])[p_plush + 1]
$$;

create or replace function public.g_tem_normais(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select count(*) = 40 from public.collection where user_id = p_user and plush_id < 40 and count >= 1 $$;

-- na máquina só ficam as bolinhas (20..39)
create or replace function public.rpc_capture(p_user uuid, p_plush_id integer, p_chance real)
returns table(coins integer, wins integer, count integer, plush_id integer, transformed boolean)
language plpgsql security definer set search_path = public as $$
declare updated_coins integer; updated_wins integer; updated_count integer; pid integer := p_plush_id; tr boolean := false;
begin
  if p_plush_id < 20 or p_plush_id >= 40 then raise exception 'bad_plush_id'; end if;
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

-- 10 bolinhas + 5 pedras = grande evoluído
create or replace function public.rpc_bolinha_evolve(p_user uuid, p_plush integer, p_balls integer, p_stones integer)
returns table(balls integer, stones integer, plush integer, count integer, xp integer, evolved boolean)
language plpgsql security definer set search_path = public as $$
declare g integer := p_plush - 20; b integer; q integer; n integer; x integer;
begin
  if p_plush < 20 or p_plush >= 40 or p_balls < 2 or p_balls > 50 or p_stones < 1 or p_stones > 20 then raise exception 'regra_invalida'; end if;
  update public.collection c set count = c.count - p_balls
  where c.user_id = p_user and c.plush_id = p_plush and c.count >= p_balls
  returning c.count into b;
  if not found then raise exception 'faltam_bolinhas'; end if;
  q := public.g_item_add(p_user, 'stone_' || public.g_stone_of(g), -p_stones);       -- sem pedras suficientes: sem_item (desfaz tudo)
  insert into public.collection (user_id, plush_id, count) values (p_user, g, 1)
  on conflict on constraint collection_pkey do update set count = collection.count + 1
  returning collection.count into n;
  insert into public.plush_care (user_id, plush_id, xp, evolved) values (p_user, g, 0, true)
  on conflict (user_id, plush_id) do update set evolved = true, stone_pending = 0, updated_at = now()
  returning plush_care.xp into x;
  perform public.g_count(p_user, 'stone', p_stones);
  perform public.g_count(p_user, 'capture', 1);
  return query select b, q, g, n, x, true;
end; $$;

do $$ declare f text; begin
  foreach f in array array['g_stone_of(integer)', 'g_tem_normais(uuid)', 'rpc_capture(uuid,integer,real)', 'rpc_bolinha_evolve(uuid,integer,integer,integer)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
