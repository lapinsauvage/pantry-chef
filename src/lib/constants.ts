/**
 * Codes and bit values shared with the data pipeline
 * (data-pipeline/pantry_pipeline/{classify,ingredients}.py).
 * data-pipeline/tests/test_constants_sync.py fails if they drift apart.
 */

export type Lang = 'en' | 'fr';
type Labels = Record<Lang, string>;

export interface Flag {
  key: string;
  bit: number;
  label: Labels;
}

/** recipes.equipment: bits of the appliances a recipe needs. */
export const EQUIPMENT: Flag[] = [
  { key: 'oven', bit: 1, label: { en: 'Oven', fr: 'Four' } },
  { key: 'stovetop', bit: 2, label: { en: 'Stovetop', fr: 'Taque / plaque de cuisson' } },
  { key: 'microwave', bit: 4, label: { en: 'Microwave', fr: 'Micro-ondes' } },
  { key: 'air_fryer', bit: 8, label: { en: 'Air fryer', fr: 'Air fryer' } },
  { key: 'slow_cooker', bit: 16, label: { en: 'Slow cooker', fr: 'Mijoteuse' } },
  { key: 'pressure_cooker', bit: 32, label: { en: 'Pressure cooker', fr: 'Autocuiseur' } },
  { key: 'blender', bit: 64, label: { en: 'Blender / food processor', fr: 'Mixeur / robot' } },
  { key: 'mixer', bit: 128, label: { en: 'Electric mixer', fr: 'Batteur électrique' } },
  { key: 'grill', bit: 256, label: { en: 'Grill / BBQ', fr: 'Grill / barbecue' } },
  { key: 'deep_fryer', bit: 512, label: { en: 'Deep fryer', fr: 'Friteuse' } },
  { key: 'bread_machine', bit: 1024, label: { en: 'Bread machine', fr: 'Machine à pain' } },
];
export const ALL_EQUIPMENT = EQUIPMENT.reduce((m, e) => m | e.bit, 0);

/** recipes.diet: derived from ingredients/nutrition (best effort, not medical advice). */
export const DIETS: Flag[] = [
  { key: 'vegetarian', bit: 1, label: { en: 'Vegetarian', fr: 'Végétarien' } },
  { key: 'vegan', bit: 2, label: { en: 'Vegan', fr: 'Vegan' } },
  { key: 'gluten_free', bit: 4, label: { en: 'Gluten-free', fr: 'Sans gluten' } },
  { key: 'dairy_free', bit: 8, label: { en: 'Dairy-free', fr: 'Sans lactose' } },
  { key: 'low_carb', bit: 16, label: { en: 'Low carb', fr: 'Pauvre en glucides' } },
  { key: 'low_calorie', bit: 32, label: { en: 'Under 400 kcal', fr: 'Moins de 400 kcal' } },
  { key: 'high_protein', bit: 64, label: { en: 'High protein', fr: 'Riche en protéines' } },
  { key: 'nut_free', bit: 128, label: { en: 'Nut-free', fr: 'Sans fruits à coque' } },
];

/** recipes.avoid and ingredients.avoid: what a recipe/ingredient contains. */
export const AVOID: Flag[] = [
  { key: 'gluten', bit: 1, label: { en: 'Gluten', fr: 'Gluten' } },
  { key: 'dairy', bit: 2, label: { en: 'Dairy', fr: 'Produits laitiers' } },
  { key: 'egg', bit: 4, label: { en: 'Eggs', fr: 'Œufs' } },
  { key: 'tree_nuts', bit: 8, label: { en: 'Tree nuts', fr: 'Fruits à coque' } },
  { key: 'peanut', bit: 16, label: { en: 'Peanuts', fr: 'Arachides' } },
  { key: 'fish', bit: 32, label: { en: 'Fish', fr: 'Poisson' } },
  { key: 'shellfish', bit: 64, label: { en: 'Shellfish', fr: 'Crustacés / fruits de mer' } },
  { key: 'soy', bit: 128, label: { en: 'Soy', fr: 'Soja' } },
  { key: 'sesame', bit: 256, label: { en: 'Sesame', fr: 'Sésame' } },
  { key: 'pork', bit: 512, label: { en: 'Pork', fr: 'Porc' } },
  { key: 'alcohol', bit: 1024, label: { en: 'Alcohol', fr: 'Alcool' } },
  { key: 'meat', bit: 2048, label: { en: 'Meat', fr: 'Viande' } },
  { key: 'honey', bit: 4096, label: { en: 'Honey', fr: 'Miel' } },
];

export const COURSES: { key: string; label: Labels }[] = [
  { key: 'main', label: { en: 'Main dishes', fr: 'Plats' } },
  { key: 'side', label: { en: 'Sides', fr: 'Accompagnements' } },
  { key: 'soup', label: { en: 'Soups & stews', fr: 'Soupes & ragoûts' } },
  { key: 'salad', label: { en: 'Salads', fr: 'Salades' } },
  { key: 'breakfast', label: { en: 'Breakfast', fr: 'Petit-déjeuner' } },
  { key: 'dessert', label: { en: 'Desserts', fr: 'Desserts' } },
  { key: 'baking', label: { en: 'Breads & baking', fr: 'Pains & pâtisserie' } },
  { key: 'snack', label: { en: 'Snacks & starters', fr: 'Snacks & entrées' } },
  { key: 'sauce', label: { en: 'Sauces & dressings', fr: 'Sauces & vinaigrettes' } },
  { key: 'drink', label: { en: 'Drinks', fr: 'Boissons' } },
  { key: 'other', label: { en: 'Other', fr: 'Autres' } },
];
/** Default course filter for "What can I cook?" */
export const MEAL_COURSES = ['main', 'side', 'soup', 'salad', 'breakfast'];

export const CUISINES: { key: string; label: Labels }[] = [
  { key: 'italian', label: { en: 'Italian', fr: 'Italienne' } },
  { key: 'french', label: { en: 'French', fr: 'Française' } },
  { key: 'spanish', label: { en: 'Spanish & Portuguese', fr: 'Espagnole & portugaise' } },
  { key: 'greek', label: { en: 'Greek', fr: 'Grecque' } },
  { key: 'german', label: { en: 'German & Central European', fr: 'Allemande & Europe centrale' } },
  { key: 'british', label: { en: 'British & Irish', fr: 'Britannique & irlandaise' } },
  { key: 'european', label: { en: 'Other European', fr: 'Autres européennes' } },
  { key: 'mexican', label: { en: 'Mexican & Tex-Mex', fr: 'Mexicaine & tex-mex' } },
  { key: 'latin', label: { en: 'Latin American & Caribbean', fr: 'Latino & caribéenne' } },
  { key: 'american', label: { en: 'American', fr: 'Américaine' } },
  { key: 'chinese', label: { en: 'Chinese', fr: 'Chinoise' } },
  { key: 'japanese', label: { en: 'Japanese', fr: 'Japonaise' } },
  { key: 'korean', label: { en: 'Korean', fr: 'Coréenne' } },
  { key: 'thai', label: { en: 'Thai', fr: 'Thaïe' } },
  { key: 'vietnamese', label: { en: 'Vietnamese', fr: 'Vietnamienne' } },
  { key: 'indian', label: { en: 'Indian', fr: 'Indienne' } },
  { key: 'asian', label: { en: 'Other Asian', fr: 'Autres asiatiques' } },
  { key: 'middle_eastern', label: { en: 'Middle Eastern', fr: 'Moyen-Orient' } },
  { key: 'african', label: { en: 'African & Moroccan', fr: 'Africaine & marocaine' } },
  { key: 'other', label: { en: 'Unspecified', fr: 'Non précisée' } },
];

export const INGREDIENT_CATEGORIES: { key: string; label: Labels }[] = [
  { key: 'produce', label: { en: 'Fruit & vegetables', fr: 'Fruits & légumes' } },
  { key: 'meat', label: { en: 'Meat', fr: 'Viande' } },
  { key: 'fish', label: { en: 'Fish & seafood', fr: 'Poisson & fruits de mer' } },
  { key: 'dairy_eggs', label: { en: 'Dairy & eggs', fr: 'Produits laitiers & œufs' } },
  { key: 'grains_bakery', label: { en: 'Pasta, rice & bread', fr: 'Pâtes, riz & pain' } },
  { key: 'canned_jarred', label: { en: 'Cans, jars & sauces', fr: 'Conserves, bocaux & sauces' } },
  { key: 'spices_herbs', label: { en: 'Herbs & spices', fr: 'Herbes & épices' } },
  { key: 'baking_sweets', label: { en: 'Baking & sweets', fr: 'Pâtisserie & sucré' } },
  { key: 'other', label: { en: 'Other', fr: 'Autres' } },
];

export const CHIPS: Record<string, Labels> = {
  easy: { en: 'Easy', fr: 'Facile' }, kid_friendly: { en: 'Kid friendly', fr: 'Pour enfants' },
  weeknight: { en: 'Weeknight', fr: 'En semaine' }, budget: { en: 'Budget', fr: 'Petit budget' },
  crowd: { en: 'For a crowd', fr: 'Pour un groupe' }, one_pot: { en: 'One pot', fr: 'Plat unique' },
  healthy: { en: 'Healthy', fr: 'Sain' }, spicy: { en: 'Spicy', fr: 'Épicé' },
  comfort: { en: 'Comfort food', fr: 'Réconfortant' }, freezer: { en: 'Freezes well', fr: 'Se congèle' },
  potluck: { en: 'Potluck', fr: 'Auberge espagnole' }, christmas: { en: 'Christmas', fr: 'Noël' },
  summer: { en: 'Summer', fr: 'Été' }, winter: { en: 'Winter', fr: 'Hiver' },
  camping: { en: 'Camping', fr: 'Camping' }, beginner: { en: 'Beginner', fr: 'Débutant' },
};

export const DIFFICULTY: Record<number, Labels> = {
  1: { en: 'Easy', fr: 'Facile' },
  2: { en: 'Medium', fr: 'Moyen' },
  3: { en: 'Challenging', fr: 'Difficile' },
};

/** Never counted as missing (pipeline: HARD_STAPLES; not stored in recipe_ingredients). */
export const HARD_STAPLES = ['water', 'salt', 'black pepper', 'ice', 'cooking spray'];
/** Suggested "basics I always have" on first launch — the user can edit them. */
export const DEFAULT_BASICS = [
  'vegetable oil', 'olive oil', 'sugar', 'flour', 'butter', 'garlic', 'onion', 'egg', 'milk',
];
/** Other common store-cupboard items offered as one-tap additions in the basics editor. */
export const BASIC_SUGGESTIONS = [
  'brown sugar', 'powdered sugar', 'baking powder', 'baking soda', 'vanilla extract', 'cornstarch',
  'yeast', 'rice', 'pasta', 'breadcrumbs', 'margarine', 'parmesan', 'chicken broth', 'tomato paste',
  'soy sauce', 'vinegar', 'lemon juice', 'honey', 'mustard', 'ketchup', 'mayonnaise',
  'worcestershire sauce', 'cinnamon', 'paprika', 'oregano', 'basil', 'thyme', 'cumin', 'nutmeg',
  'garlic powder', 'chili flakes', 'cayenne pepper',
];

/** Time presets for the "how much time do you have?" picker (minutes; null = any). */
export const TIME_PRESETS = [15, 30, 45, 60, 90, null] as const;

// ---------------------------------------------------------------------------
// Images & attribution

export const IMAGE_PREFIX =
  'https://img.sndimg.com/food/image/upload/w_555,h_416,c_fit,fl_progressive,q_95/v1/img/recipes/';

/** Same photo as a 300×300 crop for list thumbnails (~5× less data than the full photo). */
export const THUMB_PREFIX = IMAGE_PREFIX.replace('w_555,h_416,c_fit,fl_progressive,q_95', 'w_300,h_300,c_fill,q_80');

/** recipes.image holds the path after IMAGE_PREFIX, or "!<full url>" for other hosts. */
export function imageUrl(image: string | null | undefined, variant: 'full' | 'thumb' = 'full'): string | null {
  if (!image) return null;
  if (image.startsWith('!')) return image.slice(1);
  return (variant === 'thumb' ? THUMB_PREFIX : IMAGE_PREFIX) + image;
}

/** Link to the original recipe on Food.com (shown on every recipe for attribution). */
export function sourceUrl(slug: string, id: number): string {
  return `https://www.food.com/recipe/${slug}-${id}`;
}
