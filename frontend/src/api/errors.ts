// The API reports most errors in English. The UI shows them in Spanish; unknown messages are shown as they come.
const messages: Record<string, string> = {
  "SESSION_SECRET is not configured": "El servidor no está configurado para iniciar sesión (falta SESSION_SECRET).",
  "Organizer login required": "Tu sesión expiró. Inicia sesión de nuevo.",
  "Session not found": "No se encontró la sesión.",
  "Generate teams before requesting insights": "Genera los equipos antes de pedir la explicación.",
  "month must look like YYYY-MM": "El mes debe tener el formato AAAA-MM.",
  "Client visit not found": "No se encontró la visita.",
  "Judge identity could not be verified": "No se pudo verificar la identidad del jurado. Vuelve a identificarte.",
  "Evaluation not found": "No se encontró la evaluación.",
  "Generate teams before opening evaluation": "Genera los equipos antes de abrir la evaluación.",
  "Judge not found in this evaluation": "El jurado no está en esta evaluación.",
  "Generate teams before requesting an evaluation report": "Genera los equipos antes de pedir el reporte de evaluación.",
  "Evaluation is closed": "La evaluación está cerrada.",
  "Name is required": "El nombre es obligatorio.",
  "Judge is not registered for this evaluation": "El jurado no está registrado en esta evaluación.",
  "Team not found": "No se encontró el equipo.",
  "Invalid criterion": "Criterio no válido.",
  "Participant not found": "No se encontró al participante.",
  "Imported rows must include nombre": "Cada fila importada debe tener la columna nombre.",
  "The file has no participants": "El archivo no tiene participantes.",
  "Only random mode is supported": "Solo se admite el modo aleatorio.",
  "Generate teams before assigning use cases": "Genera los equipos antes de asignar los casos.",
  "Invalid session status": "Estado de sesión no válido.",
  "History entry not found": "No se encontró el registro del historial.",
  "Generate teams before editing them": "Genera los equipos antes de editarlos.",
  "Team ids must be unique": "Los equipos no pueden repetirse.",
  "All teams must belong to this session": "Todos los equipos deben pertenecer a esta sesión.",
  "All session teams must be included": "Debes incluir todos los equipos de la sesión.",
  "A participant cannot be assigned to more than one team": "Un participante no puede estar en más de un equipo.",
  "All session participants must be assigned exactly once": "Cada participante debe estar asignado a un equipo, una sola vez.",
  "Use case not found": "No se encontró el caso de uso.",
  "number_of_teams must be greater than 0": "El número de equipos debe ser mayor que 0.",
  "There must be at least one participant per team": "Debe haber al menos un participante por equipo.",
  "There must be at least one use case": "Agrega al menos un caso de uso.",
  "Could not parse cloud AI response into JSON": "La IA devolvió una respuesta que no se pudo leer.",
};

const prefixes: Array<[string, string]> = [
  ["Invalid nivelIA value:", "Nivel de IA no válido:"],
  ["nivelIA must be between 0 and 5:", "El nivel de IA debe estar entre 0 y 5:"],
];

export function translateApiError(detail: unknown): string {
  // FastAPI sends validation errors (422) as a list of objects, which cannot be shown as text.
  if (Array.isArray(detail)) return "Revisa los datos ingresados.";
  if (typeof detail !== "string" || !detail) return "Error inesperado";
  if (messages[detail]) return messages[detail];
  const prefix = prefixes.find(([english]) => detail.startsWith(english));
  if (prefix) return `${prefix[1]}${detail.slice(prefix[0].length)}`;
  return detail;
}
