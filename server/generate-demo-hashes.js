// Run with Node to produce salted seed hashes for the shared demo password.
import { randomBytes, scryptSync } from 'node:crypto';
const password = 'HostelDemo2026!';
const entries = ['owner1','owner2','owner3', ...Array.from({ length: 12 }, (_, index) => `student${index + 1}`)];
for (const account of entries) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  console.log(`${account}\t${`scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`}`);
}
