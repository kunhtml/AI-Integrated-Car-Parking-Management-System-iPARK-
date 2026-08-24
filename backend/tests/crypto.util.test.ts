import { decryptField, encryptField, fingerprintField } from "../src/utils/crypto.util.js";

describe("crypto util for protected ID card fields", () => {
  it("encrypts and decrypts the original CCCD value", () => {
    const plain = "123456789";
    const encrypted = encryptField(plain);

    expect(encrypted).not.toBe(plain);
    expect(encrypted).toContain(":");
    expect(decryptField(encrypted)).toBe(plain);
  });

  it("keeps a deterministic fingerprint for exact lookup", () => {
    const plain = "123456789";

    expect(fingerprintField(plain)).toHaveLength(64);
    expect(fingerprintField(plain)).toBe(fingerprintField("123456789"));
  });

  it("returns the original text for legacy unencrypted values and fails tampered ciphertext", () => {
    const legacy = "123456789";
    expect(decryptField(legacy)).toBe(legacy);

    const ciphertext = encryptField("987654321");
    const tampered = ciphertext.replace(/.$/, ciphertext.at(-1) === "A" ? "B" : "A");

    expect(() => decryptField(tampered)).toThrow();
  });
});
