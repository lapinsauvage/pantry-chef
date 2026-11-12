import { Message } from '@/components/states';
import { useI18n } from '@/i18n';

/** Placeholder until milestone M4 (see docs/SPEC.md). */
export default function ShoppingScreen() {
  const { t } = useI18n();
  return <Message icon="cart" body={t.shopping.comingSoon} />;
}
