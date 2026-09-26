import nodemailer from "nodemailer";

import User from "../models/user.js";
import Shop from "../models/shop.js";

let transporterInstance = null;

export const createTransporter = () => {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host =
    process.env.SMTP_HOST;

  const port =
    parseInt(
      process.env.SMTP_PORT,
      10
    ) || 587;

  const user =
    process.env.SMTP_USER;

  const pass =
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS;

  const secure =
    process.env.SMTP_SECURE === "true" ||
    port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  transporterInstance =
    nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

  return transporterInstance;
};

export const verifyEmailTransport =
  async () => {
    try {
      const transporter =
        createTransporter();

      if (!transporter) {
        return {
          isConnected: false,
          error:
            "SMTP configuration is missing",
        };
      }

      await transporter.verify();

      return {
        isConnected: true,
      };
    } catch (error) {
      console.error(
        "SMTP verification failed:",
        error.message
      );

      return {
        isConnected: false,
        error: error.message,
      };
    }
  };

export const resolveRecipient =
  async ({
    application,
    shop,
  }) => {
    try {
      let targetShop =
        shop || application?.shop;

      if (
        targetShop &&
        (!targetShop.owner ||
          typeof targetShop.owner ===
            "string")
      ) {
        targetShop =
          await Shop.findById(
            targetShop._id ||
              targetShop
          ).populate(
            "owner",
            "name email phone"
          );
      }

      let owner =
        targetShop?.owner;

      if (
        owner &&
        (!owner.email ||
          typeof owner === "string")
      ) {
        owner =
          await User.findById(
            owner._id || owner
          ).select(
            "name email phone"
          );
      }

      // Fallback to applicant
      if (
        !owner?.email &&
        application?.applicant
      ) {
        if (
          application.applicant.email
        ) {
          owner =
            application.applicant;
        } else {
          owner =
            await User.findById(
              application.applicant
                ._id ||
                application.applicant
            ).select(
              "name email phone"
            );
        }
      }

      if (!owner?.email) {
        return null;
      }

      return {
        _id: owner._id,
        name:
          owner.name ||
          "Valued Merchant",
        email: owner.email,
        phone: owner.phone,
      };
    } catch (error) {
      console.error(
        "Recipient resolution failed:",
        error.message
      );

      return null;
    }
  };

const formatDate = (date) => {
  if (!date) return "N/A";

  return new Date(
    date
  ).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
};

export const sendVerificationSuccessEmail =
  async ({
    application,
    certificate,
    instrument,
    shop,
    pdfPath,
  }) => {
    try {
      if (
        !certificate ||
        !certificate.certificateNumber
      ) {
        return {
          success: false,
          reason:
            "MISSING_CERTIFICATE",
        };
      }

      const recipient =
        await resolveRecipient({
          application,
          shop,
        });

      if (!recipient?.email) {
        return {
          success: false,
          reason:
            "MISSING_RECIPIENT_EMAIL",
        };
      }

      const transporter =
        createTransporter();

      if (!transporter) {
        return {
          success: false,
          reason:
            "SMTP_NOT_CONFIGURED",
        };
      }

      const attachments = [];

      // Attach locally generated PDF
      if (pdfPath) {
        attachments.push({
          filename:
            `Verification_Certificate_${certificate.certificateNumber}.pdf`,
          path: pdfPath,
          contentType:
            "application/pdf",
        });

        console.log(
          "Certificate PDF attached to email:",
          pdfPath
        );
      }

      const verificationDate =
        application?.verification?.date ||
        certificate.issueDate;

      const subject =
        `Verification Successful - ${
          instrument?.serialNumber ||
          "Instrument"
        }`;

      const text = `
Dear ${recipient.name},

Your instrument verification has been successfully completed.

Instrument: ${
        instrument?.category || "N/A"
      }

Serial Number: ${
        instrument?.serialNumber || "N/A"
      }

Verification Date: ${formatDate(
        verificationDate
      )}

Certificate Number: ${
        certificate.certificateNumber
      }

Valid Until: ${formatDate(
        certificate.validUntil
      )}

Your digital verification certificate is attached to this email.

Regards,

MaanakSetu
Legal Metrology Verification System
`;

      const result =
        await transporter.sendMail({
          from:
            process.env.SMTP_FROM ||
            process.env.SMTP_USER,

          to: recipient.email,

          subject,

          text,

          attachments,
        });

      console.log(
        `Verification email sent to ${recipient.email}`
      );

      return {
        success: true,
        recipientEmail:
          recipient.email,
        messageId:
          result.messageId,
        hasAttachment:
          attachments.length > 0,
      };
    } catch (error) {
      console.error(
        "Verification email failed:",
        error.message
      );

      return {
        success: false,
        error: error.message,
      };
    }
  };