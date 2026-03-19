import { APP_ENV, type AppDistributionId } from '@sdkwork/claw-infrastructure';

export type MobileAppGuideChannelId = 'android' | 'ios' | 'harmony';
export type MobileAppGuideChannelStatus = 'available' | 'preview';

export interface MobileAppGuideChannel {
  id: MobileAppGuideChannelId;
  href: string;
  copyHref: string;
  status: MobileAppGuideChannelStatus;
}

export interface MobileAppGuide {
  distributionId: AppDistributionId;
  docsHomeHref: string;
  recommendedChannelId: MobileAppGuideChannelId;
  channels: MobileAppGuideChannel[];
}

const mobileChannelLinks: Record<MobileAppGuideChannelId, string> = {
  android: 'https://clawstudio.sdkwork.com/platforms/android',
  ios: 'https://clawstudio.sdkwork.com/platforms/ios',
  harmony: 'https://clawstudio.sdkwork.com/platforms/harmony',
};

function createGuideChannel(
  id: MobileAppGuideChannelId,
  status: MobileAppGuideChannelStatus = 'available',
): MobileAppGuideChannel {
  return {
    id,
    href: mobileChannelLinks[id],
    copyHref: mobileChannelLinks[id],
    status,
  };
}

export function createMobileAppGuide(
  distributionId: AppDistributionId = APP_ENV.distribution.id,
): MobileAppGuide {
  const docsHomeHref = mobileChannelLinks.android;

  return {
    distributionId,
    docsHomeHref,
    recommendedChannelId: 'android',
    channels: [
      createGuideChannel('android'),
      createGuideChannel('ios'),
      createGuideChannel('harmony'),
    ],
  };
}

export const mobileAppGuideService = {
  getGuide(distributionId: AppDistributionId = APP_ENV.distribution.id): MobileAppGuide {
    return createMobileAppGuide(distributionId);
  },
};
