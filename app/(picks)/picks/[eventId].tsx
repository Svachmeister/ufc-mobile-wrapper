import { useLocalSearchParams } from 'expo-router';

import { FightPickScreen } from '@/features/fantasy/FightPickScreen';

export default function PicksFlow() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <FightPickScreen eventId={eventId} />;
}
