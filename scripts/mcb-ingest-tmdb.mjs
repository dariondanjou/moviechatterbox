// TMDB ingestion for the MovieChatterbox rebuild (FR-2.2.1, launch vertical:
// horror §1.3). Upserts into mcb_titles keyed on (media_type, tmdb_id).
// Usage: node scripts/mcb-ingest-tmdb.mjs [pages-per-list]
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const get = (name) => env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
const DATABASE_URL = get('DATABASE_URL');
const TMDB_API_KEY = get('TMDB_API_KEY');
if (!DATABASE_URL || !TMDB_API_KEY) throw new Error('missing DATABASE_URL or TMDB_API_KEY in .env');

const PAGES = Number(process.argv[2] ?? 5);
const HORROR = 27; // TMDB genre id

const genreNames = new Map();

async function tmdb(pathname, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${pathname} -> ${res.status}`);
  return res.json();
}

async function loadGenres() {
  for (const type of ['movie', 'tv']) {
    const { genres } = await tmdb(`/genre/${type}/list`);
    for (const g of genres) genreNames.set(`${type}:${g.id}`, g.name);
  }
}

function mapItem(item, mediaType) {
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
  };
}

const sql = postgres(DATABASE_URL, { ssl: 'require', connect_timeout: 20, max: 1 });

async function upsert(rows) {
  if (!rows.length) return 0;
  const result = await sql`
    insert into mcb_titles ${sql(
      rows,
      'tmdb_id', 'media_type', 'title', 'year', 'overview', 'poster_path',
      'backdrop_path', 'genres', 'popularity', 'vote_average',
    )}
    on conflict (media_type, tmdb_id) do update set
      title = excluded.title,
      year = excluded.year,
      overview = excluded.overview,
      poster_path = excluded.poster_path,
      backdrop_path = excluded.backdrop_path,
      genres = excluded.genres,
      popularity = excluded.popularity,
      vote_average = excluded.vote_average,
      updated_at = now()
  `;
  return result.count;
}

try {
  await loadGenres();
  let total = 0;

  // Horror vertical: most popular horror films + TV, several pages deep
  for (let page = 1; page <= PAGES; page++) {
    const movies = await tmdb('/discover/movie', {
      with_genres: HORROR, sort_by: 'popularity.desc', page,
      'vote_count.gte': 50,
    });
    total += await upsert(movies.results.map((m) => mapItem(m, 'movie')));

    const tv = await tmdb('/discover/tv', {
      with_genres: HORROR, sort_by: 'popularity.desc', page,
      'vote_count.gte': 25,
    });
    total += await upsert(tv.results.map((t) => mapItem(t, 'tv')));
  }

  // Popular across all genres — conversations aren't horror-only even if
  // launch programming is (§1.3)
  for (let page = 1; page <= Math.max(2, Math.floor(PAGES / 2)); page++) {
    const movies = await tmdb('/movie/popular', { page });
    total += await upsert(movies.results.map((m) => mapItem(m, 'movie')));
    const tv = await tmdb('/tv/popular', { page });
    total += await upsert(tv.results.map((t) => mapItem(t, 'tv')));
    const top = await tmdb('/movie/top_rated', { page });
    total += await upsert(top.results.map((m) => mapItem(m, 'movie')));
  }

  // Plus what everyone is talking about right now, all genres
  for (let page = 1; page <= 2; page++) {
    const trending = await tmdb('/trending/all/week', { page });
    const items = trending.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv');
    total += await upsert(items.map((i) => mapItem(i, i.media_type)));
  }

  const [{ count }] = await sql`select count(*) from mcb_titles`;
  console.log(`upserted ${total} rows; mcb_titles now holds ${count} titles`);
} finally {
  await sql.end();
}
