// Nightly TMDB ingest (FR-2.2.1) — keeps the catalog growing unattended
// (Solo-Operator Principle §1.2). Scheduled by pg_cron; guarded by an
// x-ingest-key header so only the scheduler can trigger it.
import { createClient } from 'npm:@supabase/supabase-js@2';

const TMDB = 'https://api.themoviedb.org/3';
const HORROR = 27;
const TOP_CAST = 10;
const CREW_JOBS = new Set(['Director', 'Writer', 'Screenplay', 'Creator']);

async function tmdb(path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set('api_key', Deno.env.get('TMDB_API_KEY')!);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${path} -> ${res.status}`);
  return res.json();
}

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  genre_ids?: number[];
  popularity?: number;
  vote_average?: number;
  media_type?: string;
};

Deno.serve(async (req) => {
  if (req.headers.get('x-ingest-key') !== Deno.env.get('INGEST_KEY')) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const genreNames = new Map<string, string>();
  for (const type of ['movie', 'tv']) {
    const { genres } = await tmdb(`/genre/${type}/list`);
    for (const g of genres) genreNames.set(`${type}:${g.id}`, g.name);
  }

  const mapItem = (item: TmdbItem, mediaType: string) => {
    const date = item.release_date ?? item.first_air_date ?? '';
    return {
      tmdb_id: item.id,
      media_type: mediaType,
      title: item.title ?? item.name ?? 'Untitled',
      year: date ? Number(date.slice(0, 4)) : null,
      overview: item.overview || null,
      poster_path: item.poster_path || null,
      backdrop_path: item.backdrop_path || null,
      genres: (item.genre_ids ?? [])
        .map((id) => genreNames.get(`${mediaType}:${id}`))
        .filter(Boolean),
      popularity: item.popularity ?? 0,
      vote_average: item.vote_average ?? null,
      updated_at: new Date().toISOString(),
    };
  };

  // Gather the day's slate
  const rows = [];
  for (let page = 1; page <= 2; page++) {
    const trending = await tmdb('/trending/all/day', { page });
    for (const item of trending.results as TmdbItem[]) {
      if (item.media_type === 'movie' || item.media_type === 'tv') {
        rows.push(mapItem(item, item.media_type));
      }
    }
    const horror = await tmdb('/discover/movie', {
      with_genres: HORROR,
      sort_by: 'popularity.desc',
      page,
      'vote_count.gte': 20,
    });
    for (const item of horror.results as TmdbItem[]) rows.push(mapItem(item, 'movie'));
  }

  // Dedupe: trending overlaps discover, and one statement can't update the
  // same row twice
  const unique = [
    ...new Map(rows.map((r) => [`${r.media_type}:${r.tmdb_id}`, r])).values(),
  ];
  const { error: upsertErr } = await db
    .from('mcb_titles')
    .upsert(unique, { onConflict: 'media_type,tmdb_id' });
  if (upsertErr) {
    return new Response(JSON.stringify({ error: upsertErr.message }), { status: 500 });
  }

  // Credits for titles that don't have any yet (bounded per run)
  const { data: missing } = await db
    .from('mcb_titles')
    .select('id, tmdb_id, media_type')
    .order('popularity', { ascending: false })
    .limit(400);
  const { data: withCredits } = await db
    .from('mcb_credits')
    .select('title_id')
    .in('title_id', (missing ?? []).map((t) => t.id));
  const covered = new Set((withCredits ?? []).map((c) => c.title_id));
  const targets = (missing ?? []).filter((t) => !covered.has(t.id)).slice(0, 25);

  let creditCount = 0;
  for (const t of targets) {
    const data = await tmdb(`/${t.media_type}/${t.tmdb_id}/credits`).catch(() => null);
    if (!data) continue;
    const people = [
      ...(data.cast ?? []).slice(0, TOP_CAST).map((c: Record<string, unknown>) => ({
        person: c,
        kind: 'cast',
        role: (c.character as string) || null,
        billing: (c.order as number) ?? 999,
      })),
      ...(data.crew ?? [])
        .filter((c: Record<string, unknown>) => CREW_JOBS.has(c.job as string))
        .map((c: Record<string, unknown>) => ({
          person: c,
          kind: 'crew',
          role: c.job as string,
          billing: 0,
        })),
    ];
    if (!people.length) continue;

    const personRows = [
      ...new Map(
        people.map((p) => [
          p.person.id,
          {
            tmdb_id: p.person.id as number,
            name: p.person.name as string,
            profile_path: (p.person.profile_path as string) || null,
            known_for: (p.person.known_for_department as string) || null,
            popularity: (p.person.popularity as number) ?? 0,
            updated_at: new Date().toISOString(),
          },
        ]),
      ).values(),
    ];
    const { data: upserted } = await db
      .from('mcb_persons')
      .upsert(personRows, { onConflict: 'tmdb_id' })
      .select('id, tmdb_id');
    const idByTmdb = new Map((upserted ?? []).map((r) => [Number(r.tmdb_id), r.id]));

    const seen = new Set<string>();
    const creditRows = people
      .map((p) => ({
        person_id: idByTmdb.get(p.person.id as number),
        title_id: t.id,
        kind: p.kind,
        role: p.role,
        billing: p.billing,
      }))
      .filter((c) => {
        if (!c.person_id) return false;
        const k = `${c.person_id}:${c.kind}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    const { error } = await db
      .from('mcb_credits')
      .upsert(creditRows, { onConflict: 'person_id,title_id,kind' });
    if (!error) creditCount += creditRows.length;
  }

  return new Response(
    JSON.stringify({ titles: unique.length, creditTitles: targets.length, credits: creditCount }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
