import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { GhostPill, GlassCard, LiveBadge, PrimaryPill, TimeChip } from '@/components/ui';
import type { Chatterbox } from '@/lib/chatterbox';
import {
  getMyRating,
  isWatchlisted,
  ratingSummary,
  setMyRating,
  toggleWatchlist,
} from '@/lib/library';
import {
  getTitle,
  listBoxesForEntity,
  listThreadPosts,
  posterUrl,
  postToThread,
  type ThreadPost,
  type Title,
} from '@/lib/titles';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function TitlePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState<Title | null>(null);
  const [boxes, setBoxes] = useState<Chatterbox[]>([]);
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [draft, setDraft] = useState('');
  const [myRating, setMyRatingState] = useState<number | null>(null);
  const [community, setCommunity] = useState<{ average: number | null; count: number }>({
    average: null,
    count: 0,
  });
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    if (!id) return;
    getTitle(id)
      .then((t) => {
        setTitle(t);
        if (t) {
          listBoxesForEntity(t.media_type, t.id).then(setBoxes).catch(() => {});
          listThreadPosts(t.media_type, t.id).then(setPosts).catch(() => {});
          getMyRating(t.media_type, t.id).then(setMyRatingState).catch(() => {});
          ratingSummary(t.media_type, t.id).then(setCommunity).catch(() => {});
          isWatchlisted(t.media_type, t.id).then(setInWatchlist).catch(() => {});
        }
      })
      .catch(() => {});
  }, [id]);

  async function onRate(rating: number | null) {
    if (!title) return;
    setMyRatingState(rating);
    try {
      await setMyRating(title.media_type, title.id, rating);
      setCommunity(await ratingSummary(title.media_type, title.id));
    } catch {
      getMyRating(title.media_type, title.id).then(setMyRatingState).catch(() => {});
    }
  }

  async function onToggleWatchlist() {
    if (!title) return;
    const next = !inWatchlist;
    setInWatchlist(next);
    await toggleWatchlist(title.media_type, title.id, next).catch(() =>
      setInWatchlist(!next),
    );
  }

  async function submitPost() {
    if (!title) return;
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await postToThread(title.media_type, title.id, body);
      setPosts(await listThreadPosts(title.media_type, title.id));
    } catch {
      setDraft(body);
    }
  }

  if (!title) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const startChatterbox = () =>
    router.push({
      pathname: '/start',
      params: {
        entityType: title.media_type,
        entityId: title.id,
        entityTitle: title.title,
      },
    });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/browse'))}>
          <Text style={styles.back}>← back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Image
            source={{ uri: posterUrl(title.poster_path) ?? undefined }}
            style={styles.poster}
            contentFit="cover"
            transition={150}
          />
          <View style={styles.heroText}>
            <Text style={styles.title}>{title.title}</Text>
            <Text style={styles.meta}>
              {[
                title.year,
                title.media_type === 'tv' ? 'TV series' : null,
                title.genres.slice(0, 3).join(' / ') || null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {title.vote_average ? (
              <Text style={styles.rating}>★ {title.vote_average.toFixed(1)}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.ctaRow}>
          <View style={styles.ctaGrow}>
            <PrimaryPill label="🎙 Start a Chatterbox" onPress={startChatterbox} />
          </View>
          <GhostPill
            label={inWatchlist ? '✓ Watchlist' : '+ Watchlist'}
            active={inWatchlist}
            onPress={onToggleWatchlist}
          />
        </View>

        <View style={styles.ratingBlock}>
          <Text style={styles.sectionLabel}>YOUR RATING</Text>
          <RatingStars value={myRating} onRate={onRate} />
          <Text style={styles.communityText}>
            {community.count > 0
              ? `MCB average ★ ${community.average?.toFixed(1)} · ${community.count} rating${community.count === 1 ? '' : 's'}`
              : 'No MCB ratings yet'}
          </Text>
        </View>

        {title.overview ? (
          <Text style={styles.overview}>{title.overview}</Text>
        ) : null}

        <Text style={styles.sectionLabel}>CHATTERBOXES</Text>
        {boxes.length === 0 && (
          <Text style={styles.emptyBoxes}>
            No live or scheduled Chatterboxes about this yet — be the first.
          </Text>
        )}
        {boxes.map((b) => (
          <Pressable key={b.id} onPress={() => router.push(`/chatterbox/${b.id}`)}>
            <GlassCard live={b.status === 'live'} style={styles.boxCard}>
              {b.status === 'live' ? (
                <LiveBadge />
              ) : (
                <TimeChip
                  label={
                    b.scheduled_at
                      ? new Date(b.scheduled_at).toLocaleString([], {
                          weekday: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'scheduled'
                  }
                />
              )}
              <Text style={styles.boxTitle}>{b.title}</Text>
            </GlassCard>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>DISCUSSION</Text>
        <View style={styles.composerRow}>
          <TextInput
            style={styles.composerInput}
            placeholder="Add to the conversation…"
            placeholderTextColor={color.textTertiary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submitPost}
            returnKeyType="send"
          />
          <Pressable onPress={submitPost}>
            <Text style={styles.postBtn}>Post</Text>
          </Pressable>
        </View>
        {posts.length === 0 && (
          <Text style={styles.emptyBoxes}>No posts yet — say something.</Text>
        )}
        {posts.map((p) => (
          <View key={p.id} style={styles.post}>
            <Text style={styles.postAuthor}>
              {p.profile?.display_name || p.profile?.handle || 'someone'}
            </Text>
            <Text style={styles.postBody}>{p.body}</Text>
          </View>
        ))}

        <Text style={styles.attribution}>
          Film and TV data from TMDB. This product uses the TMDB API but is not
          endorsed or certified by TMDB.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  loading: {
    ...type.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: space.huge,
  },
  content: {
    padding: space.xl,
    gap: space.lg,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    ...type.label,
    color: color.textTertiary,
  },
  hero: {
    flexDirection: 'row',
    gap: space.lg,
  },
  poster: {
    width: 104,
    height: 154,
    borderRadius: radius.sm,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  heroText: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  title: {
    fontFamily: font.display,
    fontSize: 28,
    color: color.textPrimary,
  },
  meta: {
    ...type.body,
    color: color.textSecondary,
  },
  rating: {
    ...type.label,
    color: color.orange300,
  },
  overview: {
    ...type.body,
    lineHeight: 22,
    color: color.textSecondary,
  },
  sectionLabel: {
    ...type.micro,
    color: color.textTertiary,
    marginTop: space.sm,
  },
  emptyBoxes: {
    ...type.body,
    color: color.textTertiary,
  },
  boxCard: {
    gap: space.sm,
    marginBottom: space.sm,
  },
  boxTitle: {
    ...type.heading,
    color: color.textPrimary,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  ctaGrow: {
    flex: 1,
  },
  ratingBlock: {
    gap: space.sm,
  },
  communityText: {
    ...type.label,
    color: color.textTertiary,
  },
  composerRow: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  composerInput: {
    ...type.body,
    flex: 1,
    color: color.textPrimary,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  postBtn: {
    ...type.label,
    color: color.orange500,
    paddingHorizontal: space.sm,
  },
  post: {
    borderBottomWidth: 1,
    borderBottomColor: color.glassBorder,
    paddingVertical: space.md,
    gap: space.xs,
  },
  postAuthor: {
    ...type.label,
    color: color.orange300,
  },
  postBody: {
    ...type.body,
    color: color.textPrimary,
  },
  attribution: {
    fontFamily: font.regular,
    fontSize: 11,
    color: color.textTertiary,
    marginTop: space.xxl,
  },
});
