import Certificate from "../models/certificate.js";
import Application from "../models/application.js";
import ApiError from "../utils/apiError.js";

export const getMyCertificates = async (req, res, next) => {
  try {
    const applications = await Application.find({
      applicant: req.user._id,
    }).select("_id");

    const applicationIds = applications.map(
      (application) => application._id
    );

    const certificates = await Certificate.find({
      application: { $in: applicationIds },
    })
      .populate(
        "instrument",
        "category serialNumber capacity installationType status"
      )
      .populate({
        path: "application",
        select: "applicationNumber shop",
        populate: {
          path: "shop",
          select: "shopName licenseNumber address pincode",
        },
      })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Certificates retrieved successfully",
      data: certificates,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyCertificateById = async (
  req,
  res,
  next
) => {
  try {
    const { id } = req.params;

    const certificate = await Certificate.findById(id)
      .populate(
        "instrument",
        "category serialNumber capacity installationType status"
      )
      .populate({
        path: "application",
        select:
          "applicationNumber applicant shop verification",
        populate: [
          {
            path: "applicant",
            select: "name email phone",
          },
          {
            path: "shop",
            select:
              "shopName licenseNumber address pincode",
          },
        ],
      });

    if (!certificate) {
      throw new ApiError(
        404,
        "Certificate not found"
      );
    }

    // USER can only access their own certificate
    if (
      req.user.role === "USER" &&
      certificate.application?.applicant?._id.toString() !==
        req.user._id.toString()
    ) {
      throw new ApiError(
        403,
        "You are not authorized to view this certificate"
      );
    }

    return res.status(200).json({
      success: true,
      message: "Certificate retrieved successfully",
      data: certificate,
    });
  } catch (error) {
    next(error);
  }
};