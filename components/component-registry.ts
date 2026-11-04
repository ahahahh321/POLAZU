export type Registration = {
  id: string;
  name: string;
  source: string;
  filename: string;
  css?: string;
  cssFilename?: string;
};

export const registryStorageKey = "polazu:component-registrations:v1";

export function readRegistrations(): Registration[] {
  const raw = localStorage.getItem(registryStorageKey);
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries)) throw new Error("Invalid component registry");
  return entries.filter((entry): entry is Registration =>
    entry && typeof entry.id === "string" && typeof entry.name === "string" &&
    typeof entry.source === "string" && typeof entry.filename === "string" &&
    (entry.css === undefined || typeof entry.css === "string") &&
    (entry.cssFilename === undefined || typeof entry.cssFilename === "string"));
}
