-- 0009 — Aventura: mapa de fases com lutas por turno.
-- Só ESTADO no banco: fases vencidas (estrelas), energia de cada bichinho e a partida em andamento.
-- O conteúdo (fases, inimigos, níveis, prêmios, regras de energia) fica em data/aventura.json; a sync-estado
-- lê esse arquivo e passa os números para as funções abaixo, que conferem antes de gastar ou pagar.

create table if not exists public.adventure_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null check (stage ~ '^[a-z0-9_]{2,24}$'),
  stars smallint not null default 1 check (stars between 1 and 3),
  wins integer not null default 1 check (wins >= 0),
  first_at timestamptz not null default now(),
  primary key (user_id, stage)
);
-- energia por bichinho: "energy" vale no instante "since"; a cada recarga_min volta 1 até o máximo
create table if not exists public.adventure_energy (
  user_id uuid not null references public.profiles(id) on delete cascade,
  plush_id integer not null check (plush_id >= 0 and plush_id < 43),
  energy integer not null check (energy >= 0),
  since timestamptz not null default now(),
  primary key (user_id, plush_id)
);
-- partida em andamento (no máximo uma por jogador)
create table if not exists public.adventure_run (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plush_id integer not null,
  stage text not null,
  started_at timestamptz not null default now()
);
alter table public.adventure_progress enable row level security;
alter table public.adventure_energy enable row level security;
alter table public.adventure_run enable row level security;
create policy "adventure_progress: leitura própria" on public.adventure_progress for select using (auth.uid() = user_id);
create policy "adventure_energy: leitura própria" on public.adventure_energy for select using (auth.uid() = user_id);
grant select on public.adventure_progress, public.adventure_energy to authenticated;

-- nível a partir do XP (igual ao jogo: grandes 4 XP por nível até o Nv 100; redondos 5 XP por nível até o Nv 30)
create or replace function public.g_level(p_user uuid, p_plush integer)
returns integer language sql stable security definer set search_path = public as $$
  select case when p_plush < 20 then least(100, 1 + coalesce(max(xp),0) / 4) else least(30, 1 + coalesce(max(xp),0) / 5) end
  from public.plush_care where user_id = p_user and plush_id = p_plush
$$;

-- energia atual (já com a recarga do tempo que passou); trava a linha
create or replace function public.g_adv_energy(p_user uuid, p_plush integer, p_max integer, p_regen_min integer)
returns integer language plpgsql security definer set search_path = public as $$
declare r public.adventure_energy; n integer; step interval := make_interval(mins => p_regen_min);
begin
  insert into public.adventure_energy (user_id, plush_id, energy, since) values (p_user, p_plush, p_max, now())
  on conflict (user_id, plush_id) do nothing;
  select * into r from public.adventure_energy where user_id = p_user and plush_id = p_plush for update;
  if r.energy >= p_max then return p_max; end if;
  n := floor(extract(epoch from (now() - r.since)) / extract(epoch from step))::integer;
  if n > 0 then
    r.energy := least(p_max, r.energy + n);
    r.since := case when r.energy >= p_max then now() else r.since + step * n end;
    update public.adventure_energy set energy = r.energy, since = r.since where user_id = p_user and plush_id = p_plush;
  end if;
  return r.energy;
end; $$;

-- começar uma fase: precisa ter o bichinho, a fase anterior vencida e 1 de energia
create or replace function public.rpc_adv_start(p_user uuid, p_plush integer, p_stage text, p_prev text, p_max integer, p_regen_min integer)
returns table(energy integer, since timestamptz) language plpgsql security definer set search_path = public as $$
declare e integer; s timestamptz;
begin
  if p_plush < 0 or p_plush >= 43 then raise exception 'bad_plush_id'; end if;
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

-- terminar a fase. Vitória: só conta se a partida começou de verdade, durou o mínimo e o bichinho tem nível
-- para aquela fase. 1ª vitória na fase paga p_reward moedas; o chefe tem p_chance de soltar uma pedra.
create or replace function public.rpc_adv_end(p_user uuid, p_stage text, p_win boolean, p_stars integer, p_reward integer,
  p_xp_win integer, p_xp_lose integer, p_min_sec integer, p_min_lv integer, p_boss boolean, p_chance real, p_stones integer[])
returns table(coins integer, xp integer, first boolean, stone integer, stars integer)
language plpgsql security definer set search_path = public as $$
declare run public.adventure_run; c integer; x integer; fst boolean := false; st integer := -1; s integer := least(3, greatest(1, p_stars));
begin
  if p_reward < 0 or p_reward > 5 or p_chance < 0 or p_chance > 0.5 then raise exception 'regra_invalida'; end if;
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
    perform public.g_count(p_user, 'adventure', 1);
  end if;
  x := public.g_xp_add(p_user, run.plush_id, case when p_win then p_xp_win else p_xp_lose end);
  select ps.coins into c from public.player_state ps where ps.user_id = p_user;
  return query select c, x, fst, st, s;
end; $$;

-- descansar: enche a energia do bichinho pagando moedas
create or replace function public.rpc_adv_rest(p_user uuid, p_plush integer, p_cost integer, p_max integer, p_regen_min integer)
returns table(coins integer, energy integer) language plpgsql security definer set search_path = public as $$
declare c integer; e integer;
begin
  if p_cost < 1 then raise exception 'regra_invalida'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  e := public.g_adv_energy(p_user, p_plush, p_max, p_regen_min);
  if e >= p_max then raise exception 'ja_descansado'; end if;
  c := public.g_spend(p_user, p_cost);
  update public.adventure_energy set energy = p_max, since = now() where user_id = p_user and plush_id = p_plush;
  return query select c, p_max;
end; $$;

-- só a Edge Function (service_role) chama as ações
do $$ declare f text; begin
  foreach f in array array['g_level(uuid,integer)','g_adv_energy(uuid,integer,integer,integer)',
    'rpc_adv_start(uuid,integer,text,text,integer,integer)',
    'rpc_adv_end(uuid,text,boolean,integer,integer,integer,integer,integer,integer,boolean,real,integer[])',
    'rpc_adv_rest(uuid,integer,integer,integer,integer)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
