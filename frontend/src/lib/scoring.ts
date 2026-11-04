export const scoreLabels: Record<number, string> = {
  1: "Muy mal",
  2: "Insuficiente",
  3: "Aceptable",
  4: "Bueno",
  5: "Muy bueno",
};

// Criteria are stored with English names. They are translated only when shown; other names appear as saved.
const criterionNames: Record<string, string> = {
  "presentation & communication": "Presentación y comunicación",
  "usability & desing": "Usabilidad y diseño",
  "usability & design": "Usabilidad y diseño",
  innovation: "Innovación",
  "impact and relevance": "Impacto y relevancia",
  "technical quiality": "Calidad técnica",
  "technical quality": "Calidad técnica",
};

export function criterionLabel(name: string) {
  return criterionNames[name.trim().toLowerCase()] ?? name;
}
