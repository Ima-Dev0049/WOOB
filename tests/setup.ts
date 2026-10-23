import { afterEach, vi } from 'vitest';

process.env.APP_ENV = 'test';
process.env.AI_PROVIDER = 'demo';
process.env.EMAIL_DRIVER = 'file';
process.env.STORAGE_DRIVER = 'local';
process.env.WOOB_DATA_DIR = '.woob-test-data';
process.env.STORAGE_LOCAL_DIR = '.woob-test-storage';
process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = 'false';

afterEach(() => {
  vi.clearAllMocks();
});
