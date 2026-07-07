// Finalizes Chatterbox recordings (FR-2.1.4). Runs on a 5-minute cron and
// after every explicit stop: checks unfinished egresses against LiveKit,
// downloads completed files from LiveKit Cloud's 30-day storage, uploads
// them to the mcb-replays bucket, and marks rows ready/failed.
// Autonomous by design (Solo-Operator Principle, §1.2).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EgressClient, EgressStatus } from 'npm:livekit-server-sdk@2';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-ingest-key') !== Deno.env.get('INGEST_KEY')) {
    return json({ error: 'unauthorized' }, 401);
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const egress = new EgressClient(
    Deno.env.get('LIVEKIT_URL')!.replace(/^wss?:\/\//, 'https://'),
    Deno.env.get('LIVEKIT_API_KEY')!,
    Deno.env.get('LIVEKIT_API_SECRET')!,
  );

  const { data: pending, error } = await db
    .from('mcb_recordings')
    .select('id,box_id,egress_id,status')
    .in('status', ['recording', 'processing'])
    .limit(20);
  if (error) return json({ error: error.message }, 500);

  const results: Record<string, string> = {};

  for (const rec of pending ?? []) {
    try {
      const [info] = await egress.listEgress({ egressId: rec.egress_id });
      if (!info) {
        await db
          .from('mcb_recordings')
          .update({ status: 'failed', error: 'egress not found' })
          .eq('id', rec.id);
        results[rec.id] = 'failed:missing';
        continue;
      }

      const done =
        info.status === EgressStatus.EGRESS_COMPLETE ||
        info.status === EgressStatus.EGRESS_LIMIT_REACHED;
      const failed =
        info.status === EgressStatus.EGRESS_FAILED ||
        info.status === EgressStatus.EGRESS_ABORTED;

      if (failed) {
        await db
          .from('mcb_recordings')
          .update({
            status: 'failed',
            error: info.error || 'egress failed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', rec.id);
        results[rec.id] = 'failed';
        continue;
      }
      if (!done) {
        results[rec.id] = 'still-active';
        continue;
      }

      const file = info.fileResults?.[0];
      if (!file?.location) {
        await db
          .from('mcb_recordings')
          .update({ status: 'failed', error: 'no file result' })
          .eq('id', rec.id);
        results[rec.id] = 'failed:nofile';
        continue;
      }

      const res = await fetch(file.location);
      if (!res.ok) throw new Error(`download ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const path = `${rec.box_id}/${rec.id}.mp4`;
      const { error: upErr } = await db.storage
        .from('mcb-replays')
        .upload(path, bytes, { contentType: 'audio/mp4', upsert: true });
      if (upErr) throw upErr;

      await db
        .from('mcb_recordings')
        .update({
          status: 'ready',
          storage_path: path,
          duration_seconds: Math.round(Number(file.duration ?? 0) / 1e9),
          size_bytes: Number(file.size ?? bytes.byteLength),
          ended_at: new Date().toISOString(),
        })
        .eq('id', rec.id);
      results[rec.id] = 'ready';
    } catch (e) {
      // transient — leave for the next sweep
      results[rec.id] = `retry:${e instanceof Error ? e.message : 'error'}`;
    }
  }

  return json({ checked: pending?.length ?? 0, results });
});
