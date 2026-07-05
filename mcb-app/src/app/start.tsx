import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostPill, PrimaryPill } from '@/components/ui';
import { createChatterbox } from '@/lib/chatterbox';
import { color, font, radius, space, type } from '@/theme/tokens';

function backToLobby() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/lobby');
  }
}

const SCHEDULE_OPTIONS = [
  { label: 'in 15 min', minutes: 15 },
  { label: 'in 1 hour', minutes: 60 },
  { label: 'in 3 hours', minutes: 180 },
  { label: 'tomorrow', minutes: 24 * 60 },
] as const;

export default function StartChatterbox() {
  const { entityType, entityId, entityTitle } = useLocalSearchParams<{
    entityType?: string;
    entityId?: string;
    entityTitle?: string;
  }>();
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'now' | 'later'>('now');
  const [minutes, setMinutes] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const box = await createChatterbox({
        title: title.trim(),
        topic: topic.trim() || undefined,
        scheduledAt:
          mode === 'later'
            ? new Date(Date.now() + minutes * 60_000)
            : undefined,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
      });
      if (mode === 'now') {
        router.replace(`/chatterbox/${box.id}`);
      } else {
        backToLobby();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ presentation: 'modal' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>start a chatterbox</Text>
            <Pressable onPress={backToLobby}>
              <Text style={styles.cancel}>cancel</Text>
            </Pressable>
          </View>

          {entityTitle ? (
            <View style={styles.entityChip}>
              <Text style={styles.entityChipText}>🎬 {entityTitle}</Text>
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>WHAT'S IT ABOUT?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Hereditary — that ending"
            placeholderTextColor={color.textTertiary}
            maxLength={140}
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.fieldLabel}>TOPIC (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Set the vibe — spoilers welcome? hot takes only?"
            placeholderTextColor={color.textTertiary}
            multiline
            maxLength={280}
            value={topic}
            onChangeText={setTopic}
          />

          <Text style={styles.fieldLabel}>WHEN</Text>
          <View style={styles.pillRow}>
            <GhostPill
              label="Go live now"
              active={mode === 'now'}
              onPress={() => setMode('now')}
            />
            <GhostPill
              label="Schedule"
              active={mode === 'later'}
              onPress={() => setMode('later')}
            />
          </View>

          {mode === 'later' && (
            <View style={styles.pillRow}>
              {SCHEDULE_OPTIONS.map((o) => (
                <GhostPill
                  key={o.minutes}
                  label={o.label}
                  active={minutes === o.minutes}
                  onPress={() => setMinutes(o.minutes)}
                />
              ))}
            </View>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.submitWrap}>
            <PrimaryPill
              label={
                busy
                  ? 'Opening…'
                  : mode === 'now'
                    ? '🎙 Go live now'
                    : 'Schedule it'
              }
              disabled={busy || !title.trim()}
              onPress={submit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bgScreen,
  },
  flex: { flex: 1 },
  content: {
    padding: space.xl,
    gap: space.sm,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  title: {
    fontFamily: font.display,
    fontSize: 24,
    color: color.textPrimary,
  },
  cancel: {
    ...type.label,
    color: color.textTertiary,
  },
  fieldLabel: {
    ...type.micro,
    color: color.textTertiary,
    marginTop: space.lg,
  },
  entityChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,135,31,0.12)',
    borderColor: color.orange500,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  entityChipText: {
    ...type.label,
    color: color.orange300,
  },
  input: {
    ...type.body,
    color: color.textPrimary,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  error: {
    ...type.label,
    color: color.recordingText,
    marginTop: space.md,
  },
  submitWrap: {
    marginTop: space.xxl,
  },
});
