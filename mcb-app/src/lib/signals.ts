import { supabase } from '@/lib/supabase';

/**
 * Interest-profile signal emission (FR-11.1). Events accumulate from day
 * one — the recommender (FR-11.3/11.4) arrives later and reads history.
 *
 * Fire-and-forget by design: never awaited by callers, never blocks UI,
 * never surfaces errors. Losing an occasional signal is fine; janking a
 * screen is not.
 */

export type SignalType =
  // browse & search
  | 'title_view' // value: dwell seconds
  | 'person_view' // value: dwell seconds
  | 'search' // meta: { query }
  // library
  | 'rate' // value: rating
  | 'watchlist_add'
  | 'watchlist_remove'
  | 'thread_post'
  // Chatterboxes
  | 'box_join' // meta: { role }
  | 'box_listen' // value: seconds in room
  | 'box_speak' // unmuted their mic
  | 'box_host' // went live as host
  | 'reaction' // meta: { emoji }
  | 'replay_play';

export function emitSignal(
  type: SignalType,
  opts: {
    entityType?: string | null;
    entityId?: string | null;
    boxId?: string | null;
    value?: number | null;
    meta?: Record<string, unknown>;
  } = {},
) {
  void (async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return;
      await supabase.from('mcb_events').insert({
        user_id: session.user.id,
        event_type: type,
        entity_type: opts.entityType ?? null,
        entity_id: opts.entityId ?? null,
        box_id: opts.boxId ?? null,
        value: opts.value ?? null,
        meta: opts.meta ?? null,
      });
    } catch {
      // signals are best-effort, never user-visible
    }
  })();
}
