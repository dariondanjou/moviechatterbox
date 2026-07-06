import { supabase } from '@/lib/supabase';

// Moderation data layer (FR-5.1): host mute/remove, user block/report.
// Server-side guards live in the mcb_moderation migration; these calls
// assume RLS + triggers do the actual enforcement.

export type ReportTargetType =
  | 'user'
  | 'chatterbox'
  | 'message'
  | 'thread_post'
  | 'review';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'other', label: 'Something else' },
];

/** Host-only (trigger-enforced): hard-mute someone's mic. Never unmutes. */
export async function forceMute(boxId: string, userId: string) {
  const { error } = await supabase
    .from('mcb_participants')
    .update({ muted: true })
    .eq('box_id', boxId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Host-only (trigger-enforced): remove someone; they cannot rejoin. */
export async function removeFromChatterbox(boxId: string, userId: string) {
  const { error } = await supabase
    .from('mcb_participants')
    .update({ removed_at: new Date().toISOString() })
    .eq('box_id', boxId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** My own participant row for this box, including removal state. */
export async function getMyParticipation(
  boxId: string,
): Promise<{ removed_at: string | null } | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('mcb_participants')
    .select('removed_at')
    .eq('box_id', boxId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function blockUser(blockedId: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase
    .from('mcb_blocks')
    .upsert({ blocker_id: user.id, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockedId: string) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return;
  const { error } = await supabase
    .from('mcb_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId);
  if (error) throw error;
}

/** Everyone the current user has blocked. */
export async function listBlockedIds(): Promise<Set<string>> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return new Set();
  const { data, error } = await supabase
    .from('mcb_blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id);
  if (error) throw error;
  return new Set(data.map((r) => r.blocked_id));
}

export async function submitReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  boxId?: string;
  reason: ReportReason;
  details?: string;
}) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('not signed in');
  const { error } = await supabase.from('mcb_reports').insert({
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    box_id: input.boxId ?? null,
    reason: input.reason,
    details: input.details ?? null,
  });
  if (error) throw error;
}
