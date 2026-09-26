import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

console.log("DEBUG CHECK:", {
  cloud: process.env.CLOUDINARY_CLOUD_NAME || process.env.cloudinary_cloud_name,
  key: process.env.CLOUDINARY_API_KEY || process.env.cloudinary_api_key,
  secret: process.env.CLOUDINARY_API_SECRET || process.env.cloudinary_api_secret
});
cloudinary.config({
  cloud_name: process.env.cloudinary_cloud_name,
  api_key: process.env.cloudinary_api_key,
  api_secret: process.env.cloudinary_api_secret,
});

export const uploadPdfToCloudinary = async (
  filePath,
  certificateNumber
) => {
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "raw",
    folder: "maanak-setu/certificates",
    public_id: certificateNumber,
    format: "pdf",
  });

  return result.secure_url;
};