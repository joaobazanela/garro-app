-- Teste local da migração 0015 (épico vem em ovo). NÃO roda no deploy.
\set u '''77777777-7777-7777-7777-777777777777'''
insert into auth.users(id) values (:u);
update player_state set coins = 5000, pending_epic = true, epic_firm = false, last_action_at = now() - interval '2 seconds' where user_id = :u;
do $$ begin perform rpc_epic_capture('77777777-7777-7777-7777-777777777777',55,7,90); exception when others then raise notice 'OK sem estar firme não ganha: %',sqlerrm; end $$;
update player_state set pending_epic = true, epic_firm = true, last_action_at = now() - interval '2 seconds' where user_id = :u;
select 'ovo do Zephyrax (55) foi para o ninho' t, epic, coins from rpc_epic_capture(:u,55,7,90);
select 'ovo: leg 12, origem epico, 7..90 dias' t, leg, source, need_days between 7 and 90 ok from legendary_eggs where user_id = :u;
select 'ainda não tem o épico' t, count(*) from collection where user_id = :u and plush_id = 55;
do $$ begin perform rpc_epic_capture('77777777-7777-7777-7777-777777777777',55,7,90); exception when others then raise notice 'OK não repete sem nova jogada: %',sqlerrm; end $$;
do $$ begin perform g_egg_new('77777777-7777-7777-7777-777777777777',12,7,90,'loja'); exception when others then raise notice 'OK ovo de épico não sai da loja: %',sqlerrm; end $$;
-- choca: 1 dia de carinho quando need_days = 1
update legendary_eggs set need_days = 1 where user_id = :u;
select 'carinho choca: nasce o Zephyrax (55) no Nv 30' t, hatched, nasceu, g_lv_xp(55,xp) nv from rpc_egg_care(:u,(select id from legendary_eggs where user_id = :u),30);
select 'agora tem o épico' t, count from collection where user_id = :u and plush_id = 55;
