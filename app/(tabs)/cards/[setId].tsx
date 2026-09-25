import { useLocalSearchParams } from 'expo-router';

import { SetChecklistScreen } from '@/features/cards/SetChecklistScreen';

export default function CardsSetChecklist() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  return <SetChecklistScreen setId={setId} />;
}
