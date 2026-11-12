/**
 * French UI strings (Belgian usage: taque, cassonade, sucre impalpable, poudre à lever;
 * septante/nonante if a number is ever spelled out). Same shape as en.ts.
 * French typography: a no-break space ( ) before ? ! : ;
 */
import type { Translations } from './en';

export const fr: Translations = {
  common: {
    appName: 'Pantry Chef',
    next: 'Suivant',
    back: 'Retour',
    skip: 'Passer',
    cancel: 'Annuler',
    retry: 'Réessayer',
    none: 'Aucun',
    settings: 'Paramètres',
    selected: 'Sélectionné',
    preparingTitle: 'Préparation des recettes…',
    preparingBody: 'Installation de la bibliothèque de recettes sur votre téléphone. Cela n’arrive qu’une fois.',
    errorTitle: 'Un problème est survenu',
    errorBody: 'Impossible d’ouvrir la bibliothèque de recettes.',
  },
  tabs: {
    cook: 'Cuisiner',
    browse: 'Parcourir',
    favorites: 'Favoris',
    shopping: 'Courses',
  },
  cook: {
    title: 'Qu’est-ce que je cuisine ?',
    recipesReady: (n: string) => `${n} recettes sur votre téléphone, disponibles hors ligne.`,
    comingSoon:
      'Choisissez les ingrédients que vous avez et voyez ce que vous pouvez préparer — dans la prochaine mise à jour.',
    kitchenTitle: 'Votre cuisine',
    basicsCount: (n: number) => (n < 2 ? `${n} produit de base` : `${n} produits de base`),
    editKitchen: 'Modifier dans les paramètres',
  },
  browse: {
    title: 'Parcourir',
    comingSoon: 'Recherchez des recettes et parcourez-les par plat, cuisine et collection — bientôt disponible.',
  },
  favorites: {
    title: 'Favoris',
    comingSoon: 'Les recettes enregistrées avec ♥ et celles consultées récemment apparaîtront ici.',
  },
  shopping: {
    title: 'Liste de courses',
    comingSoon: 'Les ingrédients manquants des recettes et vos propres articles apparaîtront ici.',
  },
  onboarding: {
    stepOf: (step: number, total: number) => `Étape ${step} sur ${total}`,
    languageTitle: 'Bienvenue dans Pantry Chef',
    languageHint:
      'Dites-nous ce que vous avez, on vous dit ce que vous pouvez cuisiner. D’abord, quelle langue préférez-vous ?',
    appliancesTitle: 'Vos appareils',
    appliancesHint: 'Nous ne proposons que des recettes réalisables avec ce que vous avez.',
    basicsTitle: 'Les produits de base que vous avez toujours',
    basicsHint:
      'Ils comptent comme disponibles dans chaque recherche. Le sel, le poivre et l’eau sont toujours supposés présents.',
    dietTitle: 'Régime et ingrédients à éviter',
    dietHint: 'Facultatif — modifiable à tout moment dans les paramètres.',
    finish: 'C’est parti !',
  },
  settings: {
    title: 'Paramètres',
    language: 'Langue',
    languageSystem: (current: string) => `Langue du système (${current})`,
    languageNames: { en: 'English', fr: 'Français' },
    units: 'Unités',
    unitsMetric: 'Métriques (g, ml, °C)',
    unitsUs: 'Américaines (cups, oz, °F)',
    unitsHint: 'Les cuillères restent des cuillères dans les deux cas.',
    kitchen: 'Ma cuisine',
    appliances: 'Appareils',
    appliancesHint: 'Les recettes qui demandent un appareil que vous n’avez pas sont masquées.',
    basics: 'Produits de base',
    basicsHint:
      'Comptés comme disponibles dans chaque recherche. Le sel, le poivre et l’eau sont toujours supposés présents.',
    basicsCount: (n: number) => (n === 0 ? 'Aucun' : n === 1 ? '1 ingrédient' : `${n} ingrédients`),
    yourBasics: 'Vos produits de base',
    noBasics: 'Aucun produit de base — ajoutez-en ci-dessous.',
    suggestions: 'Suggestions',
    searchIngredient: 'Rechercher un ingrédient…',
    noMatch: 'Aucun ingrédient correspondant.',
    addIngredient: (name: string) => `Ajouter ${name}`,
    removeIngredient: (name: string) => `Retirer ${name}`,
    dietAndAvoid: 'Régime & allergies',
    diet: 'Régime',
    dietHint: 'N’afficher que les recettes qui respectent tous les régimes choisis.',
    avoid: 'À éviter',
    avoidHint: 'Masquer les recettes qui contiennent l’un de ces ingrédients.',
    avoidSummary: (list: string) => `À éviter\u00a0: ${list}`,
    dietDisclaimer:
      'Les régimes et allergènes sont estimés d’après le nom des ingrédients. Vérifiez toujours la recette.',
    data: 'Données des recettes',
    dataRecipes: 'Recettes',
    dataIngredients: 'Ingrédients',
    dataVersion: 'Version des données',
    dataBuilt: 'Générées le',
    about: 'À propos',
    appVersion: 'Version de l’app',
    attribution:
      'Recettes et photos de Food.com, pour un usage personnel. Chaque recette renvoie vers sa page et son auteur.',
    reset: 'Réinitialiser les données',
    resetTitle: 'Réinitialiser les données ?',
    resetBody:
      'Vos paramètres, produits de base, garde-manger, favoris, historique et liste de courses seront effacés. Les recettes restent sur votre téléphone.',
    resetConfirm: 'Réinitialiser',
  },
};
