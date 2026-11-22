import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

interface QRCodeCardProps {
  value: string;
  size?: number;
  alt: string;
  className?: string;
}

export const QRCodeCard: React.FC<QRCodeCardProps> = ({ value, size = 180, alt, className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl('');
      return;
    }
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value || error || !dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 ${className}`}
      >
        <QrCode className="h-8 w-8" />
        <span className="mt-2 text-xs font-medium">No address set</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={`rounded-xl border border-slate-200 bg-white p-1.5 ${className}`}
    />
  );
};
