import { useLocalSearchParams } from 'expo-router';

import { FighterDetailScreen } from '@/features/cards/FighterDetailScreen';

export default function CardsFighterDetail() {
  const { fighterId } = useLocalSearchParams<{ fighterId: string }>();
  return <FighterDetailScreen fighterId={fighterId} />;
}
