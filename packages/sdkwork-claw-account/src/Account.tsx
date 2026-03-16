import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  History,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Modal } from '@sdkwork/claw-ui';
import {
  accountService,
  type AccountSummary,
  type Transaction,
} from './services';

export function Account() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'all' | 'income' | 'expense'>('all');
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [summaryData, transactionData] = await Promise.all([
        accountService.getSummary(),
        accountService.getTransactions(activeTab),
      ]);
      setSummary(summaryData);
      setTransactions(transactionData);
    } catch {
      toast.error(t('account.fetchError', 'Failed to load account data'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, [activeTab]);

  async function handleRecharge(event: FormEvent) {
    event.preventDefault();

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error(t('account.invalidAmount', 'Please enter a valid amount'));
      return;
    }

    setIsProcessing(true);
    try {
      await accountService.recharge(Number(amount), method);
      toast.success(t('account.rechargeSuccess', 'Recharge successful'));
      setIsRechargeModalOpen(false);
      setAmount('');
      await fetchData();
    } catch {
      toast.error(t('account.rechargeFailed', 'Recharge failed'));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleWithdraw(event: FormEvent) {
    event.preventDefault();

    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error(t('account.invalidAmount', 'Please enter a valid amount'));
      return;
    }
    if (summary && Number(amount) > summary.balance) {
      toast.error(t('account.insufficientBalance', 'Insufficient balance'));
      return;
    }

    setIsProcessing(true);
    try {
      await accountService.withdraw(Number(amount), method);
      toast.success(t('account.withdrawSuccess', 'Withdrawal request submitted'));
      setIsWithdrawModalOpen(false);
      setAmount('');
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('account.withdrawFailed', 'Withdrawal failed'),
      );
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 p-6 dark:bg-zinc-950 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
            <Wallet className="h-8 w-8 text-primary-500" />
            {t('account.title', 'Account & Wallet')}
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            {t(
              'account.subtitle',
              'Manage your agent earnings, recharges, and withdrawals.',
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-xl">
            <div className="absolute right-0 top-0 -mr-4 -mt-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative z-10">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-medium text-primary-100">
                  {t('account.totalBalance', 'Total Balance')}
                </span>
                <DollarSign className="h-5 w-5 text-primary-200" />
              </div>
              <div className="mb-8 text-4xl font-black tracking-tight">
                ${summary?.balance.toFixed(2) || '0.00'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsRechargeModalOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-2.5 font-bold text-primary-700 shadow-sm transition-colors hover:bg-primary-50"
                >
                  <Plus className="h-4 w-4" /> {t('account.recharge', 'Recharge')}
                </button>
                <button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary-500/30 bg-primary-700 py-2.5 font-bold text-white transition-colors hover:bg-primary-900"
                >
                  <Download className="h-4 w-4" /> {t('account.withdraw', 'Withdraw')}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <ArrowUpRight className="h-5 w-5" />
              </div>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {t('account.monthlyIncome', 'Monthly Income')}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              +${summary?.totalIncome.toFixed(2) || '0.00'}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" /> +12.5% {t('account.vsLastMonth', 'vs last month')}
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                <ArrowDownRight className="h-5 w-5" />
              </div>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">
                {t('account.monthlyExpense', 'Monthly Expense')}
              </span>
            </div>
            <div className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              -${summary?.totalExpense.toFixed(2) || '0.00'}
            </div>
            <div className="mt-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {t('account.mostlyApiFees', 'Mostly API usage fees')}
            </div>
          </div>
        </div>

        <div className="flex min-h-[400px] flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 p-6 dark:border-zinc-800 sm:flex-row sm:items-center">
            <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-white">
              <History className="h-5 w-5 text-zinc-400" />
              {t('account.transactionHistory', 'Transaction History')}
            </h2>

            <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              {(['all', 'income', 'expense'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {t(`account.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {isLoading ? (
              <div className="flex justify-center p-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
              </div>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 sm:p-6"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        transaction.type === 'income' || transaction.type === 'recharge'
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                      }`}
                    >
                      {transaction.type === 'income' ? (
                        <ArrowUpRight className="h-5 w-5" />
                      ) : null}
                      {transaction.type === 'expense' ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : null}
                      {transaction.type === 'recharge' ? (
                        <CreditCard className="h-5 w-5" />
                      ) : null}
                      {transaction.type === 'withdraw' ? (
                        <Download className="h-5 w-5" />
                      ) : null}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {transaction.desc}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                        <span>
                          {new Date(transaction.date).toLocaleDateString()}{' '}
                          {new Date(transaction.date).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {transaction.status === 'completed' ? (
                          <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />{' '}
                            {t('account.completed', 'Completed')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> {t('account.pending', 'Pending')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`whitespace-nowrap text-right font-bold ${
                      transaction.type === 'income' || transaction.type === 'recharge'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {transaction.type === 'income' || transaction.type === 'recharge'
                      ? '+'
                      : '-'}
                    ${transaction.amount.toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-zinc-500">
                {t('account.noTransactions', 'No transactions found.')}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isRechargeModalOpen}
        onClose={() => setIsRechargeModalOpen(false)}
        title={t('account.recharge', 'Recharge')}
      >
        <form onSubmit={handleRecharge} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('account.amount', 'Amount ($)')}
            </label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('account.paymentMethod', 'Payment Method')}
            </label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="credit_card">{t('account.creditCard', 'Credit Card')}</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">{t('account.crypto', 'Crypto (USDT/USDC)')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsRechargeModalOpen(false)}
              className="rounded-xl px-4 py-2 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {t('account.confirmRecharge', 'Confirm Recharge')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title={t('account.withdraw', 'Withdraw')}
      >
        <form onSubmit={handleWithdraw} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-primary-50 p-3 text-sm font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            <span>{t('account.availableBalance', 'Available Balance')}:</span>
            <span className="font-bold">${summary?.balance.toFixed(2)}</span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('account.amount', 'Amount ($)')}
            </label>
            <input
              type="number"
              min="1"
              max={summary?.balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('account.withdrawDestination', 'Withdraw to')}
            </label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >
              <option value="bank_account">{t('account.bankAccount', 'Bank Account')}</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(false)}
              className="rounded-xl px-4 py-2 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {t('account.confirmWithdraw', 'Confirm Withdraw')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
