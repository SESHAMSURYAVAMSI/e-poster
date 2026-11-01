import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import connectDB from "@/lib/mongodb";
import Submission from "@/models/Submission";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    await connectDB();

    const submission = await Submission.findOne({
      submissionId: id,
    })
      .select("fileId fileName fileType")
      .lean();

    if (!submission?.fileId) {
      return NextResponse.json(
        { error: "Poster file not found." },
        { status: 404 }
      );
    }

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB is not connected.");
    }

    const fileId =
      submission.fileId instanceof ObjectId
        ? submission.fileId
        : new ObjectId(String(submission.fileId));

    const bucket = new GridFSBucket(db, {
      bucketName: "posterFiles",
    });

    const files = await bucket
      .find({ _id: fileId })
      .limit(1)
      .toArray();

    if (!files.length) {
      return NextResponse.json(
        { error: "Poster file is missing from GridFS." },
        { status: 404 }
      );
    }

    const file = files[0];

    const mimeType =
      submission.fileType ||
      (typeof file.metadata?.contentType === "string"
        ? file.metadata.contentType
        : null) ||
      "application/octet-stream";

    const fileName = submission.fileName || file.filename || "poster";

    const safeFileName = fileName.replace(/[\r\n"\\]/g, "_");

    const stream = Readable.toWeb(
      bucket.openDownloadStream(fileId)
    ) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Content-Length": String(file.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "GET /api/submissions/[id]/file failed:",
      error
    );

    return NextResponse.json(
      { error: "Unable to retrieve poster file." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext
) {
  try {
    await connectDB();

    const { id } = await params;

    const submission = await Submission.findOne({
      submissionId: id,
    }).select("submissionId fileId");

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found." },
        { status: 404 }
      );
    }

    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB is not connected.");
    }

    const fileId = submission.fileId as unknown as ObjectId;

    if (fileId) {
      const bucket = new GridFSBucket(db, {
        bucketName: "posterFiles",
      });

      try {
        await bucket.delete(fileId);
      } catch (error) {
        const remaining = await bucket
          .find({ _id: fileId })
          .limit(1)
          .toArray();

        if (remaining.length > 0) {
          console.error(
            "Unable to delete GridFS poster:",
            error
          );

          return NextResponse.json(
            {
              error:
                "The poster file could not be deleted. The submission was kept; please retry.",
            },
            { status: 500 }
          );
        }
      }
    }

    await Submission.deleteOne({
      _id: submission._id,
    });

    return NextResponse.json({
      message: "Submission and poster file deleted.",
      id,
    });
  } catch (error) {
    console.error(
      "DELETE /api/submissions/[id]/file failed:",
      error
    );

    return NextResponse.json(
      { error: "Unable to delete this submission." },
      { status: 500 }
    );
  }
}