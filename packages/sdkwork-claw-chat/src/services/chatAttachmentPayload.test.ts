import assert from 'node:assert/strict';
import { mapChatSession, mapStudioConversation } from '../chatSessionMapping.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('chat attachment payloads round-trip through the studio conversation mapping layer', () => {
  const session = {
    id: 'session-1',
    title: 'Attachment conversation',
    createdAt: 1,
    updatedAt: 2,
    model: 'Gemini 3 Flash',
    instanceId: 'local-built-in',
    messages: [
      {
        id: 'message-1',
        role: 'user',
        content: '',
        timestamp: 2,
        attachments: [
          {
            id: 'asset-1',
            kind: 'image',
            name: 'diagram.png',
            mimeType: 'image/png',
            sizeBytes: 123,
            url: 'https://cdn.example.com/diagram.png',
            previewUrl: 'https://cdn.example.com/diagram.png',
            objectKey: 'chat/2026/03/22/diagram.png',
          },
        ],
      },
    ],
    transport: 'local',
  } as any;

  const record = mapChatSession(session);
  const attachment = record.messages[0]?.attachments?.[0];

  assert.ok(attachment);
  assert.equal(attachment.id, 'asset-1');
  assert.equal(attachment.kind, 'image');
  assert.equal(attachment.name, 'diagram.png');
  assert.equal(attachment.url, 'https://cdn.example.com/diagram.png');

  const roundTrip = mapStudioConversation(record);
  const roundTripAttachment = roundTrip.messages[0]?.attachments?.[0];

  assert.ok(roundTripAttachment);
  assert.equal(roundTripAttachment.id, 'asset-1');
  assert.equal(roundTripAttachment.kind, 'image');
  assert.equal(roundTripAttachment.url, 'https://cdn.example.com/diagram.png');
});
