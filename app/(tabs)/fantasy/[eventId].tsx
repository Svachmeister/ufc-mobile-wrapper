import { useLocalSearchParams } from 'expo-router';

import { FantasyScreen } from '@/features/fantasy/FantasyScreen';

export default function FantasyEvent() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <FantasyScreen eventId={eventId} />;
}
