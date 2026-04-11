import React from 'react';
import {
  InstanceDetailLlmProviderDialogs,
  type InstanceDetailLlmProviderDialogsProps,
} from './InstanceDetailLlmProviderDialogs.tsx';
import {
  InstanceDetailLlmProvidersSection,
  type InstanceDetailLlmProvidersSectionProps,
} from './InstanceDetailLlmProvidersSection.tsx';

interface InstanceDetailManagedLlmProvidersSectionProps {
  sectionProps: InstanceDetailLlmProvidersSectionProps;
  dialogProps: InstanceDetailLlmProviderDialogsProps;
}

export function InstanceDetailManagedLlmProvidersSection({
  sectionProps,
  dialogProps,
}: InstanceDetailManagedLlmProvidersSectionProps) {
  return (
    <>
      <InstanceDetailLlmProvidersSection {...sectionProps} />
      <InstanceDetailLlmProviderDialogs {...dialogProps} />
    </>
  );
}
