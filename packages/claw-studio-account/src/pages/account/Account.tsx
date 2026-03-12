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
import { Modal } from '@sdkwork/claw-studio-shared-ui';
import { accountService, type AccountSummary, type Transaction } from '../../services';

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
      toast.error(error instanceof Error ? error.message : t('account.withdrawFailed', 'Withdrawal failed'));
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading && !summary) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 p-6 md:p-8 overflow-y-auto scrollbar-hide">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary-500" />
            {t('account.title', 'Account & Wallet')}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            {t('account.subtitle', 'Manage your agent earnings, recharges, and withdrawals.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-primary-100 font-medium">{t('account.totalBalance', 'Total Balance')}</span>
                <DollarSign className="w-5 h-5 text-primary-200" />
              </div>
              <div className="text-4xl font-black mb-8 tracking-tight">
                ${summary?.balance.toFixed(2) || '0.00'}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsRechargeModalOpen(true)}
                  className="flex-1 bg-white text-primary-700 hover:bg-primary-50 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> {t('account.recharge', 'Recharge')}
                </button>
                <button
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="flex-1 bg-primary-700 hover:bg-primary-900 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-primary-500/30"
                >
                  <Download className="w-4 h-4" /> {t('account.withdraw', 'Withdraw')}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">{t('account.monthlyIncome', 'Monthly Income')}</span>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              +${summary?.totalIncome.toFixed(2) || '0.00'}
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <TrendingUp className="w-4 h-4" /> +12.5% {t('account.vsLastMonth', 'vs last month')}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">{t('account.monthlyExpense', 'Monthly Expense')}</span>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-white mt-2">
              -${summary?.totalExpense.toFixed(2) || '0.00'}
            </div>
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
              {t('account.mostlyApiFees', 'Mostly API usage fees')}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <History className="w-5 h-5 text-zinc-400" />
              {t('account.transactionHistory', 'Transaction History')}
            </h2>

            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
              {(['all', 'income', 'expense'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  {t(`account.${tab}`, tab.charAt(0).toUpperCase() + tab.slice(1))}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 flex-1">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : transactions.length > 0 ? (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-4 sm:p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        transaction.type === 'income' || transaction.type === 'recharge'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {transaction.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : null}
                      {transaction.type === 'expense' ? <ArrowDownRight className="w-5 h-5" /> : null}
                      {transaction.type === 'recharge' ? <CreditCard className="w-5 h-5" /> : null}
                      {transaction.type === 'withdraw' ? <Download className="w-5 h-5" /> : null}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{transaction.desc}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                        <span>
                          {new Date(transaction.date).toLocaleDateString()} {new Date(transaction.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {transaction.status === 'completed' ? (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> {t('account.completed', 'Completed')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <Clock className="w-3 h-3" /> {t('account.pending', 'Pending')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`text-right font-bold whitespace-nowrap ${
                      transaction.type === 'income' || transaction.type === 'recharge'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {transaction.type === 'income' || transaction.type === 'recharge' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-zinc-500">{t('account.noTransactions', 'No transactions found.')}</div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isRechargeModalOpen} onClose={() => setIsRechargeModalOpen(false)} title={t('account.recharge', 'Recharge')}>
        <form onSubmit={handleRecharge} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('account.amount', 'Amount ($)')}</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('account.paymentMethod', 'Payment Method')}</label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            >
              <option value="credit_card">{t('account.creditCard', 'Credit Card')}</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">{t('account.crypto', 'Crypto (USDT/USDC)')}</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRechargeModalOpen(false)}
              className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {t('account.confirmRecharge', 'Confirm Recharge')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title={t('account.withdraw', 'Withdraw')}>
        <form onSubmit={handleWithdraw} className="space-y-4">
          <div className="bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 p-3 rounded-lg text-sm font-medium flex items-center justify-between">
            <span>{t('account.availableBalance', 'Available Balance')}:</span>
            <span className="font-bold">${summary?.balance.toFixed(2)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('account.amount', 'Amount ($)')}</label>
            <input
              type="number"
              min="1"
              max={summary?.balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t('account.withdrawDestination', 'Withdraw to')}</label>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            >
              <option value="bank_account">{t('account.bankAccount', 'Bank Account')}</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsWithdrawModalOpen(false)}
              className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
              {t('account.confirmWithdraw', 'Confirm Withdraw')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
