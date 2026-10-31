-- 0012 — Pedras de evoluir e Renascer.
-- 1ª pedra: o bichinho evolui na hora e vai ao Nv de evolução (30). Depois, a cada N pedras (2) ele sobe 1 nível, até o Nv 100.
-- No Nv 100 ele pode renascer: o nível volta ao 1, a forma evoluída e o resto ficam, e conta mais 1 renascimento
-- (cada renascimento deixa os atributos mais fortes; a conta do bônus fica no jogo, data/regras.json → EVOLUCAO).
-- Só ESTADO no banco: quantos renascimentos e se há meia pedra guardada para cada bichinho.
alter table public.plush_care add column if not exists rebirths smallint not null default 0 check (rebirths between 0 and 999);
alter table public.plush_care add column if not exists stone_pending smallint not null default 0 check (stone_pending between 0 and 4);

drop function if exists public.rpc_use_stone(uuid, integer, integer);
create or replace function public.rpc_use_stone(p_user uuid, p_plush integer, p_stone integer, p_evo_lv integer, p_per integer)
returns table(stones integer, xp integer, rebirths integer, pending integer, leveled boolean)
language plpgsql security definer set search_path = public as $$
declare q integer; x integer; lv integer; rb integer; pend integer; up boolean := false;
begin
  if p_plush < 0 or p_plush >= 20 or p_stone < 0 or p_stone > 7 or p_evo_lv < 10 or p_evo_lv > 60 or p_per < 1 or p_per > 4 then raise exception 'bad_request'; end if;
  perform 1 from public.collection where user_id = p_user and plush_id = p_plush and count >= 1;
  if not found then raise exception 'nao_tem'; end if;
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, 0) on conflict do nothing;
  select pc.xp, pc.rebirths, pc.stone_pending into x, rb, pend from public.plush_care pc where pc.user_id = p_user and pc.plush_id = p_plush for update;
  lv := public.g_lv_xp(p_plush, x);
  if lv >= 100 then raise exception 'nivel_maximo'; end if;
  q := public.g_item_add(p_user, 'stone_' || p_stone, -1);
  if lv < p_evo_lv and rb = 0 then
    x := greatest(x, public.g_xp_total(p_plush, p_evo_lv)); up := true;            -- evolui e vai ao nível de evolução
  elsif pend + 1 >= p_per then
    x := greatest(x, public.g_xp_total(p_plush, lv + 1)); pend := 0; up := true;   -- completou as pedras: +1 nível
  else
    pend := pend + 1;                                                               -- guarda a meia pedra
  end if;
  update public.plush_care pc set xp = x, stone_pending = pend, updated_at = now() where pc.user_id = p_user and pc.plush_id = p_plush;
  perform public.g_count(p_user, 'stone', 1);
  return query select q, x, rb, pend, up;
end; $$;

-- renascer: só no Nv 100; o nível volta ao 1 e soma 1 renascimento
create or replace function public.rpc_rebirth(p_user uuid, p_plush integer)
returns table(xp integer, rebirths integer) language plpgsql security definer set search_path = public as $$
declare x integer; rb integer;
begin
  if p_plush < 0 or p_plush >= 20 then raise exception 'bad_request'; end if;
  select pc.xp into x from public.plush_care pc where pc.user_id = p_user and pc.plush_id = p_plush for update;
  if not found or public.g_lv_xp(p_plush, x) < 100 then raise exception 'nivel_baixo'; end if;
  update public.plush_care pc set xp = 0, rebirths = pc.rebirths + 1, stone_pending = 0, updated_at = now()
  where pc.user_id = p_user and pc.plush_id = p_plush returning pc.rebirths into rb;
  return query select 0, rb;
end; $$;

do $$ declare f text; begin
  foreach f in array array['rpc_use_stone(uuid,integer,integer,integer,integer)','rpc_rebirth(uuid,integer)'] loop
    execute 'revoke execute on function public.'||f||' from public, anon, authenticated';
    execute 'grant execute on function public.'||f||' to service_role';
  end loop;
end $$;
