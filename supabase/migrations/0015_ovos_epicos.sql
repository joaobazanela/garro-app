-- GARRO 0015 — épicos vêm em ovo: a máquina do épico entrega o OVO do épico do dia, que vai para o Ninho
-- e choca como o dos lendários (carinho 1 vez por dia, tempo secreto entre chocar.dias_min e dias_max).
-- Ovos dos épicos usam a mesma tabela legendary_eggs com leg 10..13 (= épico 53..56; o bicho é sempre 43 + leg).

alter table public.legendary_eggs drop constraint if exists legendary_eggs_leg_check;
alter table public.legendary_eggs add constraint legendary_eggs_leg_check check (leg between 0 and 13);
alter table public.legendary_eggs drop constraint if exists legendary_eggs_source_check;
alter table public.legendary_eggs add constraint legendary_eggs_source_check check (source in ('maquina','desafio','loja','epico'));

create or replace function public.g_egg_new(p_user uuid, p_leg integer, p_min integer, p_max integer, p_source text)
returns bigint language plpgsql security definer set search_path = public as $$
declare e bigint;
begin
  if p_leg < 0 or p_leg > 13 or p_min < 1 or p_max < p_min or p_max > 365 then raise exception 'regra_invalida'; end if;
  -- ovos 10..13 (épicos) só saem da máquina do épico
  if p_leg >= 10 and p_source <> 'epico' then raise exception 'regra_invalida'; end if;
  insert into public.legendary_eggs (user_id, leg, need_days, source)
  values (p_user, p_leg, p_min + floor(random() * (p_max - p_min + 1))::integer, p_source) returning id into e;
  return e;
end; $$;

-- máquina do épico: se a jogada era "firme", cria o ovo do épico do dia (antes dava o épico direto)
drop function if exists public.rpc_epic_capture(uuid, integer, integer);
create or replace function public.rpc_epic_capture(p_user uuid, p_epic integer, p_min integer, p_max integer)
returns table(coins integer, egg bigint, epic integer) language plpgsql security definer set search_path = public as $$
declare c integer; f boolean; e bigint;
begin
  if p_epic < 53 or p_epic > 56 then raise exception 'regra_invalida'; end if;
  update public.player_state set pending_epic = false, last_action_at = now()
  where user_id = p_user and pending_epic = true
    and last_action_at is not null and now() - last_action_at > interval '1.5 seconds'
  returning player_state.coins, player_state.epic_firm into c, f;
  if not found then raise exception 'epic_capture_rejected'; end if;
  if not f then raise exception 'epic_not_firm'; end if;
  e := public.g_egg_new(p_user, p_epic - 43, p_min, p_max, 'epico');
  perform public.g_count(p_user, 'capture', 1);
  return query select c, e, p_epic;
end; $$;

do $$ declare f text; begin
  foreach f in array array['g_egg_new(uuid,integer,integer,integer,text)','rpc_epic_capture(uuid,integer,integer,integer)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
