import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { TenantSecretVault } from '../src/platform/secret-vault';

async function main(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    const userId = await rl.question('Tenant user ID: ');
    const username = await rl.question('BC.Game username: ');
    const password = await rl.question('BC.Game password: ');
    const totp = await rl.question('TOTP secret (blank to skip): ');
    if (!userId || !username || !password) {
      throw new Error('userId, username and password are required');
    }
    await new TenantSecretVault().store(userId.trim(), {
      username: username.trim(),
      password,
      totp: totp.trim() || undefined,
    });
    console.log('Credentials encrypted and stored.');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
