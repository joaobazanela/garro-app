-- Teste local da migração 0018 (dragões). NÃO roda no deploy.
\set a '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
insert into auth.users(id) values (:a) on conflict do nothing;
update player_state set diamonds = 500 where user_id = :a;
select 'compra ovo de dragão (leg 14)' t, leg from rpc_egg_buy(:a, 14, 120, 1, 1);
do $$ begin perform public.g_egg_new('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',15,1,1,'maquina'); exception when others then raise notice 'OK dragão só pela loja: %',sqlerrm; end $$;
do $$ begin perform public.g_egg_new('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',19,1,1,'loja'); exception when others then raise notice 'OK leg 19 não existe: %',sqlerrm; end $$;
do $$ begin perform public.g_egg_new('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',11,1,1,'loja'); exception when others then raise notice 'OK épico continua só na máquina: %',sqlerrm; end $$;
select 'diamantes 380' t, diamonds from player_state where user_id = :a;
select 'choca no 1º carinho: dragão 57 na coleção' t, hatched, nasceu from rpc_egg_care(:a, (select max(id) from legendary_eggs where user_id = :a), 30);
select 'coleção tem o 57' t, count from collection where user_id = :a and plush_id = 57;
