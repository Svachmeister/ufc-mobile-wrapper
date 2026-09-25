import { useLocalSearchParams } from 'expo-router';

import { CardDetailScreen } from '@/features/cards/CardDetailScreen';

export default function CollectionCardDetail() {
  const { cardId } = useLocalSearchParams<{ cardId: string }>();
  return <CardDetailScreen cardId={cardId} enableFighterLinks={false} fallbackRoute="/(tabs)/collection" />;
}
