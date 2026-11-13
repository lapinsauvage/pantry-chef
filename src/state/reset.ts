import { recipeDb } from '@/db/recipe-db';
import { resetUserData } from '@/db/user';

import { basicsStore, seedDefaultBasics } from './basics';
import { browseStore } from './browse';
import { cookStore } from './cook';
import { favoritesStore, historyStore } from './favorites';
import { pantryStore } from './pantry';
import { shoppingStore } from './shopping';
import { settingsStore } from './settings';

/** Forget everything the user entered; the app goes back to onboarding with default basics. */
export async function resetAppData(): Promise<void> {
  resetUserData();
  basicsStore.reload();
  pantryStore.reload();
  favoritesStore.reload();
  historyStore.reload();
  shoppingStore.reload();
  cookStore.reload();
  browseStore.reload();
  try {
    await seedDefaultBasics(await recipeDb());
  } finally {
    // onboarded is now unset: the root layout's guard shows onboarding again
    settingsStore.reload();
  }
}
