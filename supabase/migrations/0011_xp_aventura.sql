-- 0011 — Aventura: XP por bichinho derrotado e curva de níveis nova (cada nível pede mais XP que o anterior, como no Pokémon).
-- Só ESTADO no banco (o XP de cada bichinho já existia). As regras ficam em data/regras.json (NIVEL) e data/aventura.json (xp);
-- aqui só estão as mesmas contas para o servidor conferir. XP total para o nível N: linear×(N−1) + round(0,012×(N−1)³),
-- com linear 4 (grandes e lendários, até o Nv 100) ou 5 (redondos, até o Nv 30).

create or replace function public.g_xp_total(p_plush integer, p_lv integer)
returns integer language sql immutable as $$
  select (case when p_plush < 20 or p_plush >= 43 then 4 else 5 end) * n + round(12 * (n::numeric ^ 3) / 1000)::integer
  from (select greatest(0, least(p_lv, case when p_plush < 20 or p_plush >= 43 then 100 else 30 end) - 1) as n) q
$$;

-- nível que um XP dá (o maior nível cujo XP total cabe)
create or replace function public.g_lv_xp(p_plush integer, p_xp integer)
returns integer language sql immutable as $$
  select max(l) from generate_series(1, case when p_plush < 20 or p_plush >= 43 then 100 else 30 end) l
  where public.g_xp_total(p_plush, l) <= greatest(0, p_xp)
$$;

create or replace function public.g_xp_cap(p_plush integer)
returns integer language sql immutable as $$ select public.g_xp_total(p_plush, 100) $$;

create or replace function public.g_level(p_user uuid, p_plush integer)
returns integer language sql stable security definer set search_path = public as $$
  select public.g_lv_xp(p_plush, coalesce(max(xp), 0)) from public.plush_care where user_id = p_user and plush_id = p_plush
$$;

-- converte uma vez o XP salvo da escala antiga (4 ou 5 XP por nível) para a nova, mantendo o nível de cada bichinho
update public.plush_care pc set xp = case
  when old_lv >= cap then public.g_xp_total(pc.plush_id, cap)
  else public.g_xp_total(pc.plush_id, old_lv) + floor((pc.xp - (old_lv - 1) * dv)::numeric / dv * (public.g_xp_total(pc.plush_id, old_lv + 1) - public.g_xp_total(pc.plush_id, old_lv)))::integer end
from (select user_id, plush_id, xp as xp0,
        case when plush_id < 20 or plush_id >= 43 then 4 else 5 end as dv,
        case when plush_id < 20 or plush_id >= 43 then 100 else 30 end as cap,
        least(case when plush_id < 20 or plush_id >= 43 then 100 else 30 end, 1 + xp / case when plush_id < 20 or plush_id >= 43 then 4 else 5 end) as old_lv
      from public.plush_care) o
where o.user_id = pc.user_id and o.plush_id = pc.plush_id and pc.xp > 0;

-- XP de um inimigo derrotado (fórmula do Pokémon, 5ª geração): (k × nível do inimigo ÷ 5) × ((2×inimigo+10) ÷ (inimigo+seu nível+10))^2,5 + 1
create or replace function public.g_kill_xp(p_enemy_lv integer, p_my_lv integer, p_k real)
returns integer language sql immutable as $$
  select floor(p_k * p_enemy_lv / 5.0 * (((2.0 * p_enemy_lv + 10) / (p_enemy_lv + p_my_lv + 10)) ^ 2.5) + 1)::integer
$$;

-- missão "leve um bichinho grande ao Nv N" passa a usar a curva nova
create or replace function public.g_progress(p_user uuid, p_kind text, p_daily boolean)
returns integer language plpgsql stable security definer set search_path = public as $$
declare v integer;
begin
  if p_kind = 'distinct' then select count(*) into v from public.collection where user_id = p_user and count > 0; return coalesce(v,0); end if;
  if p_kind = 'level_big' then
    select coalesce(max(public.g_lv_xp(pc.plush_id, pc.xp)),0) into v from public.plush_care pc
      join public.collection c on c.user_id = pc.user_id and c.plush_id = pc.plush_id and c.count > 0
      where pc.user_id = p_user and pc.plush_id < 20;
    return coalesce(v,0);
  end if;
  if p_daily then select case when day = public.g_today() then day_count else 0 end into v from public.mission_counters where user_id = p_user and kind = p_kind;
  else select total into v from public.mission_counters where user_id = p_user and kind = p_kind;
    if p_kind = 'capture' then v := greatest(coalesce(v,0), (select coalesce(sum(count),0) from public.collection where user_id = p_user)); end if;
  end if;
  return coalesce(v,0);
end; $$;

-- ovo choca: nasce no nível pedido (a curva fica no servidor)
drop function if exists public.rpc_egg_care(uuid, bigint, integer);
create or replace function public.rpc_egg_care(p_user uuid, p_egg bigint, p_birth_lv integer)
returns table(days integer, counted boolean, hint integer, hatched boolean, nasceu integer, xp integer)
language plpgsql security definer set search_path = public as $$
declare r public.legendary_eggs; today date := public.g_today(); cnt boolean := false; h integer; done boolean := false; pid integer := null; x integer := null;
begin
  if p_birth_lv < 1 or p_birth_lv > 100 then raise exception 'regra_invalida'; end if;
  select * into r from public.legendary_eggs where id = p_egg and user_id = p_user for update;
  if not found then raise exception 'sem_ovo'; end if;
  if r.hatched_at is not null then raise exception 'ja_chocou'; end if;
  if r.last_day is distinct from today then r.days := r.days + 1; r.last_day := today; cnt := true; end if;
  h := least(3, floor(r.days * 4.0 / r.need_days)::integer);
  if r.days >= r.need_days then
    done := true; pid := 43 + r.leg;
    insert into public.collection (user_id, plush_id, count) values (p_user, pid, 1)
    on conflict (user_id, plush_id) do update set count = collection.count + 1;
    insert into public.plush_care (user_id, plush_id, xp) values (p_user, pid, public.g_xp_total(pid, p_birth_lv))
    on conflict (user_id, plush_id) do update set xp = greatest(plush_care.xp, public.g_xp_total(pid, p_birth_lv)), updated_at = now() returning plush_care.xp into x;
  end if;
  update public.legendary_eggs set days = r.days, last_day = r.last_day, hint = h, hatched_at = case when done then now() else null end where id = r.id;
  if cnt then perform public.g_count(p_user, 'pet', 1); end if;
  return query select r.days::integer, cnt, h, done, pid, x;
end; $$;

-- fim da partida da Aventura: agora também dá XP pelos bichinhos derrotados
drop function if exists public.rpc_adv_end(uuid,text,boolean,integer,integer,integer,integer,integer,integer,boolean,real,integer[],text,text[],integer,integer,integer,real,integer,integer);
create or replace function public.rpc_adv_end(p_user uuid, p_stage text, p_win boolean, p_stars integer, p_reward integer,
  p_xp_win integer, p_xp_lose integer, p_min_sec integer, p_min_lv integer, p_boss boolean, p_chance real, p_stones integer[],
  p_world text default null, p_world_stages text[] default null, p_boss_diamonds integer default 0, p_world_diamonds integer default 0,
  p_leg integer default -1, p_leg_chance real default 0, p_egg_min integer default 7, p_egg_max integer default 90,
  p_kills integer default 0, p_kill_lv integer default 1, p_boss_kill boolean default false, p_xp_k real default 0, p_xp_boss real default 1, p_max_kills integer default 0)
returns table(coins integer, xp integer, first boolean, stone integer, stars integer, diamonds integer, diamonds_got integer, egg_leg integer)
language plpgsql security definer set search_path = public as $$
declare run public.adventure_run; hl integer; kx integer := 0; c integer; x integer; fst boolean := false; st integer := -1; s integer := least(3, greatest(1, p_stars));
  got integer := 0; d integer; egg integer := -1; n3 integer;
begin
  if p_reward < 0 or p_reward > 5 or p_chance < 0 or p_chance > 0.5 or p_boss_diamonds < 0 or p_boss_diamonds > 5 or p_world_diamonds < 0 or p_world_diamonds > 5
     or p_leg < -1 or p_leg > 9 or p_leg_chance < 0 or p_leg_chance > 0.25
     or p_kills < 0 or p_kills > p_max_kills or p_kill_lv < 1 or p_kill_lv > 100 or p_xp_k < 0 or p_xp_k > 5 or p_xp_boss < 1 or p_xp_boss > 5 then raise exception 'regra_invalida'; end if;
  select * into run from public.adventure_run where user_id = p_user for update;
  if not found or run.stage <> p_stage then raise exception 'sem_partida'; end if;
  if p_win then
    if now() - run.started_at < make_interval(secs => p_min_sec) then raise exception 'rapido_demais'; end if;
    if public.g_level(p_user, run.plush_id) < p_min_lv then raise exception 'nivel_baixo'; end if;
  end if;
  delete from public.adventure_run where user_id = p_user;
  if p_win then
    insert into public.adventure_progress (user_id, stage, stars, wins) values (p_user, p_stage, s, 1)
    on conflict (user_id, stage) do update set stars = greatest(adventure_progress.stars, excluded.stars), wins = adventure_progress.wins + 1
    returning (xmax = 0) into fst;
    if fst and p_reward > 0 then update public.player_state set coins = player_state.coins + p_reward where user_id = p_user; end if;
    if p_boss and array_length(p_stones, 1) > 0 and random() < p_chance then
      st := p_stones[1 + floor(random() * array_length(p_stones, 1))::integer];
      perform public.g_item_add(p_user, 'stone_' || st, 1);
    end if;
    -- 💎 na 1ª vitória contra o chefão do mundo
    if p_boss then got := got + public.g_award(p_user, 'chefe_' || p_stage, p_boss_diamonds); end if;
    -- 💎 quando todas as fases do mundo têm 3 estrelas
    if p_world is not null and array_length(p_world_stages, 1) > 0 then
      select count(*) into n3 from public.adventure_progress ap where ap.user_id = p_user and ap.stage = any(p_world_stages) and ap.stars >= 3;
      if n3 = array_length(p_world_stages, 1) then got := got + public.g_award(p_user, 'mundo3_' || p_world, p_world_diamonds); end if;
    end if;
    -- Desafio Lendário: o ovo é sorteado só na 1ª vitória do dia
    if p_leg >= 0 then
      update public.player_state set leg_roll_day = public.g_today() where user_id = p_user and leg_roll_day is distinct from public.g_today();
      if found and random() < p_leg_chance then perform public.g_egg_new(p_user, p_leg, p_egg_min, p_egg_max, 'desafio'); egg := p_leg; end if;
    end if;
    perform public.g_count(p_user, 'adventure', 1);
  end if;
  -- XP por bichinho derrotado (o servidor limita pelo máximo da fase e usa o nível mais alto da fase: nunca dá mais do que o possível)
  hl := public.g_level(p_user, run.plush_id);
  kx := p_kills * public.g_kill_xp(p_kill_lv, hl, p_xp_k) + case when p_boss_kill and p_win then round(p_xp_boss * public.g_kill_xp(p_kill_lv, hl, p_xp_k))::integer else 0 end;
  x := public.g_xp_add(p_user, run.plush_id, (case when p_win then p_xp_win else p_xp_lose end) + kx);
  select ps.coins, ps.diamonds into c, d from public.player_state ps where ps.user_id = p_user;
  return query select c, x, fst, st, s, d, got, egg;
end; $$;

do $$ declare f text; begin
  foreach f in array array['g_xp_total(integer,integer)','g_lv_xp(integer,integer)','g_kill_xp(integer,integer,real)','g_level(uuid,integer)','rpc_egg_care(uuid,bigint,integer)',
    'rpc_adv_end(uuid,text,boolean,integer,integer,integer,integer,integer,integer,boolean,real,integer[],text,text[],integer,integer,integer,real,integer,integer,integer,integer,boolean,real,real,integer)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
