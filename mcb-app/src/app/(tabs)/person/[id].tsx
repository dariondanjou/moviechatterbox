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

import { ReplayPlayer } from '@/components/replay-player';
import { GlassCard, LiveBadge, PrimaryPill, TimeChip } from '@/components/ui';
import type { Chatterbox } from '@/lib/chatterbox';
import {
  filmographyForPerson,
  getPerson,
  personImgUrl,
  type Person,
} from '@/lib/persons';
import { listReplaysForEntity, type Replay } from '@/lib/replays';
import { emitSignal } from '@/lib/signals';
import { listBoxesForEntity, posterUrl, type Title } from '@/lib/titles';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [person, setPerson] = useState<Person | null>(null);
  const [films, setFilms] = useState<(Title & { role: string | null })[]>([]);
  const [boxes, setBoxes] = useState<Chatterbox[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);

  useEffect(() => {
    if (!id) return;
    getPerson(id)
      .then((p) => {
        setPerson(p);
        if (p) {
          filmographyForPerson(p.id).then(setFilms).catch(() => {});
          listBoxesForEntity('person', p.id).then(setBoxes).catch(() => {});
          listReplaysForEntity(p.id).then(setReplays).catch(() => {});
        }
      })
      .catch(() => {});
  }, [id]);

  // Dwell signal (FR-11.1), emitted on the way out
  useEffect(() => {
    if (!person) return;
    const t0 = Date.now();
    const entityId = person.id;
    return () => {
      emitSignal('person_view', {
        entityType: 'person',
        entityId,
        value: Math.round((Date.now() - t0) / 1000),
      });
    };
  }, [person?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!person) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.loading}>Loading…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/browse'))}
        >
          <Text style={styles.back}>← back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Image
            source={{ uri: personImgUrl(person.profile_path, 'w342') ?? undefined }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
          />
          <View style={styles.heroText}>
            <Text style={styles.name}>{person.name}</Text>
            {person.known_for ? (
              <Text style={styles.meta}>{person.known_for}</Text>
            ) : null}
          </View>
        </View>

        <PrimaryPill
          label="🎙 Start a Chatterbox"
          onPress={() =>
            router.push({
              pathname: '/start',
              params: {
                entityType: 'person',
                entityId: person.id,
                entityTitle: person.name,
              },
            })
          }
        />

        {boxes.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>CHATTERBOXES</Text>
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
          </>
        )}

        {replays.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>REPLAYS</Text>
            {replays.map((r) => (
              <View key={r.id} style={styles.replayBlock}>
                {r.box && (
                  <Pressable onPress={() => router.push(`/chatterbox/${r.box_id}`)}>
                    <Text style={styles.replayTitle} numberOfLines={1}>
                      {r.box.title}
                    </Text>
                  </Pressable>
                )}
                <ReplayPlayer replay={r} />
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionLabel}>FILMOGRAPHY</Text>
        <View style={styles.grid}>
          {films.map((f) => (
            <Pressable
              key={f.id}
              style={styles.cell}
              onPress={() => router.push(`/title/${f.id}`)}
            >
              <Image
                source={{ uri: posterUrl(f.poster_path, 'w185') ?? undefined }}
                style={styles.poster}
                contentFit="cover"
              />
              <Text style={styles.cellTitle} numberOfLines={1}>
                {f.title}
              </Text>
              <Text style={styles.cellMeta} numberOfLines={1}>
                {f.role ?? ''}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.attribution}>
          Person data from TMDB. This product uses the TMDB API but is not
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
  photo: {
    width: 104,
    height: 130,
    borderRadius: radius.md,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  heroText: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: space.xs,
  },
  name: {
    fontFamily: font.display,
    fontSize: 28,
    color: color.textPrimary,
  },
  meta: {
    ...type.body,
    color: color.textSecondary,
  },
  sectionLabel: {
    ...type.micro,
    color: color.textTertiary,
    marginTop: space.sm,
  },
  boxCard: {
    gap: space.sm,
    marginBottom: space.sm,
  },
  boxTitle: {
    ...type.heading,
    color: color.textPrimary,
  },
  replayBlock: {
    gap: space.xs,
    marginBottom: space.sm,
  },
  replayTitle: {
    ...type.label,
    color: color.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  cell: {
    width: 96,
  },
  poster: {
    width: 96,
    height: 144,
    borderRadius: radius.sm,
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.glassBorder,
  },
  cellTitle: {
    ...type.label,
    color: color.textPrimary,
    marginTop: space.xs,
  },
  cellMeta: {
    fontFamily: font.regular,
    fontSize: 11,
    color: color.textTertiary,
  },
  attribution: {
    fontFamily: font.regular,
    fontSize: 11,
    color: color.textTertiary,
    marginTop: space.xxl,
  },
});
