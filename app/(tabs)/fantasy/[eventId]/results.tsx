import { useLocalSearchParams } from 'expo-router';

import { EventResultsScreen } from '@/features/fantasy/EventResultsScreen';

export default function FantasyEventResults() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <EventResultsScreen eventId={eventId} />;
}
