import { NextRequest, NextResponse } from "next/server";
import { createContext } from "../../../../server/trpc";
import { db } from "../../../../server/db";
import { audioRooms, roomParticipants } from "../../../../shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

// Simple leave endpoint for sendBeacon (fires on page close)
export async function POST(req: NextRequest) {
  const ctx = await createContext(req);
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { roomId } = await req.json();
    if (!roomId) {
      return NextResponse.json({ error: "roomId required" }, { status: 400 });
    }

    await db.update(roomParticipants)
      .set({ leftAt: new Date() })
      .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, ctx.userId), isNull(roomParticipants.leftAt)));
    await db.update(audioRooms)
      .set({ listenerCount: sql`GREATEST(0, ${audioRooms.listenerCount} - 1)` })
      .where(eq(audioRooms.id, roomId));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
