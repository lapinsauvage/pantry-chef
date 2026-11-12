import { TabStack } from '@/components/navigation';
import { useI18n } from '@/i18n';

export default function FavoritesStackLayout() {
  const { t } = useI18n();
  return <TabStack title={t.favorites.title} />;
}
