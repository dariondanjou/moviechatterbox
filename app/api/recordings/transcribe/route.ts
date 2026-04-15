import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../server/db";
import { audioRooms } from "../../../../shared/schema";
import { eq } from "drizzle-orm";

interface SpeakerSegment {
  identity: string;
  name: string;
  start: number;
  end: number;
}

interface TranscriptSegment {
  speaker: string;
  speakerName: string;
  text: string;
  start: number;
  end: number;
}

function findSpeaker(
  time: number,
  timeline: SpeakerSegment[]
): { identity: string; name: string } | null {
  for (const seg of timeline) {
    if (time >= seg.start && time <= seg.end) {
      return { identity: seg.identity, name: seg.name };
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.warn("DEEPGRAM_API_KEY not set — skipping transcription");
    return NextResponse.json({ skipped: true, reason: "No API key" });
  }

  const { roomId, recordingUrl, speakerTimeline: timelineStr } = await req.json();

  if (!roomId || !recordingUrl) {
    return NextResponse.json({ error: "roomId and recordingUrl required" }, { status: 400 });
  }

  let timeline: SpeakerSegment[] = [];
  try {
    timeline = JSON.parse(timelineStr || "[]");
  } catch {
    timeline = [];
  }

  try {
    // Call Deepgram REST API directly
    const dgResponse = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&utterances=true&diarize=true&punctuate=true&paragraphs=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: recordingUrl }),
      }
    );

    if (!dgResponse.ok) {
      const errText = await dgResponse.text();
      console.error("Deepgram API error:", dgResponse.status, errText);
      return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
    }

    const dgResult = await dgResponse.json();

    // Build transcript segments from Deepgram utterances
    const utterances = dgResult?.results?.utterances || [];
    const transcriptSegments: TranscriptSegment[] = utterances.map((utt: any) => {
      const midTime = (utt.start + utt.end) / 2;
      const matched = findSpeaker(midTime, timeline);
      return {
        speaker: matched?.identity || `speaker-${utt.speaker}`,
        speakerName: matched?.name || `Speaker ${(utt.speaker || 0) + 1}`,
        text: utt.transcript,
        start: utt.start,
        end: utt.end,
      };
    });

    // Fallback: if no utterances, try paragraphs
    if (transcriptSegments.length === 0) {
      const channels = dgResult?.results?.channels || [];
      if (channels.length > 0) {
        const paragraphs = channels[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
        for (const para of paragraphs) {
          for (const sentence of para.sentences || []) {
            const midTime = (sentence.start + sentence.end) / 2;
            const matched = findSpeaker(midTime, timeline);
            transcriptSegments.push({
              speaker: matched?.identity || `speaker-${para.speaker ?? 0}`,
              speakerName: matched?.name || `Speaker ${(para.speaker ?? 0) + 1}`,
              text: sentence.text,
              start: sentence.start,
              end: sentence.end,
            });
          }
        }
      }
    }

    // Save transcript to database
    await db
      .update(audioRooms)
      .set({ transcript: JSON.stringify(transcriptSegments) })
      .where(eq(audioRooms.id, roomId));

    return NextResponse.json({
      success: true,
      segmentCount: transcriptSegments.length,
    });
  } catch (err) {
    console.error("Transcription error:", err);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
