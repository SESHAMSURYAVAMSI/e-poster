import mongoose, { Schema, type Model } from "mongoose";

export type SubmissionFileType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "application/vnd.ms-powerpoint"
  | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  | "application/msword"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type SubmissionCategory =
  | "Clinical Research"
  | "Basic Science"
  | "Case Report"
  | "Public Health"
  | "Technology & Innovation"
  | "Other";

export type SubmissionStatus =
  | "submitted"
  | "under-review"
  | "accepted"
  | "rejected";

export interface SubmissionRecord {
  submissionId: string;
  authorName: string;
  email: string;
  institution: string;
  department: string;
  coAuthors: string;
  title: string;
  category: SubmissionCategory;
  abstract: string;
  keywords: string;
  fileId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: SubmissionFileType;
  fileSize: number;
  status: SubmissionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const FILE_TYPES: SubmissionFileType[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const SubmissionSchema = new Schema<SubmissionRecord>(
  {
    submissionId: { type: String, required: true, unique: true, index: true },
    authorName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 150 },
    institution: { type: String, required: true, trim: true, maxlength: 200 },
    department: { type: String, required: true, trim: true, maxlength: 150 },
    coAuthors: { type: String, default: "", maxlength: 500 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: {
      type: String,
      required: true,
      enum: ["Clinical Research", "Basic Science", "Case Report", "Public Health", "Technology & Innovation", "Other"],
    },
    abstract: { type: String, default: "", maxlength: 5000 },
    keywords: { type: String, default: "", maxlength: 300 },
    fileId: { type: Schema.Types.ObjectId, required: true },
    fileName: { type: String, required: true, maxlength: 255 },
    fileType: { type: String, required: true, enum: FILE_TYPES },
    fileSize: { type: Number, required: true, min: 1, max: 20 * 1024 * 1024 },
    status: {
      type: String,
      enum: ["submitted", "under-review", "accepted", "rejected"],
      default: "submitted",
      index: true,
    },
  },
  { timestamps: true, versionKey: false, collection: "submissions" },
);

SubmissionSchema.index({ createdAt: -1 });

const Submission: Model<SubmissionRecord> =
  (mongoose.models.Submission as Model<SubmissionRecord> | undefined) ??
  mongoose.model<SubmissionRecord>("Submission", SubmissionSchema, "submissions");

export default Submission;
