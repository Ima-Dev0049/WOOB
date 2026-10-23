import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { createId } from '@/lib/id';

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }): Promise<{ driver: string; id: string }> {
  const id = createId('email');
  if (process.env.EMAIL_DRIVER === 'smtp') {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      throw new Error('SMTP est sélectionné mais sa configuration est incomplète.');
    }
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
    await transport.sendMail({ from: process.env.EMAIL_FROM || 'Woob <no-reply@localhost>', to, subject, text });
    return { driver: 'smtp', id };
  }
  if (process.env.APP_ENV === 'production' && process.env.EMAIL_DRIVER !== 'file') {
    throw new Error('Aucun service email de production configuré.');
  }
  const directory = path.join(process.cwd(), '.woob-outbox');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${id}.txt`), `To: ${to}\nSubject: ${subject}\n\n${text}`, { mode: 0o600 });
  return { driver: 'file', id };
}
