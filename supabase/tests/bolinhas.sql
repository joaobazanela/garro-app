-- Teste local da migração 0016 (bolinhas: 10 iguais + 5 pedras = grande evoluído). NÃO roda no deploy.
\set u '''88888888-8888-8888-8888-888888888888'''
insert into auth.users(id) values (:u);
select 'pedra da bolinha 20 (Terranox) = pedra do Terranox (0)' t, g_stone_of(20) = g_stone_of(0) ok, g_stone_of(39) = g_stone_of(19) ok2;
insert into collection(user_id, plush_id, count) values (:u, 20, 9);
insert into inventory(user_id, item, qty) values (:u, 'stone_2', 5);
do $$ begin perform rpc_bolinha_evolve('88888888-8888-8888-8888-888888888888',20,10,5); exception when others then raise notice 'OK com 9 bolinhas não troca: %',sqlerrm; end $$;
update collection set count = 12 where user_id = :u and plush_id = 20;
update inventory set qty = 4 where user_id = :u and item = 'stone_2';
do $$ begin perform rpc_bolinha_evolve('88888888-8888-8888-8888-888888888888',20,10,5); exception when others then raise notice 'OK com 4 pedras não troca: %',sqlerrm; end $$;
select 'nada foi gasto na tentativa sem pedra' t, count from collection where user_id = :u and plush_id = 20;
update inventory set qty = 6 where user_id = :u and item = 'stone_2';
select 'troca: sobram 2 bolinhas e 1 pedra; Terranox (0) evoluído no Nv 1' t, balls, stones, plush, count, g_lv_xp(0, xp) nv, evolved from rpc_bolinha_evolve(:u,20,10,5);
select 'na coleção' t, count from collection where user_id = :u and plush_id = 0;
select 'cuidado do Terranox: evoluído' t, evolved from plush_care where user_id = :u and plush_id = 0;
-- já tinha o grande em nível alto: evolui e mantém o nível
insert into collection(user_id, plush_id, count) values (:u, 21, 10), (:u, 1, 1);
insert into plush_care(user_id, plush_id, xp) values (:u, 1, g_xp_total(1, 57));
insert into inventory(user_id, item, qty) values (:u, 'stone_1', 5) on conflict (user_id, item) do update set qty = 5;
select 'Aquarim que já era Nv 57 evolui e continua Nv 57' t, g_lv_xp(1, xp) nv, evolved, count from rpc_bolinha_evolve(:u,21,10,5);
do $$ begin perform rpc_bolinha_evolve('88888888-8888-8888-8888-888888888888',41,10,5); exception when others then raise notice 'OK aposentado (41) não troca: %',sqlerrm; end $$;
select 'coleção completa agora é 40 (sem 40..42)' t, g_tem_normais(:u) = false ok;
