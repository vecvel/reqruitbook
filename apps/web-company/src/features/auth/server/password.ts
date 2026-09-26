import "server-only";

import { scrypt, randomBytes, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_OPTIONS = {
  cost: 16384, // N
  blockSize: 8, // r
  parallelization: 1, // p
};

function deriveScryptKey(
  password: string,
  salt: string,
  keylen: number,
  cost = SCRYPT_OPTIONS.cost,
  blockSize = SCRYPT_OPTIONS.blockSize,
  parallelization = SCRYPT_OPTIONS.parallelization,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keylen,
      { cost, blockSize, parallelization },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      },
    );
  });
}

/**
 * Hashes a plaintext password using Node.js crypto scrypt with unique salt.
 * Output format: "scrypt:N:r:p:saltHex:hashHex"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = await deriveScryptKey(password, salt, KEY_LENGTH);

  return `scrypt:${SCRYPT_OPTIONS.cost}:${SCRYPT_OPTIONS.blockSize}:${SCRYPT_OPTIONS.parallelization}:${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time.
 */
export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  if (!storedHash) {
    // Perform dummy scrypt operation to prevent timing-based user enumeration attacks
    const dummySalt = "0123456789abcdef0123456789abcdef";
    await deriveScryptKey("dummy_password_for_constant_timing", dummySalt, KEY_LENGTH);
    return false;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const cost = parseInt(parts[1], 10);
  const blockSize = parseInt(parts[2], 10);
  const parallelization = parseInt(parts[3], 10);
  const salt = parts[4];
  const expectedHashHex = parts[5];

  const derivedKey = await deriveScryptKey(
    password,
    salt,
    KEY_LENGTH,
    cost,
    blockSize,
    parallelization,
  );

  const expectedBuffer = Buffer.from(expectedHashHex, "hex");

  if (derivedKey.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedBuffer);
}
