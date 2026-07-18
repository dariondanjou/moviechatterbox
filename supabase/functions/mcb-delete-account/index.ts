// In-app account deletion (Apple guideline 5.1.1(v); FR-12.3 delete right).
// Verifies the caller's JWT, removes their storage artifacts (feedback voice
// notes, replay files of Chatterboxes they hosted), then deletes the auth
// user. All mcb_ rows cascade from auth.users (see 20260717090000 migration),
// so no manual table sweeps — fully automated (Solo-Operator Principle, §1.2).
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

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Feedback voice notes live under <user id>/ in the private bucket
  try {
    const { data: files } = await admin.storage
      .from('mcb-feedback-audio')
      .list(user.id, { limit: 1000 });
    if (files?.length) {
      await admin.storage
        .from('mcb-feedback-audio')
        .remove(files.map((f) => `${user.id}/${f.name}`));
    }
  } catch {
    // storage cleanup is best-effort; the auth delete below is what matters
  }

  // Replay audio for Chatterboxes the user hosted (their rows cascade away
  // with the box, which would otherwise orphan the storage files)
  try {
    const { data: recs } = await admin
      .from('mcb_recordings')
      .select('storage_path, mcb_chatterboxes!inner(host_id)')
      .eq('mcb_chatterboxes.host_id', user.id)
      .not('storage_path', 'is', null);
    const paths = (recs ?? [])
      .map((r) => r.storage_path as string | null)
      .filter((p): p is string => !!p);
    if (paths.length) {
      await admin.storage.from('mcb-replays').remove(paths);
    }
  } catch {
    // best-effort, as above
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: 'could not delete account' }, 500);
  return json({ ok: true });
});
