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
import {
  formatCurrency,
  formatDate,
  formatNumber,
  useLocalizedText,
} from '@sdkwork/claw-i18n';
import { Section } from './Shared';

export function BillingSettings() {
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices'>('overview');
  const { text, language } = useLocalizedText();

  const usageData = [
    {
      name: 'GPT-4o',
      type: text('LLM API', 'LLM API'),
      tokens: 2400000,
      costUsd: 24.5,
      icon: Sparkles,
    },
    {
      name: 'Claude 3.5 Sonnet',
      type: text('LLM API', 'LLM API'),
      tokens: 1100000,
      costUsd: 3.3,
      icon: Sparkles,
    },
    {
      name: text(
        'Production Node (aws-us-east-1)',
        '\u751f\u4ea7\u8282\u70b9 (aws-us-east-1)',
      ),
      type: text('Instance', '\u5b9e\u4f8b'),
      uptimeHours: 720,
      costUsd: 14.4,
      icon: Server,
    },
    {
      name: text('Dev Node (local)', '\u5f00\u53d1\u8282\u70b9 (local)'),
      type: text('Instance', '\u5b9e\u4f8b'),
      uptimeHours: 120,
      costUsd: 0,
      icon: Server,
    },
  ];

  const invoices = [
    {
      id: 'INV-2026-003',
      date: '2026-03-01T00:00:00.000Z',
      amountUsd: 42.2,
      status: text('Paid', '\u5df2\u652f\u4ed8'),
    },
    {
      id: 'INV-2026-002',
      date: '2026-02-01T00:00:00.000Z',
      amountUsd: 38.5,
      status: text('Paid', '\u5df2\u652f\u4ed8'),
    },
    {
      id: 'INV-2026-001',
      date: '2026-01-01T00:00:00.000Z',
      amountUsd: 12,
      status: text('Paid', '\u5df2\u652f\u4ed8'),
    },
  ];

  const monthlyChange = formatNumber(12.5, language, { maximumFractionDigits: 1 });
  const compactTokenTotal = formatNumber(3500000, language, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  const formatUsage = (item: (typeof usageData)[number]) => {
    if ('tokens' in item) {
      const compactTokens = formatNumber(item.tokens, language, {
        notation: 'compact',
        maximumFractionDigits: 1,
      });

      return text(`${compactTokens} tokens`, `${compactTokens} \u4ee4\u724c`);
    }

    const hours = formatNumber(item.uptimeHours, language);
    return text(`${hours}h`, `${hours} \u5c0f\u65f6`);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {text('Billing & Usage', '\u8d26\u5355\u4e0e\u7528\u91cf')}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {text(
            'Manage your subscription, payment methods, and monitor API or instance costs.',
            '\u7ba1\u7406\u4f60\u7684\u8ba2\u9605\u3001\u4ed8\u6b3e\u65b9\u5f0f\uff0c\u5e76\u76d1\u63a7 API \u6216\u5b9e\u4f8b\u7684\u8d39\u7528\u3002',
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-500/10">
              <DollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {text('This Month', '\u672c\u6708')}
            </span>
          </div>
          <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {text('Current Usage', '\u5f53\u524d\u7528\u91cf')}
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {formatCurrency(42.2, language)}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-500">+{monthlyChange}%</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {text('vs last month', '\u8f83\u4e0a\u6708')}
            </span>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {text('API Costs', 'API \u8d39\u7528')}
            </span>
          </div>
          <div className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {text('Total Tokens', 'Tokens \u603b\u91cf')}
          </div>
          <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {compactTokenTotal}
          </div>
          <div className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {text('Estimated cost:', '\u9884\u4f30\u8d39\u7528\uff1a')}{' '}
            <span className="text-zinc-900 dark:text-zinc-100">
              {formatCurrency(27.8, language)}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[1.5rem] border border-zinc-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-zinc-400" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {text('Payment Method', '\u4ed8\u6b3e\u65b9\u5f0f')}
              </span>
            </div>
            <div className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {text(
                'Visa ending in **** 4242',
                'Visa\uff0c\u5c3e\u53f7 **** 4242',
              )}
            </div>
          </div>
          <button className="w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-bold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700">
            {text('Update Payment Method', '\u66f4\u65b0\u4ed8\u6b3e\u65b9\u5f0f')}
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
          {text('Usage Breakdown', '\u7528\u91cf\u660e\u7ec6')}
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          {text('Invoices & History', '\u53d1\u7968\u4e0e\u5386\u53f2')}
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
            <Section
              title={text(
                'Cost Breakdown (March 2026)',
                '2026 \u5e74 3 \u6708\u8d39\u7528\u660e\u7ec6',
              )}
            >
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">
                        {text('Resource', '\u8d44\u6e90')}
                      </th>
                      <th className="px-6 py-4 font-medium">
                        {text('Type', '\u7c7b\u578b')}
                      </th>
                      <th className="px-6 py-4 font-medium">
                        {text('Usage', '\u7528\u91cf')}
                      </th>
                      <th className="px-6 py-4 text-right font-medium">
                        {text('Cost', '\u8d39\u7528')}
                      </th>
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
                          {formatUsage(item)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(item.costUsd, language)}
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
                        {text(
                          'Total Estimated Cost',
                          '\u603b\u9884\u4f30\u8d39\u7528',
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(42.2, language)}
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
                  {text('Spending Limit Alert', '\u652f\u51fa\u4e0a\u9650\u63d0\u9192')}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-500/80">
                  {text(
                    `You have reached 85% of your ${formatCurrency(50, language)} monthly spending limit. Consider adjusting your limits or monitoring usage closely.`,
                    `\u4f60\u5df2\u8fbe\u5230\u6bcf\u6708 ${formatCurrency(50, language)} \u652f\u51fa\u4e0a\u9650\u7684 85%\uff0c\u5efa\u8bae\u8c03\u6574\u9650\u989d\u6216\u5bc6\u5207\u76d1\u63a7\u4f7f\u7528\u60c5\u51b5\u3002`,
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Section title={text('Billing History', '\u8d26\u5355\u5386\u53f2')}>
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">
                      {text('Invoice', '\u53d1\u7968')}
                    </th>
                    <th className="px-6 py-4 font-medium">
                      {text('Date', '\u65e5\u671f')}
                    </th>
                    <th className="px-6 py-4 font-medium">
                      {text('Amount', '\u91d1\u989d')}
                    </th>
                    <th className="px-6 py-4 font-medium">
                      {text('Status', '\u72b6\u6001')}
                    </th>
                    <th className="px-6 py-4 text-right font-medium">
                      {text('Action', '\u64cd\u4f5c')}
                    </th>
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
                        {formatDate(invoice.date, language, { dateStyle: 'medium' })}
                      </td>
                      <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(invoice.amountUsd, language)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          title={text('Download invoice', '\u4e0b\u8f7d\u53d1\u7968')}
                        >
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
