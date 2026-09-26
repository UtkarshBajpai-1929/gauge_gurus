import Application from "../models/application.js";
import Shop from "../models/shop.js";
import Instrument from "../models/instrument.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { generateApplicationNumber } from "../utils/idGenerator.js";
import { validateTransition } from "../services/workflowService.js";
import { issueCertificateForApplication } from "../services/certificateService.js";
import { createNotification } from "../services/notificationService.js";
import { processUploadedFile } from "../middleware/uploadMiddleware.js";
import { safeJsonParse, toAbsoluteUrl } from "../utils/urlHelper.js";
import User from "../models/user.js";

/*
|--------------------------------------------------------------------------
| CREATE APPLICATION
|--------------------------------------------------------------------------
*/

export const createApplication = async (req, res, next) => {
  console.log("Application create hit")
  try {
    const {
      shop,
      instrument,
      reason,
      remarks,
    } = req.body;
    console.log(req.body);
    if (!shop || !instrument) {
      throw new ApiError(
        400,
        "Please provide shop and instrument"
      );
    }

    // Check shop
    const shopDoc = await Shop.findById(shop);

    if (!shopDoc) {
      throw new ApiError(404, "Shop not found");
    }

    // Check shop ownership
    if (
      req.user.role === "USER" &&
      shopDoc.owner.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not own this shop");
    }

    // Check instrument
    const instrumentDoc = await Instrument.findById(instrument);

    if (!instrumentDoc) {
      throw new ApiError(404, "Instrument not found");
    }

    // Check instrument belongs to shop
    if (instrumentDoc.shop.toString() !== shopDoc._id.toString()) {
      throw new ApiError(
        400,
        "Instrument does not belong to the specified shop"
      );
    }

    // Check existing active application
    const activeApp = await Application.findOne({
      instrument: instrumentDoc._id,
      status: {
        $in: [
          "SUBMITTED",
          "UNDER_REVIEW",
          "SCHEDULED",
          "VERIFIED",
        ],
      },
    });

    if (activeApp) {
      throw new ApiError(
        400,
        `An active application (${activeApp.applicationNumber}) already exists for this instrument`
      );
    }

    // Documents
    const documents = [];

    // Direct Cloudinary URL
    if (req.body.documentUrl) {
      documents.push({
        title: req.body.documentTitle || "Supporting Document",
        url: req.body.documentUrl,
      });
    }

    // Multiple documents
    if (req.body.documents) {
      const parsedDocs = safeJsonParse(req.body.documents, []);

      if (Array.isArray(parsedDocs)) {
        parsedDocs.forEach((doc) => {
          if (doc && (typeof doc === "string" || doc.url)) {
            documents.push({
              title: doc.title || "Supporting Document",
              url: typeof doc === "string" ? doc : doc.url,
            });
          }
        });
      }
    }

    // Uploaded file
    if (req.file) {
      const url = await processUploadedFile(
        req.file,
        "applications"
      );

      documents.push({
        title: req.body.documentTitle || "Supporting Document",
        url,
      });
    }

    // Generate application number
    const applicationNumber = generateApplicationNumber();
    console.log(applicationNumber);
    // Create application
    const application = await Application.create({
      applicationNumber,
      applicant: req.user._id,
      shop: shopDoc._id,
      instrument: instrumentDoc._id,
      reason,
      status: "SUBMITTED",
      remarks,
      documents,
    });

    // Update instrument status
    instrumentDoc.status = "SUBMITTED";
    await instrumentDoc.save();

    // Notify applicant
    await createNotification({
      user: req.user._id,
      application: application._id,
      type: "APPLICATION_UPDATE",
      title: "Application Submitted",
      message: `Your application ${applicationNumber} for instrument verification has been submitted successfully.`,
    });

    return sendSuccess(
      res,
      201,
      "Application submitted successfully",
      application
    );
  } catch (error) {
    next(error);
  }
};


/*
|--------------------------------------------------------------------------
| GET APPLICATIONS
|--------------------------------------------------------------------------
*/

export const getApplications = async (req, res, next) => {
  try {
    let query = {
      status: { $ne: "VERIFIED" },
    };

    if (req.user.role === "USER") {
      query.applicant = req.user._id;
    }

    if (req.user.role === "OFFICER") {
      const officer = await User.findById(req.user._id)
        .select("pin_code");

      if (!officer) {
        throw new ApiError(404, "Officer not found");
      }

      if (!officer.pin_code) {
        throw new ApiError(
          400,
          "Pincode is not assigned to this officer"
        );
      }

      const shops = await Shop.find({
        pincode: officer.pin_code,
        isActive: true,
      }).select("_id");

      const shopIds = shops.map((shop) => shop._id);

      query.shop = { $in: shopIds };
    }

    const applications = await Application.find(query)
      .populate("applicant", "name email phone")
      .populate(
        "shop",
        "shopName licenseNumber pincode address owner gstNumber"
      )
      .populate(
        "instrument",
        "category serialNumber capacity installationType status"
      )
      .populate(
        "assignedOfficer",
        "name email phone role pin_code"
      )
      .sort({ createdAt: -1 });

    if (req.user.role === "OFFICER") {
      const groupedApplications = {};

      applications.forEach((application) => {
        const shopId = application.shop._id.toString();

        if (!groupedApplications[shopId]) {
          groupedApplications[shopId] = {
            shop: application.shop,
            applications: [],
          };
        }

        groupedApplications[shopId].applications.push(application);
      });

      return sendSuccess(
        res,
        200,
        "Applications retrieved successfully",
        Object.values(groupedApplications)
      );
    }

    return sendSuccess(
      res,
      200,
      "Applications retrieved successfully",
      applications
    );
  } catch (error) {
    next(error);
  }
};
/*
|--------------------------------------------------------------------------
| GET APPLICATION BY ID
|--------------------------------------------------------------------------
*/

export const getApplicationById = async (
  req,
  res,
  next
) => {
  try {
    const application = await Application.findById(
      req.params.id
    )
      .populate(
        "applicant",
        "name email phone aadhar_no address"
      )
      .populate("shop")
      .populate("instrument")
      .populate(
        "assignedOfficer",
        "name email phone role"
      );

    if (!application) {
      throw new ApiError(
        404,
        "Application not found"
      );
    }

    // USER can only view their own application
    if (
      req.user.role === "USER" &&
      application.applicant._id.toString() !==
        req.user._id.toString()
    ) {
      throw new ApiError(
        403,
        "You do not have permission to view this application"
      );
    }

    return sendSuccess(
      res,
      200,
      "Application retrieved successfully",
      application
    );
  } catch (error) {
    next(error);
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE APPLICATION
|--------------------------------------------------------------------------
*/

export const updateApplication = async (
  req,
  res,
  next
) => {
  try {
    const application = await Application.findById(
      req.params.id
    );

    if (!application) {
      throw new ApiError(
        404,
        "Application not found"
      );
    }

    // USER can only modify their own application
    if (
      req.user.role === "USER" &&
      application.applicant.toString() !==
        req.user._id.toString()
    ) {
      throw new ApiError(
        403,
        "You do not have permission to modify this application"
      );
    }

    const { remarks, reason } = req.body;

    if (remarks) {
      application.remarks = remarks;
    }

    if (reason) {
      application.reason = reason;
    }

    // Direct document URL
    if (req.body.documentUrl) {
      application.documents.push({
        title:
          req.body.documentTitle ||
          "Additional Document",
        url: req.body.documentUrl,
      });
    }

    // Multiple documents
    if (req.body.documents) {
      const parsedDocs = safeJsonParse(
        req.body.documents,
        []
      );

      if (Array.isArray(parsedDocs)) {
        parsedDocs.forEach((doc) => {
          if (
            doc &&
            (typeof doc === "string" || doc.url)
          ) {
            application.documents.push({
              title:
                doc.title ||
                "Additional Document",
              url:
                typeof doc === "string"
                  ? doc
                  : doc.url,
            });
          }
        });
      }
    }

    // Uploaded document
    if (req.file) {
      const url = await processUploadedFile(
        req.file,
        "applications"
      );

      application.documents.push({
        title:
          req.body.documentTitle ||
          "Additional Document",
        url,
      });
    }

    await application.save();

    return sendSuccess(
      res,
      200,
      "Application updated successfully",
      application
    );
  } catch (error) {
    next(error);
  }
};


/*
|--------------------------------------------------------------------------
| UPDATE APPLICATION STATUS
|--------------------------------------------------------------------------
*/

export const updateApplicationStatus = async (
  req,
  res,
  next
) => {
  try {
    const { status, remarks } = req.body;

    if (!status) {
      throw new ApiError(
        400,
        "Status is required"
      );
    }

    const application = await Application.findById(
      req.params.id
    );

    if (!application) {
      throw new ApiError(
        404,
        "Application not found"
      );
    }

    validateTransition(
      application.status,
      status
    );

    application.status = status;

    if (remarks) {
      application.remarks = remarks;
    }

    await application.save();

    await createNotification({
      user: application.applicant,
      application: application._id,
      type: "APPLICATION_UPDATE",
      title: "Application Status Update",
      message: `Your application ${application.applicationNumber} status changed to ${status}.`,
    });

    return sendSuccess(
      res,
      200,
      `Application status updated to ${status}`,
      application
    );
  } catch (error) {
    next(error);
  }
};


/*
|--------------------------------------------------------------------------
| SUBMIT VERIFICATION RESULT
|--------------------------------------------------------------------------
*/

export const submitVerificationResult = async (req, res, next) => {
  try {
    const { id } = req.params
    const application = await Application.findById(id)
      .populate("instrument")
      .populate("applicant")
      .populate("shop");

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    // Check officer jurisdiction
    if (
      req.user.pin_code &&
      application.shop?.pincode &&
      String(application.shop.pincode).trim() !==
        String(req.user.pin_code).trim()
    ) {
      throw new ApiError(
        403,
        "You do not have jurisdiction to verify this application"
      );
    }

    // Mark as verified
    application.status = "VERIFIED";

    application.assignedOfficer = req.user._id;

    application.verification = {
      date: new Date(),
      officer: req.user._id,
      condition: "SATISFACTORY",
      result: "PASS",
      remarks: "Verified successfully",
      photographs: [],
    };

    await application.save();

    // Generate certificate + QR + notification + email
    const certificate = await issueCertificateForApplication(
      application._id,
      req.user
    );

    const updatedApplication = await Application.findById(application._id);

    return sendSuccess(
      res,
      200,
      "Application verified and certificate issued successfully",
      {
        application: updatedApplication,
        certificate,
      }
    );
  } catch (error) {
    next(error);
  }
};


/*
|--------------------------------------------------------------------------
| REJECT APPLICATION
|--------------------------------------------------------------------------
*/

export const rejectApplication = async (
  req,
  res,
  next
) => {
  try {
    const {
      rejectionReason,
      remarks,
    } = req.body;

    if (!rejectionReason) {
      throw new ApiError(
        400,
        "Rejection reason is required"
      );
    }

    const application =
      await Application.findById(
        req.params.id
      ).populate("instrument");

    if (!application) {
      throw new ApiError(
        404,
        "Application not found"
      );
    }

    application.status = "REJECTED";

    application.rejectionReason =
      rejectionReason;

    if (remarks) {
      application.remarks = remarks;
    }

    await application.save();

    // Update instrument status
    if (application.instrument) {
      await Instrument.findByIdAndUpdate(
        application.instrument._id,
        {
          status: "REJECTED",
        }
      );
    }

    // Notify applicant
    await createNotification({
      user: application.applicant,
      application: application._id,
      type: "REJECTED",
      title: "Application Rejected",
      message: `Your application ${application.applicationNumber} has been rejected. Reason: ${rejectionReason}`,
    });

    return sendSuccess(
      res,
      200,
      "Application rejected successfully",
      application
    );
  } catch (error) {
    next(error);
  }
};

export const getShopApplications = async (req, res, next) => {
  try {
    if (!req.user) {
      throw new ApiError(401, "Unauthorised request");
    }

    if (req.user.role !== "OFFICER") {
      throw new ApiError(
        403,
        "Only officers can access this resource"
      );
    }

    const officer = await User.findById(req.user._id)
      .select("pin_code");

    if (!officer) {
      throw new ApiError(404, "Officer not found");
    }

    if (!officer.pin_code) {
      throw new ApiError(
        400,
        "Pincode is not assigned to this officer"
      );
    }

    const shop = await Shop.findOne({
      _id: req.params.shopId,
      pincode: officer.pin_code,
      isActive: true,
    });

    if (!shop) {
      throw new ApiError(
        404,
        "Shop not found or not assigned to this officer"
      );
    }

    const applications = await Application.find({
      shop: shop._id,
      status: { $ne: "VERIFIED" },
    })
      .populate(
        "instrument",
        "category serialNumber capacity installationType status"
      )
      .populate(
        "applicant",
        "name email phone"
      )
      .sort({ createdAt: -1 });

    return sendSuccess(
      res,
      200,
      "Shop applications retrieved successfully",
      applications
    );
  } catch (error) {
    next(error);
  }
};