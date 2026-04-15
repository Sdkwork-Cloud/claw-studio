import type { StudioInstanceDeploymentMode, StudioRuntimeKind } from '@sdkwork/claw-types';

interface StudioCreateInstanceKernelPolicyInput {
  runtimeKind: StudioRuntimeKind;
  deploymentMode: StudioInstanceDeploymentMode;
}

const HERMES_UNSUPPORTED_LOCAL_MANAGED_MESSAGE =
  'Hermes instances must use local-external or remote deployment. local-managed Hermes is not supported because Hermes remains externally managed and Windows support is limited to WSL2 or remote Linux.';

function normalizeRuntimeKind(runtimeKind: StudioRuntimeKind) {
  return String(runtimeKind ?? '').trim().toLowerCase();
}

export function getStudioCreateInstanceKernelPolicyError(
  input: StudioCreateInstanceKernelPolicyInput,
): string | null {
  if (
    normalizeRuntimeKind(input.runtimeKind) === 'hermes'
    && input.deploymentMode === 'local-managed'
  ) {
    return HERMES_UNSUPPORTED_LOCAL_MANAGED_MESSAGE;
  }

  return null;
}

export function assertValidStudioCreateInstanceKernelPolicy(
  input: StudioCreateInstanceKernelPolicyInput,
) {
  const policyError = getStudioCreateInstanceKernelPolicyError(input);
  if (policyError) {
    throw new Error(policyError);
  }
}
