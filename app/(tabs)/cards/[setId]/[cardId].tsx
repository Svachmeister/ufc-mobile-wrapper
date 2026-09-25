import { useLocalSearchParams } from 'expo-router';

import { CardDetailScreen } from '@/features/cards/CardDetailScreen';

export default function CardsCardDetail() {
  const { cardId } = useLocalSearchParams<{ setId: string; cardId: string }>();
  return <CardDetailScreen cardId={cardId} />;
}
