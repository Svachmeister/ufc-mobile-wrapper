import { useLocalSearchParams } from 'expo-router';

import { FightPickScreen } from '@/features/fantasy/FightPickScreen';

export default function PicksFlow() {
  const { eventId, fightId } = useLocalSearchParams<{ eventId: string; fightId?: string }>();
  return <FightPickScreen eventId={eventId} focusFightId={fightId} />;
}
