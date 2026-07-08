// Accepts user feedback and AI-triages it (category, sentiment, summary)
// so review needs no manual sorting (Solo-Operator Principle, §1.2).
// Insert-first: feedback is never lost if classification fails — rows with
// category null can be re-classified later.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

async function classify(body: string, route: string | null) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return null; // degrade gracefully until the secret is set

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    system:
      'You triage user feedback for MovieChatterbox, a social audio app for ' +
      'movie/TV fans (live audio rooms called Chatterboxes, a film database, ' +
      'ratings/watchlists). Classify the feedback. "audio" is for sound/mic/' +
      'connection issues in live rooms; "content" is about the film/TV ' +
      'catalog; "moderation" is about other users’ behavior or safety.',
    messages: [
      {
        role: 'user',
        content: `Screen: ${route ?? 'unknown'}\n\nFeedback:\n${body}`,
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: CLASSIFICATION_SCHEMA },
    },
  });

  const text = response.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') return null;
  return JSON.parse(text.text) as {
    category: string;
    sentiment: string;
    summary: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

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

  const { body, route, platform, osVersion, appVersion } = await req
    .json()
    .catch(() => ({}));
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text || text.length > 4000) {
    return json({ error: 'feedback text required (max 4000 chars)' }, 400);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: row, error } = await db
    .from('mcb_feedback')
    .insert({
      user_id: user.id,
      body: text,
      route: route ?? null,
      platform: platform ?? null,
      os_version: osVersion ?? null,
      app_version: appVersion ?? null,
    })
    .select('id')
    .single();
  if (error) return json({ error: 'could not save feedback' }, 500);

  // Classification is best-effort; the row is already safe
  try {
    const result = await classify(text, route ?? null);
    if (result) {
      await db
        .from('mcb_feedback')
        .update({
          category: result.category,
          sentiment: result.sentiment,
          ai_summary: result.summary,
        })
        .eq('id', row.id);
    }
  } catch {
    // leave category null; a later pass can re-classify
  }

  return json({ ok: true, id: row.id });
});
