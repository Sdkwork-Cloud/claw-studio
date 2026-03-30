import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const localesDir = join(import.meta.dirname, 'locales');
const zh = JSON.parse(readFileSync(join(localesDir, 'zh.json'), 'utf8'));

await runTest('zh points locale keeps recharge payment copy readable', () => {
  assert.equal(zh.points.page.title, '管理积分、充值与使用情况');
  assert.equal(zh.points.paymentMethods.wechat, '微信支付');
  assert.equal(zh.points.rechargeDialog.paymentSessionTitle, '支付会话');
  assert.equal(
    zh.points.rechargeDialog.paymentSummaryDescription,
    '后端已创建充值订单，请先完成支付，再回来确认。',
  );
  assert.equal(zh.points.actions.processing, '处理中...');
});
