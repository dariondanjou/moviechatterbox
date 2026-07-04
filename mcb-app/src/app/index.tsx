import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { color } from '@/theme/tokens';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={color.orange500} />
      </View>
    );
  }

  return <Redirect href={session ? '/lobby' : '/sign-in'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.bgScreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
