import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { getRequestUiLocale } from '@/server/locale';
export const metadata: Metadata = { title: 'Récupération du compte' };
export default async function ForgotPage() { return <AuthForm mode="forgot" locale={await getRequestUiLocale()} />; }
