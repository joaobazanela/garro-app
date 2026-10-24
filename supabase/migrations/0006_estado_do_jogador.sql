-- 0006 — leva para o Supabase o ESTADO do jogador que ainda ficava só no aparelho.
-- Só estado (quantidades, XP, flags). Nenhum conteúdo do jogo (nomes, imagens, textos) entra no banco.
-- Regras de jogo usadas aqui (preços, XP por ação) são código versionado e precisam bater com data/regras.json.

-- ---------- tabelas ----------
-- inventário: 'food' e 'stone_0'..'stone_7'
create table if not exists public.inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null check (item = 'food' or item ~ '^stone_[0-9]$'),
  qty integer not null default 0 check (qty >= 0),
  primary key (user_id, item)
);

-- cuidado e XP de cada pelúcia (o nível é calculado a partir do XP no jogo)
create table if not exists public.plush_care (
  user_id uuid not null references public.profiles(id) on delete cascade,
  plush_id integer not null check (plush_id >= 0 and plush_id < 43),
  xp integer not null default 0 check (xp >= 0),
  f real not null default 60 check (f between 0 and 100),
  l real not null default 60 check (l between 0 and 100),
  p real not null default 60 check (p between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, plush_id)
);

-- pelúcias gigantes (só as 20 grandes)
create table if not exists public.giants (
  user_id uuid not null references public.profiles(id) on delete cascade,
  plush_id integer not null check (plush_id >= 0 and plush_id < 20),
  count integer not null default 0 check (count >= 0),
  evolved boolean not null default false,
  primary key (user_id, plush_id)
);

alter table public.player_state add column if not exists pending_giant boolean not null default false;
alter table public.player_state add column if not exists care_at timestamptz;
alter table public.player_state add column if not exists battle_at timestamptz;
alter table public.player_state add column if not exists battle_hour_start timestamptz;
alter table public.player_state add column if not exists battle_coins integer not null default 0;
alter table public.player_state add column if not exists imported_local boolean not null default false;

-- leitura só da própria linha; escrita só pela Edge Function (service_role)
alter table public.inventory enable row level security;
alter table public.plush_care enable row level security;
alter table public.giants enable row level security;
create policy "inventory: leitura própria" on public.inventory for select using (auth.uid() = user_id);
create policy "plush_care: leitura própria" on public.plush_care for select using (auth.uid() = user_id);
create policy "giants: leitura própria" on public.giants for select using (auth.uid() = user_id);
grant select on public.inventory, public.plush_care, public.giants to authenticated;

-- jogador novo começa com 3 comidas
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  insert into public.player_state (user_id) values (new.id);
  insert into public.inventory (user_id, item, qty) values (new.id, 'food', 3);
  return new;
end;
$$;

-- ---------- ajudantes ----------
create or replace function public.g_spend(p_user uuid, p_cost integer)
returns integer language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  update public.player_state set coins = coins - p_cost where user_id = p_user and coins >= p_cost returning coins into c;
  if not found then raise exception 'sem_moedas'; end if;
  return c;
end; $$;

create or replace function public.g_item_add(p_user uuid, p_item text, p_n integer)
returns integer language plpgsql security definer set search_path = public as $$
declare q integer;
begin
  if p_n < 0 then
    update public.inventory set qty = inventory.qty + p_n where user_id = p_user and item = p_item and inventory.qty + p_n >= 0 returning qty into q;
    if not found then raise exception 'sem_item'; end if;
  else
    insert into public.inventory (user_id, item, qty) values (p_user, p_item, p_n)
    on conflict (user_id, item) do update set qty = inventory.qty + p_n returning qty into q;
  end if;
  return q;
end; $$;

-- XP máximo: grandes até o Nv 100 (4 XP por nível), redondos até o Nv 30 (5 XP por nível)
create or replace function public.g_xp_cap(p_plush integer)
returns integer language sql immutable as $$ select case when p_plush < 20 then 396 else 145 end $$;

create or replace function public.g_xp_add(p_user uuid, p_plush integer, p_n integer)
returns integer language plpgsql security definer set search_path = public as $$
declare x integer;
begin
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, least(greatest(p_n,0), public.g_xp_cap(p_plush)))
  on conflict (user_id, plush_id) do update set xp = least(plush_care.xp + p_n, public.g_xp_cap(p_plush)), updated_at = now()
  returning xp into x;
  return x;
end; $$;


-- CORREÇÃO de bug antigo (0002): rpc_round_start e rpc_refill davam erro "column reference coins is ambiguous"
-- (o nome da coluna é igual ao da saída da função). Com isso a jogada nunca marcava pending_round no servidor
-- e a captura era recusada. Aqui as colunas ficam com o nome da tabela na frente.
create or replace function public.rpc_round_start(p_user uuid)
returns table(coins integer, wins integer) language plpgsql security definer set search_path = public as $$
declare c integer; w integer;
begin
  update public.player_state set coins = player_state.coins - 1, pending_round = true, last_action_at = now()
  where user_id = p_user and player_state.coins >= 1
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'round_start_rejected'; end if;
  return query select c, w;
end; $$;

create or replace function public.rpc_refill(p_user uuid)
returns table(coins integer, wins integer) language plpgsql security definer set search_path = public as $$
declare c integer; w integer;
begin
  update public.player_state set coins = player_state.coins + 15, last_action_at = now()
  where user_id = p_user and (last_action_at is null or now() - last_action_at > interval '20 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'refill_rejected'; end if;
  return query select c, w;
end; $$;

-- ---------- ações ----------
-- loja: comida 5, pedra 400
create or replace function public.rpc_buy(p_user uuid, p_item text)
returns table(coins integer, item text, qty integer)
language plpgsql security definer set search_path = public as $$
declare c integer; q integer;
begin
  if p_item = 'food' then c := public.g_spend(p_user, 5);
  elsif p_item ~ '^stone_[0-7]$' then c := public.g_spend(p_user, 400);
  else raise exception 'item_invalido'; end if;
  q := public.g_item_add(p_user, p_item, 1);
  return query select c, p_item, q;
end; $$;

-- trocar os bichinhos da máquina: 10
create or replace function public.rpc_swap(p_user uuid)
returns table(coins integer) language plpgsql security definer set search_path = public as $$
begin return query select public.g_spend(p_user, 10); end; $$;

-- máquina gigante: 50 por jogada
create or replace function public.rpc_giant_round_start(p_user uuid)
returns table(coins integer, wins integer) language plpgsql security definer set search_path = public as $$
declare c integer; w integer;
begin
  update public.player_state set coins = player_state.coins - 50, pending_giant = true, last_action_at = now()
  where user_id = p_user and player_state.coins >= 50
    and (last_action_at is null or now() - last_action_at > interval '1.5 seconds')
  returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'giant_round_rejected'; end if;
  return query select c, w;
end; $$;

-- pegou o gigante: +1 gigante, +1 na coleção, +60 XP
create or replace function public.rpc_giant_capture(p_user uuid, p_plush integer)
returns table(coins integer, wins integer, count integer, giants integer, xp integer)
language plpgsql security definer set search_path = public as $$
declare c integer; w integer; n integer; g integer; x integer;
begin
  if p_plush < 0 or p_plush >= 20 then raise exception 'bad_plush_id'; end if;
  update public.player_state set wins = player_state.wins + 1, pending_giant = false
  where user_id = p_user and pending_giant = true returning player_state.coins, player_state.wins into c, w;
  if not found then raise exception 'giant_capture_rejected'; end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, p_plush, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1 returning collection.count into n;
  insert into public.giants (user_id, plush_id, count) values (p_user, p_plush, 1)
  on conflict (user_id, plush_id) do update set count = giants.count + 1 returning giants.count into g;
  x := public.g_xp_add(p_user, p_plush, 60);
  return query select c, w, n, g, x;
end; $$;

-- vender gigante: +40
create or replace function public.rpc_sell_giant(p_user uuid, p_plush integer)
returns table(coins integer, giants integer) language plpgsql security definer set search_path = public as $$
declare c integer; g integer;
begin
  update public.giants set count = giants.count - 1, evolved = (giants.count - 1 > 0) and giants.evolved
  where user_id = p_user and plush_id = p_plush and giants.count >= 1 returning giants.count into g;
  if not found then raise exception 'sem_gigante'; end if;
  update public.player_state set coins = player_state.coins + 40 where user_id = p_user returning player_state.coins into c;
  return query select c, g;
end; $$;

-- evoluir gigante: 5 pedras (a pedra certa do elemento é escolhida pelo jogo)
create or replace function public.rpc_giant_evolve(p_user uuid, p_plush integer, p_stone integer)
returns table(stones integer) language plpgsql security definer set search_path = public as $$
declare q integer;
begin
  if p_stone < 0 or p_stone > 7 then raise exception 'pedra_invalida'; end if;
  perform 1 from public.giants where user_id = p_user and plush_id = p_plush and count >= 1 and not evolved;
  if not found then raise exception 'sem_gigante'; end if;
  q := public.g_item_add(p_user, 'stone_' || p_stone, -5);
  update public.giants set evolved = true where user_id = p_user and plush_id = p_plush;
  return query select q;
end; $$;

-- usar pedra: evolui na hora (leva o XP até o Nv 50 = 196 XP)
create or replace function public.rpc_use_stone(p_user uuid, p_plush integer, p_stone integer)
returns table(stones integer, xp integer) language plpgsql security definer set search_path = public as $$
declare q integer; x integer;
begin
  if p_plush < 0 or p_plush >= 20 or p_stone < 0 or p_stone > 7 then raise exception 'bad_request'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  q := public.g_item_add(p_user, 'stone_' || p_stone, -1);
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, 196)
  on conflict (user_id, plush_id) do update set xp = greatest(plush_care.xp, 196), updated_at = now() returning plush_care.xp into x;
  return query select q, x;
end; $$;

-- cuidar: comida (gasta 1, +6 XP), carinho (+2), brincar (+5). As barras são guardadas como o jogo mandou (0 a 100).
create or replace function public.rpc_care(p_user uuid, p_plush integer, p_kind text, p_f real, p_l real, p_p real)
returns table(xp integer, food integer) language plpgsql security definer set search_path = public as $$
declare x integer; fd integer; gain integer;
begin
  if p_plush < 0 or p_plush >= 43 then raise exception 'bad_plush_id'; end if;
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
  return query select x, coalesce(fd, 0);
end; $$;

-- batalha: vitória +10 XP e 1 moeda (no máximo 5 moedas por hora); derrota +4 XP
create or replace function public.rpc_battle(p_user uuid, p_plush integer, p_win boolean)
returns table(coins integer, xp integer, paid boolean) language plpgsql security definer set search_path = public as $$
declare c integer; x integer; pay boolean := false; st public.player_state;
begin
  if p_plush < 0 or p_plush >= 43 then raise exception 'bad_plush_id'; end if;
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
  return query select c, x, pay;
end; $$;

-- capturar repetida também dá XP: +20 nos grandes, +5 nos redondos (antes era só no aparelho)
create or replace function public.rpc_capture(p_user uuid, p_plush_id integer)
returns table(coins integer, wins integer, count integer)
language plpgsql security definer set search_path = public as $$
declare updated_coins integer; updated_wins integer; updated_count integer;
begin
  if p_plush_id < 0 or p_plush_id >= 43 then raise exception 'bad_plush_id'; end if;
  update public.player_state set wins = player_state.wins + 1, pending_round = false, last_action_at = now()
  where user_id = p_user and pending_round = true
  returning player_state.coins, player_state.wins into updated_coins, updated_wins;
  if not found then raise exception 'capture_rejected'; end if;
  insert into public.collection (user_id, plush_id, count) values (p_user, p_plush_id, 1)
  on conflict (user_id, plush_id) do update set count = collection.count + 1
  returning collection.count into updated_count;
  if updated_count > 1 then perform public.g_xp_add(p_user, p_plush_id, case when p_plush_id < 20 then 20 else 5 end); end if;
  return query select updated_coins, updated_wins, updated_count;
end; $$;

-- trazer, UMA vez, o que o jogador já tinha guardado no aparelho antes desta versão (com limites)
create or replace function public.rpc_import_local(p_user uuid, p_data jsonb)
returns table(done boolean) language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; i integer;
begin
  update public.player_state set imported_local = true where user_id = p_user and imported_local = false;
  if not found then return query select false; return; end if;
  if (p_data->>'food') is not null then
    insert into public.inventory (user_id,item,qty) values (p_user,'food',least(greatest((p_data->>'food')::int,0),50))
    on conflict (user_id,item) do update set qty = greatest(inventory.qty, excluded.qty);
  end if;
  if jsonb_typeof(p_data->'stones') = 'array' then
    for i in 0..least(jsonb_array_length(p_data->'stones'),8)-1 loop
      insert into public.inventory (user_id,item,qty) values (p_user,'stone_'||i,least(greatest(((p_data->'stones')->>i)::int,0),10))
      on conflict (user_id,item) do update set qty = greatest(inventory.qty, excluded.qty);
    end loop;
  end if;
  -- capturas que ficaram só no aparelho (por causa do erro do rpc_round_start), no máximo 3 de cada
  if jsonb_typeof(p_data->'coll') = 'object' then
    for k, v in select * from jsonb_each(p_data->'coll') loop
      i := k::int;
      if i >= 0 and i < 43 and jsonb_typeof(v) = 'number' and v::text::int > 0 then
        insert into public.collection (user_id,plush_id,count) values (p_user,i,least(v::text::int,3))
        on conflict (user_id,plush_id) do update set count = greatest(collection.count, excluded.count);
      end if;
    end loop;
  end if;
  if jsonb_typeof(p_data->'xp') = 'object' then
    for k, v in select * from jsonb_each(p_data->'xp') loop
      i := k::int;
      if i >= 0 and i < 43 then
        perform 1 from public.collection where user_id = p_user and plush_id = i and count >= 1;
        if found then
          insert into public.plush_care (user_id,plush_id,xp) values (p_user,i,least(greatest(v::text::int,0),public.g_xp_cap(i)))
          on conflict (user_id,plush_id) do update set xp = greatest(plush_care.xp, excluded.xp);
        end if;
      end if;
    end loop;
  end if;
  if jsonb_typeof(p_data->'giants') = 'object' then
    for k, v in select * from jsonb_each(p_data->'giants') loop
      i := k::int;
      if i >= 0 and i < 20 then
        insert into public.giants (user_id,plush_id,count,evolved) values (p_user,i,least(greatest(v::text::int,0),3),coalesce((p_data->'giants_evolved'->>k)::boolean,false))
        on conflict (user_id,plush_id) do nothing;
      end if;
    end loop;
  end if;
  return query select true;
end; $$;

-- só a Edge Function (service_role) chama as ações
do $$ declare f text; begin
  foreach f in array array['g_spend(uuid,integer)','g_item_add(uuid,text,integer)','g_xp_add(uuid,integer,integer)',
    'rpc_buy(uuid,text)','rpc_swap(uuid)','rpc_giant_round_start(uuid)','rpc_giant_capture(uuid,integer)','rpc_sell_giant(uuid,integer)',
    'rpc_giant_evolve(uuid,integer,integer)','rpc_use_stone(uuid,integer,integer)','rpc_care(uuid,integer,text,real,real,real)',
    'rpc_battle(uuid,integer,boolean)','rpc_capture(uuid,integer)','rpc_round_start(uuid)','rpc_refill(uuid)','rpc_import_local(uuid,jsonb)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
