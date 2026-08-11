/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Stub out otplib & qrcode (không cần trong unit test auth)
    "^otplib$": "<rootDir>/tests/__mocks__/otplib.js",
    "^qrcode$": "<rootDir>/tests/__mocks__/qrcode.js",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: "./tsconfig.test.json",
      },
    ],
  },
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  clearMocks: true,
};
