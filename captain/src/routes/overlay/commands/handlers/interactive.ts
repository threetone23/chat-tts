import type { OverlayDispatchers, OverlayRaidObserver } from '../../dispatcher';
import type { ChatMessage } from '@twurple/chat';
import { checkCostAddIfEnough, TOGGLE_EXPIRY, TOGGLE_COOLDOWN } from '../middleware';
import { requireUsername } from './shared';
import type {
  OverlayGoodNightKissConfig,
  OverlayKarmaConfig,
  OverlaySetTitleConfig
} from '$lib/config';
import type { RaidOutMessage } from '$lib/bus/messages';
import { goodnightKissStore, karmaStore, raidStore } from '../../stores';
import { ApprovableObserver } from '../../approvable';
import { random } from '$lib/utils';

const GOODNIGHT_KISS_REDEEMERS: string[] = [];

export class GoodnightKissRaidGuard implements OverlayRaidObserver {
  constructor(dispatcher: OverlayDispatchers) {
    dispatcher.addRaidObserver(this);
  }

  onRaidOut(_info: RaidOutMessage) {
    if (!raidStore.raidedOut) {
      raidStore.markRaidedOut();
      console.log('goodnightkiss: raid out detected, timeouts disabled for this session');
    }
  }
}

export async function goodnightkissHandler(
  dispatcher: OverlayDispatchers,
  message: ChatMessage,
  config: OverlayGoodNightKissConfig
) {
  const username = requireUsername(message);
  if (!username) return;

  const args = message.text.split(' ').slice(1);
  if (args[0] === 'clear' && (message.userInfo.isMod || message.userInfo.isBroadcaster)) {
    const { userid, username, isMod } = goodnightKissStore.reset();
    dispatcher.sendMessageAsUser(message.channelId!, 'cleared', message.id);
    if (raidStore.raidedOut) {
      console.log('goodnightkiss clear: raid out this session, skipping timeout');
    } else {
      dispatcher.timeoutUser(
        message.channelId!,
        userid,
        'Good night! EvilTuckk',
        config.timeoutDurationSec,
        username,
        isMod
      );
    }
    return;
  }

  if (goodnightKissStore.isPopulated()) {
    dispatcher.sendMessageAsUser(message.channelId!, 'goodnightkiss already ongoing', message.id);
    return;
  }

  if (GOODNIGHT_KISS_REDEEMERS.includes(username)) {
    dispatcher.sendMessageAsUser(
      message.channelId!,
      'goodnightkiss can only be redeemed once per stream',
      message.id
    );
    return;
  }

  const targetUserId = message.userInfo.userId;

  if (
    message.userInfo.userName === config.user ||
    (await checkCostAddIfEnough(
      dispatcher,
      message.channelId!,
      username,
      -config.cost,
      message.id
    ))
  ) {
    GOODNIGHT_KISS_REDEEMERS.push(username);
    goodnightKissStore.setProperties({
      username: username ?? 'no username?',
      userid: targetUserId,
      color: message.userInfo.color ?? 'lightgrey',
      fast_version: random() < 0.1,
      isMod: message.userInfo.isMod
    });
    karmaStore.updateKarma(config.karma, 'Good Night Kiss');

    if (message.userInfo.userName === config.user) {
      dispatcher.sendMessageAsUser(message.channelId!, 'ok', message.id);
    } else {
      dispatcher.sendMessageAsUser(
        message.channelId!,
        `why did u claim this -${config.cost}`,
        message.id
      );
    }
  }
}

export async function settitleHandler(
  dispatcher: OverlayDispatchers,
  message: ChatMessage,
  config: OverlaySetTitleConfig
) {
  const username = requireUsername(message);
  if (!username) return;

  if (karmaStore.karma < config.karmaRequirement) {
    dispatcher.sendMessageAsUser(
      message.channelId!,
      'chat does not have enough karma for this',
      message.id
    );
    return;
  }

  const title = message.text.split(' ').slice(1).join(' ');
  if (title.trim().length === 0) return;

  if (username === config.user) {
    dispatcher.rawSendMessageAsUser(message.channelId!, `!settitle ${title}`);
    return;
  }

  if (
    !(await checkCostAddIfEnough(
      dispatcher,
      message.channelId!,
      username,
      -config.cost,
      message.id
    ))
  )
    return;

  const approverObserver = new ApprovableObserver(
    dispatcher,
    message,
    [config.user],
    () => {
      dispatcher.rawSendMessageAsUser(message.channelId!, `!settitle ${title}`);
      karmaStore.setKarma(
        config.karmaModifier * karmaStore.karma,
        'Set Title karma'
      );
    },
    () => dispatcher.sendMessageAsUser(message.channelId!, 'unfortunate', message.id)
  );
  dispatcher.addObserver(approverObserver);
}

export async function togglesHandler(
  dispatcher: OverlayDispatchers,
  message: ChatMessage,
  blendShape: 'Hearts' | 'Stars' | 'Undress',
  config: OverlayKarmaConfig
) {
  const karmaValue = karmaStore.karma;
  const requiredKarma = config.togglesKarma.find((toggle) => toggle.name === blendShape)?.karma;
  if (!requiredKarma) return;
  if (karmaValue < requiredKarma) {
    dispatcher.sendMessageAsUser(
      message.channelId!,
      'forsenLaughingAtYou not enough karma',
      message.id
    );
    return;
  }

  let timeoutVal = TOGGLE_EXPIRY.get(blendShape);
  if (timeoutVal) {
    clearTimeout(timeoutVal);
    TOGGLE_EXPIRY.delete(blendShape);
  }

  timeoutVal = setTimeout(() => {
    dispatcher.modelUpdater.hideBlendShape(blendShape);
  }, TOGGLE_COOLDOWN);

  TOGGLE_EXPIRY.set(blendShape, timeoutVal);
  dispatcher.modelUpdater.showBlendShape(blendShape);
  karmaStore.setKarma(karmaValue - requiredKarma, 'Toggles');
}

export async function giveKarmaHandler(dispatcher: OverlayDispatchers, message: ChatMessage) {
  const username = requireUsername(message);
  if (!username) return;

  if (!message.userInfo.isBroadcaster && !message.userInfo.isMod) return;
  const args = message.text.split(' ').slice(1);
  const asNumber = Number.parseFloat(args[0]);
  if (Number.isNaN(asNumber)) return;

  karmaStore.updateKarma(asNumber, 'admin abuse');
  dispatcher.sendMessageAsUser(message.channelId!, 'ok', message.id);
}
