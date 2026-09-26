import QRCode from "qrcode";

export const generateQrDataUrl = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 200,
    });
  } catch (error) {
    console.error(
      "QR Code generation failed:",
      error.message
    );

    throw error;
  }
};

export const buildVerificationUrl = (certificateNumber) => {
  const baseUrl =
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`;

  return `${baseUrl}/api/certificates/verify/${certificateNumber}`;
};