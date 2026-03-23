export type RechargePaymentMethod = 'wechat' | 'alipay' | 'bankcard';

export interface PointsRechargeDialogState {
  selectedPreset: number | null;
  customPointsValue: string;
  paymentMethod: RechargePaymentMethod;
}

export function createInitialPointsRechargeDialogState(
  rechargePresets: readonly number[],
): PointsRechargeDialogState {
  return {
    selectedPreset: rechargePresets[1] ?? rechargePresets[0] ?? null,
    customPointsValue: '',
    paymentMethod: 'wechat',
  };
}

export function shouldResetPointsRechargeDialogState(
  wasOpen: boolean,
  isOpen: boolean,
) {
  return !wasOpen && isOpen;
}
