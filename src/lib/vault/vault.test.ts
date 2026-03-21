// Vault encryption/decryption round-trip test
import { encryptCredentials, decryptCredentials } from './encrypt';

// Set a test encryption secret
process.env.ENCRYPTION_SECRET = 'test-secret-key-for-vault-testing-only';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

// Test 1: Basic round-trip
const pgCreds = {
  host: 'db.example.com',
  port: '5432',
  database: 'analytics',
  username: 'admin',
  password: 'super-s3cret!@#$%',
  ssl: 'true',
};

const encrypted = encryptCredentials(pgCreds);
console.log(`Encrypted: ${encrypted}`);

const parts = encrypted.split(':');
assert(parts.length === 3, 'Encrypted string has 3 colon-separated parts (iv:authTag:data)');

const decrypted = decryptCredentials(encrypted);
console.log(`Decrypted: ${JSON.stringify(decrypted)}`);

assert(JSON.stringify(decrypted) === JSON.stringify(pgCreds), 'Decrypted credentials match original');

// Test 2: Different encryptions produce different ciphertexts (random IV)
const encrypted2 = encryptCredentials(pgCreds);
assert(encrypted !== encrypted2, 'Two encryptions of same data produce different ciphertexts (unique IV)');

const decrypted2 = decryptCredentials(encrypted2);
assert(JSON.stringify(decrypted2) === JSON.stringify(pgCreds), 'Second decryption also matches original');

// Test 3: Tampered ciphertext fails
try {
  const tampered = encrypted.slice(0, -2) + 'XX';
  decryptCredentials(tampered);
  assert(false, 'Tampered ciphertext should throw');
} catch {
  assert(true, 'Tampered ciphertext correctly throws error');
}

// Test 4: Missing ENCRYPTION_SECRET throws
const savedSecret = process.env.ENCRYPTION_SECRET;
delete process.env.ENCRYPTION_SECRET;
try {
  encryptCredentials({ key: 'value' });
  assert(false, 'Missing ENCRYPTION_SECRET should throw');
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : '';
  assert(msg.includes('ENCRYPTION_SECRET'), 'Missing secret throws descriptive error');
}
process.env.ENCRYPTION_SECRET = savedSecret;

// Test 5: Empty credentials object
const emptyCreds = {};
const encEmpty = encryptCredentials(emptyCreds);
const decEmpty = decryptCredentials(encEmpty);
assert(JSON.stringify(decEmpty) === '{}', 'Empty credentials round-trip works');

// Test 6: Special characters and unicode
const unicodeCreds = {
  password: '密码🔑páss→wörd<>&"\'',
  host: 'db.例え.com',
};
const encUnicode = encryptCredentials(unicodeCreds);
const decUnicode = decryptCredentials(encUnicode);
assert(JSON.stringify(decUnicode) === JSON.stringify(unicodeCreds), 'Unicode and special characters round-trip correctly');

console.log('\n✅ All vault tests passed!');
