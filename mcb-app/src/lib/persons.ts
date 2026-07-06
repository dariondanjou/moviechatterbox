import { supabase } from '@/lib/supabase';

import type { Title } from './titles';

// Person entities (§9.1) — the runner's entity matching depends on these.

export type Person = {
  id: string;
  tmdb_id: number;
  name: string;
  profile_path: string | null;
  known_for: string | null;
  popularity: number;
};

export type CastMember = Person & { role: string | null; kind: 'cast' | 'crew' };

export function personImgUrl(path: string | null, size: 'w185' | 'w342' = 'w185') {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export async function getPerson(id: string): Promise<Person | null> {
  const { data, error } = await supabase
    .from('mcb_persons')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function creditsForTitle(titleId: string): Promise<CastMember[]> {
  const { data, error } = await supabase
    .from('mcb_credits')
    .select('kind, role, billing, person:mcb_persons(*)')
    .eq('title_id', titleId)
    .order('billing', { ascending: true })
    .limit(24);
  if (error) throw error;
  return (data as unknown as { kind: 'cast' | 'crew'; role: string | null; person: Person }[])
    .filter((c) => c.person)
    .map((c) => ({ ...c.person, role: c.role, kind: c.kind }));
}

export async function filmographyForPerson(personId: string): Promise<
  (Title & { role: string | null; kind: string })[]
> {
  const { data, error } = await supabase
    .from('mcb_credits')
    .select('kind, role, title:mcb_titles(*)')
    .eq('person_id', personId);
  if (error) throw error;
  return (data as unknown as { kind: string; role: string | null; title: Title }[])
    .filter((c) => c.title)
    .map((c) => ({ ...c.title, role: c.role, kind: c.kind }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}
