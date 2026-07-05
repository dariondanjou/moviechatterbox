import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostPill, GlassCard, LiveBadge, TimeChip } from '@/components/ui';
import {
  listLive,
  listScheduled,
  myReminders,
  toggleReminder,
  type Chatterbox,
} from '@/lib/chatterbox';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function Lobby() {
  const { session, loading } = useAuth();
  const [live, setLive] = useState<Chatterbox[]>([]);
  const [scheduled, setScheduled] = useState<Chatterbox[]>([]);
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([listLive(), listScheduled()]);
      setLive(l);
      setScheduled(s);
      setReminded(await myReminders(s.map((b) => b.id)));
    } catch {
      // transient — pull-to-refresh recovers
    }
  }, []);

  async function onRemind(box: Chatterbox) {
    const on = !reminded.has(box.id);
    setReminded((prev) => {
      const next = new Set(prev);
      if (on) next.add(box.id);
      else next.delete(box.id);
      return next;
    });
    await toggleReminder(box.id, on).catch(() => refresh());
  }

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const channel = supabase
      .channel('lobby')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mcb_chatterboxes' },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  if (!loading && !session) {
    return <Redirect href="/sign-in" />;
  }

  const fmtTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date().toDateString() === d.toDateString();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return today ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>the lobby</Text>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>sign out</Text>
        </Pressable>
      </View>

      <FlatList
        data={live}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={color.orange500}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
          />
        }
        ListHeaderComponent={
          <Text style={styles.sectionLabel}>
            LIVE NOW{live.length ? ` · ${live.length}` : ''}
          </Text>
        }
        ListEmptyComponent={
          <GlassCard>
            <Text style={styles.emptyTitle}>Nothing live yet</Text>
            <Text style={styles.emptyBody}>
              Be the first — start a Chatterbox about anything you're watching.
            </Text>
          </GlassCard>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/chatterbox/${item.id}`)}>
            <GlassCard live style={styles.card}>
              <View style={styles.cardTopRow}>
                <LiveBadge />
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.topic ? (
                <Text style={styles.cardTopic}>{item.topic}</Text>
              ) : null}
              <Text style={styles.cardJoin}>Join →</Text>
            </GlassCard>
          </Pressable>
        )}
        ListFooterComponent={
          <View>
            {scheduled.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>COMING UP</Text>
                {scheduled.map((b) => (
                  <Pressable key={b.id} onPress={() => router.push(`/chatterbox/${b.id}`)}>
                    <GlassCard style={styles.card}>
                      <TimeChip label={fmtTime(b.scheduled_at)} />
                      <Text style={styles.cardTitle}>{b.title}</Text>
                      {b.topic ? <Text style={styles.cardTopic}>{b.topic}</Text> : null}
                      <View style={styles.remindRow}>
                        <GhostPill
                          label={reminded.has(b.id) ? '✓ Reminded' : 'Remind me'}
                          active={reminded.has(b.id)}
                          onPress={() => onRemind(b)}
                        />
                      </View>
                    </GlassCard>
                  </Pressable>
                ))}
              </>
            )}
            <View style={{ height: 96 }} />
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push('/start')}>
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  title: {
    ...type.displayHeader,
    color: color.textPrimary,
  },
  signOut: {
    ...type.label,
    color: color.textTertiary,
  },
  list: {
    paddingHorizontal: space.xl,
  },
  sectionLabel: {
    ...type.micro,
    color: color.textTertiary,
    marginTop: space.lg,
    marginBottom: space.md,
  },
  card: {
    marginBottom: space.md,
    gap: space.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 19,
    color: color.textPrimary,
  },
  cardTopic: {
    ...type.body,
    color: color.textSecondary,
  },
  cardJoin: {
    ...type.label,
    color: color.orange500,
  },
  remindRow: {
    flexDirection: 'row',
  },
  emptyTitle: {
    ...type.heading,
    color: color.textPrimary,
    marginBottom: space.xs,
  },
  emptyBody: {
    ...type.body,
    color: color.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: space.xxl,
    bottom: space.xxxl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.orange500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: color.orange500,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabPlus: {
    fontFamily: font.bold,
    fontSize: 30,
    lineHeight: 34,
    color: color.inkOnOrange,
  },
});
