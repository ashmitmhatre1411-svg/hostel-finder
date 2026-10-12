// Run with Node to produce salted seed hashes for the shared demo password.
import { randomBytes, scryptSync } from 'node:crypto';
const password = 'HostelDemo2026!';
const entries = ['student1','student2','student3','student4','student5','student6','student7','student8','student9','student10','student11','student12','system-admin','boys-admin','girls-admin','coed-admin'];
for (const account of entries) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  console.log(`${account}\t${`scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`}`);
}
