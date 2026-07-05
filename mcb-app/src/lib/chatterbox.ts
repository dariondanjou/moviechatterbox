import { supabase } from '@/lib/supabase';

// Data layer for Chatterboxes (FR-2.1.x). SQL uses "box" internally;
// UI copy always says Chatterbox (FR-10.x).

export type BoxStatus = 'scheduled' | 'live' | 'ended';
export type StageRole = 'host' | 'speaker' | 'listener';

export type Chatterbox = {
  id: string;
  title: string;
  topic: string | null;
  host_id: string;
  status: BoxStatus;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  is_recorded: boolean;
  created_at: string;
};

export type Participant = {
  id: string;
  box_id: string;
  user_id: string;
  role: StageRole;
  hand_raised: boolean;
  muted: boolean;
  joined_at: string;
  left_at: string | null;
  profile?: Profile;
};

export type Profile = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type Message = {
  id: string;
  box_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: Profile;
};

export async function listLive(): Promise<Chatterbox[]> {
  const { data, error } = await supabase
    .from('mcb_chatterboxes')
    .select('*')
    .eq('status', 'live')
    .order('started_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listScheduled(): Promise<Chatterbox[]> {
  const { data, error } = await supabase
    .from('mcb_chatterboxes')
    .select('*')
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getBox(boxId: string): Promise<Chatterbox | null> {
  const { data, error } = await supabase
    .from('mcb_chatterboxes')
    .select('*')
    .eq('id', boxId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createChatterbox(input: {
  title: string;
  topic?: string;
  scheduledAt?: Date;
}): Promise<Chatterbox> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');

  const live = !input.scheduledAt;
  const { data, error } = await supabase
    .from('mcb_chatterboxes')
    .insert({
      title: input.title,
      topic: input.topic ?? null,
      host_id: user.id,
      status: live ? 'live' : 'scheduled',
      scheduled_at: input.scheduledAt?.toISOString() ?? null,
      started_at: live ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;

  if (live) {
    await join(data.id, 'host');
  }
  return data;
}

export async function goLive(boxId: string): Promise<void> {
  const { error } = await supabase
    .from('mcb_chatterboxes')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', boxId);
  if (error) throw error;
  await join(boxId, 'host');
}

export async function endChatterbox(boxId: string): Promise<void> {
  const { error } = await supabase
    .from('mcb_chatterboxes')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', boxId);
  if (error) throw error;
}

export async function join(boxId: string, role: StageRole = 'listener') {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('mcb_participants').upsert(
    {
      box_id: boxId,
      user_id: user.id,
      role,
      left_at: null,
      joined_at: new Date().toISOString(),
      // hosts join unmuted-capable but still muted until they tap the mic
      muted: true,
      hand_raised: false,
    },
    { onConflict: 'box_id,user_id' },
  );
  if (error) throw error;
}

export async function leave(boxId: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;
  await supabase
    .from('mcb_participants')
    .update({ left_at: new Date().toISOString(), hand_raised: false })
    .eq('box_id', boxId)
    .eq('user_id', user.id);
}

export async function setHandRaised(boxId: string, raised: boolean) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('mcb_participants')
    .update({ hand_raised: raised })
    .eq('box_id', boxId)
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function setMuted(boxId: string, muted: boolean) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('mcb_participants')
    .update({ muted })
    .eq('box_id', boxId)
    .eq('user_id', user.id);
  if (error) throw error;
}

/** Host-only (enforced server-side by trigger + RLS). */
export async function setRole(boxId: string, userId: string, role: Exclude<StageRole, 'host'>) {
  const { error } = await supabase
    .from('mcb_participants')
    .update({ role, hand_raised: false })
    .eq('box_id', boxId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function listParticipants(boxId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from('mcb_participants')
    .select('*, profile:mcb_profiles(id, handle, display_name, avatar_url)')
    .eq('box_id', boxId)
    .is('left_at', null)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data as unknown as Participant[];
}

export async function listMessages(boxId: string, limit = 100): Promise<Message[]> {
  const { data, error } = await supabase
    .from('mcb_messages')
    .select('*, profile:mcb_profiles(id, handle, display_name, avatar_url)')
    .eq('box_id', boxId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as Message[]).reverse();
}

export async function sendMessage(boxId: string, body: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('mcb_messages')
    .insert({ box_id: boxId, user_id: user.id, body });
  if (error) throw error;
}

/**
 * Toggle recording disclosure (FR-2.1.4, FR-5.4). Host-only via RLS.
 * Actual media egress lands once storage credentials are configured;
 * the in-room REC disclosure is honest from day one.
 */
export async function setRecording(boxId: string, on: boolean) {
  const { error } = await supabase
    .from('mcb_chatterboxes')
    .update({ is_recorded: on })
    .eq('id', boxId);
  if (error) throw error;
}

export async function toggleReminder(boxId: string, on: boolean) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  if (on) {
    const { error } = await supabase
      .from('mcb_reminders')
      .upsert({ box_id: boxId, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('mcb_reminders')
      .delete()
      .eq('box_id', boxId)
      .eq('user_id', user.id);
    if (error) throw error;
  }
}

/** Which of the given boxes the current user has reminders for. */
export async function myReminders(boxIds: string[]): Promise<Set<string>> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user || boxIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('mcb_reminders')
    .select('box_id')
    .eq('user_id', user.id)
    .in('box_id', boxIds);
  if (error) throw error;
  return new Set(data.map((r) => r.box_id));
}

/** Fetch a LiveKit access token for this box from the edge function. */
export async function fetchAudioToken(
  boxId: string,
): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.functions.invoke('chatterbox-token', {
    body: { boxId },
  });
  if (error) throw error;
  if (!data?.token || !data?.url) throw new Error('token service unavailable');
  return data;
}
