import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateCertificatePdf = async ({
  certificate,
  application,
  instrument,
  shop,
  officer,
  qrDataUrl,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const tempDir = path.resolve(process.cwd(), "temp");

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, {
          recursive: true,
        });
      }

      const fileName = `${certificate.certificateNumber}.pdf`;
      const filePath = path.join(tempDir, fileName);

      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
      });

      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Border
      doc
        .rect(
          20,
          20,
          doc.page.width - 40,
          doc.page.height - 40
        )
        .lineWidth(2)
        .strokeColor("#1A365D")
        .stroke();

      doc
        .rect(
          24,
          24,
          doc.page.width - 48,
          doc.page.height - 48
        )
        .lineWidth(0.5)
        .strokeColor("#2B6CB0")
        .stroke();

      // Header
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .fillColor("#1A365D")
        .text("GOVERNMENT OF INDIA", {
          align: "center",
        });

      doc
        .fontSize(12)
        .fillColor("#2B6CB0")
        .text("DEPARTMENT OF LEGAL METROLOGY", {
          align: "center",
        });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4A5568")
        .text(
          "Under Legal Metrology Act, 2009 & Legal Metrology (General) Rules, 2011",
          { align: "center" }
        );

      doc.moveDown(0.8);

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#2C5282")
        .text("CERTIFICATE OF VERIFICATION", {
          align: "center",
        });

      doc
        .fontSize(10)
        .fillColor(
          certificate.status === "ACTIVE"
            ? "#22543D"
            : "#742A2A"
        )
        .text(`[ STATUS: ${certificate.status} ]`, {
          align: "center",
        });

      doc.moveDown(0.8);

      // Certificate information
      const bannerTop = doc.y;

      doc
        .rect(
          40,
          bannerTop,
          doc.page.width - 80,
          50
        )
        .fillColor("#EDF2F7")
        .fill();

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor("#1A202C")
        .text(
          `Certificate No: ${certificate.certificateNumber}`,
          50,
          bannerTop + 10
        );

      doc
        .font("Helvetica")
        .text(
          `Stamp Code: ${certificate.stampCode}`,
          320,
          bannerTop + 10
        );

      const issueDateStr = new Date(
        certificate.issueDate
      ).toLocaleDateString("en-IN");

      const validUntilStr = new Date(
        certificate.validUntil
      ).toLocaleDateString("en-IN");

      doc.text(
        `Issue Date: ${issueDateStr}`,
        50,
        bannerTop + 30
      );

      doc.text(
        `Valid Until: ${validUntilStr}`,
        320,
        bannerTop + 30
      );

      doc.y = bannerTop + 65;

      // Shop
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1A365D")
        .text("1. ESTABLISHMENT DETAILS", 40);

      doc.moveDown(0.2);

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#2D3748");

      doc.text(
        `Name of Shop / Establishment: ${
          shop?.shopName || "N/A"
        }`,
        50
      );

      doc.text(
        `License Number: ${
          shop?.licenseNumber || "N/A"
        }`,
        50
      );

      doc.text(
        `Address: ${shop?.address || "N/A"}`,
        50
      );

      doc.moveDown(0.8);

      // Instrument
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1A365D")
        .text("2. INSTRUMENT SPECIFICATIONS", 40);

      doc.moveDown(0.2);

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#2D3748");

      doc.text(
        `Category: ${instrument?.category || "N/A"}`,
        50
      );

      doc.text(
        `Serial Number: ${
          instrument?.serialNumber || "N/A"
        }`,
        50
      );

      doc.text(
        `Capacity: ${instrument?.capacity || "N/A"}`,
        50
      );

      doc.text(
        `Installation Type: ${
          instrument?.installationType || "N/A"
        }`,
        50
      );

      if (instrument?.modelApprovalCertificateNumber) {
        doc.text(
          `Model Approval No: ${instrument.modelApprovalCertificateNumber}`,
          50
        );
      }

      doc.moveDown(0.8);

      // Verification
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1A365D")
        .text(
          "3. VERIFICATION & INSPECTION SUMMARY",
          40
        );

      doc.moveDown(0.2);

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#2D3748");

      const verificationDate =
        application?.verification?.date
          ? new Date(
              application.verification.date
            ).toLocaleDateString("en-IN")
          : issueDateStr;

      doc.text(
        `Verification Date: ${verificationDate}`,
        50
      );

      doc.text(
        `Verification Outcome: ${
          application?.verification?.result || "PASS"
        }`,
        50
      );

      doc.text(
        `Condition: ${
          application?.verification?.condition ||
          "SATISFACTORY"
        }`,
        50
      );

      doc.text(
        `Verified By Officer: ${
          officer?.name ||
          "Designated Legal Metrology Officer"
        }`,
        50
      );

      doc.text(
        "Verification Authority: Department of Legal Metrology",
        50
      );

      // QR
      if (qrDataUrl) {
        try {
          const base64Data = qrDataUrl.replace(
            /^data:image\/png;base64,/,
            ""
          );

          const qrBuffer = Buffer.from(
            base64Data,
            "base64"
          );

          const qrX = doc.page.width - 160;
          const qrY = doc.page.height - 210;

          doc.image(qrBuffer, qrX, qrY, {
            width: 110,
            height: 110,
          });

          doc
            .fontSize(7)
            .font("Helvetica")
            .fillColor("#4A5568")
            .text(
              "Scan to verify genuineness",
              qrX,
              qrY + 115,
              {
                width: 110,
                align: "center",
              }
            );
        } catch (error) {
          console.warn(
            "Could not embed QR code:",
            error.message
          );
        }
      }

      // Signature
      const sigY = doc.page.height - 150;

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor("#1A365D")
        .text(
          "Digital Signature & Verification Seal",
          50,
          sigY
        );

      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#4A5568")
        .text(
          `Digitally verified under the authority of the Controller of Legal Metrology.
Digital Signature ID: ${
            certificate.digitalSignature ||
            `MAANAK-DIGI-SIG-${certificate.certificateNumber}`
          }`,
          50,
          sigY + 15,
          {
            width: 320,
          }
        );

      // Footer
      doc
        .fontSize(7)
        .font("Helvetica-Oblique")
        .fillColor("#718096")
        .text(
          "This is a system-generated digital certificate issued under the Legal Metrology Act, 2009.",
          40,
          doc.page.height - 50,
          {
            align: "center",
            width: doc.page.width - 80,
          }
        );

      doc.end();

      writeStream.on("finish", () => {
        resolve(filePath);
      });

      writeStream.on("error", (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};