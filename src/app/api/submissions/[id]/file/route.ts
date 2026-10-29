import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import connectDB from "@/lib/mongodb";
import Submission from "@/models/Submission";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const expectedToken = process.env.EPOSTER_ADMIN_DELETE_TOKEN;
    const providedToken = request.headers.get("x-admin-delete-token");

    if (!expectedToken) {
      return NextResponse.json(
        { error: "Deletion is not configured. Set EPOSTER_ADMIN_DELETE_TOKEN on the server." },
        { status: 503 },
      );
    }
    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: "Invalid admin deletion token." }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    const submission = await Submission.findOne({ submissionId: id }).select("submissionId fileId");
    if (!submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const db = mongoose.connection.db;
    if (!db) throw new Error("MongoDB is not connected.");

    const fileId = submission.fileId as unknown as ObjectId;
    if (fileId) {
      const bucket = new GridFSBucket(db, { bucketName: "posterFiles" });
      try {
        await bucket.delete(fileId);
      } catch (error) {
        // If the GridFS file is already missing, the submission can still be
        // removed; if it exists, keep the record and return an error for retry.
        const remaining = await bucket.find({ _id: fileId }).limit(1).toArray();
        if (remaining.length > 0) {
          console.error("Unable to delete GridFS poster:", error);
          return NextResponse.json(
            { error: "The poster file could not be deleted. The submission was kept; please retry." },
            { status: 500 },
          );
        }
      }
    }

    await Submission.deleteOne({ _id: submission._id });
    return NextResponse.json({ message: "Submission and poster file deleted.", id });
  } catch (error) {
    console.error("DELETE /api/submissions/[id] failed:", error);
    return NextResponse.json({ error: "Unable to delete this submission." }, { status: 500 });
  }
}
