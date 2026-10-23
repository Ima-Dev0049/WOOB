import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { getRequestUiLocale } from '@/server/locale';
export const metadata: Metadata = { title: 'Connexion' };
export default async function LoginPage() { return <AuthForm mode="login" locale={await getRequestUiLocale()} />; }
