import { Stack } from 'expo-router';

// The picks flow lives outside the (tabs) group on purpose: it is pushed over
// the tab navigator, so the tab bar is not rendered while the flow is open.
export default function PicksLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
