-- Teste local da migração 0010 (Lendários). NÃO roda no deploy. Mesmo stub de estado_do_jogador.sql.
\set u '''66666666-6666-6666-6666-666666666666'''
insert into auth.users(id) values (:u);
update player_state set coins = 1000 where user_id = :u;

-- máquina de ovos: 200 por jogada; pegar sem jogada é recusado
do $$ begin perform rpc_egg_capture('66666666-6666-6666-6666-666666666666',false,0,1,7,90); exception when others then raise notice 'OK sem jogada: %',sqlerrm; end $$;
select 'jogada' t,coins,wins from rpc_egg_round_start(:u,200,0.33);
do $$ begin perform rpc_egg_capture('66666666-6666-6666-6666-666666666666',false,0,1,7,90); exception when others then raise notice 'OK rapido demais: %',sqlerrm; end $$;
update player_state set last_action_at = now() - interval '3 s' where user_id = :u;
-- ovo comum: +1 moeda, nunca vira lendário
select 'ovo comum' t,* from rpc_egg_capture(:u,false,0,1,7,90);
-- regra fora do limite (segurar acima de 0.5)
update player_state set last_action_at = now() - interval '3 s' where user_id = :u;
do $$ begin perform rpc_egg_round_start('66666666-6666-6666-6666-666666666666',200,0.9); exception when others then raise notice 'OK segurar invalido: %',sqlerrm; end $$;
-- garra NÃO firme (p_grip 0): pedir o ovo lendário é recusado
update player_state set last_action_at = now() - interval '3 s' where user_id = :u;
select 'jogada solta' t,firm from rpc_egg_round_start(:u,200,0); update player_state set last_action_at = now() - interval '3 s' where user_id = :u;
do $$ begin perform rpc_egg_capture('66666666-6666-6666-6666-666666666666',true,3,1,7,90); exception when others then raise notice 'OK sem firme nao ganha: %',sqlerrm; end $$;
-- garra firme (p_grip 0.5 até sair firme): o ovo lendário vai para o ninho
do $$ declare k integer; f boolean; r record; begin
  for k in 1..40 loop
    update player_state set coins = 1000, pending_egg = false, last_action_at = now() - interval '3 s' where user_id = '66666666-6666-6666-6666-666666666666';
    select firm into f from rpc_egg_round_start('66666666-6666-6666-6666-666666666666',200,0.5);
    update player_state set last_action_at = now() - interval '3 s' where user_id = '66666666-6666-6666-6666-666666666666';
    if f then select * into r from rpc_egg_capture('66666666-6666-6666-6666-666666666666',true,3,1,7,90);
      raise notice 'OK ovo lendario na jogada % (firme): leg %, real %', k, r.leg, r.real_egg; exit; end if;
  end loop; end $$;
select 'ovos' t,leg,source,need_days between 7 and 90 as dias_ok,days,hint from legendary_eggs where user_id = :u;

-- o jogador NÃO consegue ler os dias secretos
set role authenticated;
select set_config('request.jwt.claim.sub','66666666-6666-6666-6666-666666666666',false);
do $$ begin perform need_days from legendary_eggs; exception when others then raise notice 'OK need_days escondido: %',sqlerrm; end $$;
select 'leitura liberada' t,leg,days,hint from legendary_eggs;
reset role;

-- carinho: 1 dia por dia; no mesmo dia não conta de novo
update legendary_eggs set need_days = 3 where user_id = :u;
select 'carinho dia 1' t,* from rpc_egg_care(:u,(select id from legendary_eggs where user_id = :u limit 1),116);
select 'carinho de novo no mesmo dia' t,* from rpc_egg_care(:u,(select id from legendary_eggs where user_id = :u limit 1),116);
-- pulou dias: não zera
update legendary_eggs set last_day = g_today() - 5 where user_id = :u;
select 'dia 2 (depois de pular)' t,* from rpc_egg_care(:u,(select id from legendary_eggs where user_id = :u limit 1),116);
update legendary_eggs set last_day = g_today() - 1 where user_id = :u;
select 'dia 3: choca' t,* from rpc_egg_care(:u,(select id from legendary_eggs where user_id = :u limit 1),116);
select 'coleção' t,plush_id,count from collection where user_id = :u;
select 'nível ao nascer' t,g_level(:u,46);
do $$ begin perform rpc_egg_care('66666666-6666-6666-6666-666666666666',(select id from legendary_eggs where user_id = '66666666-6666-6666-6666-666666666666' limit 1),116); exception when others then raise notice 'OK já chocou: %',sqlerrm; end $$;

-- lendário cuida, batalha e entra na aventura
select 'cuidar lendário' t,* from rpc_care(:u,46,'l',50,50,50);
update player_state set battle_at = null where user_id = :u;
select 'batalha lendário' t,* from rpc_battle(:u,46,true);
select 'aventura lendário' t,energy from rpc_adv_start(:u,46,'f01',null,5,60);

-- loja: 50 diamantes
do $$ begin perform rpc_egg_buy('66666666-6666-6666-6666-666666666666',2,50,7,90); exception when others then raise notice 'OK sem diamantes: %',sqlerrm; end $$;
update player_state set diamonds = 60 where user_id = :u;
select 'comprar ovo' t,* from rpc_egg_buy(:u,2,50,7,90);

-- aventura: chefão dá 1 diamante só na 1ª vez; 3 estrelas no mundo dá 1 diamante uma vez
insert into collection values (:u,10,1) on conflict do nothing;
update plush_care set xp = 396 where user_id = :u and plush_id = 46;
update adventure_run set started_at = now() - interval '30 s' where user_id = :u;
select 'fim f01 (3 estrelas, mundo só com f01)' t,diamonds,diamonds_got,egg_leg from rpc_adv_end(:u,'f01',true,3,1,8,2,10,1,false,0,'{}','m1','{f01}',1,1,-1,0,7,90);
select rpc_adv_start(:u,46,'f01',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id = :u;
select 'f01 de novo (prêmio do mundo já dado)' t,diamonds,diamonds_got from rpc_adv_end(:u,'f01',true,3,1,8,2,10,1,false,0,'{}','m1','{f01}',1,1,-1,0,7,90);
select rpc_adv_start(:u,46,'f10',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id = :u;
select 'chefão 1a vez' t,diamonds,diamonds_got from rpc_adv_end(:u,'f10',true,1,3,8,2,10,1,true,0,'{0}',null,null,1,1,-1,0,7,90);
select rpc_adv_start(:u,46,'f10',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id = :u;
select 'chefão de novo' t,diamonds,diamonds_got from rpc_adv_end(:u,'f10',true,1,3,8,2,10,1,true,0,'{0}',null,null,1,1,-1,0,7,90);

-- Desafio Lendário: o sorteio do ovo só vale na 1ª vitória do dia (chance 0.2 = máximo permitido)
select rpc_adv_start(:u,46,'lenda',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id = :u;
select 'desafio 1a vitória do dia' t,egg_leg from rpc_adv_end(:u,'lenda',true,1,0,8,2,10,1,false,0,'{}',null,null,0,0,7,0.2,7,90);
select 'dia do sorteio marcado' t,leg_roll_day = g_today() from player_state where user_id = :u;
update adventure_energy set energy = 5 where user_id = :u;
select rpc_adv_start(:u,46,'lenda',null,5,60); update adventure_run set started_at = now() - interval '30 s' where user_id = :u;
select 'desafio 2a vitória (sem sorteio)' t,egg_leg from rpc_adv_end(:u,'lenda',true,1,0,8,2,10,1,false,0,'{}',null,null,0,0,7,0.2,7,90);

-- diamante raro na máquina gigante
update player_state set coins = 100, last_action_at = now() - interval '3 s' where user_id = :u;
select rpc_giant_round_start(:u); update player_state set last_action_at = now() - interval '3 s' where user_id = :u;
select 'gigante com chance 0.2' t,diamond,diamonds from rpc_giant_capture(:u,3,0.2);
select 'prêmios únicos' t,award from diamond_awards where user_id = :u order by award;
