import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { color, font, radius, space, type } from '@/theme/tokens';

type Mode = 'signIn' | 'signUp';

export default function SignIn() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (session) {
    return <Redirect href="/lobby" />;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const auth =
      mode === 'signIn'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (auth.error) {
      setError(auth.error.message);
    } else if (mode === 'signUp' && !auth.data.session) {
      setNotice('Check your email to confirm your account.');
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Image
            source={require('../../assets/brand/wordmark-dark.png')}
            style={styles.wordmark}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>
            where lovers of tv and film talk to each other — live
          </Text>

          <TextInput
            style={styles.input}
            placeholder="email"
            placeholderTextColor={color.textTertiary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="password"
            placeholderTextColor={color.textTertiary}
            secureTextEntry
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {notice && <Text style={styles.notice}>{notice}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              busy && styles.disabled,
            ]}
            disabled={busy || !email || !password}
            onPress={submit}
          >
            {busy ? (
              <ActivityIndicator color={color.inkOnOrange} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'signIn' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
              setNotice(null);
            }}
          >
            <Text style={styles.ghostButtonText}>
              {mode === 'signIn'
                ? 'New here? Create an account'
                : 'Already have an account? Sign in'}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    gap: space.md,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  wordmark: {
    width: 260,
    height: 64,
    alignSelf: 'center',
  },
  tagline: {
    ...type.body,
    color: color.textSecondary,
    textAlign: 'center',
    marginBottom: space.xxl,
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
  },
  error: {
    ...type.label,
    color: color.recordingText,
    textAlign: 'center',
  },
  notice: {
    ...type.label,
    color: color.positive,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: color.orange500,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.sm,
    shadowColor: color.orange500,
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  primaryButtonPressed: {
    backgroundColor: color.orange600,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontFamily: font.bold,
    fontSize: 16,
    color: color.inkOnOrange,
  },
  ghostButtonText: {
    ...type.label,
    color: color.orange500,
    textAlign: 'center',
    paddingVertical: space.md,
  },
});
