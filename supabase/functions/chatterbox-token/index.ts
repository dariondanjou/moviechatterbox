// Mints a LiveKit access token for a Chatterbox participant.
// Publish rights follow the stage model (FR-2.1.2): host/speaker can publish,
// listeners subscribe only. Role source of truth is mcb_participants.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { boxId } = await req.json().catch(() => ({}));
  if (!boxId) return json({ error: 'boxId required' }, 400);

  const [{ data: box }, { data: part }] = await Promise.all([
    supabase
      .from('mcb_chatterboxes')
      .select('id,status')
      .eq('id', boxId)
      .maybeSingle(),
    supabase
      .from('mcb_participants')
      .select('role,left_at')
      .eq('box_id', boxId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  if (!box || box.status !== 'live') return json({ error: 'not live' }, 409);
  if (!part || part.left_at) return json({ error: 'not a participant' }, 403);

  const canPublish = part.role === 'host' || part.role === 'speaker';
  const token = new AccessToken(
    Deno.env.get('LIVEKIT_API_KEY')!,
    Deno.env.get('LIVEKIT_API_SECRET')!,
    {
      identity: user.id,
      name: user.email ?? user.id,
      // Short TTL: reconnects re-mint, so revoked speakers lose publish rights
      ttl: '2h',
    },
  );
  token.addGrant({
    room: `box_${boxId}`,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: false,
  });

  return json({ token: await token.toJwt(), url: Deno.env.get('LIVEKIT_URL') });
});
