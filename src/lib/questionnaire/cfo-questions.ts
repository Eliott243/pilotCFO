export interface QuestionOption {
  emoji: string;
  label: string;
  sublabel: string;
}

export interface CfoQuestion {
  id: number;
  title: string;
  subtitle: string;
  options: QuestionOption[];
}

export const CFO_QUESTIONS: CfoQuestion[] = [
  {
    id: 1,
    title: "Combien tu fais de ventes par mois ?",
    subtitle: "Pas besoin d'être précis — une estimation suffit.",
    options: [
      { emoji: "🌱", label: "Moins de 50 ventes", sublabel: "Je débute ou je tourne au ralenti" },
      { emoji: "📦", label: "Entre 50 et 300 ventes", sublabel: "Mon activité est régulière" },
      { emoji: "🚀", label: "Plus de 300 ventes", sublabel: "Mon volume est important" },
    ],
  },
  {
    id: 2,
    title: "Tu sais combien tu gagnes vraiment après tes dépenses ?",
    subtitle: "Livraison, publicité, frais Shopify... ce qu'il reste dans ta poche.",
    options: [
      { emoji: "✅", label: "Oui, je sais exactement", sublabel: "Je suis mes marges de près" },
      { emoji: "🤔", label: "Vaguement, pas précisément", sublabel: "J'ai une idée mais pas de chiffre exact" },
      { emoji: "❌", label: "Non, aucune idée", sublabel: "Je ne suis pas ça du tout" },
    ],
  },
  {
    id: 3,
    title: "Où tu perds le plus d'argent en ce moment ?",
    subtitle: "Choisis ce qui te semble le plus problématique.",
    options: [
      {
        emoji: "📣",
        label: "La publicité (Meta, Google...)",
        sublabel: "Je dépense mais je ne sais pas si ça rapporte",
      },
      {
        emoji: "🔄",
        label: "Les retours et remboursements",
        sublabel: "Trop de clients qui renvoient leurs commandes",
      },
      {
        emoji: "🛒",
        label: "Les paniers abandonnés",
        sublabel: "Les gens partent sans acheter",
      },
      {
        emoji: "🤷",
        label: "Je ne sais pas",
        sublabel: "C'est justement ce que je veux comprendre",
      },
    ],
  },
  {
    id: 4,
    title: "Tu as combien de stock en ce moment ?",
    subtitle: "La valeur de tes produits en stock, en gros.",
    options: [
      { emoji: "📭", label: "Je fais du dropshipping", sublabel: "Je n'ai pas de stock physique" },
      { emoji: "📫", label: "Moins de 5 000 €", sublabel: "Stock léger" },
      { emoji: "📬", label: "Entre 5 000 € et 30 000 €", sublabel: "Stock moyen" },
      { emoji: "🏭", label: "Plus de 30 000 €", sublabel: "Stock important" },
    ],
  },
  {
    id: 5,
    title: "Comment tu gères ta compta aujourd'hui ?",
    subtitle: "Sois honnête — il n'y a pas de mauvaise réponse.",
    options: [
      { emoji: "📊", label: "J'ai un comptable", sublabel: "Un pro s'occupe de tout" },
      { emoji: "📋", label: "Je me débrouille avec Excel", sublabel: "Je note mais c'est un peu brouillon" },
      { emoji: "😬", label: "Je ne gère pas vraiment", sublabel: "Je regarde juste mon solde de temps en temps" },
    ],
  },
  {
    id: 6,
    title: "C'est quoi ton objectif principal pour les 3 prochains mois ?",
    subtitle: "Une seule réponse — ce qui compte le plus pour toi.",
    options: [
      { emoji: "💰", label: "Augmenter mes ventes", sublabel: "Faire plus de chiffre" },
      { emoji: "📈", label: "Améliorer ma marge", sublabel: "Garder plus d'argent sur chaque vente" },
      { emoji: "😌", label: "Comprendre mes chiffres", sublabel: "Enfin savoir où j'en suis vraiment" },
      { emoji: "⚙️", label: "Automatiser et gagner du temps", sublabel: "Moins de tâches manuelles" },
    ],
  },
];

export const AI_PREFILL_STORAGE_KEY = "pilotcfo_ai_prefill";
export const CFO_DONE_COOKIE = "pilotcfo_cfo_done";
export const CFO_DRAFT_STORAGE_KEY = "pilotcfo_cfo_questionnaire_draft";
