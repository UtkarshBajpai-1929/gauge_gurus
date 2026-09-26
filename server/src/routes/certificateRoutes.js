// import express from "express";
// import {
//   getCertificates,
//   getCertificateById,
//   verifyCertificatePublic,
// } from "../controllers/certificateController.js";
// import { requireAuth } from "../middleware/authMiddleware.js";
// import { validateObjectId } from "../middleware/validateMiddleware.js";

// const router = express.Router();

// // Public verification endpoint - no authentication required
// router.get("/verify/:certificateNumber", verifyCertificatePublic);

// // Authenticated endpoints
// router.get("/", requireAuth, getCertificates);
// router.get("/:id", requireAuth, validateObjectId("id"), getCertificateById);
// // router.get("/:id/download", requireAuth, validateObjectId("id"), downloadCertificatePdf);

// export default router;

import express from "express";

import {
  getMyCertificates,
  getMyCertificateById,
} from "../controllers/certificateController.js";

import { requireAuth } from "../middleware/authMiddleware.js";
import { validateObjectId } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.get(
  "/my",
  requireAuth,
  getMyCertificates
);

router.get(
  "/my/:id",
  requireAuth,
  validateObjectId("id"),
  getMyCertificateById
);

export default router;
