import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    instrument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instrument",
      required: true,
    },

    // reason: {
    //   type: String,
    //   enum: [
    //     "ROUTINE_EXPIRY",
    //     "REPAIR",
    //     "DISMANTLING",
    //     "REINSTALLATION",
    //   ],
    // },

    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "SCHEDULED",
        "VERIFIED",
        "REJECTED",
        "CERTIFICATE_ISSUED",
        "COMPLETED",
      ],
      default: "SUBMITTED",
    },

    remarks: {
      type: String,
      trim: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    documents: [
      {
        title: String,
        url: {
          type: String,
        },
      },
    ],

    verification: {
      date: Date,

      officer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },

      condition: {
        type: String,
        trim: true,
      },

      result: {
        type: String,
        enum: ["PASS", "FAIL"],
      },

      remarks: {
        type: String,
        trim: true,
      },

      photographs: [String],
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model("Application", applicationSchema);

export default Application;