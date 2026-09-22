import { useLocalSearchParams } from 'expo-router';

import { PicksSummaryScreen } from '@/features/fantasy/PicksSummaryScreen';

export default function PicksSummary() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  return <PicksSummaryScreen eventId={eventId} />;
}
