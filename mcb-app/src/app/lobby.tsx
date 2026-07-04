import { Redirect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { color, radius, space, type } from '@/theme/tokens';

/**
 * The Lobby — live discovery surface (FR-2.1, §10 naming).
 * Foundation placeholder; live Chatterbox list lands with the audio core phase.
 */
export default function Lobby() {
  const { session, loading } = useAuth();

  if (!loading && !session) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>the lobby</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>SIGNED IN</Text>
          <Text style={styles.cardText}>{session?.user.email}</Text>
          <Text style={styles.cardMeta}>
            Live Chatterboxes appear here once the audio core ships.
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  title: {
    ...type.displayHeader,
    color: color.textPrimary,
  },
  body: {
    flex: 1,
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  card: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.xl,
    gap: space.sm,
  },
  cardLabel: {
    ...type.micro,
    color: color.orange500,
  },
  cardText: {
    ...type.heading,
    color: color.textPrimary,
  },
  cardMeta: {
    ...type.body,
    color: color.textSecondary,
  },
  signOut: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  signOutPressed: {
    backgroundColor: color.glassStrong,
  },
  signOutText: {
    ...type.label,
    color: color.textPrimary,
  },
});
