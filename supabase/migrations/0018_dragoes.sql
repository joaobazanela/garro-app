-- 0018 — Dragões (data/lendarios.json → dragoes): 5 bichinhos novos, ids 57 a 61, entre os lendários e os épicos.
--  • nascem de ovo no Ninho, como os lendários: o ovo usa a mesma tabela legendary_eggs com leg 14..18 (o bicho é sempre 43 + leg);
--  • o ovo do dragão sai na loja de ovos (preço em loja.preco_ovo_dragao, enviado pela sync-estado);
--  • as 3 formas (inicial, evolução 2, final) dependem só do nível — nada novo no banco.
-- Só estado do jogador vai para o banco; nomes, formas, preços e força ficam nos arquivos do jogo.

alter table public.collection drop constraint if exists collection_plush_id_check;
alter table public.collection add constraint collection_plush_id_check check (plush_id >= 0 and plush_id < 62);
alter table public.plush_care drop constraint if exists plush_care_plush_id_check;
alter table public.plush_care add constraint plush_care_plush_id_check check (plush_id >= 0 and plush_id < 62);
alter table public.adventure_energy drop constraint if exists adventure_energy_plush_id_check;
alter table public.adventure_energy add constraint adventure_energy_plush_id_check check (plush_id >= 0 and plush_id < 62);

alter table public.legendary_eggs drop constraint if exists legendary_eggs_leg_check;
alter table public.legendary_eggs add constraint legendary_eggs_leg_check check (leg between 0 and 18);

-- ovo novo: lendários 0..9 (máquina, desafio, loja), épicos 10..13 (só da máquina do épico), dragões 14..18 (só da loja)
create or replace function public.g_egg_new(p_user uuid, p_leg integer, p_min integer, p_max integer, p_source text)
returns bigint language plpgsql security definer set search_path = public as $$
declare e bigint;
begin
  if p_leg < 0 or p_leg > 18 or p_min < 1 or p_max < p_min or p_max > 365 then raise exception 'regra_invalida'; end if;
  if p_leg between 10 and 13 and p_source <> 'epico' then raise exception 'regra_invalida'; end if;
  if p_leg >= 14 and p_source <> 'loja' then raise exception 'regra_invalida'; end if;
  insert into public.legendary_eggs (user_id, leg, need_days, source)
  values (p_user, p_leg, p_min + floor(random() * (p_max - p_min + 1))::integer, p_source) returning id into e;
  return e;
end; $$;

do $$ begin
  execute 'revoke execute on function public.g_egg_new(uuid,integer,integer,integer,text) from public, anon, authenticated';
  execute 'grant execute on function public.g_egg_new(uuid,integer,integer,integer,text) to service_role';
end $$;
