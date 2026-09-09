import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { spacing } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';

export default function Profile() {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <Screen>
      <Text variant="heading">Profile</Text>
      <View style={styles.signOut}>
        <Button variant="outline" label="Sign out" onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signOut: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
