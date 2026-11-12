import { TabStack } from '@/components/navigation';
import { useI18n } from '@/i18n';

export default function CookStackLayout() {
  const { t } = useI18n();
  return <TabStack title={t.cook.title} />;
}
