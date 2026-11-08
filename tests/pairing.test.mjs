import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
test('all incremental SQL parses; phone expenses migrate atomically while learning rows remain unchanged',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth,public to authenticated;`);
 for(const file of ['001_learning.sql','002_device_sync.sql','003_weekly_plans.sql','004_personal_records.sql','005_daily_planner.sql','006_daily_push.sql','007_device_link_and_word_batches.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 // Safe re-run of only the new migrations.
 for(const file of ['005_daily_planner.sql','006_daily_push.sql','007_device_link_and_word_batches.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 // Supabase grants public schema table access by default; reproduce existing platform grants in this bare PostgreSQL test.
 await db.exec('grant select on vocab_cards,vocab_reviews,budgets to authenticated;');
 const owner='00000000-0000-4000-8000-000000000001',phone='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
 await db.exec(`insert into auth.users values('${owner}'),('${phone}'),('${other}');set role authenticated;select set_config('test.uid','${owner}',false);`);
 await db.query('select burgut_review($1,$2,$3,$4)',['review-0001','en|hello','correct',new Date(Date.now()-10000).toISOString()]);
 const before=JSON.stringify((await db.query('select * from vocab_cards')).rows);
 const code=(await db.query('select burgut_pair_create() as code')).rows[0].code;
 await db.exec(`select set_config('test.uid','${phone}',false);`);
 await db.query('select burgut_record_save($1::jsonb)',[JSON.stringify({kind:'expense',id:'phone-expense',data:{amount:25,currency:'TRY',date:'2026-11-05'},updatedAt:new Date().toISOString()})]);
 const linked=(await db.query('select burgut_pair_claim($1::uuid) as owner',[code])).rows[0].owner;assert.equal(linked,owner);
 assert.equal((await db.query('select * from burgut_records')).rows[0].data.amount,25);
 assert.equal(JSON.stringify((await db.query('select * from vocab_cards')).rows),before);
 await assert.rejects(db.query('select burgut_pair_claim($1::uuid)',[code]),/Kod yaroqsiz/);
 await db.exec(`select set_config('test.uid','${other}',false);`);
 assert.equal((await db.query('select * from burgut_records')).rows.length,0);
 await db.query('select burgut_review($1,$2,$3,$4)',['review-0002','tr|deneyim','hard',new Date(Date.now()-10000).toISOString()]);
 await db.exec(`select set_config('test.uid','${owner}',false);`);const another=(await db.query('select burgut_pair_create() as code')).rows[0].code;
 await db.exec(`select set_config('test.uid','${other}',false);`);
 await assert.rejects(db.query('select burgut_pair_claim($1::uuid)',[another]),/o‘quv tarixi/);
 assert.equal((await db.query('select * from vocab_reviews')).rows.length,1);
 }finally{await db.close();}
});
