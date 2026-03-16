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

await runTest('getList returns popular posts first', async () => {
  const result = await communityService.getList({ category: 'popular', page: 1, pageSize: 10 });

  assert.equal(result.total, 3);
  assert.equal(result.items[0]?.id, '2');
});

await runTest('getById and getComments expose the seeded V5-compatible post detail data', async () => {
  const post = await communityService.getById('1');
  const comments = await communityService.getComments('1');

  assert.equal(post?.author.name, 'Alex Johnson');
  assert.equal(comments.length, 2);
});

await runTest('create prepends a new post and returns an ISO timestamp', async () => {
  const created = await communityService.create({
    title: 'Fresh Community Post',
    content: 'A newly created post body.',
    category: 'Discussions',
    tags: ['fresh'],
  });

  assert.equal(Number.isNaN(Date.parse(created.createdAt)), false);
  assert.match(created.id, /^p\d+$/);

  const posts = await communityService.getPosts();
  assert.equal(posts[0]?.id, created.id);
});
