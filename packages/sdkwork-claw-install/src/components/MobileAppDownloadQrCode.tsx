import { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';

interface MobileAppDownloadQrCodeProps {
  label: string;
  description: string;
  value: string;
}

export function MobileAppDownloadQrCode({
  label,
  description,
  value,
}: MobileAppDownloadQrCodeProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    let isDisposed = false;

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((nextQrCodeDataUrl) => {
        if (!isDisposed) {
          setQrCodeDataUrl(nextQrCodeDataUrl);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setQrCodeDataUrl('');
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [value]);

  return (
    <div
      data-slot="mobile-app-download-qr-code"
      className="rounded-[28px] border border-sky-500/16 bg-white/90 p-5 text-zinc-950 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-zinc-900/92 dark:text-zinc-50"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p>
      <div className="mt-4 flex justify-center rounded-[24px] bg-white p-4 shadow-inner">
        {qrCodeDataUrl ? (
          <img
            src={qrCodeDataUrl}
            alt={label}
            className="h-48 w-48 rounded-2xl object-contain"
          />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        )}
      </div>
      <div className="mt-4 break-all rounded-2xl bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-5 text-emerald-300 dark:bg-black/40">
        {value}
      </div>
    </div>
  );
}
