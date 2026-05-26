import { CFO_QUESTIONS } from "./cfo-questions";

/** answers[i] = index of selected option for question i, or null */
export type QuestionnaireAnswers = (number | null)[];

export function buildAiMessage(answers: QuestionnaireAnswers): string {
  const lines = CFO_QUESTIONS.map((q, i) => {
    const idx = answers[i];
    const label =
      idx != null ? q.options[idx].label : "Non répondu";
    return `- ${questionLabel(q.id)} : ${label}`;
  });

  return `Voici mes réponses au questionnaire CFO :
${lines.join("\n")}
Fais-moi une analyse CFO complète et dis-moi par quoi commencer.`;
}

function questionLabel(id: number): string {
  const map: Record<number, string> = {
    1: "Ventes par mois",
    2: "Je connais mes marges",
    3: "Perte principale",
    4: "Stock actuel",
    5: "Gestion compta",
    6: "Objectif 3 mois",
  };
  return map[id] ?? `Question ${id}`;
}

export function buildPriorityTags(answers: QuestionnaireAnswers): string[] {
  const tags: string[] = [];
  const q2 = answers[1];
  const q3 = answers[2];
  const q5 = answers[4];
  const q6 = answers[5];

  if (q2 === 2) tags.push("📊 Suivi des marges urgent");
  if (q3 === 0) tags.push("📣 Optimiser le ROI pub");
  if (q3 === 2) tags.push("🛒 Réduire abandons panier");
  if (q5 === 2) tags.push("📋 Mettre en place une compta");
  if (q6 === 1) tags.push("📈 Focus rentabilité");
  if (q6 === 2) tags.push("🔍 Analyse financière complète");

  return tags;
}
