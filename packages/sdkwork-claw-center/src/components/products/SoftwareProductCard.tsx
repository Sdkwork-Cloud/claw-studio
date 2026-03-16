import React, { useState } from 'react';
import { Code, Server, Play, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { SoftwareProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

interface SoftwareProductCardProps {
  product: SoftwareProduct;
  onRequest: (name: string) => void;
}

export function SoftwareProductCard({ product, onRequest }: SoftwareProductCardProps) {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'generating' | 'generated' | 'deploying' | 'deployed'>('idle');

  const handleGenerate = () => {
    setIsGenerating(true);
    setStatus('generating');
    setTimeout(() => {
      setIsGenerating(false);
      setStatus('generated');
    }, 3000); // Mock generation time
  };

  const handleDeploy = () => {
    setIsDeploying(true);
    setStatus('deploying');
    setTimeout(() => {
      setIsDeploying(false);
      setStatus('deployed');
    }, 3000); // Mock deployment time
  };

  return (
    <ProductCardWrapper 
      product={product} 
      onRequest={onRequest}
      customContent={
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {product.supportedTypes.map((type, idx) => (
              <span key={idx} className="px-2 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold rounded-md flex items-center gap-1">
                <Code className="w-3 h-3" /> {type}
              </span>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {product.deploymentOptions.map((opt, idx) => (
              <span key={idx} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-md flex items-center gap-1">
                <Server className="w-3 h-3" /> {opt}
              </span>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">Features</h4>
            <ul className="grid grid-cols-2 gap-2">
              {product.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
            {status === 'idle' && (
              <button 
                onClick={handleGenerate}
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Generate Software
              </button>
            )}
            
            {status === 'generating' && (
              <div className="w-full py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </div>
            )}

            {status === 'generated' && (
              <div className="flex gap-2">
                <div className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Generated
                </div>
                <button 
                  onClick={handleDeploy}
                  className="flex-1 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Server className="w-4 h-4" /> Deploy Now
                </button>
              </div>
            )}

            {status === 'deploying' && (
              <div className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Deploying...
              </div>
            )}

            {status === 'deployed' && (
              <div className="flex gap-2">
                <div className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Deployed
                </div>
                <button 
                  onClick={() => window.open('https://example.com', '_blank')}
                  className="flex-1 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Visit Site
                </button>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
