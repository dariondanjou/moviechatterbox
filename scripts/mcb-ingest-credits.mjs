// Credits ingestion: top cast + key crew for every title in mcb_titles.
// Usage: node scripts/mcb-ingest-credits.mjs [max-titles]
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const get = (name) => env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
const DATABASE_URL = get('DATABASE_URL');
const TMDB_API_KEY = get('TMDB_API_KEY');
if (!DATABASE_URL || !TMDB_API_KEY) throw new Error('missing env');

const MAX = Number(process.argv[2] ?? 500);
const TOP_CAST = 10;
const CREW_JOBS = new Set(['Director', 'Writer', 'Screenplay', 'Creator']);

async function tmdb(pathname) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${pathname} -> ${res.status}`);
  return res.json();
}

const sql = postgres(DATABASE_URL, { ssl: 'require', connect_timeout: 20, max: 1 });

try {
  // Titles that have no credits yet
  const titles = await sql`
    select t.id, t.tmdb_id, t.media_type, t.title
    from mcb_titles t
    where not exists (select 1 from mcb_credits c where c.title_id = t.id)
    order by t.popularity desc
    limit ${MAX}`;
  console.log(`ingesting credits for ${titles.length} titles`);

  let persons = 0;
  let credits = 0;

  for (const t of titles) {
    let data;
    try {
      data = await tmdb(`/${t.media_type}/${t.tmdb_id}/credits`);
    } catch (e) {
      console.warn(`skip ${t.title}: ${e.message}`);
      continue;
    }

    const cast = (data.cast ?? []).slice(0, TOP_CAST).map((c) => ({
      tmdb_id: c.id,
      name: c.name,
      profile_path: c.profile_path || null,
      known_for: c.known_for_department || null,
      popularity: c.popularity ?? 0,
      kind: 'cast',
      role: c.character || null,
      billing: c.order ?? 999,
    }));
    const crew = (data.crew ?? [])
      .filter((c) => CREW_JOBS.has(c.job))
      .map((c) => ({
        tmdb_id: c.id,
        name: c.name,
        profile_path: c.profile_path || null,
        known_for: c.known_for_department || null,
        popularity: c.popularity ?? 0,
        kind: 'crew',
        role: c.job,
        billing: 0,
      }));

    const people = [...cast, ...crew];
    if (!people.length) continue;

    // Upsert persons, keep tmdb_id -> uuid map
    const personRows = [...new Map(people.map((p) => [p.tmdb_id, p])).values()].map(
      (p) => ({
        tmdb_id: p.tmdb_id,
        name: p.name,
        profile_path: p.profile_path,
        known_for: p.known_for,
        popularity: p.popularity,
      }),
    );
    const upserted = await sql`
      insert into mcb_persons ${sql(personRows, 'tmdb_id', 'name', 'profile_path', 'known_for', 'popularity')}
      on conflict (tmdb_id) do update set
        name = excluded.name,
        profile_path = excluded.profile_path,
        popularity = excluded.popularity,
        updated_at = now()
      returning id, tmdb_id`;
    persons += upserted.length;
    const idByTmdb = new Map(upserted.map((r) => [Number(r.tmdb_id), r.id]));

    const creditRows = people
      .map((p) => ({
        person_id: idByTmdb.get(p.tmdb_id),
        title_id: t.id,
        kind: p.kind,
        role: p.role,
        billing: p.billing,
      }))
      .filter((c) => c.person_id);
    // Dedup (person may be both cast entries) on (person,title,kind)
    const seen = new Set();
    const unique = creditRows.filter((c) => {
      const k = `${c.person_id}:${c.kind}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (unique.length) {
      const ins = await sql`
        insert into mcb_credits ${sql(unique, 'person_id', 'title_id', 'kind', 'role', 'billing')}
        on conflict (person_id, title_id, kind) do update set
          role = excluded.role, billing = excluded.billing`;
      credits += ins.count;
    }
  }

  const [{ pcount }] = await sql`select count(*) as pcount from mcb_persons`;
  const [{ ccount }] = await sql`select count(*) as ccount from mcb_credits`;
  console.log(
    `done: ${persons} person upserts, ${credits} credit upserts; totals: ${pcount} persons, ${ccount} credits`,
  );
} finally {
  await sql.end();
}
