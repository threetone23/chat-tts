import { getUserFontStyle, setUserFontStyle } from '$lib/server/db';
import { error, json, text, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  const username = url.searchParams.get('user')?.trim().toLowerCase() ?? '';
  if (!username) {
    error(400, 'Missing user');
  }

  const style = await getUserFontStyle(username);
  if (!style) {
    error(404, 'No font style set');
  }

  return json(style);
};

export const POST: RequestHandler = async ({ url }) => {
  const username = url.searchParams.get('user')?.trim().toLowerCase() ?? '';
  if (!username) {
    console.warn('Font style POST missing user.');
    error(400, 'Missing user');
  }

  let weight: string | null = null;
  let italic: number | null = null;

  const weightParam = url.searchParams.get('weight')?.trim().toLowerCase();
  if (weightParam) {
    if (weightParam !== 'bold' && weightParam !== 'normal') {
      console.warn(`Font style POST invalid weight: ${weightParam}`);
      error(400, 'Invalid weight');
    }
    weight = weightParam;
  }

  const italicParam = url.searchParams.get('italic');
  if (italicParam !== null) {
    const parsed = Number(italicParam);
    if (parsed !== 0 && parsed !== 1) {
      console.warn(`Font style POST invalid italic: ${italicParam}`);
      error(400, 'Invalid italic');
    }
    italic = parsed;
  }

  if (weight === null && italic === null) {
    console.warn('Font style POST missing weight/italic.');
    error(400, 'Missing weight or italic');
  }

  await setUserFontStyle(username, weight, italic);
  return text('OK');
};
