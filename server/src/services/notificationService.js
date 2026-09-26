import Notification from "../models/notification.js";
import Certificate from "../models/certificate.js";

export const createNotification = async ({
  user,
  application = null,
  certificate = null,
  type,
  title,
  message,
  metadata = {},
  scheduledFor = null,
}) => {
  try {
    return await Notification.create({
      user,
      application,
      certificate,
      type,
      title,
      message,
      metadata,
      scheduledFor,
    });
  } catch (error) {
    console.error(
      "Failed to create notification:",
      error.message
    );

    return null;
  }
};

export const checkAndGenerateExpiryReminders =
  async () => {
    const now = new Date();

    const intervals = [30, 15, 7];

    const results = [];

    for (const days of intervals) {
      const targetStart = new Date(now);

      targetStart.setDate(
        targetStart.getDate() + days - 1
      );

      targetStart.setHours(0, 0, 0, 0);

      const targetEnd = new Date(now);

      targetEnd.setDate(
        targetEnd.getDate() + days
      );

      targetEnd.setHours(23, 59, 59, 999);

      const certificates =
        await Certificate.find({
          status: "ACTIVE",
          validUntil: {
            $gte: targetStart,
            $lte: targetEnd,
          },
        }).populate({
          path: "application",
          select: "applicant instrument",
          populate: {
            path: "applicant",
            select: "name email phone",
          },
        });

      for (const certificate of certificates) {
        const applicantId =
          certificate.application?.applicant?._id;

        if (!applicantId) continue;

        const existing =
          await Notification.findOne({
            user: applicantId,
            certificate: certificate._id,
            type: "EXPIRY_REMINDER",
            "metadata.reminderDays": days,
          });

        if (!existing) {
          const validUntil =
            new Date(
              certificate.validUntil
            ).toLocaleDateString("en-IN");

          const notification =
            await createNotification({
              user: applicantId,
              application:
                certificate.application._id,
              certificate:
                certificate._id,
              type: "EXPIRY_REMINDER",
              title: `Instrument Verification Expiry Reminder (${days} Days)`,
              message: `Verification Certificate ${certificate.certificateNumber} will expire in approximately ${days} days on ${validUntil}. Please submit a re-verification application before expiry.`,
              metadata: {
                reminderDays: days,
                certificateNumber:
                  certificate.certificateNumber,
              },
            });

          results.push(notification);
        }
      }
    }

    const expiredCount =
      await Certificate.updateMany(
        {
          status: "ACTIVE",
          validUntil: {
            $lt: now,
          },
        },
        {
          $set: {
            status: "EXPIRED",
          },
        }
      );

    return {
      generatedCount: results.length,
      markedExpiredCount:
        expiredCount.modifiedCount || 0,
    };
  };