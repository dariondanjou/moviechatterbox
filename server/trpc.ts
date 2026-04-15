import { initTRPC, TRPCError } from "@trpc/server";
import { supabase } from "./supabase";

interface Context {
  userId: number | null;
  supabaseUserId: string | null;
}

export async function createContext(req: Request): Promise<Context> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { userId: null, supabaseUserId: null };
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { userId: null, supabaseUserId: null };
  }

  // Look up the internal user ID from supabase_id
  const { db } = await import("./db");
  const { users } = await import("../shared/schema");
  const { eq } = await import("drizzle-orm");

  let [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseId, user.id))
    .limit(1);

  // Auto-create user row on first authenticated request
  if (!dbUser) {
    const name = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    const [created] = await db
      .insert(users)
      .values({
        supabaseId: user.id,
        name,
        email: user.email || null,
        avatarUrl,
      })
      .returning({ id: users.id });
    dbUser = created;
  }

  return {
    userId: dbUser?.id ?? null,
    supabaseUserId: user.id,
  };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
