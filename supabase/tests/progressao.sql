-- Teste local da migração 0014 (nova progressão). NÃO roda no deploy.
\set u '''66666666-6666-6666-6666-666666666666'''
insert into auth.users(id) values (:u);
update player_state set coins = 5000 where user_id = :u;
select 'pedra custa 200' t, coins from rpc_buy(:u,'stone_1');
-- máquina: só redondos
do $$ begin perform rpc_capture('66666666-6666-6666-6666-666666666666',3,0.05); exception when others then raise notice 'OK grande não sai da máquina: %',sqlerrm; end $$;
update player_state set pending_round = true, last_action_at = now() - interval '2 seconds' where user_id = :u;
select 'chance 100%: Marim (28, Ar) vira um grande do grupo Ar' t, plush_id, transformed, g_stone_of(plush_id) grupo from rpc_capture(:u,28,0.5) where true;
-- travas
do $$ begin perform rpc_giant_round_start('66666666-6666-6666-6666-666666666666'); exception when others then raise notice 'OK gigante travado: %',sqlerrm; end $$;
insert into collection select :u, g, 1 from generate_series(0,42) g on conflict on constraint collection_pkey do nothing;
update player_state set last_action_at = now() - interval '2 seconds' where user_id = :u;
select 'com todos os normais o gigante abre' t, coins from rpc_giant_round_start(:u);
update player_state set last_action_at = now() - interval '2 seconds' where user_id = :u;
do $$ begin perform rpc_egg_round_start('66666666-6666-6666-6666-666666666666',200,0.15); exception when others then raise notice 'OK ovos travados sem gigantes: %',sqlerrm; end $$;
insert into giants(user_id,plush_id,count) select :u, g, 1 from generate_series(0,19) g;
select 'ovos abrem com normais + gigantes' t, coins from rpc_egg_round_start(:u,200,0.15);
update player_state set last_action_at = now() - interval '2 seconds' where user_id = :u;
do $$ begin perform rpc_epic_round_start('66666666-6666-6666-6666-666666666666',500,0.05); exception when others then raise notice 'OK épico travado sem lendários: %',sqlerrm; end $$;
insert into collection select :u, g, 1 from generate_series(43,52) g on conflict on constraint collection_pkey do nothing;
update player_state set last_action_at = now() - interval '2 seconds' where user_id = :u;
select 'épico abre com tudo (firme forçado no teste)' t, coins from rpc_epic_round_start(:u,500,0.2);
update player_state set epic_firm = true, last_action_at = now() - interval '2 seconds' where user_id = :u;
select 'pegou o OVO do épico do dia (Abyssor, 54; migração 0015)' t, epic, egg is not null tem_ovo from rpc_epic_capture(:u,54,7,90);
-- evolução: Nv 100 + 5 pedras do grupo
insert into inventory(user_id,item,qty) values (:u,'stone_1',5) on conflict (user_id,item) do update set qty=5;
do $$ begin perform rpc_use_stone('66666666-6666-6666-6666-666666666666',3,1,100,5); exception when others then raise notice 'OK abaixo do Nv 100 não evolui: %',sqlerrm; end $$;
insert into plush_care(user_id,plush_id,xp) values (:u,3,g_xp_total(3,100)) on conflict (user_id,plush_id) do update set xp = excluded.xp;
do $$ begin perform rpc_use_stone('66666666-6666-6666-6666-666666666666',3,0,100,5); exception when others then raise notice 'OK pedra do grupo errado: %',sqlerrm; end $$;
select 'evoluiu no Nv 100 e ficou no 100' t, stones, g_lv_xp(3,xp) nv, evolved from rpc_use_stone(:u,3,1,100,5);
select 'renasce mantendo a forma' t, r.rebirths, (select evolved from plush_care where user_id=:u and plush_id=3) evoluido from rpc_rebirth(:u,3) r;
insert into plush_care(user_id,plush_id,xp) values (:u,25,g_xp_total(25,100)) on conflict (user_id,plush_id) do update set xp = excluded.xp;
select 'redondo chega ao Nv 100 e renasce' t, rebirths from rpc_rebirth(:u,25);
-- Aventura cobra
insert into adventure_energy(user_id,plush_id,energy,since) values (:u,3,5,now()) on conflict do nothing;
select 'Aventura: -60 moedas' t, energy, coins from rpc_adv_start(:u,3,'f1',null,5,60,60);
