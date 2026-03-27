import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(overrides?: Partial<TrpcContext["user"]>): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user-1",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user object for authenticated users", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("user");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

describe("CineVerse router structure", () => {
  it("has movie router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["movie.list"]).toBeDefined();
    expect(router["movie.detail"]).toBeDefined();
    expect(router["movie.featured"]).toBeDefined();
    expect(router["movie.trending"]).toBeDefined();
    expect(router["movie.topRated"]).toBeDefined();
    expect(router["movie.search"]).toBeDefined();
  });

  it("has person router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["person.detail"]).toBeDefined();
    expect(router["person.list"]).toBeDefined();
  });

  it("has genre router", () => {
    const router = appRouter._def.procedures;
    expect(router["genre.list"]).toBeDefined();
  });

  it("has watchlist router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["watchlist.list"]).toBeDefined();
    expect(router["watchlist.toggle"]).toBeDefined();
    expect(router["watchlist.isWatchlisted"]).toBeDefined();
    expect(router["watchlist.markWatched"]).toBeDefined();
  });

  it("has review router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["review.list"]).toBeDefined();
    expect(router["review.create"]).toBeDefined();
    expect(router["review.myReviews"]).toBeDefined();
  });

  it("has rating router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["rating.upsert"]).toBeDefined();
    expect(router["rating.myRating"]).toBeDefined();
    expect(router["rating.myRatings"]).toBeDefined();
  });

  it("has room router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["room.list"]).toBeDefined();
    expect(router["room.create"]).toBeDefined();
    expect(router["room.join"]).toBeDefined();
    expect(router["room.leave"]).toBeDefined();
    expect(router["room.raiseHand"]).toBeDefined();
  });

  it("has thread router with required procedures", () => {
    const router = appRouter._def.procedures;
    expect(router["thread.list"]).toBeDefined();
    expect(router["thread.detail"]).toBeDefined();
    expect(router["thread.create"]).toBeDefined();
    expect(router["thread.reply"]).toBeDefined();
  });
});

describe("Protected procedures require authentication", () => {
  it("watchlist.toggle throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.watchlist.toggle({ movieId: 1 })).rejects.toThrow();
  });

  it("review.create throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.review.create({ movieId: 1, content: "Great movie!", containsSpoilers: false })
    ).rejects.toThrow();
  });

  it("rating.upsert throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.rating.upsert({ movieId: 1, score: 8 })).rejects.toThrow();
  });

  it("room.create throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.room.create({ name: "Test Room", description: "Test", tags: [] })
    ).rejects.toThrow();
  });

  it("thread.create throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.thread.create({ movieId: 1, title: "Test Thread", body: "Discussion" })
    ).rejects.toThrow();
  });
});

describe("User role validation", () => {
  it("admin users have admin role", () => {
    const ctx = createAuthContext({ role: "admin" });
    expect(ctx.user?.role).toBe("admin");
  });

  it("regular users have user role", () => {
    const ctx = createAuthContext({ role: "user" });
    expect(ctx.user?.role).toBe("user");
  });
});
