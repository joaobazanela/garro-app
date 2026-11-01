-- Teste local da migração 0013 (curva mais difícil e limite de XP de cuidar por dia). NÃO roda no deploy.
\set u '''77777777-7777-7777-7777-777777777777'''
insert into auth.users(id) values (:u);
insert into collection values (:u,4,1);
insert into inventory(user_id,item,qty) values (:u,'food',50) on conflict (user_id,item) do update set qty=50;
select 'curva: Nv10 grande=112, Nv30=1022, Nv10 redondo=130' t, g_xp_total(4,10) a, g_xp_total(4,30) b, g_xp_total(25,10) c;
select 'XP antigo de Nv 30 (409) agora dá' t, g_lv_xp(4,409) nv;
do $$ declare k int; x int; begin
  for k in 1..10 loop
    update player_state set care_at = null where user_id='77777777-7777-7777-7777-777777777777';
    select r.xp into x from rpc_care('77777777-7777-7777-7777-777777777777',4,'f',50,50,50) r;
    raise notice 'comida % → xp %', k, x;
  end loop; end $$;
select 'depois de 10 comidas: xp 30 (limite), hoje 30, comida 40' t, pc.xp, pc.care_xp_dia, (select qty from inventory where user_id=:u and item='food') comida
  from plush_care pc where user_id=:u and plush_id=4;
update plush_care set care_dia = care_dia - 1 where user_id=:u and plush_id=4;
update player_state set care_at = null where user_id=:u;
select 'dia seguinte: volta a ganhar (36)' t, xp from rpc_care(:u,4,'f',50,50,50);
