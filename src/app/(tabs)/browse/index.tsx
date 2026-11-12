import { Message } from '@/components/states';
import { useI18n } from '@/i18n';

/** Placeholder until milestone M3 (see docs/SPEC.md). */
export default function BrowseScreen() {
  const { t } = useI18n();
  return <Message icon="browse" body={t.browse.comingSoon} />;
}
