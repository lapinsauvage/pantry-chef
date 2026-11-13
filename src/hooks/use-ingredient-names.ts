import { useEffect, useState } from 'react';

import { useRecipeDb } from '@/db/recipe-db';
import { ingredientsByIds } from '@/db/recipes';
import type { UserIngredient } from '@/db/user';
import { useI18n } from '@/i18n';

/**
 * Display names for the user's ingredients (pantry, basics): user.db stores the English
 * canonical name, so in French the names are looked up in one query. Needs <Suspense>.
 */
export function useIngredientNames(items: readonly UserIngredient[]): (item: UserIngredient) => string {
  const db = useRecipeDb();
  const { lang } = useI18n();
  const [french, setFrench] = useState<ReadonlyMap<number, string>>(new Map());
  useEffect(() => {
    if (lang !== 'fr' || !items.length) return;
    let live = true;
    ingredientsByIds(db, items.map((i) => i.id)).then((rows) => {
      if (live) setFrench(new Map(rows.filter((r) => r.name_fr).map((r) => [r.id, r.name_fr as string])));
    });
    return () => {
      live = false;
    };
  }, [db, lang, items]);
  return (item) => (lang === 'fr' && french.get(item.id)) || item.name;
}
