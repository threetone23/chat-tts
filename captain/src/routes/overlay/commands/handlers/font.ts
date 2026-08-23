import type { ChatMessage } from '@twurple/chat';
import type { OverlayDispatchers } from '../../dispatcher';
import type { Commands } from '..';
import { requireUsername, withCostOrFreeUser } from './shared';
import { clearUserFont, listFontNames, setUserFont, setUserFontStyle } from '$lib/api/font';
import type { OverlayFontConfig, OverlayFontStyleConfig } from '$lib/config';

export async function fontCommandHandler(
  commands: Commands,
  dispatcher: OverlayDispatchers,
  message: ChatMessage,
  config: OverlayFontConfig
) {
  const username = requireUsername(message);
  if (!username) return;

  const fontname = message.text.split(' ').slice(1).join(' ').trim().toLowerCase();
  if (!fontname) return;

  if (fontname === 'default' || fontname === 'reset') {
    await withCostOrFreeUser(dispatcher, message, config.user, config.cost, async () => {
      await clearUserFont(username);
      commands.busWs?.send(JSON.stringify({ type: 'font-changed', username }));
    });
    return;
  }

  const fontnames = await listFontNames();
  if (!fontnames.includes(fontname)) {
    dispatcher.sendMessageAsUser(
      message.channelId!,
      `unknown font ${fontname}, see /font list in discord`,
      message.id
    );
    return;
  }

  await withCostOrFreeUser(dispatcher, message, config.user, config.cost, async () => {
    await setUserFont(username, fontname);
    commands.busWs?.send(JSON.stringify({ type: 'font-changed', username }));
  });
}

export async function fontStyleCommandHandler(
  commands: Commands,
  dispatcher: OverlayDispatchers,
  message: ChatMessage,
  config: OverlayFontStyleConfig,
  kind: 'weight' | 'italic'
) {
  const username = requireUsername(message);
  if (!username) return;

  const arg = (message.text.split(' ')[1] ?? '').trim().toLowerCase();
  if (!arg) return;

  let weight: string | null = null;
  let italic: number | null = null;

  if (kind === 'weight') {
    if (arg !== 'bold' && arg !== 'normal') {
      dispatcher.sendMessageAsUser(message.channelId!, 'usage: %fontweight <bold|normal>', message.id);
      return;
    }
    weight = arg;
  } else if (arg === 'on' || arg === 'off') {
    italic = arg === 'on' ? 1 : 0;
  } else {
    dispatcher.sendMessageAsUser(message.channelId!, 'usage: %fontitalic <on|off>', message.id);
    return;
  }

  await withCostOrFreeUser(dispatcher, message, config.user, config.cost, async () => {
    await setUserFontStyle(username, weight, italic);
    commands.busWs?.send(JSON.stringify({ type: 'font-changed', username }));
  });
}
