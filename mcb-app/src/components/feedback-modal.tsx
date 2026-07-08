import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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

const MAX_RECORDING_MS = 3 * 60 * 1000;

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Feedback sheet opened from the tab bar (founder request 2026-07-08).
 * Text and/or an optional voice note; voice is transcribed + triaged
 * server-side through the same AI pipeline.
 */
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
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [voiceMs, setVoiceMs] = useState(0);
  const [micDenied, setMicDenied] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    };
  }, []);

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setMicDenied(true);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setVoiceUri(null);
      stopTimer.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      setMicDenied(true);
    }
  }

  async function stopRecording() {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    try {
      const status = recorder.getStatus();
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (recorder.uri) {
        setVoiceUri(recorder.uri);
        setVoiceMs(status.durationMillis ?? 0);
      }
    } catch {
      // recording discarded
    }
  }

  function close() {
    if (recorderState.isRecording) {
      recorder.stop().catch(() => {});
    }
    setDraft('');
    setVoiceUri(null);
    setVoiceMs(0);
    setState('idle');
    setMicDenied(false);
    onClose();
  }

  async function onSubmit() {
    const text = draft.trim();
    if ((!text && !voiceUri) || state === 'sending') return;
    if (recorderState.isRecording) await stopRecording();
    setState('sending');
    try {
      await submitFeedback(
        { text: text || undefined, audioUri: voiceUri ?? undefined },
        pathname,
      );
      setState('sent');
    } catch {
      setState('error');
    }
  }

  const recording = recorderState.isRecording;
  const canSend = (draft.trim().length > 0 || !!voiceUri) && state !== 'sending';

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
                  Type it or say it — bugs, ideas, gripes, love letters. It all
                  goes to the founder.
                </Text>
                <TextInput
                  style={styles.input}
                  multiline
                  placeholder="What’s on your mind?"
                  placeholderTextColor={color.textTertiary}
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={4000}
                />

                {/* Voice note row */}
                <View style={styles.voiceRow}>
                  <Pressable
                    style={[styles.micBtn, recording && styles.micBtnLive]}
                    onPress={recording ? stopRecording : startRecording}
                  >
                    <Text style={styles.micBtnText}>
                      {recording
                        ? `⏹ ${fmt(recorderState.durationMillis ?? 0)}`
                        : '🎙'}
                    </Text>
                  </Pressable>
                  {recording ? (
                    <Text style={styles.voiceMeta}>
                      Recording… tap to finish (3 min max)
                    </Text>
                  ) : voiceUri ? (
                    <View style={styles.voiceChip}>
                      <Text style={styles.voiceChipText}>
                        voice note · {fmt(voiceMs)}
                      </Text>
                      <Pressable onPress={() => setVoiceUri(null)}>
                        <Text style={styles.voiceDiscard}> ✕</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.voiceMeta}>
                      {micDenied
                        ? 'Mic unavailable — typing works too.'
                        : 'or record a voice note'}
                    </Text>
                  )}
                </View>

                {state === 'error' && (
                  <Text style={styles.error}>
                    Couldn’t send that — try again in a moment.
                  </Text>
                )}
                <PrimaryPill
                  label={state === 'sending' ? 'Sending…' : 'Send feedback'}
                  disabled={!canSend}
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
    minHeight: 100,
    maxHeight: 220,
    color: color.textPrimary,
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    textAlignVertical: 'top',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  micBtn: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    minWidth: 56,
    alignItems: 'center',
  },
  micBtnLive: {
    backgroundColor: 'rgba(229,72,77,0.16)',
    borderColor: 'rgba(229,72,77,0.5)',
  },
  micBtnText: {
    ...type.label,
    color: color.textPrimary,
  },
  voiceMeta: {
    ...type.label,
    color: color.textTertiary,
    flexShrink: 1,
  },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,135,31,0.12)',
    borderColor: color.orange500,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  voiceChipText: {
    ...type.label,
    color: color.orange300,
  },
  voiceDiscard: {
    ...type.label,
    color: color.textSecondary,
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
