import assert from 'node:assert/strict';
import { communityService } from './communityService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('getList returns recruitment entries with structured listing metadata', async () => {
  const result = await communityService.getList({ category: 'recruitment', page: 1, pageSize: 10 });

  assert.ok(result.total >= 1);
  assert.equal(result.items[0]?.category, 'recruitment');
  assert.equal(typeof result.items[0]?.location, 'string');
  assert.equal(typeof result.items[0]?.compensation, 'string');
  assert.equal(result.items[0]?.publisherType, 'company');
});

await runTest('news filtering preserves official platform news entries', async () => {
  const newsEntries = await communityService.getPosts('news');

  assert.ok(newsEntries.length >= 1);
  assert.equal(newsEntries[0]?.category, 'news');
  assert.equal(newsEntries[0]?.publisherType, 'official');
  assert.equal(newsEntries[0]?.author.role, 'Official');
});

await runTest('services include online legal support and broader online-deliverable coverage', async () => {
  const serviceEntries = await communityService.getPosts('services');
  const legalEntries = serviceEntries.filter((post) => post.serviceLine === 'legal');
  const legalEntry = legalEntries[0];

  assert.ok(serviceEntries.length >= 12);
  assert.ok(legalEntry);
  assert.ok(legalEntries.length >= 2);
  assert.equal(legalEntry?.deliveryMode, 'online');
  assert.equal(typeof legalEntry?.turnaround, 'string');
  assert.ok(serviceEntries.some((post) => post.serviceLine === 'development'));
  assert.ok(serviceEntries.some((post) => post.serviceLine === 'translation'));
  assert.ok(serviceEntries.some((post) => post.serviceLine === 'consulting'));
  assert.ok(serviceEntries.some((post) => post.serviceLine === 'content'));
  assert.ok(serviceEntries.some((post) => post.serviceLine === 'data'));
  assert.ok(serviceEntries.some((post) => post.serviceLine === 'hr'));

  const legalSearch = await communityService.getPosts('services', 'legal');
  assert.ok(legalSearch.some((post) => post.serviceLine === 'legal'));

  const trademarkSearch = await communityService.getPosts('services', 'trademark');
  assert.ok(trademarkSearch.some((post) => post.serviceLine === 'legal'));

  const dashboardSearch = await communityService.getPosts('services', 'dashboard');
  assert.ok(dashboardSearch.some((post) => post.serviceLine === 'data'));
});

await runTest('create prepends a new service entry and preserves online-service fields', async () => {
  const created = await communityService.create({
    title: 'Remote legal contract review service',
    content: 'Review SaaS contracts, labor agreements, and privacy policies online.',
    category: 'services',
    publisherType: 'company',
    location: 'Remote',
    compensation: 'From 899 CNY',
    company: 'Claw Legal Desk',
    serviceLine: 'legal',
    deliveryMode: 'online',
    turnaround: '48 hours',
    tags: ['legal', 'contracts', 'online'],
  });

  assert.equal(Number.isNaN(Date.parse(created.createdAt)), false);
  assert.match(created.id, /^p\d+$/);
  assert.equal(created.publisherType, 'company');
  assert.equal(created.location, 'Remote');
  assert.equal(created.compensation, 'From 899 CNY');
  assert.equal(created.serviceLine, 'legal');
  assert.equal(created.deliveryMode, 'online');
  assert.equal(created.turnaround, '48 hours');

  const posts = await communityService.getPosts('services');
  assert.ok(posts.some((post) => post.id === created.id));
});
