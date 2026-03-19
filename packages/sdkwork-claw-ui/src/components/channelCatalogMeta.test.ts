import assert from 'node:assert/strict';
import { getChannelOfficialLink } from './channelCatalogMeta.ts';

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
  assert.deepEqual(getChannelOfficialLink('feishu'), {
    href: 'https://open.feishu.cn/app?lang=zh-CN',
    label: 'Feishu Open Platform',
  });
  assert.deepEqual(getChannelOfficialLink('qq'), {
    href: 'https://q.qq.com/qqbot/#/home',
    label: 'QQ Bot Platform',
  });
  assert.deepEqual(getChannelOfficialLink('dingtalk'), {
    href: 'https://open-dev.dingtalk.com/',
    label: 'DingTalk Developer Console',
  });
  assert.deepEqual(getChannelOfficialLink('wecom'), {
    href: 'https://work.weixin.qq.com/wework_admin/loginpage_wx?redirect_uri=https%3A%2F%2Fwork.weixin.qq.com%2Fwework_admin%2Fframe',
    label: 'WeCom Admin Console',
  });
});

runTest('getChannelOfficialLink returns null for channels without a dedicated destination', () => {
  assert.equal(getChannelOfficialLink('webhook'), null);
});
