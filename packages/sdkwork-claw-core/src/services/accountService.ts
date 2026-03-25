import {
  getAppSdkClientWithSession,
  unwrapAppSdkResponse,
} from '../sdk/index.ts';

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'recharge' | 'withdraw';
  amount: number;
  desc: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface AccountSummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
}

export interface AccountService {
  getSummary(): Promise<AccountSummary>;
  getTransactions(filter?: 'all' | 'income' | 'expense'): Promise<Transaction[]>;
  recharge(amount: number, method: string): Promise<Transaction>;
  withdraw(amount: number, destination: string): Promise<Transaction>;
}

function toNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function resolveTransactionType(transactionType?: string): Transaction['type'] {
  const normalized = transactionType?.toUpperCase() || '';
  if (normalized.includes('RECHARGE') || normalized.includes('TOPUP')) {
    return 'recharge';
  }
  if (normalized.includes('WITHDRAW')) {
    return 'withdraw';
  }
  if (normalized.includes('PAY') || normalized.includes('EXPENSE') || normalized.includes('CONSUME')) {
    return 'expense';
  }
  return 'income';
}

function resolveTransactionStatus(status?: string): Transaction['status'] {
  const normalized = status?.toUpperCase() || '';
  if (normalized === 'SUCCESS' || normalized === 'COMPLETED') {
    return 'completed';
  }
  if (normalized === 'FAILED') {
    return 'failed';
  }
  return 'pending';
}

function createTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `txn-${Date.now()}`;
}

export function createAccountService(): AccountService {
  return {
    async getSummary() {
      const client = getAppSdkClientWithSession();
      const [summaryResponse, cashAccountResponse] = await Promise.all([
        client.account.getAccountSummary(),
        client.account.getCash(),
      ]);
      const summary = unwrapAppSdkResponse(summaryResponse);
      const cashAccount = unwrapAppSdkResponse(cashAccountResponse);

      return {
        balance: toNumber(cashAccount.availableBalance, toNumber(summary.cashAvailable)),
        totalIncome: toNumber(cashAccount.totalRecharged),
        totalExpense: toNumber(cashAccount.totalSpent, toNumber(cashAccount.totalWithdrawn)),
      };
    },

    async getTransactions(filter = 'all') {
      const client = getAppSdkClientWithSession();
      const history = unwrapAppSdkResponse(await client.account.getHistoryCash());
      const items = (history.content ?? []).map((item) => ({
        id: item.historyId || item.transactionId || createTransactionId(),
        type: resolveTransactionType(item.transactionType),
        amount: Math.abs(toNumber(item.amount)),
        desc: item.remarks || item.transactionTypeName || item.transactionType || 'Transaction',
        date: item.createdAt || new Date().toISOString(),
        status: resolveTransactionStatus(item.status),
      }));

      return items.filter((item) => {
        if (filter === 'income') {
          return item.type === 'income' || item.type === 'recharge';
        }
        if (filter === 'expense') {
          return item.type === 'expense' || item.type === 'withdraw';
        }
        return true;
      });
    },

    async recharge(amount, method) {
      const client = getAppSdkClientWithSession();
      const result = unwrapAppSdkResponse(await client.account.recharge({
        amount,
        paymentMethod: method,
        remarks: `Wallet Top-up via ${method}`,
      }));

      return {
        id: result.transactionId || createTransactionId(),
        type: 'recharge',
        amount,
        desc: `Wallet Top-up via ${method}`,
        date: new Date().toISOString(),
        status: resolveTransactionStatus(result.status),
      };
    },

    async withdraw(amount, destination) {
      const client = getAppSdkClientWithSession();
      const result = unwrapAppSdkResponse(await client.account.withdraw({
        amount,
        withdrawMethod: destination,
        remarks: `Withdrawal to ${destination}`,
      }));

      return {
        id: result.transactionId || createTransactionId(),
        type: 'withdraw',
        amount,
        desc: `Withdrawal to ${destination}`,
        date: new Date().toISOString(),
        status: resolveTransactionStatus(result.status),
      };
    },
  };
}

export const accountService = createAccountService();
