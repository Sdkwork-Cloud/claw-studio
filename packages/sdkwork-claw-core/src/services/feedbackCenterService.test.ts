import assert from 'node:assert/strict';
import { createClient } from '@sdkwork/app-sdk';
import { createFeedbackCenterService } from './feedbackCenterService.ts';

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

await runTest(
  'feedbackCenterService maps generated app sdk feedback payloads into settings-friendly domain objects',
  async () => {
    const service = createFeedbackCenterService({
      getClient: () =>
        ({
          feedback: {
            listFeedback: async (params?: Record<string, unknown>) => {
              assert.equal(params?.status, 'PENDING');
              assert.equal(params?.page, 2);
              assert.equal(params?.size, 5);

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: '1001',
                      type: 'BUG_REPORT',
                      content: 'Dashboard order list is empty.',
                      status: 'PENDING',
                      submitTime: '2026-03-25T09:00:00Z',
                    },
                  ],
                  totalElements: 6,
                  number: 1,
                  size: 5,
                  last: false,
                },
              };
            },
            submit: async (body: Record<string, unknown>) => {
              assert.equal(body.type, 'BUG_REPORT');
              assert.equal(body.content, 'Dashboard order list is empty.');
              assert.equal(body.contact, 'ops@sdkwork.test');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  status: 'PENDING',
                  submitTime: '2026-03-25T09:00:00Z',
                },
              };
            },
            getFeedbackDetail: async (feedbackId: string | number) => {
              assert.equal(feedbackId, '1001');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  contact: 'ops@sdkwork.test',
                  status: 'PROCESSING',
                  submitTime: '2026-03-25T09:00:00Z',
                  processTime: '2026-03-25T10:00:00Z',
                  followUps: [
                    {
                      id: 'fu-1',
                      feedbackId: '1001',
                      content: 'More logs were uploaded.',
                      follower: 'user',
                      followUpTime: '2026-03-25T10:30:00Z',
                    },
                  ],
                },
              };
            },
            followUp: async (feedbackId: string | number, body: Record<string, unknown>) => {
              assert.equal(feedbackId, '1001');
              assert.equal(body.feedbackId, '1001');
              assert.equal(body.content, 'Attached extra screenshots.');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  contact: 'ops@sdkwork.test',
                  status: 'PROCESSING',
                  submitTime: '2026-03-25T09:00:00Z',
                  followUps: [
                    {
                      id: 'fu-2',
                      feedbackId: '1001',
                      content: 'Attached extra screenshots.',
                      follower: 'user',
                      followUpTime: '2026-03-25T11:00:00Z',
                    },
                  ],
                },
              };
            },
            close: async (feedbackId: string | number, params?: Record<string, unknown>) => {
              assert.equal(feedbackId, '1001');
              assert.equal(params?.reason, 'resolved locally');

              return {
                code: '2000',
                data: {
                  id: '1001',
                  type: 'BUG_REPORT',
                  content: 'Dashboard order list is empty.',
                  status: 'CLOSED',
                  submitTime: '2026-03-25T09:00:00Z',
                },
              };
            },
            listFaqCategories: async () => ({
              code: '2000',
              data: [
                {
                  id: 'cat-1',
                  name: 'Account',
                  faqCount: 3,
                },
              ],
            }),
            listFaqs: async (params?: Record<string, unknown>) => {
              assert.equal(params?.categoryId, 'cat-1');
              assert.equal(params?.page, 1);
              assert.equal(params?.size, 10);

              return {
                code: '2000',
                data: {
                  content: [
                    {
                      id: 'faq-1',
                      question: 'How do I reset my password?',
                      categoryId: 'cat-1',
                      categoryName: 'Account',
                      helpfulCount: 12,
                    },
                  ],
                  totalElements: 1,
                  number: 0,
                  size: 10,
                  last: true,
                },
              };
            },
            searchFaqs: async (params?: Record<string, unknown>) => {
              assert.equal(params?.keyword, 'password');

              return {
                code: '2000',
                data: [
                  {
                    id: 'faq-1',
                    question: 'How do I reset my password?',
                    categoryId: 'cat-1',
                    categoryName: 'Account',
                    helpfulCount: 12,
                  },
                ],
              };
            },
            getFaqDetail: async (faqId: string | number) => {
              assert.equal(faqId, 'faq-1');

              return {
                code: '2000',
                data: {
                  id: 'faq-1',
                  question: 'How do I reset my password?',
                  answer: 'Open account settings and choose Change Password.',
                  categoryId: 'cat-1',
                  categoryName: 'Account',
                  helpfulCount: 12,
                },
              };
            },
            getSupportInfo: async () => ({
              code: '2000',
              data: {
                hotline: '400-123-4567',
                email: 'support@sdkwork.test',
                workingHours: 'Mon-Fri 09:00-18:00',
                onlineSupportUrl: 'https://support.sdkwork.test',
              },
            }),
          },
        }) as any,
    });

    const feedbackPage = await service.listFeedback({
      status: 'PENDING',
      page: 2,
      pageSize: 5,
    });
    const createdFeedback = await service.submitFeedback({
      type: 'BUG_REPORT',
      content: 'Dashboard order list is empty.',
      contact: 'ops@sdkwork.test',
    });
    const feedbackDetail = await service.getFeedback('1001');
    const followedFeedback = await service.followUpFeedback(
      '1001',
      'Attached extra screenshots.',
    );
    const closedFeedback = await service.closeFeedback('1001', 'resolved locally');
    const faqCategories = await service.listFaqCategories();
    const faqPage = await service.listFaqs({
      categoryId: 'cat-1',
      page: 1,
      pageSize: 10,
    });
    const faqSearchResults = await service.searchFaqs('password');
    const faqDetail = await service.getFaq('faq-1');
    const supportInfo = await service.getSupportInfo();

    assert.equal(feedbackPage.total, 6);
    assert.equal(feedbackPage.page, 2);
    assert.equal(feedbackPage.pageSize, 5);
    assert.equal(feedbackPage.hasMore, true);
    assert.equal(feedbackPage.items[0]?.type, 'BUG_REPORT');
    assert.equal(createdFeedback.id, '1001');
    assert.equal(feedbackDetail.followUps[0]?.content, 'More logs were uploaded.');
    assert.equal(followedFeedback.followUps[0]?.content, 'Attached extra screenshots.');
    assert.equal(closedFeedback.status, 'CLOSED');
    assert.equal(faqCategories[0]?.name, 'Account');
    assert.equal(faqPage.items[0]?.question, 'How do I reset my password?');
    assert.equal(faqSearchResults[0]?.id, 'faq-1');
    assert.equal(faqDetail.answer, 'Open account settings and choose Change Password.');
    assert.equal(supportInfo.email, 'support@sdkwork.test');
  },
);

await runTest(
  'feedbackCenterService issues generated app sdk HTTP requests for feedback center resources',
  async () => {
    const originalFetch = globalThis.fetch;
    const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ input, init });

      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const url = new URL(rawUrl);

      if (url.pathname === '/app/v3/api/feedback' && init?.method === 'POST') {
        return new Response(JSON.stringify({ code: '2000', data: { id: '1001' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/1001' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify({ code: '2000', data: { id: '1001', followUps: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/1001/followup') {
        return new Response(JSON.stringify({ code: '2000', data: { id: '1001', followUps: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/1001/close') {
        return new Response(JSON.stringify({ code: '2000', data: { id: '1001', status: 'CLOSED' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/faq/categories') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/faq/search') {
        return new Response(JSON.stringify({ code: '2000', data: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/faq/faq-1') {
        return new Response(JSON.stringify({ code: '2000', data: { id: 'faq-1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/app/v3/api/feedback/support') {
        return new Response(JSON.stringify({ code: '2000', data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          code: '2000',
          data: {
            content: [],
            totalElements: 0,
            number: 0,
            size: 10,
            last: true,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const service = createFeedbackCenterService({
        getClient: () =>
          createClient({
            baseUrl: 'https://api.sdkwork.test',
            accessToken: 'access-token',
          }) as any,
      });

      await service.listFeedback({ status: 'PENDING', page: 2, pageSize: 5 });
      await service.submitFeedback({
        type: 'BUG_REPORT',
        content: 'Dashboard order list is empty.',
      });
      await service.getFeedback('1001');
      await service.followUpFeedback('1001', 'Attached extra screenshots.');
      await service.closeFeedback('1001', 'resolved locally');
      await service.listFaqCategories();
      await service.listFaqs({ categoryId: 'cat-1', page: 1, pageSize: 10 });
      await service.searchFaqs('password');
      await service.getFaq('faq-1');
      await service.getSupportInfo();
    } finally {
      globalThis.fetch = originalFetch;
    }

    assert.equal(fetchCalls.length, 10);

    const urls = fetchCalls.map(({ input }) => {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      return new URL(rawUrl);
    });

    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/feedback' &&
          url.searchParams.get('status') === 'PENDING' &&
          url.searchParams.get('page') === '2' &&
          url.searchParams.get('size') === '5',
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/feedback' && url.search === ''));
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/feedback/1001'));
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/feedback/1001/followup'));
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/feedback/1001/close' &&
          url.searchParams.get('reason') === 'resolved locally',
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/feedback/faq/categories'));
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/feedback/faq' &&
          url.searchParams.get('categoryId') === 'cat-1' &&
          url.searchParams.get('page') === '1' &&
          url.searchParams.get('size') === '10',
      ),
    );
    assert.ok(
      urls.some(
        (url) =>
          url.pathname === '/app/v3/api/feedback/faq/search' &&
          url.searchParams.get('keyword') === 'password',
      ),
    );
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/feedback/faq/faq-1'));
    assert.ok(urls.some((url) => url.pathname === '/app/v3/api/feedback/support'));
  },
);
