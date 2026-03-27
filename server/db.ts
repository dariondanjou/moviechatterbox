import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

const isPooler = process.env.DATABASE_URL?.includes("pooler.supabase.com");

const client = isPooler
  ? postgres(process.env.DATABASE_URL!, {
      prepare: false,
    })
  : postgres(process.env.DATABASE_URL!);

export const db = drizzle(client, { schema });
