import { protectedProcedure, publicProcedure, router } from "./trpc";
import { db } from "./db";
import { z } from "zod";
import {
  movies, genres, persons, movieGenres, movieCast, movieCrew,
  ratings, reviews, watchlist, threads, threadReplies, audioRooms, roomParticipants, roomRelatedLinks,
  users, userLists, userListItems,
} from "../shared/schema";
import { eq, and, or, like, desc, asc, sql, inArray, ne, isNull } from "drizzle-orm";

// ─── Movie Router ─────────────────────────────────────────────────────────────
const movieRouter = router({
  list: publicProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(24),
      genre: z.string().optional(),
      year: z.number().optional(),
      minRating: z.number().optional(),
      search: z.string().optional(),
      sortBy: z.enum(["imdbRating","year","title","ratingCount"]).default("imdbRating"),
      sortDir: z.enum(["asc","desc"]).default("desc"),
      featured: z.boolean().optional(),
      trending: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * input.limit;
      let query = db.select({
        id: movies.id, title: movies.title, slug: movies.slug,
        year: movies.year, runtime: movies.runtime, posterUrl: movies.posterUrl,
        imdbRating: movies.imdbRating, rtScore: movies.rtScore,
        letterboxdRating: movies.letterboxdRating, avgUserRating: movies.avgUserRating,
        ratingCount: movies.ratingCount, mpaaRating: movies.mpaaRating,
        synopsis: movies.synopsis, featured: movies.featured, trending: movies.trending,
        language: movies.language, country: movies.country,
      }).from(movies);

      const conditions: any[] = [];
      if (input.search) {
        conditions.push(like(movies.title, `%${input.search}%`));
      }
      if (input.year) {
        conditions.push(eq(movies.year, input.year));
      }
      if (input.minRating) {
        conditions.push(sql`${movies.imdbRating} >= ${input.minRating}`);
      }
      if (input.featured !== undefined) {
        conditions.push(eq(movies.featured, input.featured));
      }
      if (input.trending !== undefined) {
        conditions.push(eq(movies.trending, input.trending));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      // Genre filter via join
      if (input.genre) {
        const [genreRow] = await db.select().from(genres).where(eq(genres.slug, input.genre)).limit(1);
        if (genreRow) {
          const movieIdsWithGenre = await db
            .select({ movieId: movieGenres.movieId })
            .from(movieGenres)
            .where(eq(movieGenres.genreId, genreRow.id));
          const ids = movieIdsWithGenre.map(r => r.movieId);
          if (ids.length === 0) return { movies: [], total: 0 };
          query = query.where(inArray(movies.id, ids)) as any;
        }
      }

      const sortCol = input.sortBy === "imdbRating" ? movies.imdbRating
        : input.sortBy === "year" ? movies.year
        : input.sortBy === "ratingCount" ? movies.ratingCount
        : movies.title;

      const orderFn = input.sortDir === "asc" ? asc : desc;
      const results = await (query as any)
        .orderBy(orderFn(sortCol), asc(movies.title))
        .limit(input.limit)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(movies);
      return { movies: results, total: Number(count) };
    }),

  detail: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [movie] = await db.select().from(movies).where(eq(movies.slug, input.slug)).limit(1);
      if (!movie) return null;

      // Genres
      const movieGenreRows = await db
        .select({ id: genres.id, name: genres.name, slug: genres.slug })
        .from(movieGenres)
        .innerJoin(genres, eq(movieGenres.genreId, genres.id))
        .where(eq(movieGenres.movieId, movie.id));

      // Cast
      const castRows = await db
        .select({
          id: persons.id, name: persons.name, slug: persons.slug,
          photoUrl: persons.photoUrl, character: movieCast.character,
          order: movieCast.order,
        })
        .from(movieCast)
        .innerJoin(persons, eq(movieCast.personId, persons.id))
        .where(eq(movieCast.movieId, movie.id))
        .orderBy(asc(movieCast.order))
        .limit(20);

      // Crew
      const crewRows = await db
        .select({
          id: persons.id, name: persons.name, slug: persons.slug,
          photoUrl: persons.photoUrl, job: movieCrew.job, department: movieCrew.department,
        })
        .from(movieCrew)
        .innerJoin(persons, eq(movieCrew.personId, persons.id))
        .where(eq(movieCrew.movieId, movie.id))
        .limit(20);

      // Related movies (same genres)
      let relatedMovies: any[] = [];
      if (movieGenreRows.length > 0) {
        const genreIds = movieGenreRows.map(g => g.id);
        const relatedIds = await db
          .select({ movieId: movieGenres.movieId })
          .from(movieGenres)
          .where(and(inArray(movieGenres.genreId, genreIds), ne(movieGenres.movieId, movie.id)))
          .limit(12);
        const uniqueIds = Array.from(new Set(relatedIds.map(r => r.movieId))).slice(0, 6);
        if (uniqueIds.length > 0) {
          relatedMovies = await db
            .select({ id: movies.id, title: movies.title, slug: movies.slug, year: movies.year, posterUrl: movies.posterUrl, imdbRating: movies.imdbRating })
            .from(movies)
            .where(inArray(movies.id, uniqueIds));
        }
      }

      return { ...movie, genres: movieGenreRows, cast: castRows, crew: crewRows, relatedMovies };
    }),

  search: publicProcedure
    .input(z.object({ q: z.string(), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      if (!input.q.trim()) return { movies: [], persons: [] };

      const movieResults = await db
        .select({ id: movies.id, title: movies.title, slug: movies.slug, year: movies.year, posterUrl: movies.posterUrl, imdbRating: movies.imdbRating })
        .from(movies)
        .where(like(movies.title, `%${input.q}%`))
        .orderBy(desc(movies.imdbRating))
        .limit(input.limit);

      const personResults = await db
        .select({ id: persons.id, name: persons.name, slug: persons.slug, photoUrl: persons.photoUrl, knownFor: persons.knownFor })
        .from(persons)
        .where(like(persons.name, `%${input.q}%`))
        .limit(5);

      return { movies: movieResults, persons: personResults };
    }),

  featured: publicProcedure.query(async () => {
    return db.select({
      id: movies.id, title: movies.title, slug: movies.slug, year: movies.year,
      posterUrl: movies.posterUrl, backdropUrl: movies.backdropUrl,
      imdbRating: movies.imdbRating, synopsis: movies.synopsis, mpaaRating: movies.mpaaRating,
    }).from(movies).where(eq(movies.featured, true)).orderBy(desc(movies.imdbRating)).limit(5);
  }),

  trending: publicProcedure.query(async () => {
    return db.select({
      id: movies.id, title: movies.title, slug: movies.slug, year: movies.year,
      posterUrl: movies.posterUrl, imdbRating: movies.imdbRating, rtScore: movies.rtScore,
    }).from(movies).where(eq(movies.trending, true)).orderBy(desc(movies.imdbRating)).limit(12);
  }),

  topRated: publicProcedure.query(async () => {
    return db.select({
      id: movies.id, title: movies.title, slug: movies.slug, year: movies.year,
      posterUrl: movies.posterUrl, imdbRating: movies.imdbRating, rtScore: movies.rtScore,
    }).from(movies).where(sql`${movies.imdbRating} >= 8.0`).orderBy(desc(movies.imdbRating)).limit(12);
  }),
});

// ─── Genre Router ─────────────────────────────────────────────────────────────
const genreRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(genres).orderBy(asc(genres.name));
  }),
});

// ─── Person Router ────────────────────────────────────────────────────────────
const personRouter = router({
  detail: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [person] = await db.select().from(persons).where(eq(persons.slug, input.slug)).limit(1);
      if (!person) return null;

      // Filmography as actor
      const actingCredits = await db
        .select({
          id: movies.id, title: movies.title, slug: movies.slug, year: movies.year,
          posterUrl: movies.posterUrl, imdbRating: movies.imdbRating, character: movieCast.character,
        })
        .from(movieCast)
        .innerJoin(movies, eq(movieCast.movieId, movies.id))
        .where(eq(movieCast.personId, person.id))
        .orderBy(desc(movies.year))
        .limit(30);

      // Filmography as crew
      const crewCredits = await db
        .select({
          id: movies.id, title: movies.title, slug: movies.slug, year: movies.year,
          posterUrl: movies.posterUrl, imdbRating: movies.imdbRating, job: movieCrew.job,
        })
        .from(movieCrew)
        .innerJoin(movies, eq(movieCrew.movieId, movies.id))
        .where(eq(movieCrew.personId, person.id))
        .orderBy(desc(movies.year))
        .limit(30);

      return { ...person, actingCredits, crewCredits };
    }),

  list: publicProcedure
    .input(z.object({ search: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      let q = db.select().from(persons);
      if (input.search) {
        q = q.where(like(persons.name, `%${input.search}%`)) as any;
      }
      return (q as any).orderBy(asc(persons.name)).limit(input.limit);
    }),
});

// ─── Rating Router ────────────────────────────────────────────────────────────
const ratingRouter = router({
  upsert: protectedProcedure
    .input(z.object({ movieId: z.number(), rating: z.number().min(0.5).max(5) }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.select().from(ratings)
        .where(and(eq(ratings.userId, ctx.userId), eq(ratings.movieId, input.movieId)))
        .limit(1);
      if (existing.length > 0) {
        await db.update(ratings).set({ rating: input.rating }).where(eq(ratings.id, existing[0].id));
      } else {
        await db.insert(ratings).values({ userId: ctx.userId, movieId: input.movieId, rating: input.rating });
      }
      // Update movie avg
      const [avg] = await db.select({ avg: sql<number>`avg(rating)`, count: sql<number>`count(*)` })
        .from(ratings).where(eq(ratings.movieId, input.movieId));
      await db.update(movies).set({ avgUserRating: avg.avg, ratingCount: avg.count }).where(eq(movies.id, input.movieId));
      return { success: true };
    }),

  myRating: protectedProcedure
    .input(z.object({ movieId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [r] = await db.select().from(ratings)
        .where(and(eq(ratings.userId, ctx.userId), eq(ratings.movieId, input.movieId)))
        .limit(1);
      return r || null;
    }),

  myRatings: protectedProcedure.query(async ({ ctx }) => {
    return db.select({
      movieId: movies.id, title: movies.title, slug: movies.slug,
      year: movies.year, posterUrl: movies.posterUrl,
      rating: ratings.rating, createdAt: ratings.createdAt,
    }).from(ratings)
      .innerJoin(movies, eq(ratings.movieId, movies.id))
      .where(eq(ratings.userId, ctx.userId))
      .orderBy(desc(ratings.createdAt));
  }),
});

// ─── Review Router ────────────────────────────────────────────────────────────
const reviewRouter = router({
  list: publicProcedure
    .input(z.object({ movieId: z.number(), page: z.number().default(1) }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * 10;
      const results = await db
        .select({
          id: reviews.id, title: reviews.title, body: reviews.body,
          containsSpoilers: reviews.containsSpoilers, likes: reviews.likes,
          createdAt: reviews.createdAt,
          userName: sql<string>`(SELECT name FROM users WHERE id = ${reviews.userId})`,
          userAvatar: sql<string>`(SELECT avatar_url FROM users WHERE id = ${reviews.userId})`,
        })
        .from(reviews)
        .where(eq(reviews.movieId, input.movieId))
        .orderBy(desc(reviews.createdAt))
        .limit(10)
        .offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(reviews).where(eq(reviews.movieId, input.movieId));
      return { reviews: results, total: Number(count) };
    }),

  create: protectedProcedure
    .input(z.object({
      movieId: z.number(),
      title: z.string().optional(),
      body: z.string().min(10),
      containsSpoilers: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.insert(reviews).values({
        userId: ctx.userId, movieId: input.movieId,
        title: input.title, body: input.body, containsSpoilers: input.containsSpoilers,
      });
      return { success: true };
    }),

  myReviews: protectedProcedure.query(async ({ ctx }) => {
    return db.select({
      id: reviews.id, title: reviews.title, body: reviews.body,
      containsSpoilers: reviews.containsSpoilers, createdAt: reviews.createdAt,
      movieId: movies.id, movieTitle: movies.title, movieSlug: movies.slug,
      movieYear: movies.year, posterUrl: movies.posterUrl,
    }).from(reviews)
      .innerJoin(movies, eq(reviews.movieId, movies.id))
      .where(eq(reviews.userId, ctx.userId))
      .orderBy(desc(reviews.createdAt));
  }),
});

// ─── Watchlist Router ─────────────────────────────────────────────────────────
const watchlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: watchlist.id, watched: watchlist.watched, createdAt: watchlist.createdAt,
        movieId: movies.id, title: movies.title, slug: movies.slug,
        year: movies.year, posterUrl: movies.posterUrl, imdbRating: movies.imdbRating,
      })
      .from(watchlist)
      .innerJoin(movies, eq(watchlist.movieId, movies.id))
      .where(eq(watchlist.userId, ctx.userId))
      .orderBy(desc(watchlist.createdAt));
  }),

  toggle: protectedProcedure
    .input(z.object({ movieId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db.select().from(watchlist)
        .where(and(eq(watchlist.userId, ctx.userId), eq(watchlist.movieId, input.movieId)))
        .limit(1);
      if (existing) {
        await db.delete(watchlist).where(eq(watchlist.id, existing.id));
        return { added: false };
      } else {
        await db.insert(watchlist).values({ userId: ctx.userId, movieId: input.movieId });
        return { added: true };
      }
    }),

  isWatchlisted: protectedProcedure
    .input(z.object({ movieId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [r] = await db.select().from(watchlist)
        .where(and(eq(watchlist.userId, ctx.userId), eq(watchlist.movieId, input.movieId)))
        .limit(1);
      return !!r;
    }),

  markWatched: protectedProcedure
    .input(z.object({ movieId: z.number(), watched: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(watchlist).set({ watched: input.watched })
        .where(and(eq(watchlist.userId, ctx.userId), eq(watchlist.movieId, input.movieId)));
      return { success: true };
    }),
});

// ─── Thread Router ────────────────────────────────────────────────────────────
const threadRouter = router({
  list: publicProcedure
    .input(z.object({ movieId: z.number(), page: z.number().default(1) }))
    .query(async ({ input }) => {
      const offset = (input.page - 1) * 20;
      const results = await db
        .select({
          id: threads.id, title: threads.title, body: threads.body,
          pinned: threads.pinned, locked: threads.locked,
          replyCount: threads.replyCount, likes: threads.likes, createdAt: threads.createdAt,
          userName: sql<string>`(SELECT name FROM users WHERE id = ${threads.userId})`,
          userAvatar: sql<string>`(SELECT avatar_url FROM users WHERE id = ${threads.userId})`,
        })
        .from(threads)
        .where(eq(threads.movieId, input.movieId))
        .orderBy(desc(threads.pinned), desc(threads.createdAt))
        .limit(20)
        .offset(offset);
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(threads).where(eq(threads.movieId, input.movieId));
      return { threads: results, total: Number(count) };
    }),

  detail: publicProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const [thread] = await db.select().from(threads).where(eq(threads.id, input.threadId)).limit(1);
      if (!thread) return null;
      const replies = await db
        .select({
          id: threadReplies.id, body: threadReplies.body, likes: threadReplies.likes,
          parentReplyId: threadReplies.parentReplyId, createdAt: threadReplies.createdAt,
          userName: sql<string>`(SELECT name FROM users WHERE id = ${threadReplies.userId})`,
          userAvatar: sql<string>`(SELECT avatar_url FROM users WHERE id = ${threadReplies.userId})`,
        })
        .from(threadReplies)
        .where(eq(threadReplies.threadId, input.threadId))
        .orderBy(asc(threadReplies.createdAt));
      return { ...thread, replies };
    }),

  create: protectedProcedure
    .input(z.object({ movieId: z.number(), title: z.string().min(3), body: z.string().min(10) }))
    .mutation(async ({ input, ctx }) => {
      const [result] = await db.insert(threads).values({
        movieId: input.movieId, userId: ctx.userId, title: input.title, body: input.body,
      }).returning({ id: threads.id });
      return { id: result.id };
    }),

  reply: protectedProcedure
    .input(z.object({ threadId: z.number(), body: z.string().min(1), parentReplyId: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      await db.insert(threadReplies).values({
        threadId: input.threadId, userId: ctx.userId,
        body: input.body, parentReplyId: input.parentReplyId,
      });
      await db.update(threads).set({ replyCount: sql`${threads.replyCount} + 1` }).where(eq(threads.id, input.threadId));
      return { success: true };
    }),
});

// ─── Audio Room Router ────────────────────────────────────────────────────────
const roomRouter = router({
  list: publicProcedure.query(async () => {
    const rooms = await db
      .select({
        id: audioRooms.id, name: audioRooms.name, slug: audioRooms.slug,
        description: audioRooms.description, isLive: audioRooms.isLive,
        listenerCount: audioRooms.listenerCount, speakerCount: audioRooms.speakerCount,
        tags: audioRooms.tags, createdAt: audioRooms.createdAt,
        hostName: sql<string>`(SELECT name FROM users WHERE id = ${audioRooms.hostUserId})`,
        hostAvatar: sql<string>`(SELECT avatar_url FROM users WHERE id = ${audioRooms.hostUserId})`,
        relatedMovieId: audioRooms.relatedMovieId,
        relatedPersonId: audioRooms.relatedPersonId,
      })
      .from(audioRooms)
      .where(eq(audioRooms.isLive, true))
      .orderBy(desc(audioRooms.listenerCount));
    return rooms;
  }),

  pastRooms: publicProcedure
    .input(z.object({ limit: z.number().default(20), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const rooms = await db
        .select({
          id: audioRooms.id, name: audioRooms.name, slug: audioRooms.slug,
          description: audioRooms.description, isLive: audioRooms.isLive,
          listenerCount: audioRooms.listenerCount, speakerCount: audioRooms.speakerCount,
          tags: audioRooms.tags, createdAt: audioRooms.createdAt, endedAt: audioRooms.endedAt,
          recordingUrl: audioRooms.recordingUrl, recordingDuration: audioRooms.recordingDuration,
          hostName: sql<string>`(SELECT name FROM users WHERE id = ${audioRooms.hostUserId})`,
          hostAvatar: sql<string>`(SELECT avatar_url FROM users WHERE id = ${audioRooms.hostUserId})`,
        })
        .from(audioRooms)
        .where(eq(audioRooms.isLive, false))
        .orderBy(desc(audioRooms.endedAt))
        .limit(input.limit)
        .offset(input.offset);
      return rooms;
    }),

  detail: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [room] = await db.select().from(audioRooms).where(eq(audioRooms.slug, input.slug)).limit(1);
      if (!room) return null;

      // Get host info
      const [hostUser] = await db.select({
        name: users.name,
        supabaseId: users.supabaseId,
        avatarUrl: users.avatarUrl,
      }).from(users).where(eq(users.id, room.hostUserId)).limit(1);
      const hostName = hostUser?.name || "Unknown";
      const hostSubId = hostUser?.supabaseId || null;

      // Related movie
      let relatedMovie = null;
      if (room.relatedMovieId) {
        const [m] = await db.select({
          id: movies.id, title: movies.title, slug: movies.slug,
          posterUrl: movies.posterUrl, year: movies.year,
        }).from(movies).where(eq(movies.id, room.relatedMovieId)).limit(1);
        relatedMovie = m || null;
      }

      // Related person
      let relatedPerson = null;
      if (room.relatedPersonId) {
        const [p] = await db.select({
          id: persons.id, name: persons.name, slug: persons.slug, photoUrl: persons.photoUrl,
        }).from(persons).where(eq(persons.id, room.relatedPersonId)).limit(1);
        relatedPerson = p || null;
      }

      // Related links — enrich with movie/person data
      const rawLinks = await db
        .select().from(roomRelatedLinks).where(eq(roomRelatedLinks.roomId, room.id))
        .orderBy(asc(roomRelatedLinks.order));
      const links = await Promise.all(rawLinks.map(async (link) => {
        if (link.movieId) {
          const [m] = await db.select({ id: movies.id, title: movies.title, slug: movies.slug, posterUrl: movies.posterUrl, year: movies.year }).from(movies).where(eq(movies.id, link.movieId)).limit(1);
          return { ...link, linkType: 'movie' as const, title: m?.title || link.label, slug: m?.slug || '', posterUrl: m?.posterUrl || null, year: m?.year || null };
        } else if (link.personId) {
          const [p] = await db.select({ id: persons.id, name: persons.name, slug: persons.slug, photoUrl: persons.photoUrl }).from(persons).where(eq(persons.id, link.personId)).limit(1);
          return { ...link, linkType: 'person' as const, title: p?.name || link.label, slug: p?.slug || '', posterUrl: p?.photoUrl || null, year: null };
        }
        return { ...link, linkType: 'movie' as const, title: link.label, slug: '', posterUrl: null, year: null };
      }));

      // Participants
      const participants = await db
        .select({
          id: roomParticipants.id,
          odUserId: roomParticipants.userId,
          role: roomParticipants.role,
          isMuted: roomParticipants.isMuted, handRaised: roomParticipants.handRaised,
          joinedAt: roomParticipants.joinedAt,
          userName: sql<string>`(SELECT name FROM users WHERE id = ${roomParticipants.userId})`,
          userAvatar: sql<string>`(SELECT avatar_url FROM users WHERE id = ${roomParticipants.userId})`,
        })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, room.id), isNull(roomParticipants.leftAt)));

      return { ...room, hostName, hostSubId, relatedMovie, relatedPerson, links, participants };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(3).max(255),
      description: z.string().optional(),
      relatedMovieId: z.number().optional(),
      relatedPersonId: z.number().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const s = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now();
      await db.insert(audioRooms).values({
        name: input.name, slug: s, description: input.description,
        hostUserId: ctx.userId,
        relatedMovieId: input.relatedMovieId,
        relatedPersonId: input.relatedPersonId,
        tags: JSON.stringify(input.tags || []),
        isLive: true,
      });
      return { slug: s };
    }),

  join: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.select().from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, ctx.userId), isNull(roomParticipants.leftAt)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(roomParticipants).values({
          roomId: input.roomId, userId: ctx.userId, role: "listener",
        });
        await db.update(audioRooms).set({ listenerCount: sql`${audioRooms.listenerCount} + 1` }).where(eq(audioRooms.id, input.roomId));
      }
      return { success: true };
    }),

  leave: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(roomParticipants)
        .set({ leftAt: new Date() })
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, ctx.userId), isNull(roomParticipants.leftAt)));
      await db.update(audioRooms).set({ listenerCount: sql`GREATEST(0, ${audioRooms.listenerCount} - 1)` }).where(eq(audioRooms.id, input.roomId));

      // Auto-close room if no one is left
      const remaining = await db.select({ id: roomParticipants.id })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, input.roomId), isNull(roomParticipants.leftAt)))
        .limit(1);
      if (remaining.length === 0) {
        await db.update(audioRooms)
          .set({ isLive: false, endedAt: new Date(), listenerCount: 0, speakerCount: 0 })
          .where(eq(audioRooms.id, input.roomId));
      }

      return { success: true };
    }),

  raiseHand: protectedProcedure
    .input(z.object({ roomId: z.number(), raised: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(roomParticipants)
        .set({ handRaised: input.raised })
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, ctx.userId)));
      return { success: true };
    }),

  promoteToSpeaker: protectedProcedure
    .input(z.object({ roomId: z.number(), targetUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Only the host can promote
      const [room] = await db.select().from(audioRooms).where(eq(audioRooms.id, input.roomId)).limit(1);
      if (!room || room.hostUserId !== ctx.userId) {
        throw new Error("Only the host can promote speakers");
      }
      await db.update(roomParticipants)
        .set({ role: "speaker", handRaised: false })
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, input.targetUserId), isNull(roomParticipants.leftAt)));
      await db.update(audioRooms).set({ speakerCount: sql`${audioRooms.speakerCount} + 1` }).where(eq(audioRooms.id, input.roomId));
      return { success: true };
    }),

  demoteToListener: protectedProcedure
    .input(z.object({ roomId: z.number(), targetUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [room] = await db.select().from(audioRooms).where(eq(audioRooms.id, input.roomId)).limit(1);
      if (!room || room.hostUserId !== ctx.userId) {
        throw new Error("Only the host can demote speakers");
      }
      await db.update(roomParticipants)
        .set({ role: "listener" })
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, input.targetUserId), isNull(roomParticipants.leftAt)));
      await db.update(audioRooms).set({ speakerCount: sql`GREATEST(0, ${audioRooms.speakerCount} - 1)` }).where(eq(audioRooms.id, input.roomId));
      return { success: true };
    }),

  endRoom: protectedProcedure
    .input(z.object({ roomId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [room] = await db.select().from(audioRooms).where(eq(audioRooms.id, input.roomId)).limit(1);
      if (!room || room.hostUserId !== ctx.userId) {
        throw new Error("Only the host can end the room");
      }
      // Mark all participants as left
      await db.update(roomParticipants)
        .set({ leftAt: new Date() })
        .where(and(eq(roomParticipants.roomId, input.roomId), isNull(roomParticipants.leftAt)));
      // End the room
      await db.update(audioRooms)
        .set({ isLive: false, endedAt: new Date(), listenerCount: 0, speakerCount: 0 })
        .where(eq(audioRooms.id, input.roomId));
      return { success: true };
    }),

  updateRole: protectedProcedure
    .input(z.object({ roomId: z.number(), role: z.enum(["speaker", "listener"]) }))
    .mutation(async ({ input, ctx }) => {
      await db.update(roomParticipants)
        .set({ role: input.role })
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, ctx.userId), isNull(roomParticipants.leftAt)));
      if (input.role === "speaker") {
        await db.update(audioRooms).set({ speakerCount: sql`${audioRooms.speakerCount} + 1` }).where(eq(audioRooms.id, input.roomId));
      } else {
        await db.update(audioRooms).set({ speakerCount: sql`GREATEST(0, ${audioRooms.speakerCount} - 1)` }).where(eq(audioRooms.id, input.roomId));
      }
      return { success: true };
    }),

  makeHost: protectedProcedure
    .input(z.object({ roomId: z.number(), targetUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [room] = await db.select().from(audioRooms).where(eq(audioRooms.id, input.roomId)).limit(1);
      if (!room || room.hostUserId !== ctx.userId) {
        throw new Error("Only the current host can transfer host status");
      }
      // Transfer host to target user
      await db.update(audioRooms)
        .set({ hostUserId: input.targetUserId })
        .where(eq(audioRooms.id, input.roomId));
      // Ensure target is a speaker
      await db.update(roomParticipants)
        .set({ role: "speaker", handRaised: false })
        .where(and(eq(roomParticipants.roomId, input.roomId), eq(roomParticipants.userId, input.targetUserId), isNull(roomParticipants.leftAt)));
      return { success: true };
    }),
});

// ─── User Router ──────────────────────────────────────────────────────────────
const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select().from(users).where(eq(users.id, ctx.userId)).limit(1);
    return user || null;
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().optional(), bio: z.string().optional(), avatarUrl: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { avatarUrl, ...rest } = input;
      await db.update(users).set({ ...rest, ...(avatarUrl !== undefined ? { avatarUrl } : {}) }).where(eq(users.id, ctx.userId));
      return { success: true };
    }),
});

// ─── List Router ─────────────────────────────────────────────────────────────
const listRouter = router({
  // Get all lists for the authenticated user
  myLists: protectedProcedure.query(async ({ ctx }) => {
    const lists = await db
      .select({
        id: userLists.id, title: userLists.title, slug: userLists.slug,
        description: userLists.description, isPublic: userLists.isPublic,
        createdAt: userLists.createdAt, updatedAt: userLists.updatedAt,
        itemCount: sql<number>`(SELECT count(*) FROM user_list_items WHERE list_id = ${userLists.id})`,
      })
      .from(userLists)
      .where(eq(userLists.userId, ctx.userId))
      .orderBy(desc(userLists.updatedAt));
    return lists;
  }),

  // Get lists by user slug/id (public view)
  byUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const lists = await db
        .select({
          id: userLists.id, title: userLists.title, slug: userLists.slug,
          description: userLists.description,
          createdAt: userLists.createdAt,
          itemCount: sql<number>`(SELECT count(*) FROM user_list_items WHERE list_id = ${userLists.id})`,
        })
        .from(userLists)
        .where(and(eq(userLists.userId, input.userId), eq(userLists.isPublic, true)))
        .orderBy(desc(userLists.updatedAt));
      return lists;
    }),

  // Get a single list with items (public if public, or owner)
  detail: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input, ctx }) => {
      const [list] = await db.select().from(userLists).where(eq(userLists.slug, input.slug)).limit(1);
      if (!list) return null;

      // If not public, only the owner can view
      if (!list.isPublic && (!ctx.userId || ctx.userId !== list.userId)) return null;

      const items = await db
        .select({
          id: userListItems.id, note: userListItems.note, order: userListItems.order,
          movieId: movies.id, title: movies.title, slug: movies.slug,
          year: movies.year, posterUrl: movies.posterUrl, imdbRating: movies.imdbRating,
          runtime: movies.runtime, synopsis: movies.synopsis,
        })
        .from(userListItems)
        .innerJoin(movies, eq(userListItems.movieId, movies.id))
        .where(eq(userListItems.listId, list.id))
        .orderBy(asc(userListItems.order));

      // Get owner info
      const [owner] = await db.select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
        .from(users).where(eq(users.id, list.userId)).limit(1);

      return { ...list, items, owner, isOwner: ctx.userId === list.userId };
    }),

  // Create a new list
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      isPublic: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const base = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const slug = `${base}-${Date.now()}`;
      const [list] = await db.insert(userLists).values({
        userId: ctx.userId, title: input.title, slug,
        description: input.description, isPublic: input.isPublic,
      }).returning({ id: userLists.id, slug: userLists.slug });
      return list;
    }),

  // Update list title/description
  update: protectedProcedure
    .input(z.object({
      listId: z.number(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().optional(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [list] = await db.select().from(userLists)
        .where(and(eq(userLists.id, input.listId), eq(userLists.userId, ctx.userId))).limit(1);
      if (!list) throw new Error("List not found");
      const updates: any = { updatedAt: new Date() };
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.isPublic !== undefined) updates.isPublic = input.isPublic;
      await db.update(userLists).set(updates).where(eq(userLists.id, input.listId));
      return { success: true };
    }),

  // Delete a list
  delete: protectedProcedure
    .input(z.object({ listId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [list] = await db.select().from(userLists)
        .where(and(eq(userLists.id, input.listId), eq(userLists.userId, ctx.userId))).limit(1);
      if (!list) throw new Error("List not found");
      await db.delete(userListItems).where(eq(userListItems.listId, input.listId));
      await db.delete(userLists).where(eq(userLists.id, input.listId));
      return { success: true };
    }),

  // Add a movie to a list
  addItem: protectedProcedure
    .input(z.object({ listId: z.number(), movieId: z.number(), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [list] = await db.select().from(userLists)
        .where(and(eq(userLists.id, input.listId), eq(userLists.userId, ctx.userId))).limit(1);
      if (!list) throw new Error("List not found");
      // Get next order
      const [maxOrder] = await db.select({ max: sql<number>`coalesce(max(display_order), -1)` })
        .from(userListItems).where(eq(userListItems.listId, input.listId));
      await db.insert(userListItems).values({
        listId: input.listId, movieId: input.movieId,
        note: input.note, order: (maxOrder?.max ?? -1) + 1,
      });
      await db.update(userLists).set({ updatedAt: new Date() }).where(eq(userLists.id, input.listId));
      return { success: true };
    }),

  // Remove item from list
  removeItem: protectedProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [item] = await db.select({ listId: userListItems.listId })
        .from(userListItems).where(eq(userListItems.id, input.itemId)).limit(1);
      if (!item) throw new Error("Item not found");
      const [list] = await db.select().from(userLists)
        .where(and(eq(userLists.id, item.listId), eq(userLists.userId, ctx.userId))).limit(1);
      if (!list) throw new Error("Not your list");
      await db.delete(userListItems).where(eq(userListItems.id, input.itemId));
      await db.update(userLists).set({ updatedAt: new Date() }).where(eq(userLists.id, item.listId));
      return { success: true };
    }),

  // Update item note
  updateItem: protectedProcedure
    .input(z.object({ itemId: z.number(), note: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [item] = await db.select({ listId: userListItems.listId })
        .from(userListItems).where(eq(userListItems.id, input.itemId)).limit(1);
      if (!item) throw new Error("Item not found");
      const [list] = await db.select().from(userLists)
        .where(and(eq(userLists.id, item.listId), eq(userLists.userId, ctx.userId))).limit(1);
      if (!list) throw new Error("Not your list");
      await db.update(userListItems).set({ note: input.note ?? null }).where(eq(userListItems.id, input.itemId));
      return { success: true };
    }),

  // Reorder items
  reorder: protectedProcedure
    .input(z.object({ listId: z.number(), itemIds: z.array(z.number()) }))
    .mutation(async ({ input, ctx }) => {
      const [list] = await db.select().from(userLists)
        .where(and(eq(userLists.id, input.listId), eq(userLists.userId, ctx.userId))).limit(1);
      if (!list) throw new Error("Not your list");
      for (let i = 0; i < input.itemIds.length; i++) {
        await db.update(userListItems).set({ order: i }).where(eq(userListItems.id, input.itemIds[i]));
      }
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  movie: movieRouter,
  person: personRouter,
  genre: genreRouter,
  rating: ratingRouter,
  review: reviewRouter,
  watchlist: watchlistRouter,
  thread: threadRouter,
  room: roomRouter,
  user: userRouter,
  list: listRouter,
});

export type AppRouter = typeof appRouter;
