'use client';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import QRCode from 'qrcode';
import { InvitationCard, type CardDetails } from './invitation-card';
import type { Design } from '@/lib/planning';

export type ExportKind = 'png' | 'pdf';
export async function renderInvitation({
  design,
  details,
  photoUrl,
  link,
  kind,
}: {
  design: Design;
  details: CardDetails;
  photoUrl?: string;
  link?: string;
  kind: ExportKind;
}): Promise<Blob> {
  const qr = link
    ? await QRCode.toDataURL(link, {
        width: 360,
        margin: 4,
        errorCorrectionLevel: 'M',
      })
    : undefined;
  // Render at a stable size outside the responsive preview. Capturing an auto-
  // centred wrapper copies its resolved margin into the SVG and clips the right.
  const stage = document.createElement('div');
  stage.className = 'invitation-export-stage';
  stage.setAttribute('aria-hidden', 'true');
  document.body.append(stage);
  const root = createRoot(stage);
  try {
    flushSync(() =>
      root.render(
        <InvitationCard
          design={design}
          details={details}
          photoUrl={photoUrl}
          qr={qr}
          preview
        />,
      ),
    );
    const card = stage.querySelector('article')!;
    await document.fonts.ready;
    await Promise.all(
      Array.from(card.querySelectorAll('img')).map((image) => image.decode()),
    );
    const width = 500;
    const height = Math.ceil(card.getBoundingClientRect().height);
    const { toBlob } = await import('html-to-image');
    const png = await toBlob(card, {
      width,
      height,
      pixelRatio: 2,
      backgroundColor: design.background,
      style: {
        margin: '0',
        width: `${width}px`,
        maxWidth: 'none',
        boxShadow: 'none',
      },
    });
    if (!png)
      throw Error('The invitation could not be rendered. Please try again.');
    if (kind === 'png') return png;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: [127, 177.8] });
    const ratio = height / width;
    const printWidth = Math.min(117, 167.8 / ratio);
    if (link && (printWidth * 144) / width < 20)
      throw Error(
        'This card is too long for a scannable 5×7 print. Shorten the message or programme, or download PNG instead.',
      );
    pdf.addImage(
      new Uint8Array(await png.arrayBuffer()),
      'PNG',
      (127 - printWidth) / 2,
      (177.8 - printWidth * ratio) / 2,
      printWidth,
      printWidth * ratio,
    );
    return pdf.output('blob');
  } finally {
    root.unmount();
    stage.remove();
  }
}
export function saveInvitationBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function invitationFilename(name: string, id?: string) {
  return `yingira-${name.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 80) || 'guest'}${id ? `-${id}` : ''}`;
}
