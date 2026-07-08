// Accepts user feedback (text and/or voice note) and AI-triages it so review
// needs no manual sorting (Solo-Operator Principle, §1.2).
//
// Pipeline: insert-first (feedback is never lost) → voice notes upload to the
// private mcb-feedback-audio bucket → Deepgram transcription (FR-2.4 vendor)
// → Claude classification (category/sentiment/summary). Each stage degrades
// gracefully when its API key secret is missing; a 15-minute cron sweep
// (action=sweep, INGEST_KEY-guarded — deployed with --no-verify-jwt) retries
// unfinished rows, so everything self-heals once keys exist.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

const BUCKET = 'mcb-feedback-audio';
const MAX_AUDIO_BASE64 = 15_000_000; // ~11MB decoded ≈ several minutes of m4a

const CATEGORIES = [
  'bug',
  'feature_request',
  'ux',
  'performance',
  'audio',
  'content',
  'moderation',
  'account',
  'praise',
  'other',
] as const;

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORIES] },
    sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
    summary: {
      type: 'string',
      description: 'One-sentence plain-English summary of the feedback',
    },
  },
  required: ['category', 'sentiment', 'summary'],
  additionalProperties: false,
} as const;

type FeedbackRow = {
  id: string;
  body: string | null;
  route: string | null;
  audio_path: string | null;
  transcript: string | null;
  transcript_status: string | null;
  category: string | null;
};

function mimeForPath(path: string): string {
  if (path.endsWith('.webm')) return 'audio/webm';
  if (path.endsWith('.3gp')) return 'audio/3gpp';
  return 'audio/mp4'; // m4a
}

async function transcribe(db: SupabaseClient, row: FeedbackRow) {
  const key = Deno.env.get('DEEPGRAM_API_KEY');
  if (!key || !row.audio_path) return row;

  const { data: file, error } = await db.storage
    .from(BUCKET)
    .download(row.audio_path);
  if (error || !file) throw error ?? new Error('audio missing');

  const res = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
        'Content-Type': mimeForPath(row.audio_path),
      },
      body: await file.arrayBuffer(),
    },
  );
  if (!res.ok) throw new Error(`deepgram ${res.status}`);
  const result = await res.json();
  const transcript: string =
    result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

  const status = transcript ? 'done' : 'failed';
  await db
    .from('mcb_feedback')
    .update({ transcript: transcript || null, transcript_status: status })
    .eq('id', row.id);
  return { ...row, transcript: transcript || null, transcript_status: status };
}

async function classify(db: SupabaseClient, row: FeedbackRow) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return;
  const content = [row.body, row.transcript].filter(Boolean).join('\n\n');
  if (!content) return; // voice-only row still awaiting transcription

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    system:
      'You triage user feedback for MovieChatterbox, a social audio app for ' +
      'movie/TV fans (live audio rooms called Chatterboxes, a film database, ' +
      'ratings/watchlists). Classify the feedback. "audio" is for sound/mic/' +
      'connection issues in live rooms; "content" is about the film/TV ' +
      'catalog; "moderation" is about other users’ behavior or safety. Voice ' +
      'transcripts may contain speech-to-text noise; classify by intent.',
    messages: [
      {
        role: 'user',
        content: `Screen: ${row.route ?? 'unknown'}\n\nFeedback:\n${content}`,
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: CLASSIFICATION_SCHEMA },
    },
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return;
  const parsed = JSON.parse(text.text) as {
    category: string;
    sentiment: string;
    summary: string;
  };
  await db
    .from('mcb_feedback')
    .update({
      category: parsed.category,
      sentiment: parsed.sentiment,
      ai_summary: parsed.summary,
    })
    .eq('id', row.id);
}

/** Transcribe (if needed) then classify (if needed). Best-effort. */
async function process(db: SupabaseClient, row: FeedbackRow) {
  try {
    if (row.transcript_status === 'pending') {
      row = (await transcribe(db, row)) as FeedbackRow;
    }
  } catch {
    // stays pending; the sweep retries
  }
  try {
    if (!row.category) await classify(db, row);
  } catch {
    // stays null; the sweep retries
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const payload = await req.json().catch(() => ({}));

  // ── Cron sweep: retry unfinished transcription/classification ────────────
  if (payload?.action === 'sweep') {
    if (req.headers.get('x-ingest-key') !== Deno.env.get('INGEST_KEY')) {
      return json({ error: 'unauthorized' }, 401);
    }
    const { data: pending, error } = await db
      .from('mcb_feedback')
      .select('id,body,route,audio_path,transcript,transcript_status,category')
      .or('transcript_status.eq.pending,category.is.null')
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) return json({ error: error.message }, 500);
    for (const row of pending ?? []) {
      await process(db, row as FeedbackRow);
    }
    return json({ swept: pending?.length ?? 0 });
  }

  // ── User submission ───────────────────────────────────────────────────────
  const authed = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    },
  );
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { body, audioBase64, audioMime, route, platform, osVersion, appVersion } =
    payload;
  const text = typeof body === 'string' ? body.trim() : '';
  const hasAudio = typeof audioBase64 === 'string' && audioBase64.length > 0;
  if (!text && !hasAudio) {
    return json({ error: 'feedback text or audio required' }, 400);
  }
  if (text.length > 4000) return json({ error: 'text too long (max 4000)' }, 400);
  if (hasAudio && audioBase64.length > MAX_AUDIO_BASE64) {
    return json({ error: 'audio too large' }, 413);
  }

  // Voice note → private bucket
  let audioPath: string | null = null;
  if (hasAudio) {
    const ext = audioMime === 'audio/webm' ? 'webm' : 'm4a';
    audioPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(audioPath, bytes, {
        contentType: audioMime === 'audio/webm' ? 'audio/webm' : 'audio/mp4',
      });
    if (upErr) return json({ error: 'could not save audio' }, 500);
  }

  const { data: row, error } = await db
    .from('mcb_feedback')
    .insert({
      user_id: user.id,
      body: text || null,
      route: route ?? null,
      platform: platform ?? null,
      os_version: osVersion ?? null,
      app_version: appVersion ?? null,
      audio_path: audioPath,
      transcript_status: audioPath ? 'pending' : null,
    })
    .select('id,body,route,audio_path,transcript,transcript_status,category')
    .single();
  if (error) return json({ error: 'could not save feedback' }, 500);

  // Best-effort inline processing; the sweep covers anything unfinished
  await process(db, row as FeedbackRow);

  return json({ ok: true, id: row.id });
});
