function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const SEEDED_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'income',
    amount: 150,
    desc: 'Data Processing Service - Client A',
    date: new Date(Date.now() - 86400000).toISOString(),
    status: 'completed',
  },
  {
    id: '2',
    type: 'expense',
    amount: 20,
    desc: 'API Usage Fee - OpenAI',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'completed',
  },
  {
    id: '3',
    type: 'income',
    amount: 300,
    desc: 'Content Generation - Project X',
    date: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'completed',
  },
  {
    id: '4',
    type: 'recharge',
    amount: 500,
    desc: 'Wallet Top-up',
    date: new Date(Date.now() - 86400000 * 6).toISOString(),
    status: 'completed',
  },
  {
    id: '5',
    type: 'withdraw',
    amount: 100,
    desc: 'Withdrawal to Bank Account',
    date: new Date(Date.now() - 86400000 * 10).toISOString(),
    status: 'pending',
  },
];

export function createAccountService(
  seedTransactions: Transaction[] = SEEDED_TRANSACTIONS,
  startingBalance = 1250.5,
): AccountService {
  const transactions = [...seedTransactions];
  let balance = startingBalance;

  return {
    async getSummary() {
      await delay(500);

      const currentMonth = new Date().getMonth();
      let totalIncome = 0;
      let totalExpense = 0;

      for (const transaction of transactions) {
        if (
          new Date(transaction.date).getMonth() !== currentMonth ||
          transaction.status !== 'completed'
        ) {
          continue;
        }

        if (transaction.type === 'income') {
          totalIncome += transaction.amount;
        }
        if (transaction.type === 'expense') {
          totalExpense += transaction.amount;
        }
      }

      return {
        balance,
        totalIncome: totalIncome || 450,
        totalExpense: totalExpense || 20,
      };
    },

    async getTransactions(filter = 'all') {
      await delay(500);

      let filtered = transactions;
      if (filter === 'income') {
        filtered = transactions.filter(
          (transaction) =>
            transaction.type === 'income' || transaction.type === 'recharge',
        );
      } else if (filter === 'expense') {
        filtered = transactions.filter(
          (transaction) =>
            transaction.type === 'expense' || transaction.type === 'withdraw',
        );
      }

      return [...filtered].sort(
        (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
      );
    },

    async recharge(amount, method) {
      await delay(1000);

      const transaction: Transaction = {
        id: Math.random().toString(36).slice(2, 9),
        type: 'recharge',
        amount,
        desc: `Wallet Top-up via ${method}`,
        date: new Date().toISOString(),
        status: 'completed',
      };

      transactions.unshift(transaction);
      balance += amount;
      return transaction;
    },

    async withdraw(amount, destination) {
      await delay(1000);

      if (amount > balance) {
        throw new Error('Insufficient balance');
      }

      const transaction: Transaction = {
        id: Math.random().toString(36).slice(2, 9),
        type: 'withdraw',
        amount,
        desc: `Withdrawal to ${destination}`,
        date: new Date().toISOString(),
        status: 'pending',
      };

      transactions.unshift(transaction);
      balance -= amount;
      return transaction;
    },
  };
}

export const accountService = createAccountService();
