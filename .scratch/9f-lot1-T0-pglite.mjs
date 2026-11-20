import { PGlite } from 'file:///C:/Users/nicoj/AppData/Local/Temp/claude/9ddd3c09bf8b3398/3c76a052-57bf-4101-95c2-a12bc74e999b/scratchpad/pg/node_modules/@electric-sql/pglite/dist/index.js'
import { readFileSync } from 'fs'
const db = new PGlite()
await db.exec(`create table public.beats(id int, wav_url text, tags text[]); insert into public.beats values (1,'https://pub-f5c386abc.r2.dev/x.wav','{a}'),(2,'https://pub-6a8b/y.wav','{b}');`)
const r = await db.query(readFileSync('.scratch/9f-lot1-T0-myproducer.sql','utf8'))
console.log(JSON.stringify(r.rows))
