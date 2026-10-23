import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { getRequestUiLocale } from '@/server/locale';
export const metadata: Metadata = { title: 'Nouveau mot de passe' };
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const [locale, params] = await Promise.all([getRequestUiLocale(), searchParams]); return <AuthForm mode="reset" token={params.token || ''} locale={locale} />; }
