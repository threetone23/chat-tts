export function getFontUrl(username: string): string {
  return `/fonts?user=${encodeURIComponent(username)}`;
}

export async function listFontNames(): Promise<string[]> {
  const response = await fetch('/api/fonts');
  if (response.status !== 200) return [];

  return (await response.json()) as string[];
}

export async function setUserFont(username: string, fontname: string): Promise<boolean> {
  const response = await fetch(
    `/api/font?user=${encodeURIComponent(username)}&fontname=${encodeURIComponent(fontname)}`,
    { method: 'POST' }
  );
  return response.status === 200;
}

export async function clearUserFont(username: string): Promise<boolean> {
  const response = await fetch(`/api/font?user=${encodeURIComponent(username)}&reset=1`, {
    method: 'POST'
  });
  return response.status === 200;
}

export async function getUserFontStyle(
  username: string
): Promise<{ weight: string; italic: number } | null> {
  const response = await fetch(`/api/fontstyle?user=${encodeURIComponent(username)}`);
  if (response.status !== 200) return null;
  return (await response.json()) as { weight: string; italic: number };
}

export async function setUserFontStyle(
  username: string,
  weight: string | null,
  italic: number | null
): Promise<boolean> {
  const params = new URLSearchParams({ user: username });
  if (weight) params.set('weight', weight);
  if (italic !== null) params.set('italic', String(italic));

  const response = await fetch(`/api/fontstyle?${params.toString()}`, { method: 'POST' });
  return response.status === 200;
}
