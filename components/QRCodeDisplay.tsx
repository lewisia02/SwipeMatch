'use client';

import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  url: string;
}

export function QRCodeDisplay({ url }: QRCodeDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md bg-bg-muted p-4">
      <QRCodeSVG value={url} size={160} />
      <p className="text-caption text-text-muted">{url}</p>
    </div>
  );
}
