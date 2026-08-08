// Crockford base32: no I, L, O or U, which are the characters users misread
// when transcribing a code from paper.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_CHARS = 32; // 32 chars x 5 bits = 160 bits of entropy
const GROUP = 4;

export const generateRecoveryCode = (): string => {
  // One random byte per character, masked to 5 bits. 256 is a multiple of 32,
  // so masking is unbiased -- no rejection sampling needed.
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_CHARS));
  let out = '';
  for (let i = 0; i < CODE_CHARS; i++) out += ALPHABET[bytes[i] & 0x1f];

  const groups: string[] = [];
  for (let i = 0; i < out.length; i += GROUP) groups.push(out.slice(i, i + GROUP));
  return groups.join('-');
};

export const normalizeRecoveryCode = (input: string): string =>
  input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');

export const isValidRecoveryCode = (input: string): boolean => {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== CODE_CHARS) return false;
  return [...normalized].every((ch) => ALPHABET.includes(ch));
};
