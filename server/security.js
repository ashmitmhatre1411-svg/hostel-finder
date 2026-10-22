import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLEL = 1;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: COST, r: BLOCK_SIZE, p: PARALLEL });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLEL}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [scheme, n, r, p, saltHex, hashHex] = String(encoded).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length,
    { N: Number(n), r: Number(r), p: Number(p) });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function newSessionToken() { return randomBytes(32).toString('base64url'); }
