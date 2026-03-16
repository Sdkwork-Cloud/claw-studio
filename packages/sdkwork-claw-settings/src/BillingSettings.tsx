import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  CreditCard,
  DollarSign,
  Download,
  Server,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Section } from './Shared';

export function BillingSettings() {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices'>('overview');

  const usageData = [
    { name: 'GPT-4o', type: 'LLM API', tokens: '2.4M', cost: '$24.50', icon: Sparkles },
    {
      name: 'Claude 3.5 Sonnet',
      type: 'LLM API',
      tokens: '1.1M',
      cost: '$3.30',
      icon: Sparkles,
    },
    {
      name: 'Production Node (aws-us-east-1)',
      type: 'Instance',
      uptime: '720h',
      cost: '$14.40',
      icon: Server,
    },
    { name: 'Dev Node (local)', type: 'Instance', uptime: '120h', cost: '$0.00', icon: Server },
  ];

  const invoices = [
    { id: 'INV-2026-003', date: 'Mar 01, 2026', amount: '$42.20', status: 'Paid' },
    { id: 'INV-2026-002', date: 'Feb 01, 2026', amount: '$38.50', status: 'Paid' },
    { id: 'INV-2026-001', date: 'Jan 01, 2026', amount: '$12.00', status: 'Paid' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Billing & Usage
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your subscription, payment methods, and monitor API/Instance costs.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
              <DollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              This Month
            </span>
          </div>
          <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Current Usage
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            $42.20
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-500">+12.5%</span>
            <span className="text-zinc-500 dark:text-zinc-400">vs last month</span>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              API Costs
            </span>
          </div>
          <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Total Tokens
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            3.5M
          </div>
          <div className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Estimated cost: <span className="text-zinc-900 dark:text-zinc-100">$27.80</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-zinc-400" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                Payment Method
              </span>
            </div>
            <div className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Visa ending in **** 4242
            </div>
          </div>
          <button className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
            Update Payment Method
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          Usage Breakdown
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          Invoices & History
        </button>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <Section title="Cost Breakdown (March 2026)">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Resource</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Usage</th>
                      <th className="px-6 py-4 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {usageData.map((item) => (
                      <tr
                        key={item.name}
                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                              <item.icon className="h-4 w-4 text-zinc-500" />
                            </div>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                          {item.type}
                        </td>
                        <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                          {item.tokens ? `${item.tokens} tokens` : item.uptime}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          {item.cost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-4 text-right font-medium text-zinc-500 dark:text-zinc-400"
                      >
                        Total Estimated Cost
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        $42.20
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Section>

            <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
              <div>
                <h4 className="mb-1 text-sm font-bold text-amber-900 dark:text-amber-400">
                  Spending Limit Alert
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-500/80">
                  You have reached 85% of your $50.00 monthly spending limit. Consider
                  adjusting your limits or monitoring usage closely.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Section title="Billing History">
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Invoice</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Amount</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {invoice.id}
                      </td>
                      <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                        {invoice.date}
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                        {invoice.amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                          <Download className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </motion.div>
    </div>
  );
}
