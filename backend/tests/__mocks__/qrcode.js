// Manual mock for qrcode
module.exports = {
  toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,mock"),
};
