import assert from 'node:assert/strict';
import { buildCommunityRecommendations } from './communityRecommendations.ts';
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

await runTest('related services prioritize same service line matches for service listings', async () => {
  const posts = await communityService.getPosts();
  const current = posts.find((post) => post.id === '6');

  assert.ok(current);

  const recommendations = buildCommunityRecommendations(current, posts);

  assert.ok(recommendations.relatedServices.length >= 3);
  assert.equal(recommendations.relatedServices[0]?.post.id, '14');
  assert.ok(recommendations.relatedServices.every((item) => item.post.id !== current.id));
  assert.ok(recommendations.relatedServices.some((item) => item.post.id === '11'));
  assert.ok(recommendations.relatedServices[0]?.reasons.includes('same-service-line'));
  assert.ok(recommendations.relatedServices[0]?.reasons.includes('shared-tag'));
});

await runTest('recruitment entries surface recruitment-adjacent services and company recommendations', async () => {
  const posts = await communityService.getPosts();
  const current = posts.find((post) => post.id === '1');

  assert.ok(current);

  const recommendations = buildCommunityRecommendations(current, posts);

  assert.ok(recommendations.relatedServices.some((item) => item.post.serviceLine === 'hr'));
  assert.ok(recommendations.relatedServices.some((item) => item.post.serviceLine === 'marketing'));
  assert.equal(recommendations.relatedCompanies[0]?.company, 'OpenClaw');
  assert.ok((recommendations.relatedCompanies[0]?.listingCount ?? 0) >= 2);
  assert.ok(recommendations.relatedCompanies[0]?.reasons.includes('same-company'));
  assert.ok(recommendations.relatedCompanies[0]?.reasons.includes('multi-listing'));
});

await runTest('landing-page service tags broaden recommendations toward marketing services', async () => {
  const posts = await communityService.getPosts();
  const current = posts.find((post) => post.id === '9');

  assert.ok(current);

  const recommendations = buildCommunityRecommendations(current, posts);

  assert.equal(current.tags.includes('landing-page'), true);
  assert.ok(recommendations.relatedServices.some((item) => item.post.serviceLine === 'marketing'));
  assert.ok(recommendations.relatedServices.some((item) => item.post.serviceLine === 'operations'));
});

await runTest('news entries omit company recommendations that have no explicit match reasons', async () => {
  const posts = await communityService.getPosts();
  const current = posts.find((post) => post.id === '5');

  assert.ok(current);

  const recommendations = buildCommunityRecommendations(current, posts);

  assert.ok(recommendations.relatedCompanies.length >= 1);
  assert.ok(recommendations.relatedCompanies.every((item) => item.reasons.length > 0));
});
