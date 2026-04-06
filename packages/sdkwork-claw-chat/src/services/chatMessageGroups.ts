export type ChatMessageGroupItem<T> = {
  index: number;
  message: T;
};

export type ChatMessageGroup<T> = {
  role: string;
  senderLabel?: string | null;
  items: ChatMessageGroupItem<T>[];
};

function normalizeSenderLabel(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

export function groupChatMessagesForDisplay<
  T extends { role?: string | null; senderLabel?: string | null },
>(
  messages: T[],
): ChatMessageGroup<T>[] {
  const groups: ChatMessageGroup<T>[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const role = typeof message.role === 'string' && message.role.trim() ? message.role : 'assistant';
    const senderLabel = role === 'user' ? normalizeSenderLabel(message.senderLabel) : null;
    const previousGroup = groups.at(-1);

    if (
      previousGroup &&
      previousGroup.role === role &&
      (role !== 'user' || (previousGroup.senderLabel ?? null) === senderLabel)
    ) {
      previousGroup.items.push({
        index,
        message,
      });
      continue;
    }

    groups.push({
      role,
      ...(role === 'user' ? { senderLabel } : {}),
      items: [
        {
          index,
          message,
        },
      ],
    });
  }

  return groups;
}
