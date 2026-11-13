/** Shopping list grouping and plain-text export. Pure, unit-tested. */
import { INGREDIENT_CATEGORIES } from './constants.ts';

export interface ShoppingItem {
  id: number;
  text: string;
  ingredient_id: number | null;
  recipe_id: number | null;
  checked: number;
  created_at: number;
}

export interface ShoppingGroup {
  /** INGREDIENT_CATEGORIES key; free-text items without a known ingredient go to "other". */
  category: string;
  items: ShoppingItem[];
}

const ORDER = INGREDIENT_CATEGORIES.map((c) => c.key);

/** Groups in aisle order; inside a group, items to buy first (oldest first), then checked ones. */
export function groupShopping(items: readonly ShoppingItem[], categoryOf: (item: ShoppingItem) => string | undefined): ShoppingGroup[] {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const raw = categoryOf(item);
    const category = raw && ORDER.includes(raw) ? raw : 'other';
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map(([category, list]) => ({
      category,
      items: [...list].sort((x, y) => x.checked - y.checked || x.created_at - y.created_at || x.id - y.id),
    }));
}

/** Plain text to share (unchecked items only), e.g. for a messaging app. */
export function shoppingText(groups: readonly ShoppingGroup[], title: string, label: (category: string) => string): string {
  const lines = [title];
  for (const g of groups) {
    const todo = g.items.filter((i) => !i.checked);
    if (!todo.length) continue;
    lines.push('', label(g.category), ...todo.map((i) => `• ${i.text}`));
  }
  return lines.join('\n');
}
