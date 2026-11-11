-- 0017 — Mochila: vender itens (comida e pedras) e trocar itens com outro jogador.
--  • venda: o preço vem do data/regras.json (VENDA) pela sync-estado; o banco só aceita valores sensatos;
--  • troca: quem propõe escolhe o que dá (comida, pedras, ovos) e o que pede (comida, pedras) e o e-mail do outro jogador.
--    O que ele dá fica guardado na proposta (sai da mochila na hora, para não gastar duas vezes) e volta se ele cancelar
--    ou o outro recusar. Quando o outro aceita, tudo troca de dono de uma vez; se ele não tiver o que foi pedido, nada muda.
--  • ovo numa proposta não aparece no Ninho (trade_id preenchido); ao aceitar, muda de dono com os dias de carinho que já tinha.
-- Só estado do jogador vai para o banco (as propostas são estado); nomes e preços ficam nos arquivos do jogo.

alter table public.legendary_eggs add column if not exists trade_id bigint;
grant select (trade_id) on public.legendary_eggs to authenticated;

create table if not exists public.trade_offers (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  give jsonb not null default '{}'::jsonb,     -- {"food":2,"stone_3":1}
  give_eggs bigint[] not null default '{}',    -- ids de legendary_eggs
  want jsonb not null default '{}'::jsonb,     -- {"stone_1":2}
  status text not null default 'aberta' check (status in ('aberta','aceita','recusada','cancelada')),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  check (from_user <> to_user)
);
create index if not exists trade_offers_to on public.trade_offers (to_user, status);
create index if not exists trade_offers_from on public.trade_offers (from_user, status);
alter table public.trade_offers enable row level security;
create policy "trade_offers: leitura das minhas" on public.trade_offers for select using (auth.uid() = from_user or auth.uid() = to_user);
revoke all on public.trade_offers from anon, authenticated;
grant select on public.trade_offers to authenticated;

-- itens válidos numa troca: comida e pedras 0..7, de 1 a 999 cada
create or replace function public.g_itens_ok(p jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_each(p) e
                     where not (e.key = 'food' or e.key ~ '^stone_[0-7]$')
                        or jsonb_typeof(e.value) <> 'number'
                        or (e.value)::numeric <> floor((e.value)::numeric)
                        or (e.value)::numeric < 1 or (e.value)::numeric > 999)
$$;

-- move os itens de p (positivo = recebe, negativo = paga) para o jogador
create or replace function public.g_itens_mover(p_user uuid, p jsonb, p_sinal integer) returns void
language plpgsql security definer set search_path = public as $$
declare e record;
begin
  for e in select key, (value)::integer n from jsonb_each(p) loop
    perform public.g_item_add(p_user, e.key, p_sinal * e.n);    -- sem o bastante: sem_item (desfaz tudo)
  end loop;
end; $$;

-- vender comida ou pedra
create or replace function public.rpc_item_sell(p_user uuid, p_item text, p_qty integer, p_price integer)
returns table(coins integer, item text, qty integer) language plpgsql security definer set search_path = public as $$
declare q integer; c integer;
begin
  if not (p_item = 'food' or p_item ~ '^stone_[0-7]$') or p_qty < 1 or p_qty > 999 or p_price < 0 or p_price > 1000 then raise exception 'regra_invalida'; end if;
  q := public.g_item_add(p_user, p_item, -p_qty);
  update public.player_state set coins = player_state.coins + p_qty * p_price, last_action_at = now()
  where user_id = p_user returning player_state.coins into c;
  if not found then raise exception 'sem_estado'; end if;
  return query select c, p_item, q;
end; $$;

-- propor uma troca
create or replace function public.rpc_trade_offer(p_user uuid, p_to_email text, p_give jsonb, p_eggs bigint[], p_want jsonb)
returns table(id bigint, to_user uuid) language plpgsql security definer set search_path = public as $$
declare t uuid; o bigint; n integer;
begin
  p_give := coalesce(p_give, '{}'::jsonb); p_want := coalesce(p_want, '{}'::jsonb); p_eggs := coalesce(p_eggs, '{}');
  if not public.g_itens_ok(p_give) or not public.g_itens_ok(p_want) or cardinality(p_eggs) > 10 then raise exception 'regra_invalida'; end if;
  if p_give = '{}'::jsonb and cardinality(p_eggs) = 0 then raise exception 'troca_vazia'; end if;
  select u.id into t from auth.users u where lower(u.email) = lower(trim(p_to_email)) limit 1;
  if t is null or not exists (select 1 from public.profiles where profiles.id = t) then raise exception 'jogador_nao_encontrado'; end if;
  if t = p_user then raise exception 'troca_consigo'; end if;
  select count(*) into n from public.trade_offers where from_user = p_user and status = 'aberta';
  if n >= 10 then raise exception 'muitas_propostas'; end if;
  insert into public.trade_offers (from_user, to_user, give, give_eggs, want) values (p_user, t, p_give, p_eggs, p_want) returning trade_offers.id into o;
  perform public.g_itens_mover(p_user, p_give, -1);                 -- guarda o que ele dá
  update public.legendary_eggs e set trade_id = o
  where e.id = any(p_eggs) and e.user_id = p_user and e.hatched_at is null and e.trade_id is null;
  get diagnostics n = row_count;
  if n <> cardinality(p_eggs) then raise exception 'ovo_indisponivel'; end if;
  return query select o, t;
end; $$;

-- responder (quem recebeu) ou cancelar (quem propôs)
create or replace function public.rpc_trade_answer(p_user uuid, p_id bigint, p_accept boolean)
returns table(id bigint, status text) language plpgsql security definer set search_path = public as $$
declare r public.trade_offers; st text;
begin
  select * into r from public.trade_offers where trade_offers.id = p_id and trade_offers.status = 'aberta' for update;
  if not found then raise exception 'proposta_fechada'; end if;
  if p_user = r.to_user and p_accept then
    perform public.g_itens_mover(p_user, r.want, -1);                -- paga o que foi pedido
    perform public.g_itens_mover(r.from_user, r.want, 1);
    perform public.g_itens_mover(p_user, r.give, 1);                 -- recebe o que estava guardado
    update public.legendary_eggs e set user_id = p_user, trade_id = null where e.trade_id = r.id;
    st := 'aceita';
  elsif p_user = r.to_user or p_user = r.from_user then
    perform public.g_itens_mover(r.from_user, r.give, 1);            -- devolve para quem propôs
    update public.legendary_eggs e set trade_id = null where e.trade_id = r.id;
    st := case when p_user = r.to_user then 'recusada' else 'cancelada' end;
  else
    raise exception 'proposta_de_outro';
  end if;
  update public.trade_offers set status = st, done_at = now() where trade_offers.id = r.id;
  return query select r.id, st;
end; $$;

-- lista as propostas (com o e-mail do outro jogador) para a mochila
create or replace function public.rpc_trade_list(p_user uuid)
returns table(id bigint, mine boolean, other text, give jsonb, give_eggs jsonb, want jsonb, status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.from_user = p_user,
         (select u.email from auth.users u where u.id = case when o.from_user = p_user then o.to_user else o.from_user end)::text,
         o.give,
         coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'leg', e.leg)) from public.legendary_eggs e where e.id = any(o.give_eggs)), '[]'::jsonb),
         o.want, o.status, o.created_at
  from public.trade_offers o
  where (o.from_user = p_user or o.to_user = p_user)
    and (o.status = 'aberta' or o.done_at > now() - interval '3 days')
  order by o.status <> 'aberta', o.id desc
  limit 30
$$;

do $$ declare f text; begin
  foreach f in array array['g_itens_ok(jsonb)', 'g_itens_mover(uuid,jsonb,integer)', 'rpc_item_sell(uuid,text,integer,integer)',
                           'rpc_trade_offer(uuid,text,jsonb,bigint[],jsonb)', 'rpc_trade_answer(uuid,bigint,boolean)', 'rpc_trade_list(uuid)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
