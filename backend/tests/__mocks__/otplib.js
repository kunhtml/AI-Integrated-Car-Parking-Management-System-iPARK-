// Manual mock for otplib
module.exports = {
  generateSecret: jest.fn().mockReturnValue("MOCK_TOTP_SECRET"),
  generateURI: jest.fn().mockReturnValue("otpauth://totp/mock"),
  verifySync: jest.fn().mockReturnValue({ valid: true }),
};
