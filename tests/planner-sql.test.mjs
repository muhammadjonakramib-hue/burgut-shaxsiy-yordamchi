import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
test('planner SQL: RLS isolation, recurrence history, per-day state and conflict protection',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;create function public.burgut_owner() returns uuid language sql as $$select auth.uid()$$;`);
 for(const name of ['005_daily_planner.sql','006_daily_push.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+name,import.meta.url),'utf8'));
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',id='11111111-1111-4111-8111-111111111111';
 await db.exec(`insert into auth.users values('${a}'),('${b}');set role authenticated;select set_config('test.uid','${a}',false);`);
 const item={id,title:'Dars',start_date:'2026-11-01',start_min:480,end_min:540,category:'study',color:'#446688',repeat:'daily',weekdays:[],timezone:'Asia/Tashkent',note:'',reminder:15};
 await db.query('select burgut_daily_save($1::jsonb)',[JSON.stringify(item)]);
 await db.query('select burgut_daily_occurrence($1::jsonb,0)',[JSON.stringify({template_id:id,date:'2026-11-05',status:'done',patch:{}})]);
 await assert.rejects(db.query('select burgut_daily_occurrence($1::jsonb,0)',[JSON.stringify({template_id:id,date:'2026-11-05',status:'pending'})]),/o‘zgargan/);
 await db.query('select burgut_daily_save($1::jsonb,$2::uuid,$3::date,1)',[JSON.stringify({...item,id:'22222222-2222-4222-8222-222222222222',start_date:'2026-11-06',start_min:600,end_min:660}),id,'2026-11-06']);
 const past=(await db.query('select * from burgut_daily_templates where id=$1',[id])).rows[0];assert.equal(past.until_date.toISOString().slice(0,10),'2026-11-05');assert.equal(past.start_min,480);
 assert.equal((await db.query('select status from burgut_daily_occurrences')).rows[0].status,'done');
 await db.exec(`select set_config('test.uid','${b}',false);`);
 assert.equal((await db.query('select * from burgut_daily_templates')).rows.length,0);
 await assert.rejects(db.query('select burgut_daily_occurrence($1::jsonb,1)',[JSON.stringify({template_id:id,date:'2026-11-05',status:'pending'})]),/topilmadi/);
 await assert.rejects(db.query('insert into burgut_daily_templates(user_id,id)values($1,$2)',[a,id]),/permission denied/);
 }finally{await db.close();}
});
