import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createContext } from "../../../../server/trpc";
import { db } from "../../../../server/db";
import { audioRooms } from "../../../../shared/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const ctx = await createContext(req);
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("recording") as File | null;
  const roomId = formData.get("roomId") as string | null;
  const duration = formData.get("duration") as string | null;
  const speakerTimeline = formData.get("speakerTimeline") as string | null;

  if (!file || !roomId) {
    return NextResponse.json({ error: "recording and roomId required" }, { status: 400 });
  }

  // Verify the user is the host of this room
  const [room] = await db
    .select()
    .from(audioRooms)
    .where(eq(audioRooms.id, parseInt(roomId)))
    .limit(1);

  if (!room || room.hostUserId !== ctx.userId) {
    return NextResponse.json({ error: "Only the host can upload recordings" }, { status: 403 });
  }

  try {
    const filename = `room-recordings/${room.slug}-${Date.now()}.webm`;
    const blob = await put(filename, file, {
      access: "public",
      contentType: file.type || "audio/webm",
    });

    // Save recording URL + speaker timeline to database
    await db
      .update(audioRooms)
      .set({
        recordingUrl: blob.url,
        recordingDuration: duration ? parseInt(duration) : null,
        speakerTimeline: speakerTimeline || null,
      })
      .where(eq(audioRooms.id, room.id));

    // Trigger transcription in the background (fire and forget)
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/recordings/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: room.id,
        recordingUrl: blob.url,
        speakerTimeline: speakerTimeline || "[]",
      }),
    }).catch((err) => console.error("Transcription trigger failed:", err));

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Recording upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
