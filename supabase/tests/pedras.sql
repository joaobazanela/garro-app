-- Teste local da migração 0012 (pedras e renascer). NÃO roda no deploy.
\set u '''88888888-8888-8888-8888-888888888888'''
insert into auth.users(id) values (:u);
insert into collection values (:u,4,1);
insert into inventory(user_id,item,qty) values (:u,'stone_7',10) on conflict (user_id,item) do update set qty=10;
select '1ª pedra: evolui e vai ao Nv 30' t, g_lv_xp(4,xp) nv, stones, rebirths, pending, leveled from rpc_use_stone(:u,4,7,30,2);
select '2ª pedra: guarda meia' t, g_lv_xp(4,xp) nv, stones, pending, leveled from rpc_use_stone(:u,4,7,30,2);
select '3ª pedra: +1 nível (31)' t, g_lv_xp(4,xp) nv, stones, pending, leveled from rpc_use_stone(:u,4,7,30,2);
do $$ begin perform rpc_rebirth('88888888-8888-8888-8888-888888888888',4); exception when others then raise notice 'OK renascer antes do 100: %',sqlerrm; end $$;
update plush_care set xp = g_xp_total(4,100) where user_id=:u and plush_id=4;
do $$ begin perform rpc_use_stone('88888888-8888-8888-8888-888888888888',4,7,30,2); exception when others then raise notice 'OK pedra no Nv 100: %',sqlerrm; end $$;
select 'renasceu' t, g_lv_xp(4,xp) nv, rebirths from rpc_rebirth(:u,4);
select 'pedra depois de renascer: não volta a "evoluir"' t, g_lv_xp(4,xp) nv, pending from rpc_use_stone(:u,4,7,30,2);
select 'tem pedras' t, qty from inventory where user_id=:u and item='stone_7';
