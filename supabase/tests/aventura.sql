-- Teste local da migração 0009 (Aventura). NÃO roda no deploy. Mesmo stub de estado_do_jogador.sql.
\set u '''77777777-7777-7777-7777-777777777777'''
insert into auth.users(id) values (:u);
insert into collection values (:u,10,1);
-- fase bloqueada (f01 ainda não vencida)
do $$ begin perform rpc_adv_start('77777777-7777-7777-7777-777777777777',10,'f02','f01',5,60); exception when others then raise notice 'OK f02 bloqueada: %',sqlerrm; end $$;
-- sem o bichinho
do $$ begin perform rpc_adv_start('77777777-7777-7777-7777-777777777777',3,'f01',null,5,60); exception when others then raise notice 'OK sem bichinho: %',sqlerrm; end $$;
select 'start f01' t,energy from rpc_adv_start(:u,10,'f01',null,5,60);
-- vitória rápida demais
do $$ begin perform rpc_adv_end('77777777-7777-7777-7777-777777777777','f01',true,3,1,8,2,10,1,false,0,'{}'); exception when others then raise notice 'OK rapido demais: %',sqlerrm; end $$;
update adventure_run set started_at=now()-interval '20 s' where user_id=:u;
select 'fim f01 (1a vez)' t,* from rpc_adv_end(:u,'f01',true,2,1,8,2,10,1,false,0,'{}');
-- terminar sem partida
do $$ begin perform rpc_adv_end('77777777-7777-7777-7777-777777777777','f01',true,3,1,8,2,10,1,false,0,'{}'); exception when others then raise notice 'OK sem partida: %',sqlerrm; end $$;
select 'start f01 de novo' t,energy from rpc_adv_start(:u,10,'f01',null,5,60);
update adventure_run set started_at=now()-interval '20 s' where user_id=:u;
select 'fim f01 (repetida: sem moeda, estrelas sobem)' t,* from rpc_adv_end(:u,'f01',true,3,1,8,2,10,1,false,0,'{}');
select 'progresso' t,stage,stars,wins from adventure_progress where user_id=:u;
-- nível baixo para a fase (Nv do Sylvorn agora = 1 + 16/4 = 5)
select 'start f02' t,energy from rpc_adv_start(:u,10,'f02','f01',5,60);
update adventure_run set started_at=now()-interval '20 s' where user_id=:u;
do $$ begin perform rpc_adv_end('77777777-7777-7777-7777-777777777777','f02',true,3,1,8,2,10,9,false,0,'{}'); exception when others then raise notice 'OK nivel baixo: %',sqlerrm; end $$;
select 'derrota f02 (partida segue aberta, termina como derrota)' t,* from rpc_adv_end(:u,'f02',false,1,1,8,2,10,9,false,0,'{}');
-- energia acaba (já gastou 3; mais 2 e cansa)
select rpc_adv_start(:u,10,'f01',null,5,60); select rpc_adv_start(:u,10,'f01',null,5,60);
do $$ begin perform rpc_adv_start('77777777-7777-7777-7777-777777777777',10,'f01',null,5,60); exception when others then raise notice 'OK cansado: %',sqlerrm; end $$;
-- recarga com o tempo: 2 horas -> +2
update adventure_energy set since=since-interval '125 minutes' where user_id=:u;
select 'energia depois de 2h' t,g_adv_energy(:u,10,5,60);
-- descansar pagando: sem moedas
update player_state set coins=3 where user_id=:u;
do $$ begin perform rpc_adv_rest('77777777-7777-7777-7777-777777777777',10,10,5,60); exception when others then raise notice 'OK sem moedas p/ descansar: %',sqlerrm; end $$;
update player_state set coins=50 where user_id=:u;
select 'descansar' t,* from rpc_adv_rest(:u,10,10,5,60);
do $$ begin perform rpc_adv_rest('77777777-7777-7777-7777-777777777777',10,10,5,60); exception when others then raise notice 'OK ja descansado: %',sqlerrm; end $$;
-- chefe: com chance 0.5 (máximo aceito) em 40 vitórias tem que cair pedra algumas vezes
update plush_care set xp=200 where user_id=:u and plush_id=10;
create temp table pedras(st int);
do $$ declare r record; begin for k in 1..40 loop
  update adventure_energy set energy=5 where user_id='77777777-7777-7777-7777-777777777777';
  perform rpc_adv_start('77777777-7777-7777-7777-777777777777',10,'f10',null,5,60);
  update adventure_run set started_at=now()-interval '30 s' where user_id='77777777-7777-7777-7777-777777777777';
  select * into r from rpc_adv_end('77777777-7777-7777-7777-777777777777','f10',true,3,3,8,2,10,19,true,0.5,'{0,1,2,3,4,6,7}');
  insert into pedras values (r.stone);
end loop; end $$;
select 'pedras do chefe (de 40)' t,count(*) filter (where st>=0) caiu, count(*) filter (where st=5) psiquica from pedras;
select 'inventario' t,item,qty from inventory where user_id=:u and item like 'stone%' order by item;
select 'moedas finais (50-10 + 1 + 3)' t,coins from player_state where user_id=:u;
select 'contador missões' t,kind,total from mission_counters where user_id=:u;
do $$ begin perform rpc_adv_end('77777777-7777-7777-7777-777777777777','f10',true,3,99,8,2,10,1,false,0,'{}'); exception when others then raise notice 'OK premio absurdo: %',sqlerrm; end $$;
