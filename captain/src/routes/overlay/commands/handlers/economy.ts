import type { ChatMessage } from '@twurple/chat';
import type { OverlayDispatchers } from '../../dispatcher';
import { checkCostAddIfEnough, PEOPLE_WHO_CHECKED_IN } from '../middleware';
import { requireUsername } from './shared';
import { getPointsForUser } from '$lib/api/points';
import type { OverlayCheckInConfig } from '$lib/config';
import { checkinUser } from '../../checkinInterface';
import { GLOBAL_STOCK_MARKET } from '../../stock/market';
import { apiGetMedian } from '$lib/api/stock-market';

export async function transferHandler(dispatcher: OverlayDispatchers, message: ChatMessage) {
  const username = requireUsername(message);
  if (!username) return;

  const args = message.text.split(' ').slice(1);
  if (args.length < 2) {
    dispatcher.sendMessageAsUser(message.channelId!, 'insufficient arguments', message.id);
    return;
  }
  const target = args[0].toLowerCase();
  const amount = Number(args[1]);

  if (target === username) {
    dispatcher.sendMessageAsUser(message.channelId!, 'cant transfer to yourself', message.id);
    return;
  }

  if (Number.isNaN(amount) || amount <= 0) {
    dispatcher.sendMessageAsUser(message.channelId!, 'invalid amount', message.id);
    return;
  }

  if (!(await checkCostAddIfEnough(dispatcher, message.channelId!, username, -amount, message.id)))
    return;
  (await checkCostAddIfEnough(dispatcher, message.channelId!, target, amount, message.id))!;

  dispatcher.sendMessageAsUser(
    message.channelId!,
    `@${username} transferred ${amount} to ${target}`,
    message.id
  );
}

export async function grantHandler(dispatcher: OverlayDispatchers, message: ChatMessage) {
  const username = requireUsername(message);
  if (!username) return;
  if (!(message.userInfo.isBroadcaster || message.userInfo.isMod)) return;

  const args = message.text.split(' ').slice(1);
  if (args.length < 3 || args.length > 4) {
    dispatcher.sendMessageAsUser(message.channelId!, 'invalid amount of arguments, want: <asset> <amount> <target> <reason?>', message.id);
    return;
  }

  const asset = args[0].toUpperCase();
  const amount = Number(args[1]);
  const target = args[2].toLowerCase();
  const reason = args[3] ?? null;

  if (Number.isNaN(amount)) {
    dispatcher.sendMessageAsUser(message.channelId!, `invalid amount "${amount}"`, message.id);
    return;
  }

  if (!(asset === 'POINTS' || GLOBAL_STOCK_MARKET.approvedStocks().includes(asset))) {
    dispatcher.sendMessageAsUser(message.channelId!, `invalid asset "${asset}", want either of: ${['POINTS', ...GLOBAL_STOCK_MARKET.approvedStocks()].join(', ')}`, message.id);
    return;

  }

  if (asset === 'POINTS') {
    (await checkCostAddIfEnough(dispatcher, message.channelId!, target, amount, message.id))!;
  } else {
    (await GLOBAL_STOCK_MARKET.grantPoints(target, asset, amount))!
  }
  dispatcher.sendMessageAsUser(message.channelId!, `granted ${amount} of ${asset} to ${target} for reason: ${reason}`, message.id);
}

export function getPointsHandler(dispatcher: OverlayDispatchers, message: ChatMessage) {
  const username = requireUsername(message);
  if (!username) return;
  const target = message.text.split(' ').at(1)?.toLowerCase() ?? username;

  (async () => {
    const points = (await getPointsForUser(target)) ?? 0;
    dispatcher.sendMessageAsUser(message.channelId!, `${target} has ${points} vanorDollars`);
  })();
}

export function medianHandler(dispatcher: OverlayDispatchers, message: ChatMessage) {
  const username = requireUsername(message);
  if (!username) return;

  if (PEOPLE_WHO_CHECKED_IN.length < 5) {
    dispatcher.sendMessageAsUser(
      message.channelId!,
      `not enough checkins (need ${5 - PEOPLE_WHO_CHECKED_IN.length} more people)`,
      message.id
    );
    return;
  }

  (async () => {
    const { ok, medianPoints } = await apiGetMedian({
      checkedInUsers: [...PEOPLE_WHO_CHECKED_IN]
    });

    if (!ok) {
      dispatcher.sendMessageAsUser(message.channelId!, 'coudl not compute median points');
      return;
    }

    const n = PEOPLE_WHO_CHECKED_IN.length;
    dispatcher.sendMessageAsUser(
      message.channelId!,
      `median: ${Math.round(medianPoints ?? 0)} vanorDollars (n=${n})`,
      message.id
    );
  })();
}

export async function checkInHandler(
  dispatcher: OverlayDispatchers,
  message: ChatMessage,
  sender: WebSocket | undefined = undefined,
  config: OverlayCheckInConfig
) {
  const username = requireUsername(message);
  if (!username) return;

  if (PEOPLE_WHO_CHECKED_IN.includes(username)) {
    dispatcher.sendMessageAsUser(message.channelId!, `you've already checked in RAGEY`, message.id);
    return;
  }

  dispatcher.sendMessageAsUser(
    message.channelId!,
    `vedalWave @${username} here's +${config.points} vanorDollars`,
    message.id
  );
  PEOPLE_WHO_CHECKED_IN.push(username);

  (await checkCostAddIfEnough(
    dispatcher,
    message.channelId!,
    username,
    config.points,
    message.id
  ))!;

  await GLOBAL_STOCK_MARKET.checkin(username);

  if (sender) checkinUser(username, sender);
}
