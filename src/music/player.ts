import type { PlayerCommand, Suggestions } from "../../shared/spotify";

export async function sendCommand(command: PlayerCommand): Promise<void> {
  const response = await fetch("/api/spotify/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(await errorText(response));
}

export async function fetchSuggestions(): Promise<Suggestions> {
  const response = await fetch("/api/spotify/suggestions");
  if (!response.ok) throw new Error(await errorText(response));
  return response.json();
}

async function errorText(response: Response): Promise<string> {
  const body: { error?: string } = await response.json().catch(() => ({}));
  return body.error ?? `HTTP ${response.status}`;
}
