import { NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { eq, isNull, or, sql } from "drizzle-orm";
import { persons } from "../../../../shared/schema";

// Fills in bios, birth dates, and IMDB IDs for persons missing that data
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TMDB_KEY = process.env.TMDB_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

async function tmdbFetch<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${TMDB}${path}${sep}api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "5", 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return tmdbFetch<T>(path);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`);
  return res.json() as T;
}

export async function GET(request: Request) {
  // Verify cron secret (skip in development; allow Vercel cron)
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";
    if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!TMDB_KEY) {
    return NextResponse.json({ error: "TMDB_API_KEY not configured" }, { status: 500 });
  }

  const startTime = Date.now();
  const maxRuntime = 50_000; // 50s safety margin
  let enriched = 0;
  let searched = 0;
  const errors: string[] = [];

  try {
    // Get batch of persons without bios (prioritize those with photos — they're likely real cast/crew)
    const batch = await db
      .select({ id: persons.id, name: persons.name, slug: persons.slug })
      .from(persons)
      .where(or(isNull(persons.bio), eq(persons.bio, "")))
      .orderBy(sql`CASE WHEN ${persons.photoUrl} IS NOT NULL THEN 0 ELSE 1 END, ${persons.id}`)
      .limit(100);

    for (const person of batch) {
      if (Date.now() - startTime > maxRuntime) break;
      searched++;

      try {
        // Search TMDB for this person
        const searchResult = await tmdbFetch<{ results: any[] }>(
          `/search/person?query=${encodeURIComponent(person.name)}`
        );

        if (!searchResult.results?.length) continue;

        // Find best match (exact name match preferred)
        const match = searchResult.results.find(
          (r: any) => r.name.toLowerCase() === person.name.toLowerCase()
        ) || searchResult.results[0];

        // Fetch full details
        const detail = await tmdbFetch<any>(`/person/${match.id}`);

        if (!detail.biography && !detail.birthday && !detail.imdb_id) continue;

        const updates: any = {};
        if (detail.biography) updates.bio = detail.biography;
        if (detail.birthday) updates.birthDate = detail.birthday;
        if (detail.place_of_birth) updates.birthPlace = detail.place_of_birth;
        if (detail.imdb_id) updates.imdbId = detail.imdb_id;
        if (detail.known_for_department) updates.knownFor = detail.known_for_department;
        if (!person.slug && detail.profile_path) {
          updates.photoUrl = `${IMG}/w500${detail.profile_path}`;
        }

        if (Object.keys(updates).length > 0) {
          await db.update(persons).set(updates).where(eq(persons.id, person.id));
          enriched++;
        }
      } catch (e: any) {
        errors.push(`${person.name}: ${e.message}`);
      }
    }
  } catch (e: any) {
    errors.push(`fatal: ${e.message}`);
  }

  return NextResponse.json({
    ok: true,
    searched,
    enriched,
    runtime: `${Math.round((Date.now() - startTime) / 1000)}s`,
    errors: errors.slice(0, 10),
  });
}
