import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/page-metadata';
import { NarrativesLibrary } from '@/components/narratives/narratives-library';

export const metadata: Metadata = {
  ...pageMetadata({ title: 'Zcash Pitches & Narratives · OpenZcash', description: '20 original OpenZcash pitches and eight ways to explain private digital money in English, Portuguese and Spanish.', path: '/narratives' }),
  alternates: { canonical: '/narratives', languages: { en: '/narratives?lang=en', 'pt-BR': '/narratives?lang=pt-BR', es: '/narratives?lang=es' } },
};

export default function NarrativesPage() {
  return <Suspense fallback={<p>Loading Zcash Pitches & Narratives…</p>}><NarrativesLibrary /></Suspense>;
}
