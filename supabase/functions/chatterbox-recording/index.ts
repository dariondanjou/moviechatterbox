// Starts/stops LiveKit room-composite egress for a Chatterbox (FR-2.1.4).
// Host-only, live rooms only. Audio-only MP4; LiveKit Cloud hosts the file
// until mcb-replays-finalize copies it into Supabase Storage.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
} from 'npm:livekit-server-sdk@2';

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

function egressClient() {
  const url = Deno.env.get('LIVEKIT_URL')!.replace(/^wss?:\/\//, 'https://');
  return new EgressClient(
    url,
    Deno.env.get('LIVEKIT_API_KEY')!,
    Deno.env.get('LIVEKIT_API_SECRET')!,
  );
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

  const { boxId, action } = await req.json().catch(() => ({}));
  if (!boxId || !['start', 'stop'].includes(action)) {
    return json({ error: 'boxId and action (start|stop) required' }, 400);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: box } = await db
    .from('mcb_chatterboxes')
    .select('id,status,host_id,is_recorded')
    .eq('id', boxId)
    .maybeSingle();
  if (!box) return json({ error: 'not found' }, 404);
  if (box.host_id !== user.id) return json({ error: 'host only' }, 403);

  const { data: active } = await db
    .from('mcb_recordings')
    .select('id,egress_id')
    .eq('box_id', boxId)
    .eq('status', 'recording')
    .maybeSingle();

  if (action === 'start') {
    if (box.status !== 'live') return json({ error: 'not live' }, 409);
    if (active) return json({ ok: true, recordingId: active.id });

    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `box_${boxId}_{time}`,
    });
    const info = await egressClient().startRoomCompositeEgress(
      `box_${boxId}`,
      { file: output },
      { audioOnly: true },
    );

    const { data: rec, error } = await db
      .from('mcb_recordings')
      .insert({ box_id: boxId, egress_id: info.egressId })
      .select('id')
      .single();
    if (error) {
      // Don't leave an untracked egress billing minutes
      await egressClient().stopEgress(info.egressId).catch(() => {});
      return json({ error: 'could not track recording' }, 500);
    }
    await db
      .from('mcb_chatterboxes')
      .update({ is_recorded: true })
      .eq('id', boxId);
    return json({ ok: true, recordingId: rec.id });
  }

  // stop
  if (active) {
    await egressClient()
      .stopEgress(active.egress_id)
      .catch(() => {}); // may already be stopping if the room emptied
    await db
      .from('mcb_recordings')
      .update({ status: 'processing', ended_at: new Date().toISOString() })
      .eq('id', active.id);
  }
  await db
    .from('mcb_chatterboxes')
    .update({ is_recorded: false })
    .eq('id', boxId);
  return json({ ok: true });
});
