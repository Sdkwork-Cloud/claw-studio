import assert from 'node:assert/strict';
import {
  getChannelCatalogRegion,
  getChannelOfficialLink,
  getSupplementalChannelCatalogEntries,
  isManagedChannelCatalogEntry,
  isChannelDownloadAppAction,
  partitionChannelCatalogItemsByRegion,
  resolveDefaultChannelCatalogRegion,
  sortChannelCatalogItems,
} from './channelCatalogMeta.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('getChannelOfficialLink maps supported channels to their official setup destinations', () => {
  assert.deepEqual(getChannelOfficialLink('telegram'), {
    href: 'https://core.telegram.org/bots',
    label: 'Telegram Bot Platform',
  });
  assert.deepEqual(getChannelOfficialLink('whatsapp'), {
    href: 'https://web.whatsapp.com/',
    label: 'WhatsApp Web',
  });
  assert.deepEqual(getChannelOfficialLink('signal'), {
    href: 'https://signal.org/download/',
    label: 'Signal Download',
  });
  assert.deepEqual(getChannelOfficialLink('line'), {
    href: 'https://developers.line.biz/en/docs/messaging-api/',
    label: 'LINE Messaging API Docs',
  });
});

runTest('getChannelOfficialLink returns null for channels without a dedicated destination', () => {
  assert.equal(getChannelOfficialLink('webhook'), null);
});

runTest('isChannelDownloadAppAction keeps unrelated chat channels as setup links, not app downloads', () => {
  assert.equal(isChannelDownloadAppAction('sdkworkchat'), false);
  assert.equal(isChannelDownloadAppAction('whatsapp'), false);
  assert.equal(isChannelDownloadAppAction('discord'), false);
});

runTest('getChannelCatalogRegion separates restored domestic channel entries from bundled global channels', () => {
  assert.equal(getChannelCatalogRegion('wechat'), 'domestic');
  assert.equal(getChannelCatalogRegion('feishu'), 'domestic');
  assert.equal(getChannelCatalogRegion('dingtalk'), 'domestic');
  assert.equal(getChannelCatalogRegion('wecom'), 'domestic');
  assert.equal(getChannelCatalogRegion('qq'), 'domestic');
  assert.equal(getChannelCatalogRegion('telegram'), 'global');
  assert.equal(getChannelCatalogRegion('slack'), 'global');
  assert.equal(getChannelCatalogRegion('unknown-channel'), 'global');
});

runTest('getSupplementalChannelCatalogEntries exposes domestic reference channels in stable product order', () => {
  const entries = getSupplementalChannelCatalogEntries();

  assert.deepEqual(
    entries.map((entry) => entry.id),
    ['wechat', 'feishu', 'dingtalk', 'wecom', 'qq'],
  );
  assert.ok(entries.every((entry) => entry.region === 'domestic'));
  assert.ok(entries.every((entry) => entry.managementMode === 'reference'));
  assert.ok(entries.every((entry) => entry.officialLink));
});

runTest('partitionChannelCatalogItemsByRegion groups channels and defaults to the domestic tab when both groups exist', () => {
  const grouped = partitionChannelCatalogItemsByRegion([
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Telegram workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wechat',
      name: 'WeChat',
      description: 'WeChat workspace',
      status: 'disconnected',
      enabled: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Slack workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'qq',
      name: 'QQ',
      description: 'QQ workspace',
      status: 'disconnected',
      enabled: false,
    },
  ]);

  assert.deepEqual(
    grouped.domestic.map((entry) => entry.id),
    ['wechat', 'qq'],
  );
  assert.deepEqual(
    grouped.global.map((entry) => entry.id),
    ['telegram', 'slack'],
  );
  assert.equal(resolveDefaultChannelCatalogRegion(grouped), 'domestic');
  assert.equal(
    resolveDefaultChannelCatalogRegion({
      domestic: [],
      global: grouped.global,
    }),
    'global',
  );
});

runTest('isManagedChannelCatalogEntry keeps restored domestic channels as reference-only entries', () => {
  assert.equal(isManagedChannelCatalogEntry('telegram'), true);
  assert.equal(isManagedChannelCatalogEntry('slack'), true);
  assert.equal(isManagedChannelCatalogEntry('wechat'), false);
  assert.equal(isManagedChannelCatalogEntry('feishu'), false);
});

runTest('sortChannelCatalogItems follows the bundled OpenClaw chat channel order for managed channel surfaces', () => {
  const sorted = sortChannelCatalogItems([
    {
      id: 'line',
      name: 'LINE',
      description: 'LINE workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Telegram workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'WhatsApp workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Slack workspace',
      status: 'connected',
      enabled: true,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['telegram', 'whatsapp', 'slack', 'line'],
  );
});

runTest('sortChannelCatalogItems keeps upstream order ahead of status sorting for managed OpenClaw channels', () => {
  const sorted = sortChannelCatalogItems([
    {
      id: 'signal',
      name: 'Signal',
      description: 'Signal workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'irc',
      name: 'IRC',
      description: 'IRC workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'googlechat',
      name: 'Google Chat',
      description: 'Google Chat workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'imessage',
      name: 'iMessage',
      description: 'iMessage workspace',
      status: 'connected',
      enabled: true,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['irc', 'googlechat', 'signal', 'imessage'],
  );
});
