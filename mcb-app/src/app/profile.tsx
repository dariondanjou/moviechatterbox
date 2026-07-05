import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RatingStars } from '@/components/rating-stars';
import { Avatar, GhostPill } from '@/components/ui';
import {
  getMyProfile,
  listMyRatings,
  listWatchlistItems,
  updateMyProfile,
  type MyProfile,
  type Rating,
} from '@/lib/library';
import { supabase } from '@/lib/supabase';
import { getTitlesByIds, posterUrl, type Title } from '@/lib/titles';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function Profile() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [handleDraft, setHandleDraft] = useState('');
  const [watchlist, setWatchlist] = useState<{ entity_id: string }[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [titles, setTitles] = useState<Map<string, Title>>(new Map());

  const load = useCallback(async () => {
    try {
      const [p, wl, r] = await Promise.all([
        getMyProfile(),
        listWatchlistItems(),
        listMyRatings(20),
      ]);
      setProfile(p);
      setWatchlist(wl);
      setRatings(r);
      setTitles(
        await getTitlesByIds([
          ...wl.map((i) => i.entity_id),
          ...r.map((i) => i.entity_id),
        ]),
      );
    } catch {
      // transient
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile() {
    setEditing(false);
    await updateMyProfile({
      display_name: nameDraft.trim() || undefined,
      handle: handleDraft.trim().replace(/^@/, '') || undefined,
    }).catch(() => {});
    load();
  }

  const name = profile?.display_name || 'you';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/lobby'))}>
            <Text style={styles.back}>← back</Text>
          </Pressable>
          <Pressable onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOut}>sign out</Text>
          </Pressable>
        </View>

        <View style={styles.identity}>
          <Avatar name={name} size={80} />
          {editing ? (
            <View style={styles.editBlock}>
              <TextInput
                style={styles.input}
                placeholder="display name"
                placeholderTextColor={color.textTertiary}
                value={nameDraft}
                onChangeText={setNameDraft}
              />
              <TextInput
                style={styles.input}
                placeholder="handle"
                placeholderTextColor={color.textTertiary}
                autoCapitalize="none"
                value={handleDraft}
                onChangeText={setHandleDraft}
              />
              <GhostPill label="Save" active onPress={saveProfile} />
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setNameDraft(profile?.display_name ?? '');
                setHandleDraft(profile?.handle ?? '');
                setEditing(true);
              }}
            >
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.handle}>
                {profile?.handle ? `@${profile.handle}` : 'tap to edit profile'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{ratings.length}</Text>
            <Text style={styles.statLabel}>RATED</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{watchlist.length}</Text>
            <Text style={styles.statLabel}>WATCHLIST</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>WATCHLIST</Text>
        {watchlist.length === 0 && (
          <Text style={styles.empty}>
            Nothing saved yet — add films from their pages.
          </Text>
        )}
        <View style={styles.posterRow}>
          {watchlist.slice(0, 12).map((item) => {
            const t = titles.get(item.entity_id);
            if (!t) return null;
            return (
              <Pressable key={item.entity_id} onPress={() => router.push(`/title/${t.id}`)}>
                <Image
                  source={{ uri: posterUrl(t.poster_path, 'w185') ?? undefined }}
                  style={styles.poster}
                  contentFit="cover"
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>RECENT RATINGS</Text>
        {ratings.length === 0 && (
          <Text style={styles.empty}>No ratings yet.</Text>
        )}
        {ratings.map((r) => {
          const t = titles.get(r.entity_id);
          return (
            <Pressable
              key={`${r.entity_type}:${r.entity_id}`}
              onPress={() => t && router.push(`/title/${t.id}`)}
            >
              <View style={styles.ratingRow}>
                <Text style={styles.ratingTitle} numberOfLines={1}>
                  {t?.title ?? '…'}
                </Text>
                <RatingStars value={r.rating} size={16} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  content: {
    padding: space.xl,
    gap: space.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: {
    ...type.label,
    color: color.textTertiary,
  },
  signOut: {
    ...type.label,
    color: color.textTertiary,
  },
  identity: {
    alignItems: 'center',
    gap: space.md,
  },
  name: {
    fontFamily: font.display,
    fontSize: 26,
    color: color.textPrimary,
    textAlign: 'center',
  },
  handle: {
    ...type.label,
    color: color.textTertiary,
    textAlign: 'center',
  },
  editBlock: {
    gap: space.sm,
    width: '100%',
    maxWidth: 320,
  },
  input: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xxxl,
  },
  stat: {
    alignItems: 'center',
  },
  statNum: {
    fontFamily: font.display,
    fontSize: 24,
    color: color.orange300,
  },
  statLabel: {
    ...type.micro,
    color: color.textTertiary,
  },
  sectionLabel: {
    ...type.micro,
    color: color.textTertiary,
    marginTop: space.md,
  },
  empty: {
    ...type.body,
    color: color.textTertiary,
  },
  posterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  poster: {
    width: 72,
    height: 108,
    borderRadius: radius.sm,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.glassBorder,
  },
  ratingTitle: {
    ...type.body,
    color: color.textPrimary,
    flexShrink: 1,
  },
});
