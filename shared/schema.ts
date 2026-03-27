import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const movieStatusEnum = pgEnum("movie_status", ["released", "upcoming", "in_production"]);
export const roomRoleEnum = pgEnum("room_role", ["host", "speaker", "listener"]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabaseId: varchar("supabase_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Genres ───────────────────────────────────────────────────────────────────
export const genres = pgTable("genres", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
});

export type Genre = typeof genres.$inferSelect;

// ─── Persons (actors, directors, crew) ────────────────────────────────────────
export const persons = pgTable("persons", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  photoUrl: text("photo_url"),
  bio: text("bio"),
  birthDate: varchar("birth_date", { length: 20 }),
  birthPlace: varchar("birth_place", { length: 255 }),
  knownFor: varchar("known_for", { length: 100 }),
  imdbId: varchar("imdb_id", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Person = typeof persons.$inferSelect;

// ─── Movies ───────────────────────────────────────────────────────────────────
export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 500 }).notNull().unique(),
  year: integer("year"),
  releaseDate: varchar("release_date", { length: 20 }),
  runtime: integer("runtime"),
  synopsis: text("synopsis"),
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  trailerUrl: text("trailer_url"),
  imdbId: varchar("imdb_id", { length: 20 }),
  imdbRating: real("imdb_rating"),
  rtScore: integer("rt_score"),
  letterboxdRating: real("letterboxd_rating"),
  avgUserRating: real("avg_user_rating").default(0),
  ratingCount: integer("rating_count").default(0),
  language: varchar("language", { length: 50 }),
  country: varchar("country", { length: 100 }),
  budget: varchar("budget", { length: 50 }),
  boxOffice: varchar("box_office", { length: 50 }),
  mpaaRating: varchar("mpaa_rating", { length: 10 }),
  status: movieStatusEnum("status").default("released"),
  featured: boolean("featured").default(false),
  trending: boolean("trending").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Movie = typeof movies.$inferSelect;

// ─── Movie Genres (junction) ──────────────────────────────────────────────────
export const movieGenres = pgTable("movie_genres", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id").notNull(),
  genreId: integer("genre_id").notNull(),
});

// ─── Movie Cast ───────────────────────────────────────────────────────────────
export const movieCast = pgTable("movie_cast", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id").notNull(),
  personId: integer("person_id").notNull(),
  character: varchar("character", { length: 255 }),
  order: integer("display_order").default(0),
});

export type MovieCast = typeof movieCast.$inferSelect;

// ─── Movie Crew ───────────────────────────────────────────────────────────────
export const movieCrew = pgTable("movie_crew", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id").notNull(),
  personId: integer("person_id").notNull(),
  job: varchar("job", { length: 100 }),
  department: varchar("department", { length: 100 }),
});

export type MovieCrew = typeof movieCrew.$inferSelect;

// ─── User Ratings ─────────────────────────────────────────────────────────────
export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  movieId: integer("movie_id").notNull(),
  rating: real("rating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Rating = typeof ratings.$inferSelect;

// ─── User Reviews ─────────────────────────────────────────────────────────────
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  movieId: integer("movie_id").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body").notNull(),
  containsSpoilers: boolean("contains_spoilers").default(false),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;

// ─── Watchlist ────────────────────────────────────────────────────────────────
export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  movieId: integer("movie_id").notNull(),
  watched: boolean("watched").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Watchlist = typeof watchlist.$inferSelect;

// ─── Discussion Threads ───────────────────────────────────────────────────────
export const threads = pgTable("threads", {
  id: serial("id").primaryKey(),
  movieId: integer("movie_id").notNull(),
  userId: integer("user_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body").notNull(),
  pinned: boolean("pinned").default(false),
  locked: boolean("locked").default(false),
  replyCount: integer("reply_count").default(0),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Thread = typeof threads.$inferSelect;

// ─── Thread Replies ───────────────────────────────────────────────────────────
export const threadReplies = pgTable("thread_replies", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull(),
  userId: integer("user_id").notNull(),
  parentReplyId: integer("parent_reply_id"),
  body: text("body").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ThreadReply = typeof threadReplies.$inferSelect;

// ─── Audio Rooms ──────────────────────────────────────────────────────────────
export const audioRooms = pgTable("audio_rooms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  hostUserId: integer("host_user_id").notNull(),
  relatedMovieId: integer("related_movie_id"),
  relatedPersonId: integer("related_person_id"),
  isLive: boolean("is_live").default(true),
  isRecorded: boolean("is_recorded").default(false),
  listenerCount: integer("listener_count").default(0),
  speakerCount: integer("speaker_count").default(0),
  tags: text("tags"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

export type AudioRoom = typeof audioRooms.$inferSelect;

// ─── Room Participants ────────────────────────────────────────────────────────
export const roomParticipants = pgTable("room_participants", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  role: roomRoleEnum("role").default("listener").notNull(),
  isMuted: boolean("is_muted").default(true),
  handRaised: boolean("hand_raised").default(false),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
});

export type RoomParticipant = typeof roomParticipants.$inferSelect;

// ─── Room Related Links ───────────────────────────────────────────────────────
export const roomRelatedLinks = pgTable("room_related_links", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  movieId: integer("movie_id"),
  personId: integer("person_id"),
  label: varchar("label", { length: 255 }),
  order: integer("display_order").default(0),
});
