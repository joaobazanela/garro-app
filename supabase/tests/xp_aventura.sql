-- Teste local da migração 0011 (curva de níveis e XP por derrotado). NÃO roda no deploy.
select 'xp total Nv50 grande (esperado 1608)' t, g_xp_total(0,50);
select 'xp total Nv30 redondo (esperado 438)' t, g_xp_total(25,30);
select 'nivel de 1608 xp (50) e 1607 (49)' t, g_lv_xp(0,1608), g_lv_xp(0,1607);
select 'xp por inimigo Nv22 contra Nv20' t, g_kill_xp(22,20,1), 'contra Nv60 (menos)' c, g_kill_xp(22,60,1);
\set u '''77777777-7777-7777-7777-777777777777'''
insert into auth.users(id) values (:u);
insert into collection values (:u,10,1);
update plush_care set xp = 0 where user_id=:u;
insert into plush_care(user_id,plush_id,xp) values (:u,10,g_xp_total(10,30)) on conflict (user_id,plush_id) do update set xp=excluded.xp;
select rpc_adv_start(:u,10,'f01',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id=:u;
select 'fim f01: 7 derrotados' t, xp from rpc_adv_end(:u,'f01',true,1,1,8,2,10,1,false,0,'{}',null,null,0,0,-1,0,7,90,7,22,false,1.0,1.5,9);
select rpc_adv_start(:u,10,'f01',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id=:u;
do $$ begin perform rpc_adv_end('77777777-7777-7777-7777-777777777777','f01',true,1,1,8,2,10,1,false,0,'{}',null,null,0,0,-1,0,7,90,40,22,false,1.0,1.5,9); exception when others then raise notice 'OK derrotados demais: %',sqlerrm; end $$;
