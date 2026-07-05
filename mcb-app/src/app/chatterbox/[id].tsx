import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, GhostPill, LiveBadge, PrimaryPill } from '@/components/ui';
import {
  createAudioSession,
  type AudioSession,
} from '@/lib/audio-session';
import {
  endChatterbox,
  fetchAudioToken,
  getBox,
  goLive,
  join,
  leave,
  listMessages,
  listParticipants,
  sendMessage,
  setHandRaised,
  setMuted,
  setRecording,
  setRole,
  type Chatterbox,
  type Message,
  type Participant,
} from '@/lib/chatterbox';
import { confirmAction } from '@/lib/confirm';
import { supabase } from '@/lib/supabase';
import { getTitle, type Title } from '@/lib/titles';
import { useAuth } from '@/providers/auth-provider';
import { color, font, radius, space, type } from '@/theme/tokens';

const REACTIONS = ['🖤', '😂', '🔥', '👏'] as const;

type AudioState = 'connecting' | 'connected' | 'error' | 'idle';

function displayName(p?: { display_name?: string | null; handle?: string | null }) {
  return p?.display_name || p?.handle || 'someone';
}

function backToLobby() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/lobby');
  }
}

export default function ChatterboxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myId = session?.user.id;

  const [box, setBox] = useState<Chatterbox | null>(null);
  const [attachedTitle, setAttachedTitle] = useState<Title | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [floats, setFloats] = useState<{ key: number; emoji: string }[]>([]);

  const audioRef = useRef<AudioSession | null>(null);
  const roleRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const me = participants.find((p) => p.user_id === myId);
  const isHost = box?.host_id === myId;
  const canSpeak = me?.role === 'host' || me?.role === 'speaker';
  const stage = participants.filter((p) => p.role !== 'listener');
  const audience = participants.filter((p) => p.role === 'listener');

  const refreshParticipants = useCallback(async () => {
    if (!id) return;
    try {
      setParticipants(await listParticipants(id));
    } catch {
      // transient
    }
  }, [id]);

  const connectAudio = useCallback(async () => {
    if (!id) return;
    audioRef.current?.disconnect().catch(() => {});
    setAudioState('connecting');
    try {
      const { token, url } = await fetchAudioToken(id);
      const audio = createAudioSession({
        onActiveSpeakers: (ids) => setSpeaking(new Set(ids)),
        onDisconnected: () => setAudioState('idle'),
      });
      await audio.connect(url, token);
      audioRef.current = audio;
      setAudioState('connected');
    } catch {
      // Audio failure degrades to the text thread (FR-2.1.5)
      setAudioState('error');
    }
  }, [id]);

  // Load the box (+ attached entity for the film chip, FR-2.4.6 spirit)
  useEffect(() => {
    if (!id) return;
    getBox(id)
      .then((b) => {
        setBox(b);
        if (b?.entity_id) {
          getTitle(b.entity_id).then(setAttachedTitle).catch(() => {});
        }
      })
      .catch(() => setBox(null));
  }, [id]);

  const isLive = box?.status === 'live';
  const hostId = box?.host_id;

  // Join + data + audio while live (also covers a scheduled box going live)
  useEffect(() => {
    if (!id || !myId || !isLive) return;
    let cancelled = false;

    (async () => {
      await join(id, hostId === myId ? 'host' : 'listener').catch(() => {});
      await Promise.all([
        refreshParticipants(),
        listMessages(id).then((m) => !cancelled && setMessages(m)),
      ]);
      if (!cancelled) await connectAudio();
    })();

    return () => {
      cancelled = true;
      audioRef.current?.disconnect().catch(() => {});
      audioRef.current = null;
      leave(id).catch(() => {});
    };
  }, [id, myId, isLive, hostId, connectAudio, refreshParticipants]);

  // Realtime: participants, messages, box status, reactions
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`box-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mcb_participants', filter: `box_id=eq.${id}` },
        () => refreshParticipants(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mcb_messages', filter: `box_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mcb_chatterboxes', filter: `id=eq.${id}` },
        (payload) => setBox(payload.new as Chatterbox),
      )
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const key = Math.random();
        setFloats((f) => [...f.slice(-4), { key, emoji: payload.emoji }]);
        setTimeout(
          () => setFloats((f) => f.filter((x) => x.key !== key)),
          2500,
        );
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [id, refreshParticipants]);

  // Reconnect audio with new grants when my stage role changes (promotion/demotion)
  useEffect(() => {
    const role = me?.role ?? null;
    if (role && roleRef.current && roleRef.current !== role) {
      connectAudio();
    }
    roleRef.current = role;
  }, [me?.role, connectAudio]);

  // Room ended → disconnect and inform
  useEffect(() => {
    if (box?.status === 'ended') {
      audioRef.current?.disconnect().catch(() => {});
      setAudioState('idle');
    }
  }, [box?.status]);

  async function onMicPress() {
    if (!id || !me) return;
    if (!canSpeak) {
      await setHandRaised(id, !me.hand_raised).catch(() => {});
      return;
    }
    const next = !me.muted;
    await audioRef.current?.setMicEnabled(!next).catch(() => {});
    await setMuted(id, next).catch(() => {});
  }

  function onParticipantPress(p: Participant) {
    if (!isHost || !id || p.user_id === myId) return;
    const promote = p.role === 'listener';
    confirmAction({
      title: displayName(p.profile),
      message: promote ? 'Invite to the stage?' : 'Move back to the audience?',
      confirmLabel: promote ? 'Invite to stage' : 'Move to audience',
      onConfirm: () =>
        setRole(id, p.user_id, promote ? 'speaker' : 'listener').catch(() => {}),
    });
  }

  async function onSend() {
    const body = draft.trim();
    if (!id || !body) return;
    setDraft('');
    await sendMessage(id, body).catch(() => setDraft(body));
  }

  function onLeavePress() {
    if (isHost && box?.status === 'live') {
      confirmAction({
        title: 'End this Chatterbox?',
        message: 'This closes it for everyone.',
        confirmLabel: 'End for everyone',
        destructive: true,
        onConfirm: async () => {
          await endChatterbox(id!).catch(() => {});
          backToLobby();
        },
      });
    } else {
      backToLobby();
    }
  }

  function sendReaction(emoji: string) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji },
    });
  }

  const profileOf = (userId: string) =>
    participants.find((p) => p.user_id === userId)?.profile;

  if (!box) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.meta}>Opening…</Text>
      </SafeAreaView>
    );
  }

  if (box.status !== 'live') {
    const scheduledFor = box.scheduled_at
      ? new Date(box.scheduled_at).toLocaleString([], {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.endedWrap}>
          <Text style={styles.endedTitle}>
            {box.status === 'ended' ? 'This Chatterbox has ended' : 'Not live yet'}
          </Text>
          <Text style={styles.meta}>{box.title}</Text>
          {box.status === 'scheduled' && scheduledFor && (
            <Text style={styles.meta}>Scheduled for {scheduledFor}</Text>
          )}
          {box.status === 'scheduled' && isHost && (
            <PrimaryPill
              label="🎙 Go live now"
              onPress={async () => {
                await goLive(box.id).catch(() => {});
                setBox({ ...box, status: 'live', started_at: new Date().toISOString() });
              }}
            />
          )}
          <GhostPill label="Back to the Lobby" onPress={backToLobby} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadges}>
            <LiveBadge />
            {box.is_recorded && (
              <View style={styles.recBadge}>
                <Text style={styles.recBadgeText}>● REC</Text>
              </View>
            )}
            <Text style={styles.listenerCount}>
              {participants.length} here
            </Text>
            {isHost && (
              <Pressable
                onPress={() => setRecording(box.id, !box.is_recorded).catch(() => {})}
              >
                <Text style={styles.recToggle}>
                  {box.is_recorded ? 'stop rec' : 'record'}
                </Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.roomTitle}>{box.title}</Text>
          {box.topic ? <Text style={styles.meta}>{box.topic}</Text> : null}
          {attachedTitle && (
            <Pressable onPress={() => router.push(`/title/${attachedTitle.id}`)}>
              <Text style={styles.filmChip}>
                🎬 {attachedTitle.title} · tap for the film page
              </Text>
            </Pressable>
          )}
          {box.is_recorded && (
            <Text style={styles.recDisclosure}>
              This Chatterbox is being recorded.
            </Text>
          )}
        </View>

        {audioState === 'error' && (
          <View style={styles.degradeBanner}>
            <Text style={styles.degradeText}>
              Audio unavailable right now — the conversation continues in text below.
            </Text>
            <Pressable onPress={connectAudio}>
              <Text style={styles.degradeRetry}>Retry audio</Text>
            </Pressable>
          </View>
        )}

        {/* Stage */}
        <View style={styles.stage}>
          {stage.map((p) => (
            <Pressable key={p.id} onPress={() => onParticipantPress(p)}>
              <View style={styles.stageMember}>
                <Avatar
                  name={displayName(p.profile)}
                  size={64}
                  speaking={speaking.has(p.user_id)}
                  muted={p.muted}
                  host={p.role === 'host'}
                />
                <Text style={styles.stageName} numberOfLines={1}>
                  {displayName(p.profile)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Audience */}
        <Text style={styles.audienceLabel}>
          LISTENING · {audience.length}
        </Text>
        <View style={styles.audience}>
          {audience.slice(0, 16).map((p) => (
            <Pressable key={p.id} onPress={() => onParticipantPress(p)}>
              <View>
                <Avatar name={displayName(p.profile)} size={40} />
                {p.hand_raised && (
                  <Text style={styles.handBadge}>✋</Text>
                )}
              </View>
            </Pressable>
          ))}
          {audience.length > 16 && (
            <Text style={styles.meta}>+{audience.length - 16}</Text>
          )}
        </View>

        {/* Floating reactions */}
        <View pointerEvents="none" style={styles.floats}>
          {floats.map((f) => (
            <Text key={f.key} style={styles.floatEmoji}>
              {f.emoji}
            </Text>
          ))}
        </View>

        {/* Chat */}
        <FlatList
          style={styles.chat}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => (
            <View style={styles.msgRow}>
              <Text style={styles.msgAuthor}>
                {displayName(item.profile ?? profileOf(item.user_id))}
              </Text>
              <Text style={styles.msgBody}>{item.body}</Text>
            </View>
          )}
        />

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Say something…"
            placeholderTextColor={color.textTertiary}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <Pressable style={styles.sendBtn} onPress={onSend}>
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>

        {/* Bottom controls */}
        <View style={styles.controls}>
          <Pressable style={styles.leavePill} onPress={onLeavePress}>
            <Text style={styles.leaveText}>
              {isHost ? 'End' : '✌️ Leave quietly'}
            </Text>
          </Pressable>
          <View style={styles.reactionRow}>
            {REACTIONS.map((r) => (
              <Pressable key={r} onPress={() => sendReaction(r)}>
                <Text style={styles.reactionBtn}>{r}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[
              styles.micBtn,
              canSpeak && !me?.muted && styles.micBtnLive,
            ]}
            onPress={onMicPress}
          >
            <Text style={styles.micBtnText}>
              {canSpeak ? (me?.muted ? '🎙 off' : '🎙 on') : me?.hand_raised ? '✋ ·' : '✋'}
            </Text>
          </Pressable>
        </View>
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
  header: {
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    gap: space.xs,
  },
  endedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
  },
  endedTitle: {
    fontFamily: font.bold,
    fontSize: 21,
    color: color.textPrimary,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  listenerCount: {
    ...type.micro,
    color: color.textTertiary,
  },
  recBadge: {
    backgroundColor: 'rgba(229,72,77,0.14)',
    borderColor: 'rgba(229,72,77,0.4)',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  recBadgeText: {
    ...type.micro,
    color: color.recordingText,
  },
  recToggle: {
    ...type.micro,
    color: color.textTertiary,
    textDecorationLine: 'underline',
  },
  recDisclosure: {
    ...type.label,
    color: color.recordingText,
  },
  filmChip: {
    ...type.label,
    color: color.orange300,
  },
  roomTitle: {
    fontFamily: font.bold,
    fontSize: 21,
    color: color.textPrimary,
  },
  meta: {
    ...type.body,
    color: color.textSecondary,
  },
  degradeBanner: {
    marginHorizontal: space.xl,
    marginTop: space.md,
    backgroundColor: 'rgba(229,72,77,0.12)',
    borderColor: 'rgba(229,72,77,0.4)',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
  },
  degradeText: {
    ...type.label,
    color: color.recordingText,
  },
  degradeRetry: {
    ...type.label,
    color: color.orange300,
  },
  stage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  stageMember: {
    alignItems: 'center',
    width: 76,
    gap: space.xs,
  },
  stageName: {
    ...type.label,
    color: color.textSecondary,
    maxWidth: 76,
  },
  audienceLabel: {
    ...type.micro,
    color: color.textTertiary,
    paddingHorizontal: space.xl,
    marginBottom: space.sm,
  },
  audience: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  handBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    fontSize: 14,
  },
  floats: {
    position: 'absolute',
    right: space.xl,
    bottom: 170,
    alignItems: 'center',
    gap: 2,
  },
  floatEmoji: {
    fontSize: 26,
  },
  chat: {
    flex: 1,
    marginTop: space.md,
    paddingHorizontal: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.glassBorder,
  },
  msgRow: {
    paddingVertical: space.sm,
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
  },
  msgAuthor: {
    ...type.label,
    color: color.orange300,
  },
  msgBody: {
    ...type.body,
    color: color.textPrimary,
    flexShrink: 1,
  },
  composer: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
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
  sendBtn: {
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  sendBtnText: {
    ...type.label,
    color: color.orange500,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    paddingTop: space.xs,
  },
  leavePill: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  leaveText: {
    ...type.label,
    color: color.textPrimary,
  },
  reactionRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  reactionBtn: {
    fontSize: 22,
  },
  micBtn: {
    backgroundColor: color.glass,
    borderColor: color.glassBorder,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    minWidth: 64,
    alignItems: 'center',
  },
  micBtnLive: {
    backgroundColor: color.orange500,
    borderColor: color.orange500,
    shadowColor: color.orange500,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  micBtnText: {
    ...type.label,
    color: color.textPrimary,
  },
});
