import path from 'node:path';
import os from 'node:os';
import chromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return;
  await inflate(path.join(process.cwd(), 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'));
  setupLambdaEnvironment(path.join(os.tmpdir(), 'al2023', 'lib'));
  await chromium.executablePath();
}
