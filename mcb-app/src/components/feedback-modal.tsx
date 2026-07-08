import { usePathname } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryPill } from '@/components/ui';
import { submitFeedback } from '@/lib/feedback';
import { color, elevation, font, radius, space, type } from '@/theme/tokens';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

/** Feedback sheet opened from the tab bar (founder request 2026-07-08). */
export function FeedbackModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<SendState>('idle');

  function close() {
    setDraft('');
    setState('idle');
    onClose();
  }

  async function onSubmit() {
    const body = draft.trim();
    if (!body || state === 'sending') return;
    setState('sending');
    try {
      await submitFeedback(body, pathname);
      setState('sent');
    } catch {
      setState('error');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {state === 'sent' ? (
              <View style={styles.sentWrap}>
                <Text style={styles.title}>Thank you 🖤</Text>
                <Text style={styles.subtitle}>
                  Your feedback shapes what gets built next.
                </Text>
                <PrimaryPill label="Done" onPress={close} />
              </View>
            ) : (
              <>
                <Text style={styles.title}>Tell us anything</Text>
                <Text style={styles.subtitle}>
                  Bugs, ideas, gripes, love letters — it all goes to the founder.
                </Text>
                <TextInput
                  style={styles.input}
                  multiline
                  placeholder="What’s on your mind?"
                  placeholderTextColor={color.textTertiary}
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={4000}
                  autoFocus
                />
                {state === 'error' && (
                  <Text style={styles.error}>
                    Couldn’t send that — try again in a moment.
                  </Text>
                )}
                <PrimaryPill
                  label={state === 'sending' ? 'Sending…' : 'Send feedback'}
                  disabled={state === 'sending' || !draft.trim()}
                  onPress={onSubmit}
                />
              </>
            )}
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: elevation.sheetTint,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 18,
    color: color.textPrimary,
  },
  subtitle: {
    ...type.body,
    color: color.textSecondary,
  },
  input: {
    ...type.body,
    minHeight: 120,
    maxHeight: 240,
    color: color.textPrimary,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    textAlignVertical: 'top',
  },
  error: {
    ...type.label,
    color: color.recordingText,
  },
  sentWrap: {
    gap: space.md,
    paddingVertical: space.md,
  },
});
