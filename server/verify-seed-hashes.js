// Check every account hash embedded in seed.sql against the advertised demo password.
import { readFile } from 'node:fs/promises';
import { verifyPassword } from './security.js';

const sql = await readFile(new URL('../database/seed.sql', import.meta.url), 'utf8');
const hashes = [...new Set(sql.match(/scrypt\$16384\$8\$1\$[0-9a-f]+\$[0-9a-f]+/g) || [])];
const valid = await Promise.all(hashes.map(hash => verifyPassword('HostelDemo2026!', hash)));
console.log(`Verified ${valid.filter(Boolean).length}/${hashes.length} unique seeded password hashes.`);
valid.forEach((ok, index) => { if (!ok) console.log(`Invalid seed hash at insertion order ${index + 1}.`); });
if (!hashes.length || valid.some(ok => !ok)) process.exitCode = 1;
