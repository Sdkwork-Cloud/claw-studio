export type GuidedWizardAssessmentStatus = 'idle' | 'loading' | 'ready' | 'blocked' | 'error';
export type GuidedWizardActionStatus = 'idle' | 'running' | 'success' | 'error';
export type GuidedWizardStepId =
  | 'dependencies'
  | 'install'
  | 'configure'
  | 'initialize'
  | 'success';
export type GuidedWizardStepStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'blocked'
  | 'warning';

export interface GuidedWizardStepDefinition {
  id: GuidedWizardStepId;
  titleKey: string;
  descriptionKey: string;
}

export interface GuidedWizardStep extends GuidedWizardStepDefinition {
  status: GuidedWizardStepStatus;
}

export interface BuildGuidedWizardStepsInput {
  assessmentStatus: GuidedWizardAssessmentStatus;
  dependenciesStatus: GuidedWizardActionStatus;
  installStatus: GuidedWizardActionStatus;
  configurationStatus: GuidedWizardActionStatus;
  initializationStatus: GuidedWizardActionStatus;
}

export const GUIDED_WIZARD_STEPS: GuidedWizardStepDefinition[] = [
  {
    id: 'dependencies',
    titleKey: 'install.page.guided.steps.dependencies.title',
    descriptionKey: 'install.page.guided.steps.dependencies.description',
  },
  {
    id: 'install',
    titleKey: 'install.page.guided.steps.install.title',
    descriptionKey: 'install.page.guided.steps.install.description',
  },
  {
    id: 'configure',
    titleKey: 'install.page.guided.steps.configure.title',
    descriptionKey: 'install.page.guided.steps.configure.description',
  },
  {
    id: 'initialize',
    titleKey: 'install.page.guided.steps.initialize.title',
    descriptionKey: 'install.page.guided.steps.initialize.description',
  },
  {
    id: 'success',
    titleKey: 'install.page.guided.steps.success.title',
    descriptionKey: 'install.page.guided.steps.success.description',
  },
];

export function buildGuidedWizardSteps(
  input: BuildGuidedWizardStepsInput,
): GuidedWizardStep[] {
  const dependenciesStatus: GuidedWizardStepStatus =
    input.assessmentStatus === 'loading' || input.dependenciesStatus === 'running'
      ? 'running'
      : input.assessmentStatus === 'blocked' || input.assessmentStatus === 'error'
        ? 'blocked'
        : input.dependenciesStatus === 'success'
          ? 'completed'
          : input.dependenciesStatus === 'error'
            ? 'warning'
            : 'ready';

  const installStatus: GuidedWizardStepStatus =
    dependenciesStatus === 'blocked'
      ? 'pending'
      : input.installStatus === 'running'
        ? 'running'
        : input.installStatus === 'success'
          ? 'completed'
          : input.installStatus === 'error'
            ? 'warning'
            : dependenciesStatus === 'completed'
              ? 'ready'
              : 'pending';

  const configureStatus: GuidedWizardStepStatus =
    installStatus !== 'completed'
      ? 'pending'
      : input.configurationStatus === 'running'
        ? 'running'
        : input.configurationStatus === 'success'
          ? 'completed'
          : input.configurationStatus === 'error'
            ? 'warning'
            : 'ready';

  const initializeStatus: GuidedWizardStepStatus =
    configureStatus !== 'completed'
      ? 'pending'
      : input.initializationStatus === 'running'
        ? 'running'
        : input.initializationStatus === 'success'
          ? 'completed'
          : input.initializationStatus === 'error'
            ? 'warning'
            : 'ready';

  const successStatus: GuidedWizardStepStatus =
    initializeStatus === 'completed' ? 'ready' : 'pending';

  const statusById: Record<GuidedWizardStepId, GuidedWizardStepStatus> = {
    dependencies: dependenciesStatus,
    install: installStatus,
    configure: configureStatus,
    initialize: initializeStatus,
    success: successStatus,
  };

  return GUIDED_WIZARD_STEPS.map((step) => ({
    ...step,
    status: statusById[step.id],
  }));
}
