-- 0013 — Subir de nível fica mais difícil.
-- 1) Curva: XP total para o nível N = linear×(N−1) + round(0,03×(N−1)³), com linear 10 (grandes e lendários, até o Nv 100)
--    ou 12 (redondos, até o Nv 30). Antes era 4/5 e 0,012 (cerca de 2,5× menos). Os mesmos números ficam em data/regras.json (NIVEL).
--    O XP guardado não muda: o nível é recalculado por ele (decisão dos administradores, só eles jogavam).
-- 2) Cuidar (comida, carinho, brincar) dá no máximo 30 XP por bichinho por dia (data/regras.json → CUIDAR_XP_DIA).
--    Luta e Aventura continuam dando XP normal. Só ESTADO no banco: quanto XP de cuidar o bichinho já ganhou hoje.

create or replace function public.g_xp_total(p_plush integer, p_lv integer)
returns integer language sql immutable as $$
  select (case when p_plush < 20 or p_plush >= 43 then 10 else 12 end) * n + round(30 * (n::numeric ^ 3) / 1000)::integer
  from (select greatest(0, least(p_lv, case when p_plush < 20 or p_plush >= 43 then 100 else 30 end) - 1) as n) q
$$;

alter table public.plush_care add column if not exists care_dia date;
alter table public.plush_care add column if not exists care_xp_dia integer not null default 0;

create or replace function public.rpc_care(p_user uuid, p_plush integer, p_kind text, p_f real, p_l real, p_p real)
returns table(xp integer, food integer) language plpgsql security definer set search_path = public as $$
declare x integer; fd integer; gain integer; hoje date := (now() at time zone 'America/Sao_Paulo')::date; ja integer;
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
  insert into public.plush_care (user_id, plush_id, xp) values (p_user, p_plush, 0) on conflict (user_id, plush_id) do nothing;
  select case when pc.care_dia = hoje then pc.care_xp_dia else 0 end into ja from public.plush_care pc where pc.user_id = p_user and pc.plush_id = p_plush;
  gain := greatest(0, least(gain, 30 - coalesce(ja, 0)));                       -- limite de 30 XP de cuidar por dia
  x := public.g_xp_add(p_user, p_plush, gain);
  update public.plush_care set f = least(greatest(p_f,0),100), l = least(greatest(p_l,0),100), p = least(greatest(p_p,0),100),
    care_dia = hoje, care_xp_dia = coalesce(ja, 0) + gain, updated_at = now()
  where user_id = p_user and plush_id = p_plush;
  perform public.g_count(p_user, case p_kind when 'f' then 'feed' when 'l' then 'pet' else 'play' end, 1);
  return query select x, coalesce(fd, 0);
end; $$;
-- só a Edge Function (service_role) chama
revoke execute on function public.rpc_care(uuid, integer, text, real, real, real) from public, anon, authenticated;
grant execute on function public.rpc_care(uuid, integer, text, real, real, real) to service_role;
