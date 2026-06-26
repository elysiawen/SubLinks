import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'sublinks-oauth-token-v1'; // Fixed salt for key derivation

/**
 * Get the encryption key from environment variable.
 * Returns null if not configured (backward compatibility).
 */
function getEncryptionKey(): Buffer | null {
    const secret = process.env.OAUTH_TOKEN_SECRET;
    if (!secret || secret.length === 0) return null;
    // Derive a 32-byte key from the secret using scrypt
    return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a string using AES-256-GCM.
 * Returns the encrypted value as a base64 string in format: iv:authTag:ciphertext
 * Returns null if encryption is not configured (OAUTH_TOKEN_SECRET not set).
 */
export function encryptToken(plaintext: string): string | null {
    const key = getEncryptionKey();
    if (!key) return null;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Format: base64(iv):base64(authTag):base64(ciphertext)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string that was encrypted with encryptToken().
 * Returns the original plaintext, or the input as-is if it's not encrypted
 * (backward compatibility with plaintext tokens stored before encryption was enabled).
 */
export function decryptToken(encryptedValue: string): string {
    const key = getEncryptionKey();
    if (!key) return encryptedValue;

    // Check if the value looks like our encrypted format (iv:authTag:ciphertext)
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
        // Not encrypted format — return as-is (backward compatibility)
        return encryptedValue;
    }

    try {
        const iv = Buffer.from(parts[0], 'base64');
        const authTag = Buffer.from(parts[1], 'base64');
        const ciphertext = parts[2];

        if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
            // Invalid format — return as-is
            return encryptedValue;
        }

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch {
        // Decryption failed — likely a plaintext token, return as-is
        return encryptedValue;
    }
}

/**
 * Check if token encryption is configured.
 */
export function isEncryptionEnabled(): boolean {
    return getEncryptionKey() !== null;
}
