export function selectInstallAssessmentPriorityIds(input: {
  installChoiceIds: string[];
  recommendedMethodId: string | null;
  detectedInstallChoiceId: string | null;
}) {
  const priorityIds: string[] = [];
  const seen = new Set<string>();

  const append = (value: string | null | undefined) => {
    if (!value || seen.has(value) || !input.installChoiceIds.includes(value)) {
      return;
    }

    seen.add(value);
    priorityIds.push(value);
  };

  append(input.recommendedMethodId);
  append(input.detectedInstallChoiceId);
  append(input.installChoiceIds[0] ?? null);

  return priorityIds;
}

export function createInitialInstallAssessmentState<TState>(input: {
  installChoiceIds: string[];
  priorityChoiceIds: string[];
  createIdleState: () => TState;
  createLoadingState: () => TState;
}) {
  return input.installChoiceIds.reduce<Record<string, TState>>((accumulator, choiceId) => {
    accumulator[choiceId] = input.priorityChoiceIds.includes(choiceId)
      ? input.createLoadingState()
      : input.createIdleState();
    return accumulator;
  }, {});
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) {
    return [] as R[];
  }

  const nextConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  await Promise.all(
    Array.from({ length: nextConcurrency }, async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex] as T, currentIndex);
      }
    }),
  );

  return results;
}

function entriesToPatch<TState>(entries: ReadonlyArray<readonly [string, TState]>) {
  return entries.reduce<Record<string, TState>>((accumulator, [id, state]) => {
    accumulator[id] = state;
    return accumulator;
  }, {});
}

export async function* hydrateInstallAssessmentBatches<
  TChoice extends { id: string },
  TState,
>(input: {
  priorityChoices: readonly TChoice[];
  deferredChoices: readonly TChoice[];
  inspectChoice: (choice: TChoice) => Promise<readonly [string, TState]>;
  createDeferredLoadingState: (choice: TChoice) => TState;
  waitBeforeDeferredHydration?: () => Promise<void>;
  deferredResultBatchSize?: number;
  priorityConcurrency?: number;
  deferredConcurrency?: number;
  isCancelled?: () => boolean;
}) {
  const {
    priorityChoices,
    deferredChoices,
    inspectChoice,
    createDeferredLoadingState,
    waitBeforeDeferredHydration,
    deferredResultBatchSize = 3,
    priorityConcurrency = 1,
    deferredConcurrency = 1,
    isCancelled,
  } = input;

  if (priorityChoices.length > 0) {
    const priorityResults = await mapWithConcurrency(
      priorityChoices,
      priorityConcurrency,
      inspectChoice,
    );

    if (isCancelled?.()) {
      return;
    }

    yield entriesToPatch(priorityResults);
  }

  if (deferredChoices.length === 0) {
    return;
  }

  await waitBeforeDeferredHydration?.();

  if (isCancelled?.()) {
    return;
  }

  yield entriesToPatch(
    deferredChoices.map((choice) => [choice.id, createDeferredLoadingState(choice)] as const),
  );

  const nextBatchSize = Math.max(1, deferredResultBatchSize);
  const resultEntries = await mapWithConcurrency(
    deferredChoices,
    deferredConcurrency,
    inspectChoice,
  );

  if (isCancelled?.()) {
    return;
  }

  for (let index = 0; index < resultEntries.length; index += nextBatchSize) {
    if (isCancelled?.()) {
      return;
    }

    yield entriesToPatch(resultEntries.slice(index, index + nextBatchSize));
  }
}
