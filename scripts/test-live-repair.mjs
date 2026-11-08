import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;grant usage on schema auth,public to authenticated;`);
for(const f of ['001_learning.sql','002_device_sync.sql','003_weekly_plans.sql','004_personal_records.sql'])await db.exec(fs.readFileSync(new URL('../supabase/'+f,import.meta.url),'utf8'));
await db.exec(fs.readFileSync(new URL('../supabase/REPAIR_EXISTING_DAILY.sql',import.meta.url),'utf8'));
console.log('Atomic repair SQL passed PostgreSQL test');
}finally{await db.close();}
