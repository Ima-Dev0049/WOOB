import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { getRequestUiLocale } from '@/server/locale';
export const metadata: Metadata = { title: 'Vérification email' };
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const [locale, params] = await Promise.all([getRequestUiLocale(), searchParams]); return <AuthForm mode="verify" token={params.token || ''} locale={locale} />; }
