-- Teste local da migração 0017 (mochila: vender itens e trocar com outro jogador). NÃO roda no deploy.
\set a '''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'''
\set b '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''
insert into auth.users(id, email) values (:a, 'ana@teste.com'), (:b, 'Beto@Teste.com');
insert into player_state(user_id, coins) values (:a, 10), (:b, 10) on conflict (user_id) do update set coins = 10;
insert into inventory(user_id, item, qty) values (:a, 'food', 6), (:a, 'stone_3', 2), (:b, 'stone_1', 4)
  on conflict (user_id, item) do update set qty = excluded.qty;
delete from inventory where user_id = :b and item <> 'stone_1';
delete from legendary_eggs where user_id in (:a, :b);
insert into legendary_eggs(user_id, leg, need_days, days, source) values (:a, 2, 5, 3, 'maquina');
-- venda
select 'vende 2 comidas a 2: moedas 14, sobram 4' t, * from rpc_item_sell(:a, 'food', 2, 2);
do $$ begin perform rpc_item_sell('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','stone_3',3,80); exception when others then raise notice 'OK não vende 3 pedras tendo 2: %',sqlerrm; end $$;
do $$ begin perform rpc_item_sell('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','stone_9',1,80); exception when others then raise notice 'OK item inválido: %',sqlerrm; end $$;
-- proposta: Ana dá 1 comida + 1 pedra 3 + o ovo e pede 2 pedras 1 do Beto
select 'proposta criada' t, id is not null ok from rpc_trade_offer(:a, ' beto@teste.com ', '{"food":1,"stone_3":1}', (select array_agg(id) from legendary_eggs where user_id = :a), '{"stone_1":2}');
select 'itens da Ana guardados: comida 3, pedra3 1' t, string_agg(item||'='||qty, ',' order by item) from inventory where user_id = :a;
select 'ovo guardado na proposta' t, trade_id is not null ok from legendary_eggs where user_id = :a;
do $$ begin perform rpc_trade_offer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ninguem@x.com','{"food":1}','{}','{}'); exception when others then raise notice 'OK e-mail desconhecido: %',sqlerrm; end $$;
do $$ begin perform rpc_trade_offer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','ana@teste.com','{"food":1}','{}','{}'); exception when others then raise notice 'OK consigo mesma: %',sqlerrm; end $$;
do $$ begin perform rpc_trade_offer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','beto@teste.com','{"food":50}','{}','{}'); exception when others then raise notice 'OK sem comida bastante: %',sqlerrm; end $$;
select 'só a proposta boa ficou (1)' t, count(*) from trade_offers;
select 'lista do Beto' t, mine, other, give, jsonb_array_length(give_eggs) ovos, want, status from rpc_trade_list(:b);
-- Beto aceita
select 'Beto aceita' t, * from rpc_trade_answer(:b, (select max(id) from trade_offers), true);
select 'Ana: comida 3, pedra1 2, pedra3 1' t, string_agg(item||'='||qty, ',' order by item) from inventory where user_id = :a;
select 'Beto: comida 1, pedra1 2, pedra3 1' t, string_agg(item||'='||qty, ',' order by item) from inventory where user_id = :b;
select 'ovo agora é do Beto, com os 3 dias' t, user_id = :b dono, days, trade_id is null livre from legendary_eggs where leg = 2 and user_id in (:a, :b);
do $$ begin perform rpc_trade_answer('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',(select max(id) from trade_offers),true); exception when others then raise notice 'OK não aceita duas vezes: %',sqlerrm; end $$;
-- Beto propõe, Ana não tem o pedido: aceitar falha e nada muda; depois Beto cancela e recebe de volta
select 'proposta 2' t, id is not null ok from rpc_trade_offer(:b, 'ana@teste.com', '{"stone_1":1}', '{}', '{"stone_5":1}');
do $$ begin perform rpc_trade_answer('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',(select max(id) from trade_offers),true); exception when others then raise notice 'OK Ana sem pedra 5: %',sqlerrm; end $$;
select 'continua aberta' t, status from trade_offers where id = (select max(id) from trade_offers);
do $$ begin perform rpc_trade_answer('cccccccc-cccc-cccc-cccc-cccccccccccc',(select max(id) from trade_offers),false); exception when others then raise notice 'OK estranho não mexe: %',sqlerrm; end $$;
select 'Beto cancela' t, * from rpc_trade_answer(:b, (select max(id) from trade_offers), false);
select 'Beto recebeu a pedra 1 de volta: 2' t, qty from inventory where user_id = :b and item = 'stone_1';
