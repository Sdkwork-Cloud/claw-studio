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
  assert.equal(result.items[0]?.id, 'post-3');
});

await runTest('getById and getComments expose the seeded v3 post detail data', async () => {
  const post = await communityService.getById('post-1');
  const comments = await communityService.getComments('post-1');

  assert.equal(post?.author.name, 'Alex Chen');
  assert.equal(comments.length, 2);
});

await runTest('create uses the v3 createPost behavior and prepends the new post', async () => {
  const created = await communityService.create({
    title: 'Fresh Community Post',
    content: 'A newly created post body.',
    category: 'Discussions',
    tags: ['fresh'],
  });

  assert.equal(created.createdAt, 'Just now');

  const posts = await communityService.getPosts();
  assert.equal(posts[0]?.id, created.id);
});
