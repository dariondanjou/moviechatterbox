import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard, LiveBadge, PrimaryPill, TimeChip } from '@/components/ui';
import type { Chatterbox } from '@/lib/chatterbox';
import {
  getTitle,
  listBoxesForEntity,
  posterUrl,
  type Title,
} from '@/lib/titles';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function TitlePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState<Title | null>(null);
  const [boxes, setBoxes] = useState<Chatterbox[]>([]);

  useEffect(() => {
    if (!id) return;
    getTitle(id)
      .then((t) => {
        setTitle(t);
        if (t) {
          listBoxesForEntity(t.media_type, t.id).then(setBoxes).catch(() => {});
        }
      })
      .catch(() => {});
  }, [id]);

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

        <PrimaryPill label="🎙 Start a Chatterbox" onPress={startChatterbox} />

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
  attribution: {
    fontFamily: font.regular,
    fontSize: 11,
    color: color.textTertiary,
    marginTop: space.xxl,
  },
});
