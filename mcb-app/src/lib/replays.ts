import { supabase } from '@/lib/supabase';

import type { Chatterbox } from '@/lib/chatterbox';

// Replay data layer (FR-2.1.4): recorded Chatterboxes as content.

export type Replay = {
  id: string;
  box_id: string;
  status: 'recording' | 'processing' | 'ready' | 'failed';
  storage_path: string | null;
  duration_seconds: number | null;
  started_at: string;
  box?: Chatterbox;
};

/** Ready replays for one Chatterbox (usually 0 or 1). */
export async function listReplaysForBox(boxId: string): Promise<Replay[]> {
  const { data, error } = await supabase
    .from('mcb_recordings')
    .select('*')
    .eq('box_id', boxId)
    .eq('status', 'ready')
    .order('started_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Ready replays across all ended Chatterboxes attached to an entity. */
export async function listReplaysForEntity(
  entityId: string,
  limit = 10,
): Promise<Replay[]> {
  const { data, error } = await supabase
    .from('mcb_recordings')
    .select('*, box:mcb_chatterboxes!inner(*)')
    .eq('status', 'ready')
    .eq('box.entity_id', entityId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as Replay[];
}

export function replayUrl(storagePath: string): string {
  return supabase.storage.from('mcb-replays').getPublicUrl(storagePath).data
    .publicUrl;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}
