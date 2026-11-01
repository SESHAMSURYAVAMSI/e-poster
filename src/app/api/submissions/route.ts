import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { z } from "zod";
import connectDB from "@/lib/mongodb";
import Submission, {
  type SubmissionFileType,
} from "@/models/Submission";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const FILE_MIME_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const satisfies Record<string, SubmissionFileType>;

type AllowedMimeType = (typeof FILE_MIME_TYPES)[keyof typeof FILE_MIME_TYPES];

const ALLOWED_MIME_TYPES = new Set<string>(Object.values(FILE_MIME_TYPES));
const ALLOWED_EXTENSIONS = Object.keys(FILE_MIME_TYPES);

const fieldsSchema = z.object({
  authorName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  institution: z.string().trim().min(2).max(200),
  department: z.string().trim().min(2).max(150),
  coAuthors: z.string().max(500).optional().default(""),
  title: z.string().trim().min(5).max(200),
  category: z.enum([
    "Clinical Research",
    "Basic Science",
    "Case Report",
    "Public Health",
    "Technology & Innovation",
    "Other",
  ]),
  abstract: z.string().max(5000).optional().default(""),
  keywords: z.string().max(300).optional().default(""),
});

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected.");
  return new GridFSBucket(db, { bucketName: "posterFiles" });
}

function hasValidDeleteToken(request: Request) {
  const configuredToken = process.env.EPOSTER_ADMIN_DELETE_TOKEN;
  const suppliedToken = request.headers.get("x-admin-delete-token");
  return Boolean(
    configuredToken &&
      suppliedToken &&
      suppliedToken.trim() === configuredToken.trim(),
  );
}

function getFileMimeType(fileName: string): AllowedMimeType | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FILE_MIME_TYPES[extension as keyof typeof FILE_MIME_TYPES] ?? null;
}

export async function GET() {
  try {
    await connectDB();

    const submissions = await Submission.find({})
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      submissions: submissions.map((item) => ({
        id: item.submissionId,
        authorName: item.authorName,
        email: item.email,
        institution: item.institution,
        department: item.department,
        coAuthors: item.coAuthors,
        title: item.title,
        category: item.category,
        abstract: item.abstract,
        keywords: item.keywords,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSize,
        fileUrl: `/api/submissions/${encodeURIComponent(item.submissionId)}/file`,
        status: item.status,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/submissions failed:", error);
    return NextResponse.json(
      { error: "Unable to load submissions." },
      { status: 500 },
    );
  }
}

// Bulk deletion remains protected by EPOSTER_ADMIN_DELETE_TOKEN.
export async function DELETE(request: Request) {
  if (!hasValidDeleteToken(request)) {
    return NextResponse.json(
      { error: "Unauthorized. A valid admin deletion token is required." },
      { status: 401 },
    );
  }

  try {
    await connectDB();

    const bucket = getBucket();
    const files = await bucket.find({}).toArray();
    let deletedFiles = 0;

    for (const file of files) {
      try {
        await bucket.delete(file._id);
        deletedFiles += 1;
      } catch (error) {
        console.error(`Unable to delete GridFS file ${String(file._id)}:`, error);
      }
    }

    const result = await Submission.deleteMany({});

    return NextResponse.json({
      message: "Submissions deleted.",
      deletedSubmissions: result.deletedCount ?? 0,
      deletedFiles,
    });
  } catch (error) {
    console.error("DELETE /api/submissions failed:", error);
    return NextResponse.json(
      { error: "Unable to delete submissions." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let uploadedFileId: ObjectId | null = null;

  try {
    await connectDB();

    const formData = await request.formData();
    const rawFields = Object.fromEntries(
      [
        "authorName",
        "email",
        "institution",
        "department",
        "coAuthors",
        "title",
        "category",
        "abstract",
        "keywords",
      ].map((key) => [key, String(formData.get(key) ?? "")]),
    );

    const parsed = fieldsSchema.safeParse(rawFields);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Please check the submission details.",
        },
        { status: 400 },
      );
    }

    const fileEntry = formData.get("file");
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "Please attach a poster file." },
        { status: 400 },
      );
    }

    const extension = fileEntry.name.split(".").pop()?.toLowerCase() ?? "";
    const expectedType = getFileMimeType(fileEntry.name);
    const rawType = fileEntry.type === "image/jpg" ? "image/jpeg" : fileEntry.type;

    // File extension determines the canonical MIME type. Browsers may report
    // an empty or generic MIME type for Office documents.
    const normalizedType: AllowedMimeType | null = expectedType;
    const validBrowserType =
      !rawType ||
      rawType === "application/octet-stream" ||
      rawType === normalizedType;

    if (
      !ALLOWED_EXTENSIONS.includes(extension) ||
      !normalizedType ||
      !ALLOWED_MIME_TYPES.has(normalizedType) ||
      !validBrowserType
    ) {
      return NextResponse.json(
        {
          error:
            "Supported formats: PDF, PNG, JPG/JPEG, PPT, PPTX, DOC, and DOCX.",
        },
        { status: 400 },
      );
    }

    if (fileEntry.size < 1 || fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "The poster file must be between 1 byte and 20 MB." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await fileEntry.arrayBuffer());
    const submissionId = `EP-${crypto.randomUUID()}`;
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(fileEntry.name, {
      metadata: {
        submissionId,
        originalName: fileEntry.name,
        contentType: normalizedType,
      },
    });

    uploadedFileId = uploadStream.id as ObjectId;

    await new Promise<void>((resolve, reject) => {
      uploadStream.once("finish", resolve);
      uploadStream.once("error", reject);
      Readable.from(bytes).pipe(uploadStream);
    });

    const submission = await Submission.create({
      ...parsed.data,
      submissionId,
      fileId: uploadedFileId,
      fileName: fileEntry.name,
      fileType: normalizedType,
      fileSize: fileEntry.size,
    });

    return NextResponse.json(
      {
        message: "Submission saved successfully.",
        submission: {
          id: submission.submissionId,
          authorName: submission.authorName,
          email: submission.email,
          institution: submission.institution,
          department: submission.department,
          coAuthors: submission.coAuthors,
          title: submission.title,
          category: submission.category,
          abstract: submission.abstract,
          keywords: submission.keywords,
          fileName: submission.fileName,
          fileType: submission.fileType,
          fileSize: submission.fileSize,
          fileUrl: `/api/submissions/${encodeURIComponent(submission.submissionId)}/file`,
          status: submission.status,
          createdAt: submission.createdAt,
          syncStatus: "online",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedFileId && mongoose.connection.db) {
      try {
        await getBucket().delete(uploadedFileId);
      } catch (cleanupError) {
        console.error("Unable to clean up orphaned poster file:", cleanupError);
      }
    }

    console.error("POST /api/submissions failed:", error);
    return NextResponse.json(
      {
        error:
          "Unable to save the submission. Check the database connection and try again.",
      },
      { status: 500 },
    );
  }
}
