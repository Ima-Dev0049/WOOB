import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';
import { getRequestUiLocale } from '@/server/locale';
export const metadata: Metadata = { title: 'Créer un compte' };
export default async function RegisterPage() { return <AuthForm mode="register" locale={await getRequestUiLocale()} />; }
