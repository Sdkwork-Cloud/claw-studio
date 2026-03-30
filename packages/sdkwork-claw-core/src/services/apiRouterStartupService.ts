import { warmApiRouterAdminSession } from '@sdkwork/claw-infrastructure';

class DefaultApiRouterStartupService {
  async warmBootstrapSession() {
    return warmApiRouterAdminSession();
  }
}

export const apiRouterStartupService = new DefaultApiRouterStartupService();
