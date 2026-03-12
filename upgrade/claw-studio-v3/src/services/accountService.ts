import { delay } from '../types/service';

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

export interface IAccountService {
  getSummary(): Promise<AccountSummary>;
  getTransactions(filter?: 'all' | 'income' | 'expense'): Promise<Transaction[]>;
  recharge(amount: number, method: string): Promise<Transaction>;
  withdraw(amount: number, destination: string): Promise<Transaction>;
}

class AccountService implements IAccountService {
  private transactions: Transaction[] = [
    { id: '1', type: 'income', amount: 150.00, desc: 'Data Processing Service - Client A', date: new Date(Date.now() - 86400000 * 1).toISOString(), status: 'completed' },
    { id: '2', type: 'expense', amount: 20.00, desc: 'API Usage Fee - OpenAI', date: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'completed' },
    { id: '3', type: 'income', amount: 300.00, desc: 'Content Generation - Project X', date: new Date(Date.now() - 86400000 * 3).toISOString(), status: 'completed' },
    { id: '4', type: 'recharge', amount: 500.00, desc: 'Wallet Top-up', date: new Date(Date.now() - 86400000 * 6).toISOString(), status: 'completed' },
    { id: '5', type: 'withdraw', amount: 100.00, desc: 'Withdrawal to Bank Account', date: new Date(Date.now() - 86400000 * 10).toISOString(), status: 'pending' },
  ];

  private balance = 1250.50;

  async getSummary(): Promise<AccountSummary> {
    await delay(500);
    const currentMonth = new Date().getMonth();
    
    let totalIncome = 0;
    let totalExpense = 0;

    this.transactions.forEach(tx => {
      const txMonth = new Date(tx.date).getMonth();
      if (txMonth === currentMonth && tx.status === 'completed') {
        if (tx.type === 'income') totalIncome += tx.amount;
        if (tx.type === 'expense') totalExpense += tx.amount;
      }
    });

    return {
      balance: this.balance,
      totalIncome: totalIncome || 450, // fallback for mock
      totalExpense: totalExpense || 20
    };
  }

  async getTransactions(filter: 'all' | 'income' | 'expense' = 'all'): Promise<Transaction[]> {
    await delay(500);
    let filtered = this.transactions;
    if (filter === 'income') {
      filtered = this.transactions.filter(t => t.type === 'income' || t.type === 'recharge');
    } else if (filter === 'expense') {
      filtered = this.transactions.filter(t => t.type === 'expense' || t.type === 'withdraw');
    }
    return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async recharge(amount: number, method: string): Promise<Transaction> {
    await delay(1000);
    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'recharge',
      amount,
      desc: `Wallet Top-up via ${method}`,
      date: new Date().toISOString(),
      status: 'completed'
    };
    this.transactions.unshift(newTx);
    this.balance += amount;
    return newTx;
  }

  async withdraw(amount: number, destination: string): Promise<Transaction> {
    await delay(1000);
    if (amount > this.balance) {
      throw new Error('Insufficient balance');
    }
    const newTx: Transaction = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'withdraw',
      amount,
      desc: `Withdrawal to ${destination}`,
      date: new Date().toISOString(),
      status: 'pending'
    };
    this.transactions.unshift(newTx);
    this.balance -= amount;
    return newTx;
  }
}

export const accountService = new AccountService();
