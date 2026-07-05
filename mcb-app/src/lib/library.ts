import { supabase } from '@/lib/supabase';

// Letterboxd layer: ratings, watchlist (system list), profiles (FR-2.3.x).

export type Rating = {
  user_id: string;
  entity_type: string;
  entity_id: string;
  rating: number;
  created_at: string;
};

export type MyProfile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_premium: boolean;
};

async function requireUser() {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  return user;
}

// ── Ratings ──────────────────────────────────────────────────────────────────

export async function getMyRating(
  entityType: string,
  entityId: string,
): Promise<number | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('mcb_ratings')
    .select('rating')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.rating) : null;
}

export async function setMyRating(
  entityType: string,
  entityId: string,
  rating: number | null,
) {
  const user = await requireUser();
  if (rating === null) {
    const { error } = await supabase
      .from('mcb_ratings')
      .delete()
      .eq('user_id', user.id)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('mcb_ratings').upsert({
    user_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
    rating,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Community average — fine to compute client-side at current scale. */
export async function ratingSummary(
  entityType: string,
  entityId: string,
): Promise<{ average: number | null; count: number }> {
  const { data, error } = await supabase
    .from('mcb_ratings')
    .select('rating')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw error;
  if (!data.length) return { average: null, count: 0 };
  const sum = data.reduce((a, r) => a + Number(r.rating), 0);
  return { average: sum / data.length, count: data.length };
}

export async function listMyRatings(limit = 30): Promise<Rating[]> {
  const user = await requireUser();
  const { data, error } = await supabase
    .from('mcb_ratings')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((r) => ({ ...r, rating: Number(r.rating) }));
}

// ── Watchlist (the per-user system list) ─────────────────────────────────────

async function ensureWatchlist(): Promise<string> {
  const user = await requireUser();
  const { data } = await supabase
    .from('mcb_lists')
    .select('id')
    .eq('owner_id', user.id)
    .eq('is_system', true)
    .maybeSingle();
  if (data) return data.id;
  const { data: created, error } = await supabase
    .from('mcb_lists')
    .insert({ owner_id: user.id, title: 'Watchlist', is_system: true })
    .select('id')
    .single();
  if (error) throw error;
  return created.id;
}

export async function isWatchlisted(
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return false;
  const { data, error } = await supabase
    .from('mcb_list_items')
    .select('id, list:mcb_lists!inner(owner_id, is_system)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('list.owner_id', user.id)
    .eq('list.is_system', true)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleWatchlist(
  entityType: string,
  entityId: string,
  on: boolean,
) {
  const listId = await ensureWatchlist();
  if (on) {
    const { error } = await supabase.from('mcb_list_items').upsert(
      { list_id: listId, entity_type: entityType, entity_id: entityId },
      { onConflict: 'list_id,entity_type,entity_id' },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('mcb_list_items')
      .delete()
      .eq('list_id', listId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId);
    if (error) throw error;
  }
}

export async function listWatchlistItems(): Promise<
  { entity_type: string; entity_id: string; watched: boolean }[]
> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from('mcb_list_items')
    .select('entity_type, entity_id, watched, list:mcb_lists!inner(owner_id, is_system)')
    .eq('list.owner_id', user.id)
    .eq('list.is_system', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(({ entity_type, entity_id, watched }) => ({
    entity_type,
    entity_id,
    watched,
  }));
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<MyProfile | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('mcb_profiles')
    .select('id, handle, display_name, avatar_url, bio, is_premium')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(patch: {
  display_name?: string;
  handle?: string;
  bio?: string;
}) {
  const user = await requireUser();
  const { error } = await supabase
    .from('mcb_profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw error;
}
