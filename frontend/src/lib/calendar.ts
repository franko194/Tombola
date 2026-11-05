import type { ClientVisit } from "../types";

// Chilean public holidays. Update this list every year (source: official holiday calendar).
export const chileanHolidays: Record<string, string> = {
  "2026-01-01": "Año Nuevo",
  "2026-04-03": "Viernes Santo",
  "2026-04-04": "Sábado Santo",
  "2026-05-01": "Día del Trabajo",
  "2026-05-21": "Glorias Navales",
  "2026-06-07": "Toma del Morro de Arica",
  "2026-06-21": "Pueblos Indígenas",
  "2026-06-29": "San Pedro y San Pablo",
  "2026-07-16": "Virgen del Carmen",
  "2026-08-15": "Asunción de la Virgen",
  "2026-09-18": "Fiestas Patrias",
  "2026-09-19": "Glorias del Ejército",
  "2026-10-12": "Encuentro de Dos Mundos",
  "2026-10-31": "Iglesias Evangélicas",
  "2026-11-01": "Todos los Santos",
  "2026-12-08": "Inmaculada Concepción",
  "2026-12-25": "Navidad",
  "2027-01-01": "Año Nuevo",
  "2027-03-26": "Viernes Santo",
  "2027-03-27": "Sábado Santo",
  "2027-05-01": "Día del Trabajo",
  "2027-05-21": "Glorias Navales",
  "2027-06-07": "Toma del Morro de Arica",
  "2027-06-21": "Pueblos Indígenas",
  "2027-06-28": "San Pedro y San Pablo",
  "2027-07-16": "Virgen del Carmen",
  "2027-08-15": "Asunción de la Virgen",
  "2027-09-18": "Fiestas Patrias",
  "2027-09-19": "Glorias del Ejército",
  "2027-10-11": "Encuentro de Dos Mundos",
  "2027-10-31": "Iglesias Evangélicas",
  "2027-11-01": "Todos los Santos",
  "2027-12-08": "Inmaculada Concepción",
  "2027-12-25": "Navidad",
};

// Workday 9:00 to 18:00 with a lunch hour from 13:00 to 14:00, so 8 working hours.
const WORKDAY_START = 9 * 60;
const WORKDAY_END = 18 * 60;
const LUNCH_START = 13 * 60;
const LUNCH_END = 14 * 60;
export const WORKDAY_MINUTES = WORKDAY_END - WORKDAY_START - (LUNCH_END - LUNCH_START);

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Percentage of the workday taken by the confirmed events of a day. Overlapping events are not counted twice.
export function occupancyPercent(visits: Pick<ClientVisit, "start_time" | "end_time" | "tentative">[]) {
  const busy = new Set<number>();
  for (const visit of visits) {
    if (visit.tentative) continue;
    const start = Math.max(toMinutes(visit.start_time), WORKDAY_START);
    const end = Math.min(toMinutes(visit.end_time), WORKDAY_END);
    for (let minute = start; minute < end; minute++) {
      if (minute < LUNCH_START || minute >= LUNCH_END) busy.add(minute);
    }
  }
  return Math.round((busy.size / WORKDAY_MINUTES) * 100);
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// First free block of the workday around the confirmed events, used to prefill a new event on a busy day.
// Lunch counts as free so a block can cross it. Returns the whole workday when nothing is free.
export function suggestedSlot(visits: Pick<ClientVisit, "start_time" | "end_time" | "tentative">[]) {
  const busy = new Set<number>();
  for (const visit of visits) {
    if (visit.tentative) continue;
    for (let minute = toMinutes(visit.start_time); minute < toMinutes(visit.end_time); minute++) busy.add(minute);
  }
  const isLunch = (minute: number) => minute >= LUNCH_START && minute < LUNCH_END;
  let start = WORKDAY_START;
  while (start < WORKDAY_END && (busy.has(start) || isLunch(start))) start++;
  if (start >= WORKDAY_END) return { start: formatTime(WORKDAY_START), end: formatTime(WORKDAY_END) };
  let end = start;
  while (end < WORKDAY_END && !busy.has(end)) end++;
  return { start: formatTime(start), end: formatTime(end) };
}
