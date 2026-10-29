
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { cachePosterFile, cachePosters, queueSubmission, syncQueuedSubmissions } from "@/lib/offline-storage";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  FileCheck2,
  FileText,
  FlaskConical,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

const submissionSchema = z.object({
  authorName: z
    .string()
    .trim()
    .min(2, "Please enter your full name.")
    .max(100, "Name must be 100 characters or fewer."),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .max(150, "Email is too long."),

  institution: z
    .string()
    .trim()
    .min(2, "Please enter your institution.")
    .max(200, "Institution name is too long."),

  department: z
    .string()
    .trim()
    .min(2, "Please enter your department.")
    .max(150, "Department name is too long."),

  coAuthors: z
    .string()
    .max(500, "Co-author details are too long."),

  title: z
    .string()
    .trim()
    .min(5, "The poster title must contain at least 5 characters.")
    .max(200, "The title must be 200 characters or fewer."),

  category: z.enum([
    "Clinical Research",
    "Basic Science",
    "Case Report",
    "Public Health",
    "Technology & Innovation",
    "Other",
  ], {
    error: "Please select a research category.",
  }),

  abstract: z
    .string()
    .trim()
    .max(5000, "The abstract must be 5,000 characters or fewer."),

  keywords: z
    .string()
    .trim()
    .max(300, "Keywords must be 300 characters or fewer."),

  consent: z.boolean().refine((value) => value, {
    message: "Please confirm that the submission details are correct.",
  }),
});

type SubmissionFields = z.infer<typeof submissionSchema>;

type PosterSubmission = SubmissionFields & {
  id: string;
  file?: File;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
  syncStatus?: "online" | "pending";
};

const categories = [
  "Clinical Research",
  "Basic Science",
  "Case Report",
  "Public Health",
  "Technology & Innovation",
  "Other",
] as const;

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SubmitPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isOnline, setIsOnline] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSubmission, setSavedSubmission] =
    useState<PosterSubmission | null>(null);
  const [saveError, setSaveError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SubmissionFields>({
    resolver: zodResolver(submissionSchema),
    defaultValues: {
      authorName: "",
      email: "",
      institution: "",
      department: "",
      coAuthors: "",
      title: "",
      category: undefined,
      abstract: "",
      keywords: "",
      consent: false,
    },
  });

  const abstractValue = watch("abstract") ?? "";

  useEffect(() => {
    const updateConnection = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        void syncQueuedSubmissions().then((result) => {
          if (result.synced > 0) {
            setSyncNotice(`${result.synced} offline submission${result.synced === 1 ? "" : "s"} uploaded successfully.`);
            setSavedSubmission((current) =>
              current?.syncStatus === "pending" ? { ...current, syncStatus: "online" } : current
            );
          }
        }).catch((error) => console.error("Offline submission sync failed:", error));
      }
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  function validateFile(file: File | null) {
    if (!file) {
      setFileError("Please upload your ePoster file.");
      return false;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const validExtension = ["pdf", "png", "jpg", "jpeg"].includes(
      extension ?? "",
    );

    const validType =
      ALLOWED_FILE_TYPES.includes(file.type) ||
      (file.type === "" && validExtension);

    if (!validType) {
      setFileError("Upload a PDF, PNG, or JPG file.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("Your file must be 20 MB or smaller.");
      return false;
    }

    if (file.size === 0) {
      setFileError("The selected file is empty.");
      return false;
    }

    setFileError("");
    return true;
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setFileError("");
    setSaveError("");
    setSavedSubmission(null);

    if (file) {
      validateFile(file);
    }
  }

  async function saveSubmission(values: SubmissionFields) {
    setSaveError("");
    setSavedSubmission(null);

    if (!validateFile(selectedFile)) return;
    if (!selectedFile) return;

    const fields = {
      authorName: values.authorName,
      email: values.email,
      institution: values.institution,
      department: values.department,
      coAuthors: values.coAuthors,
      title: values.title,
      category: values.category,
      abstract: values.abstract,
      keywords: values.keywords,
    };

    if (!navigator.onLine) {
      try {
        const queued = await queueSubmission(fields, selectedFile);
        const pendingSubmission = {
          ...values,
          id: queued.id,
          fileName: selectedFile.name,
          fileType: selectedFile.type || "application/octet-stream",
          fileSize: selectedFile.size,
          // Offline-only submissions do not have a cloud file URL until synced.
          fileUrl: "",
          createdAt: queued.createdAt,
          syncStatus: "pending" as const,
        };
        setSavedSubmission(pendingSubmission);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        reset();
        setSyncNotice("Saved on this device. It will upload to MongoDB when this device reconnects.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        console.error("Unable to queue offline submission:", error);
        setSaveError("This browser could not save the submission offline. Check device storage and try again.");
      }
      return;
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (key !== "consent") formData.append(key, String(value ?? ""));
      });
      formData.append("file", selectedFile);

      const response = await fetch("/api/submissions", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || "We couldn't save your submission online. Please try again.",
        );
      }

      const onlineSubmission = result.submission as PosterSubmission;
      // Keep this online submission and its file available on this device when offline.
      if (onlineSubmission?.id) {
        const mimeType = selectedFile.type || inferSubmissionMimeType(selectedFile.name);
        await cachePosterFile(onlineSubmission.id, selectedFile, selectedFile.name, mimeType);
        await cachePosters([{
          ...onlineSubmission,
          fileName: onlineSubmission.fileName || selectedFile.name,
          fileType: onlineSubmission.fileType || mimeType,
          fileSize: onlineSubmission.fileSize ?? selectedFile.size,
          fileUrl: onlineSubmission.fileUrl || `/api/submissions/${encodeURIComponent(onlineSubmission.id)}/file`,
        }]);
      }
      setSavedSubmission(onlineSubmission);
      setSelectedFile(null);

      if (fileInputRef.current) fileInputRef.current.value = "";

      reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Unable to save the online submission:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "We couldn't save your submission online. Please check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startAnotherSubmission() {
    setSavedSubmission(null);
    setSaveError("");
    setFileError("");
    setSelectedFile(null);
    reset();
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-7">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <FileText size={22} />
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight">
                ePoster<span className="text-blue-600">.</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Research submission
              </span>
            </span>
          </Link>

          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold ${
              isOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? "Online" : "Offline mode"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-7 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div className="mt-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            <FlaskConical size={14} />
            Scientific research submission
          </div>

          <h1 className="mt-4 text-3xl leading-tight font-black tracking-tight text-slate-950 sm:text-4xl">
            Submit your ePoster
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-base">
            Share your research with the scientific community. Complete the
            details below and upload your poster to save your submission
            securely to the cloud.
          </p>
        </div>

        {!isOnline && (
          <div className="mt-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <WifiOff className="mt-0.5 shrink-0 text-amber-700" size={20} />
            <div>
              <p className="text-sm font-bold text-amber-900">
                You're currently offline
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                You can save a new submission on this device while offline. It will remain queued here and upload to MongoDB/GridFS when your internet returns.
              </p>
            </div>
          </div>
        )}

        {syncNotice && (
          <div role="status" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-800">
            {syncNotice}
          </div>
        )}

        {savedSubmission ? (
          <section className="mt-8 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={36} />
            </div>

            <div className="mt-5 text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">
                Saved successfully
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Your submission is saved!
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-500">
                {savedSubmission.syncStatus === "pending"
                  ? "Your submission is safely queued on this device. It will be uploaded to the cloud when your internet connection returns."
                  : "Your submission details and poster file have been saved to the online database. Keep the reference ID below for your records."}
              </p>
            </div>

            <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Submission reference
              </p>
              <p className="mt-2 break-all font-mono text-sm font-bold text-blue-700">
                {savedSubmission.id}
              </p>
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500">Poster title</p>
                <p className="mt-1 font-bold text-slate-800">
                  {savedSubmission.title}
                </p>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <FileCheck2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-800">
                    {savedSubmission.fileName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatFileSize(savedSubmission.fileSize)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
              {savedSubmission.syncStatus === "pending" ? (
                <><strong>Waiting to sync:</strong> This submission is saved in this browser’s local storage. Keep this device’s browser data intact and reconnect to upload it to MongoDB/GridFS.</>
              ) : (
                <><strong>Online submission:</strong> Your submission is stored in MongoDB and your poster file is stored in MongoDB GridFS.</>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={startAnotherSubmission}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Submit another poster <ArrowRight size={16} />
              </button>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Return home
              </Link>
            </div>
          </section>
        ) : (
          <form
            onSubmit={handleSubmit(saveSubmission)}
            noValidate
            className="mt-8 space-y-6"
          >
            {/* Author details */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <GraduationCap size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    Author information
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Tell us who is presenting this research.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <Field label="Full name" error={errors.authorName?.message}>
                  <input
                    {...register("authorName")}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className={inputClass(Boolean(errors.authorName))}
                  />
                </Field>

                <Field label="Email address" error={errors.email?.message}>
                  <input
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputClass(Boolean(errors.email))}
                  />
                </Field>

                <Field label="Institution / Hospital" error={errors.institution?.message}>
                  <input
                    {...register("institution")}
                    placeholder="Your institution name"
                    autoComplete="organization"
                    className={inputClass(Boolean(errors.institution))}
                  />
                </Field>

                <Field label="Department" error={errors.department?.message}>
                  <input
                    {...register("department")}
                    placeholder="Your department"
                    className={inputClass(Boolean(errors.department))}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    label="Co-authors"
                    hint="Optional. Separate multiple authors with commas."
                    error={errors.coAuthors?.message}
                  >
                    <input
                      {...register("coAuthors")}
                      placeholder="Enter co-author names"
                      className={inputClass(Boolean(errors.coAuthors))}
                    />
                  </Field>
                </div>
              </div>
            </section>

            {/* Research details */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                  <FlaskConical size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">
                    Research information
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add the key details of your scientific work.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <Field label="Poster title" error={errors.title?.message}>
                  <input
                    {...register("title")}
                    placeholder="Enter your research title"
                    maxLength={200}
                    className={inputClass(Boolean(errors.title))}
                  />
                </Field>

                <Field label="Research category" error={errors.category?.message}>
                  <select
                    {...register("category")}
                    className={inputClass(Boolean(errors.category))}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select a research category
                    </option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Abstract (Optional)"
                  hint="Optional. You can provide a concise summary of your research (up to 5,000 characters)."
                  error={errors.abstract?.message}
                >
                  <textarea
                    {...register("abstract")}
                    rows={6}
                    maxLength={5000}
                    placeholder="Describe the background, objectives, methods, results, and conclusion..."
                    className={`${inputClass(Boolean(errors.abstract))} min-h-36 resize-y`}
                  />
                  <div className="mt-2 text-right text-xs text-slate-400">
                    {abstractValue.length}/5000 characters
                  </div>
                </Field>

                <Field
                  label="Keywords (Optional)"
                  hint="Optional. Separate keywords with commas."
                  error={errors.keywords?.message}
                >
                  <input
                    {...register("keywords")}
                    placeholder="e.g. clinical research, innovation, public health"
                    className={inputClass(Boolean(errors.keywords))}
                  />
                </Field>
              </div>
            </section>

            {/* Poster file */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <CloudUpload size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">Upload your ePoster</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the poster file you want to submit.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] ?? null)
                  }
                  className="sr-only"
                  id="poster-file"
                />

                {selectedFile ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700">
                        <FileCheck2 size={23} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-bold text-slate-800">
                          {selectedFile.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Remove selected file"
                        onClick={() => {
                          handleFileChange(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 text-sm font-bold text-blue-700 hover:text-blue-800"
                    >
                      Choose a different file
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="poster-file"
                    className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-5 py-10 text-center transition hover:border-blue-400 hover:bg-blue-50/40 ${
                      fileError
                        ? "border-red-300 bg-red-50/30"
                        : "border-slate-300 bg-slate-50/70"
                    }`}
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                      <CloudUpload size={28} />
                    </span>
                    <span className="mt-4 text-sm font-bold text-slate-800">
                      Click to upload your poster
                    </span>
                    <span className="mt-2 text-xs leading-5 text-slate-500">
                      PDF, PNG, or JPG · Maximum 20 MB
                    </span>
                    <span className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white">
                      Browse files
                    </span>
                  </label>
                )}

                {fileError && (
                  <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                    {fileError}
                  </p>
                )}

                <p className="mt-4 text-xs leading-6 text-slate-500">
                  Your selected file is uploaded securely with your submission. PDF, PNG,
                  and JPG files up to 20 MB are supported.
                </p>
              </div>
            </section>

            {/* Consent and submission */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  {...register("consent")}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                />
                <span className="text-sm leading-6 text-slate-600">
                  I confirm that the information provided is accurate and that
                  I have permission to submit this research poster.
                </span>
              </label>

              {errors.consent && (
                <p role="alert" className="mt-2 text-sm text-red-600">
                  {errors.consent.message}
                </p>
              )}

              {saveError && (
                <div
                  role="alert"
                  className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
                >
                  <X className="mt-0.5 shrink-0" size={18} />
                  <p>{saveError}</p>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={20} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      Secure cloud submission
                    </p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      Your submission details are stored in MongoDB Atlas, and
                      the poster file is stored in MongoDB GridFS. If you are offline, the submission is queued in this browser until you reconnect.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <LoaderCircle className="animate-spin" size={18} />
                    Uploading your submission...
                  </>
                ) : (
                  <>
                    {isOnline ? "Save ePoster submission" : "Save offline for later sync"} <ArrowRight size={18} />
                  </>
                )}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                Your submission has been sent to the server. The gallery can retrieve it
                across devices once the cloud gallery update is installed.
              </p>
            </section>
          </form>
        )}

        <footer className="py-8 text-center text-xs text-slate-400">
          ePoster · Scientific research submission platform
        </footer>
      </div>
    </main>
  );
}

function inferSubmissionMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${
    hasError ? "border-red-300" : "border-slate-200"
  }`;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-2 text-xs leading-5 text-slate-400">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
