import crypto from "crypto";
import fs from "fs";

import Certificate from "../models/certificate.js";
import Application from "../models/application.js";
import Instrument from "../models/instrument.js";

import ApiError from "../utils/apiError.js";

import {
  generateCertificateNumber,
  generateStampCode,
} from "../utils/idGenerator.js";

import {
  calculateCertificateDates,
} from "./validityService.js";

import {
  buildVerificationUrl,
  generateQrDataUrl,
} from "./qrService.js";

import {
  generateCertificatePdf,
} from "./pdfService.js";

import {
  uploadPdfToCloudinary,
} from "./cloudinaryService.js";

import {
  createNotification,
} from "./notificationService.js";

import {
  sendVerificationSuccessEmail,
} from "./emailService.js";

export const issueCertificateForApplication = async (
  applicationId,
  officerUser
) => {
  const application = await Application.findById(
    applicationId
  )
    .populate(
      "applicant",
      "name email phone"
    )
    .populate({
      path: "shop",
      populate: {
        path: "owner",
        select: "name email phone",
      },
    })
    .populate("instrument")
    .populate(
      "assignedOfficer",
      "name email phone role pin_code"
    );

  if (!application) {
    throw new ApiError(
      404,
      "Application not found"
    );
  }

  if (application.status !== "VERIFIED") {
    throw new ApiError(
      400,
      `Cannot issue certificate. Application must be VERIFIED, but is currently ${application.status}`
    );
  }

  // Prevent duplicate certificate
  const existingCertificate =
    await Certificate.findOne({
      application: application._id,
      status: "ACTIVE",
    });

  if (existingCertificate) {
    return existingCertificate;
  }

  const certificateNumber =
    generateCertificateNumber();

  const stampCode =
    generateStampCode();

  const verificationDate =
    application.verification?.date ||
    new Date();

  const {
    validFrom,
    validUntil,
  } = calculateCertificateDates(
    application.instrument.category,
    verificationDate
  );

  // Generate QR
  const verificationUrl =
    buildVerificationUrl(
      certificateNumber
    );

  const qrCodeDataUrl =
    await generateQrDataUrl(
      verificationUrl
    );

  // Generate digital signature
  const digitalSignature = crypto
    .createHmac(
      "sha256",
      process.env.JWT_SECRET ||
        "maanak_setu_secret"
    )
    .update(
      `${certificateNumber}-${application._id}-${stampCode}-${validUntil.toISOString()}`
    )
    .digest("hex");

  // Create certificate
  const certificate = new Certificate({
    certificateNumber,
    application: application._id,
    instrument:
      application.instrument._id,
    issueDate: new Date(),
    validFrom,
    validUntil,
    stampCode,
    certificateType: "VERIFICATION",
    qrCode: qrCodeDataUrl,
    digitalSignature,
    status: "ACTIVE",
  });

  await certificate.save();

  // Keep local PDF path until email is sent
  let pdfPath = null;

  // Generate PDF and upload to Cloudinary
  try {
    pdfPath =
      await generateCertificatePdf({
        certificate,
        application,
        instrument:
          application.instrument,
        shop: application.shop,
        officer:
          officerUser ||
          application.assignedOfficer,
        qrDataUrl: qrCodeDataUrl,
      });

    console.log(
      "Certificate PDF generated:",
      pdfPath
    );

    const pdfUrl =
      await uploadPdfToCloudinary(
        pdfPath,
        certificate.certificateNumber
      );

    certificate.pdfUrl = pdfUrl;

    await certificate.save();

    console.log(
      "Certificate PDF uploaded:",
      pdfUrl
    );
  } catch (error) {
    console.error(
      "Certificate PDF generation/upload failed:",
      error.message
    );
  }

  // Instrument is verified
  await Instrument.findByIdAndUpdate(
    application.instrument._id,
    {
      status: "VERIFIED",
    }
  );

  // Notification
  await createNotification({
    user:
      application.applicant._id,
    application:
      application._id,
    certificate:
      certificate._id,
    type: "CERTIFICATE_ISSUED",
    title:
      "Verification Certificate Issued",
    message:
      `Digital Verification Certificate ${certificate.certificateNumber} has been issued for instrument ${application.instrument.serialNumber}.`,
  });

  // Email
  const emailResult =
    await sendVerificationSuccessEmail({
      application,
      certificate,
      instrument:
        application.instrument,
      shop: application.shop,
      officer:
        officerUser ||
        application.assignedOfficer,
      pdfPath,
    });

  console.log(
    "EMAIL RESULT:",
    emailResult
  );

  // Delete temporary PDF only after email attempt
  if (pdfPath) {
    try {
      await fs.promises.unlink(
        pdfPath
      );

      console.log(
        "Temporary certificate PDF deleted"
      );
    } catch (error) {
      console.error(
        "Failed to delete temporary certificate PDF:",
        error.message
      );
    }
  }

  return certificate;
};