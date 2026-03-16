import React from 'react';
import { Upload, FileUp, Globe, Settings, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

export function ClawUpload() {
  const { t } = useTranslation();

  return (
    <div className="h-full bg-zinc-50 dark:bg-zinc-950 p-6 md:p-8 overflow-y-auto scrollbar-hide">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
              <Globe className="w-8 h-8 text-primary-500" />
              {t('clawUpload.title', 'Claw Upload')}
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              {t('clawUpload.subtitle', 'Publish your Claw to the ecosystem')}
            </p>
          </div>
        </div>

        {/* Placeholder Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center"
        >
          <div className="w-20 h-20 bg-primary-50 dark:bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileUp className="w-10 h-10 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">
            {t('clawUpload.comingSoon', 'Claw Publishing Coming Soon')}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-8">
            {t('clawUpload.description', 'Soon you will be able to package and publish your custom Claws to the global ecosystem for others to discover and use.')}
          </p>
          <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors inline-flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {t('clawUpload.prepare', 'Prepare Your Claw')}
          </button>
        </motion.div>

      </div>
    </div>
  );
}
