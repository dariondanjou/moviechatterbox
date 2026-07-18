import { supabase } from '@/lib/supabase';

/**
 * Permanently delete the signed-in user's account (Apple guideline 5.1.1(v);
 * FR-12.3). Server side removes storage artifacts and the auth user; every
 * mcb_ row cascades. Afterwards clear the local session — the server-side
 * session is already gone with the user.
 */
export async function deleteMyAccount() {
  const { data, error } = await supabase.functions.invoke('mcb-delete-account');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  await supabase.auth.signOut({ scope: 'local' });
}
