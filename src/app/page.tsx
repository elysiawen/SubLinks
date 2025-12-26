import { db } from '@/lib/db';
import HitokotoClient from './HitokotoClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '一言 · Hitokoto',
  description: '一言网，分享动漫、文学、影视、诗词等领域的句子',
};

// Disable automatic revalidation - cache indefinitely
// Cache will only be cleared when explicitly revalidated via API
export const revalidate = false;

export default async function Home() {
  const config = await db.getGlobalConfig();
  const customBg = config.customBackgroundUrl;

  return <HitokotoClient customBg={customBg} />;
}
