import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

function s3Config() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket || !process.env.S3_REGION || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) throw new Error('Configuration S3 incomplète.');
  return { bucket, client: new S3Client({ region: process.env.S3_REGION, ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}), forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } }) };
}
function localPath(key: string): string {
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || '.woob-uploads');
  const destination = path.resolve(root, key);
  if (!destination.startsWith(`${root}${path.sep}`)) throw new Error('Clé de stockage invalide.');
  return destination;
}
export async function putObject(key: string, data: Buffer, contentType: string): Promise<void> {
  if (process.env.STORAGE_DRIVER === 's3') {
    const { bucket, client } = s3Config();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType, ServerSideEncryption: 'AES256' }));
    return;
  }
  if (process.env.APP_ENV === 'production' && process.env.STORAGE_DRIVER !== 'file') throw new Error('Stockage de production non configuré.');
  const destination = localPath(key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data, { mode: 0o600 });
}
export async function getObject(key: string): Promise<Buffer> {
  if (process.env.STORAGE_DRIVER === 's3') {
    const { bucket, client } = s3Config();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await result.Body!.transformToByteArray());
  }
  return readFile(localPath(key));
}
export async function deleteObject(key: string): Promise<void> {
  if (process.env.STORAGE_DRIVER === 's3') {
    const { bucket, client } = s3Config();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await unlink(localPath(key)).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; });
}
