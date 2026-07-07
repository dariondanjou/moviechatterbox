import { emitSignal } from '@/lib/signals';
import { supabase } from '@/lib/supabase';

import type { Chatterbox } from './chatterbox';

// TMDB-backed canonical title entities (FR-2.2.x, FS-13.3).

export type Title = {
  id: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  year: number | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
  popularity: number;
  vote_average: number | null;
};

export function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w780' = 'w342') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export async function listTrendingTitles(limit = 60): Promise<Title[]> {
  const { data, error } = await supabase
    .from('mcb_titles')
    .select('*')
    .order('popularity', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function searchTitles(query: string, limit = 30): Promise<Title[]> {
  const { data, error } = await supabase
    .from('mcb_titles')
    .select('*')
    .ilike('title', `%${query}%`)
    .order('popularity', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getTitle(id: string): Promise<Title | null> {
  const { data, error } = await supabase
    .from('mcb_titles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Batch lookup for Lobby cards / room chips. */
export async function getTitlesByIds(ids: string[]): Promise<Map<string, Title>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from('mcb_titles')
    .select('*')
    .in('id', unique);
  if (error) throw error;
  return new Map(data.map((t: Title) => [t.id, t]));
}

// ── Entity threads (FR-2.2.2) ────────────────────────────────────────────────

export type ThreadPost = {
  id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: {
    id: string;
    handle: string | null;
    display_name: string | null;
  };
};

export async function listThreadPosts(
  entityType: string,
  entityId: string,
  limit = 50,
): Promise<ThreadPost[]> {
  const { data, error } = await supabase
    .from('mcb_thread_posts')
    .select('*, profile:mcb_profiles(id, handle, display_name)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as ThreadPost[];
}

export async function postToThread(
  entityType: string,
  entityId: string,
  body: string,
) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('mcb_thread_posts').insert({
    entity_type: entityType,
    entity_id: entityId,
    user_id: user.id,
    body,
  });
  if (error) throw error;
  emitSignal('thread_post', { entityType, entityId });
}

/** Active/scheduled Chatterboxes attached to an entity (FR-2.2.2). */
export async function listBoxesForEntity(
  entityType: string,
  entityId: string,
): Promise<Chatterbox[]> {
  const { data, error } = await supabase
    .from('mcb_chatterboxes')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .in('status', ['live', 'scheduled'])
    .order('status', { ascending: true }) // live before scheduled
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
