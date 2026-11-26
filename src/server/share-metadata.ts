import 'server-only';
import type { Metadata } from 'next';
import { designSchema } from '@/lib/planning';
import {
  shareDescription,
  sharePhotoId,
  shareTitle,
} from '@/lib/share-preview';
import { invitation } from './invitation';
import { appOrigin } from './config';

// Metadata for a guest invitation link. Without a photo the site-wide Yingira
// icon remains the preview image.
export async function invitationMetadata(
  token: string,
  pageUrl: string,
): Promise<Metadata> {
  let data;
  try {
    data = await invitation(token);
  } catch {
    return {};
  }
  if (!data) return {};
  const parsed = designSchema.safeParse(data.design);
  const design = parsed.success ? parsed.data : null;
  const title = shareTitle(design, data.title);
  const description = shareDescription(data, design);
  const photo = sharePhotoId(design);
  const image = photo
    ? {
        url: `${appOrigin()}/api/share-image?token=${token}&assetId=${photo}`,
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: title,
      }
    : null;
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'Yingira',
      url: pageUrl,
      title,
      description,
      ...(image && { images: [image] }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image && { images: [image.url] }),
    },
  };
}
