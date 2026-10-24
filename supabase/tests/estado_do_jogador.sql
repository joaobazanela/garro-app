-- Teste local das migrações 0001..0006 (NÃO roda no deploy).
-- Como usar: Postgres local vazio + o stub abaixo, aplicar supabase/migrations/*.sql em ordem e rodar este arquivo com psql.
-- Stub mínimo do Supabase:
--   create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
--   create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
--   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
\set u '''11111111-1111-1111-1111-111111111111'''
insert into auth.users(id,raw_user_meta_data) values (:u,'{"full_name":"Teste"}');
select 'inicio' t,coins,wins from player_state where user_id=:u;
select item,qty from inventory where user_id=:u;
update player_state set coins=1000 where user_id=:u;
select 'compra comida' t,* from rpc_buy(:u,'food');
select 'compra pedra' t,* from rpc_buy(:u,'stone_6');
do $$ begin perform rpc_buy('11111111-1111-1111-1111-111111111111','banana'); exception when others then raise notice 'item invalido rejeitado: %',sqlerrm; end $$;
select 'troca' t,* from rpc_swap(:u);
-- rodada normal + captura
select 'round' t,* from rpc_round_start(:u);
select 'capture' t,* from rpc_capture(:u,4);
update player_state set last_action_at=null where user_id=:u;
select 'round2' t,* from rpc_round_start(:u);
select 'capture dup' t,* from rpc_capture(:u,4);
select 'xp apos dup' t,plush_id,xp from plush_care where user_id=:u;
-- gigante
update player_state set last_action_at=null where user_id=:u;
select 'giant round' t,* from rpc_giant_round_start(:u);
select 'giant capture' t,* from rpc_giant_capture(:u,4);
do $$ begin perform rpc_giant_capture('11111111-1111-1111-1111-111111111111',4); exception when others then raise notice 'captura sem jogar rejeitada: %',sqlerrm; end $$;
do $$ begin perform rpc_giant_evolve('11111111-1111-1111-1111-111111111111',4,7); exception when others then raise notice 'evoluir gigante sem 5 pedras rejeitado: %',sqlerrm; end $$;
insert into inventory values (:u,'stone_7',5) on conflict (user_id,item) do update set qty=5;
select 'giant evolve' t,* from rpc_giant_evolve(:u,4,7);
select 'giants' t,* from giants where user_id=:u;
select 'sell giant' t,* from rpc_sell_giant(:u,4);
select 'giants apos venda' t,* from giants where user_id=:u;
-- pedra
select 'use stone' t,* from rpc_use_stone(:u,4,6);
-- cuidado
select 'care feed' t,* from rpc_care(:u,4,'f',80,50,50);
do $$ begin perform rpc_care('11111111-1111-1111-1111-111111111111',4,'p',80,50,90); exception when others then raise notice 'clique rapido demais rejeitado: %',sqlerrm; end $$;
update player_state set care_at=null where user_id=:u;
select 'care play' t,* from rpc_care(:u,4,'p',80,50,90);
update player_state set care_at=null where user_id=:u;
update inventory set qty=0 where user_id=:u and item='food';
do $$ begin perform rpc_care('11111111-1111-1111-1111-111111111111',4,'f',80,50,90); exception when others then raise notice 'comida sem estoque rejeitada: %',sqlerrm; end $$;
-- batalha: 7 vitorias, so 5 moedas por hora
do $$ declare r record; n int:=0; begin for i in 1..7 loop update player_state set battle_at=null where user_id='11111111-1111-1111-1111-111111111111'; select * into r from rpc_battle('11111111-1111-1111-1111-111111111111',4,true); if r.paid then n:=n+1; end if; end loop; raise notice 'batalhas pagas em 7 vitorias: %',n; end $$;
select 'xp final' t,xp from plush_care where user_id=:u and plush_id=4;
-- venda especial
select 'sell especial' t,* from rpc_sell(:u,4,1);
-- import local uma vez
\set u2 '''22222222-2222-2222-2222-222222222222'''
insert into auth.users(id) values (:u2);
insert into collection values (:u2,6,1),(:u2,25,1);
select 'import' t,* from rpc_import_local(:u2,'{"coll":{"9":7,"30":1},"food":999,"stones":[1,20,0,0,0,0,0,3],"xp":{"6":120,"25":9999,"9":50},"giants":{"6":1},"giants_evolved":{"6":true}}');
select 'import 2a vez' t,* from rpc_import_local(:u2,'{"food":5}');
select item,qty from inventory where user_id=:u2 order by item;
select plush_id,xp from plush_care where user_id=:u2;
select * from giants where user_id=:u2;
-- RLS: outro usuário não lê
set role authenticated; set request.jwt.claim.sub='22222222-2222-2222-2222-222222222222';
select 'rls inventory visivel' t,count(*) from inventory;
do $$ begin perform rpc_buy('22222222-2222-2222-2222-222222222222','food'); exception when others then raise notice 'authenticated nao chama rpc: %',sqlerrm; end $$;
reset role;
select * from ranking;
