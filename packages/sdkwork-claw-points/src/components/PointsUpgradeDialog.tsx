import { useEffect, useMemo, useState } from 'react';
import {
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { openExternalUrl } from '@sdkwork/claw-infrastructure';
import { OverlaySurface } from '@sdkwork/claw-ui';
import { pointsQueryKeys, pointsService, type PointsPaymentRecord } from '../services';
import { formatPoints } from './pointsCopy';
import { PointsUpgradeCatalogView } from './PointsUpgradeCatalogView';
import { PointsUpgradePaymentView } from './PointsUpgradePaymentView';

interface PointsUpgradeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type UpgradePaymentMethod = 'wechat' | 'alipay';

function resolveDefaultSelectedPackId(
  plans: Array<{ packId: number; recommended: boolean }>,
): number | null {
  return plans.find((plan) => plan.recommended)?.packId ?? plans[0]?.packId ?? null;
}

export function PointsUpgradeDialog({
  isOpen,
  onClose,
}: PointsUpgradeDialogProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<UpgradePaymentMethod>('wechat');
  const [checkoutSession, setCheckoutSession] = useState<
    Awaited<ReturnType<typeof pointsService.upgradePlan>> | null
  >(null);
  const [paymentRecords, setPaymentRecords] = useState<PointsPaymentRecord[]>([]);
  const {
    data = pointsService.getEmptyDashboard(),
  } = useQuery({
    queryKey: pointsQueryKeys.dashboard,
    queryFn: () => pointsService.getDashboard(),
    enabled: isOpen,
    placeholderData: pointsService.getEmptyDashboard(),
  });

  const language = i18n.resolvedLanguage ?? i18n.language;
  const translate = (key: string, options?: Record<string, unknown>) => String(t(key, options));
  const selectedPlan = useMemo(
    () => data.plans.find((plan) => plan.packId === selectedPackId) ?? data.plans[0] ?? null,
    [data.plans, selectedPackId],
  );

  useEffect(() => {
    if (!isOpen || checkoutSession) {
      return;
    }

    setSelectedPackId((currentPackId) => {
      if (
        currentPackId !== null
        && data.plans.some((plan) => plan.packId === currentPackId)
      ) {
        return currentPackId;
      }

      return resolveDefaultSelectedPackId(data.plans);
    });
  }, [checkoutSession, data.plans, isOpen]);

  const startCheckoutMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlan) {
        throw new Error('No VIP pack selected.');
      }

      return pointsService.upgradePlan({
        packId: selectedPlan.packId,
        paymentMethod: paymentMethod.toUpperCase(),
      });
    },
    onSuccess: (result) => {
      setCheckoutSession(result);
      setPaymentRecords(result.payments);
      toast.success(
        t('points.toasts.checkoutCreated', {
          plan: result.packName || selectedPlan?.name || '',
        }),
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('points.toasts.upgradeFailed'));
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!checkoutSession?.orderId) {
        throw new Error('No VIP order is available.');
      }

      const status = await pointsService.confirmUpgradePayment(checkoutSession.orderId);
      const payments = await pointsService.getUpgradePaymentRecords(checkoutSession.orderId);
      return {
        status,
        payments,
      };
    },
    onSuccess: async ({ status, payments }) => {
      setPaymentRecords(payments);

      if (status.paid) {
        toast.success(
          t('points.toasts.upgradeSuccess', {
            plan: checkoutSession?.packName || selectedPlan?.name || '',
            points: selectedPlan ? formatPoints(selectedPlan.includedPoints, language) : '',
          }),
        );
        await queryClient.invalidateQueries({
          queryKey: pointsQueryKeys.dashboard,
        });
        onClose();
        return;
      }

      toast.message(t('points.toasts.paymentPending'));
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t('points.toasts.upgradeFailed'));
    },
  });

  const handleOpenPayment = async () => {
    const paymentUrl = checkoutSession?.paymentSession?.paymentUrl;
    if (!paymentUrl) {
      toast.error(t('points.toasts.paymentUrlUnavailable'));
      return;
    }

    try {
      await openExternalUrl(paymentUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('points.toasts.paymentOpenFailed'));
    }
  };

  const paymentParamsEntries = checkoutSession?.paymentSession?.paymentParams
    ? Object.entries(checkoutSession.paymentSession.paymentParams)
    : [];

  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      modalAlignment="top"
      closeOnBackdrop
      className="max-w-[1320px]"
      backdropClassName="bg-zinc-950/60"
    >
      <div className="border-b border-zinc-200/80 bg-white/94 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/92">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
              {t('points.upgradeDialog.eyebrow')}
            </div>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {t(checkoutSession ? 'points.upgradeDialog.paymentTitle' : 'points.upgradeDialog.title')}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              {t(checkoutSession ? 'points.upgradeDialog.paymentDescription' : 'points.upgradeDialog.description')}
            </p>
          </div>

          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,0.08),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(250,250,250,0.92))] px-6 py-8 dark:bg-[radial-gradient(circle_at_top_right,_rgba(244,63,94,0.10),_transparent_28%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))]">
        {!checkoutSession ? (
          <PointsUpgradeCatalogView
            t={translate}
            language={language}
            data={data}
            selectedPlan={selectedPlan}
            paymentMethod={paymentMethod}
            isSubmitting={startCheckoutMutation.isPending}
            onSelectPack={setSelectedPackId}
            onSelectPaymentMethod={setPaymentMethod}
            onStartCheckout={() => startCheckoutMutation.mutate()}
          />
        ) : (
          <PointsUpgradePaymentView
            t={translate}
            language={language}
            paymentMethod={paymentMethod}
            selectedPlan={selectedPlan}
            checkoutSession={checkoutSession}
            paymentParamsEntries={paymentParamsEntries}
            paymentRecords={paymentRecords}
            isConfirming={confirmPaymentMutation.isPending}
            onOpenPayment={() => void handleOpenPayment()}
            onConfirmPayment={() => confirmPaymentMutation.mutate()}
          />
        )}
      </div>
    </OverlaySurface>
  );
}
