-- 0010 — Lendários: diamantes 💎, ovos que chocam com carinho e a máquina de ovos.
-- Só ESTADO no banco: diamantes, ovos de cada jogador (com os dias secretos para chocar) e prêmios já dados.
-- O conteúdo (nomes, artes, preços, chances, dias mínimo/máximo) fica em data/lendarios.json; a sync-estado lê
-- esse arquivo e passa os números para as funções abaixo, que conferem limites antes de gastar ou dar algo.
-- Ids das pelúcias: 0–19 grandes, 20–42 redondas, 43–52 lendários (lendário = índice 0–9 + 43).

-- ---------- estado ----------
alter table public.player_state add column if not exists diamonds integer not null default 0;
alter table public.player_state drop constraint if exists player_state_diamonds_check;
alter table public.player_state add constraint player_state_diamonds_check check (diamonds >= 0);
alter table public.player_state add column if not exists pending_egg boolean not null default false;
alter table public.player_state add column if not exists egg_firm boolean not null default false;  -- jogada atual: a garra segura firme o ovo lendário?
alter table public.player_state add column if not exists leg_roll_day date;  -- dia em que já sorteou o ovo do Desafio Lendário

-- lendários entram na coleção, no cuidado e na energia da Aventura
alter table public.collection drop constraint if exists collection_plush_id_check;
alter table public.collection add constraint collection_plush_id_check check (plush_id >= 0 and plush_id < 53);
alter table public.plush_care drop constraint if exists plush_care_plush_id_check;
alter table public.plush_care add constraint plush_care_plush_id_check check (plush_id >= 0 and plush_id < 53);
alter table public.adventure_energy drop constraint if exists adventure_energy_plush_id_check;
alter table public.adventure_energy add constraint adventure_energy_plush_id_check check (plush_id >= 0 and plush_id < 53);

-- ovos: need_days é SECRETO (o jogador não lê essa coluna); o jogo só mostra a dica (hint 0–3)
create table if not exists public.legendary_eggs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  leg smallint not null check (leg between 0 and 9),
  need_days smallint not null check (need_days between 1 and 365),
  days smallint not null default 0 check (days >= 0),
  last_day date,
  hint smallint not null default 0 check (hint between 0 and 3),
  source text not null check (source in ('maquina','desafio','loja')),
  created_at timestamptz not null default now(),
  hatched_at timestamptz
);
create index if not exists legendary_eggs_user on public.legendary_eggs (user_id);

-- prêmios de diamante que só podem sair uma vez (chefão de cada mundo, 3 estrelas em todo o mundo)
create table if not exists public.diamond_awards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  award text not null check (award ~ '^[a-z0-9_]{2,40}$'),
  at timestamptz not null default now(),
  primary key (user_id, award)
);

alter table public.legendary_eggs enable row level security;
alter table public.diamond_awards enable row level security;
create policy "legendary_eggs: leitura própria" on public.legendary_eggs for select using (auth.uid() = user_id);
create policy "diamond_awards: leitura própria" on public.diamond_awards for select using (auth.uid() = user_id);
revoke all on public.legendary_eggs from anon, authenticated;
grant select (id, user_id, leg, days, last_day, hint, source, created_at, hatched_at) on public.legendary_eggs to authenticated;
revoke all on public.diamond_awards from anon, authenticated;
grant select on public.diamond_awards to authenticated;

-- ---------- ajudantes ----------
-- lendários usam a regra dos grandes: 4 XP por nível, até o Nv 100
create or replace function public.g_xp_cap(p_plush integer)
returns integer language sql immutable as $$ select case when p_plush < 20 or p_plush >= 43 then 396 else 145 end $$;

create or replace function public.g_level(p_user uuid, p_plush integer)
returns integer language sql stable security definer set search_path = public as $$
  select case when p_plush < 20 or p_plush >= 43 then least(100, 1 + coalesce(max(xp),0) / 4) else least(30, 1 + coalesce(max(xp),0) / 5) end
  from public.plush_care where user_id = p_user and plush_id = p_plush
$$;

create or replace function public.g_diamonds_add(p_user uuid, p_n integer)
returns integer language plpgsql security definer set search_path = public as $$
declare d integer;
begin
  update public.player_state set diamonds = player_state.diamonds + p_n where user_id = p_user and player_state.diamonds + p_n >= 0 returning player_state.diamonds into d;
  if not found then raise exception 'sem_diamantes'; end if;
  return d;
end; $$;

-- dá um prêmio único; devolve quantos diamantes deu (0 se já tinha ganhado)
create or replace function public.g_award(p_user uuid, p_award text, p_n integer)
returns integer language plpgsql security definer set search_path = public as $$
begin
  if p_n <= 0 then return 0; end if;
  insert into public.diamond_awards (user_id, award) values (p_user, p_award) on conflict do nothing;
  if not found then return 0; end if;
  perform public.g_diamonds_add(p_user, p_n);
  return p_n;
end; $$;

-- ovo novo: sorteia em segredo quantos dias de carinho ele precisa para chocar
create or replace function public.g_egg_new(p_user uuid, p_leg integer, p_min integer, p_max integer, p_source text)
returns bigint language plpgsql security definer set search_path = public as $$
declare e bigint;
begin
  if p_leg < 0 or p_leg > 9 or p_min < 1 or p_max < p_min or p_max > 365 then raise exception 'regra_invalida'; end if;
  insert into public.legendary_eggs (user_id, leg, need_days, source)
  values (p_user, p_leg, p_min + floor(random() * (p_max - p_min + 1))::integer, p_source) returning id into e;
  return e;
end; $$;

-- ---------- máquina de ovos ----------
-- A caixa tem ovos comuns (nunca viram lendário, dão p_fake moedas) e o ovo do lendário do dia no meio.
-- Os ovos são lisos: no começo da jogada o servidor sorteia se a garra vai segurar firme o ovo lendário (p_grip).
-- Se não for firme, o ovo escorrega na tela; pedir o ovo lendário sem firme é recusado.
drop function if exists public.rpc_egg_round_start(uuid, integer);
create or replace function public.rpc_egg_round_start(p_user uuid, p_cost integer, p_grip real)
returns table(coins integer, wins integer, firm boolean) language plpgsql security definer set search_path = public as $$
declare c integer; w integer; f boolean := random() < p_grip;
begin
  if p_cost < 50 or p_cost > 5000 or p_grip < 0 or p_grip > 0.5 then raise exception 'regra_invalida'; end if;
  update public.player_state set coins = player_state.coins - p_cost, pending_egg = true, egg_firm = f, last_action_at = now()
  where user_id = p_user and player_state.coins >= p_cost
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'egg_round_rejected'; end if;
  return query select c, w, f;
end; $$;

-- pegou um ovo: comum dá p_fake moedas; lendário (o do dia, p_leg vem da sync-estado) só se a jogada era firme
drop function if exists public.rpc_egg_capture(uuid, integer, real, integer, integer, integer);
create or replace function public.rpc_egg_capture(p_user uuid, p_real boolean, p_leg integer, p_fake integer, p_min integer, p_max integer)
returns table(coins integer, real_egg boolean, egg_id bigint, leg integer)
language plpgsql security definer set search_path = public as $$
declare c integer; f boolean; e bigint := null;
begin
  if p_leg < 0 or p_leg > 9 or p_fake < 0 or p_fake > 10 then raise exception 'regra_invalida'; end if;
  update public.player_state set pending_egg = false, last_action_at = now()
  where user_id = p_user and pending_egg = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'
  returning player_state.coins, player_state.egg_firm into c, f;
  if not found then raise exception 'egg_capture_rejected'; end if;
  if p_real then
    if not f then raise exception 'egg_not_firm'; end if;
    e := public.g_egg_new(p_user, p_leg, p_min, p_max, 'maquina');
  elsif p_fake > 0 then
    update public.player_state set coins = player_state.coins + p_fake where user_id = p_user returning player_state.coins into c;
  end if;
  perform public.g_count(p_user, 'capture', 1);
  return query select c, p_real, e, p_leg;
end; $$;

-- loja: ovo por diamantes
create or replace function public.rpc_egg_buy(p_user uuid, p_leg integer, p_price integer, p_min integer, p_max integer)
returns table(diamonds integer, egg_id bigint, leg integer) language plpgsql security definer set search_path = public as $$
declare d integer; e bigint;
begin
  if p_price < 10 or p_price > 1000 then raise exception 'regra_invalida'; end if;
  d := public.g_diamonds_add(p_user, -p_price);
  e := public.g_egg_new(p_user, p_leg, p_min, p_max, 'loja');
  return query select d, e, p_leg;
end; $$;

-- carinho no ovo: conta no máximo 1 dia por dia (horário de Brasília); pular dias não zera.
-- Quando completa os dias secretos, choca: o lendário entra na coleção já no nível de nascer.
create or replace function public.rpc_egg_care(p_user uuid, p_egg bigint, p_birth_xp integer)
returns table(days integer, counted boolean, hint integer, hatched boolean, nasceu integer, xp integer)
language plpgsql security definer set search_path = public as $$
declare r public.legendary_eggs; today date := public.g_today(); cnt boolean := false; h integer; done boolean := false; pid integer := null; x integer := null;
begin
  if p_birth_xp < 0 or p_birth_xp > 396 then raise exception 'regra_invalida'; end if;
  select * into r from public.legendary_eggs where id = p_egg and user_id = p_user for update;
  if not found then raise exception 'sem_ovo'; end if;
  if r.hatched_at is not null then raise exception 'ja_chocou'; end if;
  if r.last_day is distinct from today then r.days := r.days + 1; r.last_day := today; cnt := true; end if;
  h := least(3, floor(r.days * 4.0 / r.need_days)::integer);
  if r.days >= r.need_days then
    done := true; pid := 43 + r.leg;
    insert into public.collection (user_id, plush_id, count) values (p_user, pid, 1)
    on conflict (user_id, plush_id) do update set count = collection.count + 1;
    insert into public.plush_care (user_id, plush_id, xp) values (p_user, pid, p_birth_xp)
    on conflict (user_id, plush_id) do update set xp = greatest(plush_care.xp, p_birth_xp), updated_at = now() returning plush_care.xp into x;
  end if;
  update public.legendary_eggs set days = r.days, last_day = r.last_day, hint = h, hatched_at = case when done then now() else null end where id = r.id;
  if cnt then perform public.g_count(p_user, 'pet', 1); end if;
  return query select r.days::integer, cnt, h, done, pid, x;
end; $$;

-- ---------- diamante raro na máquina gigante (1%) ----------
drop function if exists public.rpc_giant_capture(uuid, integer);
create or replace function public.rpc_giant_capture(p_user uuid, p_plush integer, p_dchance real default 0)
returns table(coins integer, wins integer, count integer, giants integer, xp integer, diamond boolean, diamonds integer)
language plpgsql security definer set search_path = public as $$
declare c integer; w integer; n integer; g integer; x integer; dm boolean := false; d integer;
begin
  if p_plush < 0 or p_plush >= 20 then raise exception 'bad_plush_id'; end if;
  if p_dchance < 0 or p_dchance > 0.25 then raise exception 'regra_invalida'; end if;
  update public.player_state set wins = player_state.wins + 1, pending_giant = false, last_action_at = now()
  where user_id = p_user and pending_giant = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'  -- mesma regra anti-abuso da captura normal
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'giant_capture_rejected'; end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, p_plush, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1 returning collection.count into n;
  insert into public.giants (user_id, plush_id, count) values (p_user, p_plush, 1)
  on conflict (user_id, plush_id) do update set count = giants.count + 1 returning giants.count into g;
  x := public.g_xp_add(p_user, p_plush, 60);
  if random() < p_dchance then dm := true; d := public.g_diamonds_add(p_user, 1);
  else select ps.diamonds into d from public.player_state ps where ps.user_id = p_user; end if;
  perform public.g_count(p_user,'capture',1);
  perform public.g_count(p_user,'giant_capture',1);
  return query select c, w, n, g, x, dm, d;
end; $$;

-- ---------- aventura: diamantes do chefão / 3 estrelas no mundo e o ovo do Desafio Lendário ----------
drop function if exists public.rpc_adv_end(uuid,text,boolean,integer,integer,integer,integer,integer,integer,boolean,real,integer[]);
create or replace function public.rpc_adv_end(p_user uuid, p_stage text, p_win boolean, p_stars integer, p_reward integer,
  p_xp_win integer, p_xp_lose integer, p_min_sec integer, p_min_lv integer, p_boss boolean, p_chance real, p_stones integer[],
  p_world text default null, p_world_stages text[] default null, p_boss_diamonds integer default 0, p_world_diamonds integer default 0,
  p_leg integer default -1, p_leg_chance real default 0, p_egg_min integer default 7, p_egg_max integer default 90)
returns table(coins integer, xp integer, first boolean, stone integer, stars integer, diamonds integer, diamonds_got integer, egg_leg integer)
language plpgsql security definer set search_path = public as $$
declare run public.adventure_run; c integer; x integer; fst boolean := false; st integer := -1; s integer := least(3, greatest(1, p_stars));
  got integer := 0; d integer; egg integer := -1; n3 integer;
begin
  if p_reward < 0 or p_reward > 5 or p_chance < 0 or p_chance > 0.5 or p_boss_diamonds < 0 or p_boss_diamonds > 5 or p_world_diamonds < 0 or p_world_diamonds > 5
     or p_leg < -1 or p_leg > 9 or p_leg_chance < 0 or p_leg_chance > 0.25 then raise exception 'regra_invalida'; end if;
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
  x := public.g_xp_add(p_user, run.plush_id, case when p_win then p_xp_win else p_xp_lose end);
  select ps.coins, ps.diamonds into c, d from public.player_state ps where ps.user_id = p_user;
  return query select c, x, fst, st, s, d, got, egg;
end; $$;

-- ---------- lendários podem cuidar, batalhar e ir na Aventura (ids até 52) ----------
create or replace function public.rpc_care(p_user uuid, p_plush integer, p_kind text, p_f real, p_l real, p_p real)
returns table(xp integer, food integer) language plpgsql security definer set search_path = public as $$
declare x integer; fd integer; gain integer;
begin
  if p_plush < 0 or p_plush >= 53 then raise exception 'bad_plush_id'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  update public.player_state set care_at = now() where user_id = p_user and (care_at is null or now() - care_at > interval '0.8 seconds');
  if not found then raise exception 'rapido_demais'; end if;
  gain := case p_kind when 'f' then 6 when 'l' then 2 when 'p' then 5 else null end;
  if gain is null then raise exception 'acao_invalida'; end if;
  if p_kind = 'f' then fd := public.g_item_add(p_user, 'food', -1);
  else select qty into fd from public.inventory where user_id = p_user and item = 'food'; end if;
  x := public.g_xp_add(p_user, p_plush, gain);
  update public.plush_care set f = least(greatest(p_f,0),100), l = least(greatest(p_l,0),100), p = least(greatest(p_p,0),100), updated_at = now()
  where user_id = p_user and plush_id = p_plush;
  perform public.g_count(p_user, case p_kind when 'f' then 'feed' when 'l' then 'pet' else 'play' end, 1);
  return query select x, coalesce(fd, 0);
end; $$;

create or replace function public.rpc_battle(p_user uuid, p_plush integer, p_win boolean)
returns table(coins integer, xp integer, paid boolean) language plpgsql security definer set search_path = public as $$
declare c integer; x integer; pay boolean := false; st public.player_state;
begin
  if p_plush < 0 or p_plush >= 53 then raise exception 'bad_plush_id'; end if;
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

create or replace function public.rpc_adv_start(p_user uuid, p_plush integer, p_stage text, p_prev text, p_max integer, p_regen_min integer)
returns table(energy integer, since timestamptz) language plpgsql security definer set search_path = public as $$
declare e integer; s timestamptz;
begin
  if p_plush < 0 or p_plush >= 53 then raise exception 'bad_plush_id'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  if p_prev is not null then
    perform 1 from public.adventure_progress where user_id = p_user and stage = p_prev;
    if not found then raise exception 'fase_bloqueada'; end if;
  end if;
  e := public.g_adv_energy(p_user, p_plush, p_max, p_regen_min);
  if e < 1 then raise exception 'cansado'; end if;
  update public.adventure_energy ae set energy = e - 1, since = case when e >= p_max then now() else ae.since end
    where ae.user_id = p_user and ae.plush_id = p_plush returning ae.since into s;
  insert into public.adventure_run (user_id, plush_id, stage, started_at) values (p_user, p_plush, p_stage, now())
  on conflict (user_id) do update set plush_id = excluded.plush_id, stage = excluded.stage, started_at = now();
  return query select e - 1, s;
end; $$;

-- só a Edge Function (service_role) chama as ações
do $$ declare f text; begin
  foreach f in array array['g_diamonds_add(uuid,integer)','g_award(uuid,text,integer)','g_egg_new(uuid,integer,integer,integer,text)',
    'rpc_egg_round_start(uuid,integer,real)','rpc_egg_capture(uuid,boolean,integer,integer,integer,integer)','rpc_egg_buy(uuid,integer,integer,integer,integer)',
    'rpc_egg_care(uuid,bigint,integer)','rpc_giant_capture(uuid,integer,real)',
    'rpc_adv_end(uuid,text,boolean,integer,integer,integer,integer,integer,integer,boolean,real,integer[],text,text[],integer,integer,integer,real,integer,integer)',
    'rpc_care(uuid,integer,text,real,real,real)','rpc_battle(uuid,integer,boolean)','rpc_adv_start(uuid,integer,text,text,integer,integer)',
    'g_level(uuid,integer)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
