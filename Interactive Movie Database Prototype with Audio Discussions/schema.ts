import {
  boolean,
  float,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Genres ──────────────────────────────────────────────────────────────────
export const genres = mysqlTable("genres", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
});

export type Genre = typeof genres.$inferSelect;

// ─── Persons (actors, directors, crew) ───────────────────────────────────────
export const persons = mysqlTable("persons", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  photoUrl: text("photoUrl"),
  bio: text("bio"),
  birthDate: varchar("birthDate", { length: 20 }),
  birthPlace: varchar("birthPlace", { length: 255 }),
  knownFor: varchar("knownFor", { length: 100 }), // "Acting", "Directing", etc.
  imdbId: varchar("imdbId", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Person = typeof persons.$inferSelect;

// ─── Movies ───────────────────────────────────────────────────────────────────
export const movies = mysqlTable("movies", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  year: int("year"),
  releaseDate: varchar("releaseDate", { length: 20 }),
  runtime: int("runtime"), // minutes
  synopsis: text("synopsis"),
  posterUrl: text("posterUrl"),
  backdropUrl: text("backdropUrl"),
  trailerUrl: text("trailerUrl"),
  imdbId: varchar("imdbId", { length: 20 }),
  imdbRating: float("imdbRating"),
  rtScore: int("rtScore"), // Rotten Tomatoes %
  letterboxdRating: float("letterboxdRating"),
  avgUserRating: float("avgUserRating").default(0),
  ratingCount: int("ratingCount").default(0),
  language: varchar("language", { length: 50 }),
  country: varchar("country", { length: 100 }),
  budget: varchar("budget", { length: 50 }),
  boxOffice: varchar("boxOffice", { length: 50 }),
  mpaaRating: varchar("mpaaRating", { length: 10 }), // PG, PG-13, R, etc.
  status: mysqlEnum("status", ["released", "upcoming", "in_production"]).default("released"),
  featured: boolean("featured").default(false),
  trending: boolean("trending").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Movie = typeof movies.$inferSelect;

// ─── Movie Genres (junction) ──────────────────────────────────────────────────
export const movieGenres = mysqlTable("movie_genres", {
  id: int("id").autoincrement().primaryKey(),
  movieId: int("movieId").notNull(),
  genreId: int("genreId").notNull(),
});

// ─── Movie Cast ───────────────────────────────────────────────────────────────
export const movieCast = mysqlTable("movie_cast", {
  id: int("id").autoincrement().primaryKey(),
  movieId: int("movieId").notNull(),
  personId: int("personId").notNull(),
  character: varchar("character", { length: 255 }),
  order: int("order").default(0), // billing order
});

export type MovieCast = typeof movieCast.$inferSelect;

// ─── Movie Crew ───────────────────────────────────────────────────────────────
export const movieCrew = mysqlTable("movie_crew", {
  id: int("id").autoincrement().primaryKey(),
  movieId: int("movieId").notNull(),
  personId: int("personId").notNull(),
  job: varchar("job", { length: 100 }), // "Director", "Writer", "Cinematographer"
  department: varchar("department", { length: 100 }),
});

export type MovieCrew = typeof movieCrew.$inferSelect;

// ─── User Ratings ─────────────────────────────────────────────────────────────
export const ratings = mysqlTable("ratings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  movieId: int("movieId").notNull(),
  rating: float("rating").notNull(), // 0.5 to 5.0 (half-star)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Rating = typeof ratings.$inferSelect;

// ─── User Reviews ─────────────────────────────────────────────────────────────
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  movieId: int("movieId").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body").notNull(),
  containsSpoilers: boolean("containsSpoilers").default(false),
  likes: int("likes").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;

// ─── Watchlist ────────────────────────────────────────────────────────────────
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  movieId: int("movieId").notNull(),
  watched: boolean("watched").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;

// ─── Discussion Threads ───────────────────────────────────────────────────────
export const threads = mysqlTable("threads", {
  id: int("id").autoincrement().primaryKey(),
  movieId: int("movieId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false),
  locked: boolean("locked").default(false),
  replyCount: int("replyCount").default(0),
  likes: int("likes").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Thread = typeof threads.$inferSelect;

// ─── Thread Replies ───────────────────────────────────────────────────────────
export const threadReplies = mysqlTable("thread_replies", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("threadId").notNull(),
  userId: int("userId").notNull(),
  parentReplyId: int("parentReplyId"), // for nested replies
  body: text("body").notNull(),
  likes: int("likes").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ThreadReply = typeof threadReplies.$inferSelect;

// ─── Audio Rooms ──────────────────────────────────────────────────────────────
export const audioRooms = mysqlTable("audio_rooms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  hostUserId: int("hostUserId").notNull(),
  // Related entities (optional)
  relatedMovieId: int("relatedMovieId"),
  relatedPersonId: int("relatedPersonId"),
  isLive: boolean("isLive").default(true),
  isRecorded: boolean("isRecorded").default(false),
  listenerCount: int("listenerCount").default(0),
  speakerCount: int("speakerCount").default(0),
  tags: text("tags"), // JSON array of tags
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});

export type AudioRoom = typeof audioRooms.$inferSelect;

// ─── Room Participants ────────────────────────────────────────────────────────
export const roomParticipants = mysqlTable("room_participants", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["host", "speaker", "listener"]).default("listener").notNull(),
  isMuted: boolean("isMuted").default(true),
  handRaised: boolean("handRaised").default(false),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
});

export type RoomParticipant = typeof roomParticipants.$inferSelect;

// ─── Room Related Links ───────────────────────────────────────────────────────
export const roomRelatedLinks = mysqlTable("room_related_links", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  movieId: int("movieId"),
  personId: int("personId"),
  label: varchar("label", { length: 255 }),
  order: int("order").default(0),
});
