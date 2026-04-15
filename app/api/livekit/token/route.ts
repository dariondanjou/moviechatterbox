import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createContext } from "../../../../server/trpc";

export async function POST(req: NextRequest) {
  const ctx = await createContext(req);
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { roomSlug, userName } = await req.json();
  if (!roomSlug) {
    return NextResponse.json({ error: "roomSlug required" }, { status: 400 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  const identity = `user-${ctx.userId}`;
  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: userName || `User ${ctx.userId}`,
    ttl: "6h",
  });

  token.addGrant({
    room: roomSlug,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();
  return NextResponse.json({ token: jwt });
}
