import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";
import { recordAuditLog } from "@/lib/security/audit";
import { getActor } from "@/lib/rbac/guard";

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);

    // 1. Sliding-window rate limit for file uploads (10 uploads / min per IP)
    const rateLimit = checkRateLimit(
      `upload:${clientIp}`,
      RATE_LIMIT_CONFIGS.UPLOAD.limit,
      RATE_LIMIT_CONFIGS.UPLOAD.windowMs,
    );

    if (!rateLimit.allowed) {
      await recordAuditLog({
        action: "upload.rate_limit_exceeded",
        entityType: "ip_address",
        entityId: clientIp,
        metadata: { clientIp, retryAfter: rateLimit.retryAfter },
      });

      return NextResponse.json(
        {
          error: `Upload rate limit exceeded. Please wait ${rateLimit.retryAfter} second(s) before uploading again.`,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        },
      );
    }

    /**
     * Resume intake is reachable two ways: anonymously from the public careers
     * form, and from the internal candidate screens. An anonymous upload is the
     * application flow itself; a signed-in caller is acting on the candidate
     * directory and must hold the matching permission.
     */
    const actor = await getActor();
    if (actor && !actor.access.canAny(["candidates.create", "candidates.update"])) {
      await recordAuditLog({
        actorId: actor.user.id,
        orgId: actor.user.orgId,
        action: "access.denied",
        entityType: "route",
        entityId: "/api/upload",
        metadata: { required: ["candidates.create", "candidates.update"] },
      });

      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have permission to upload candidate documents.",
        },
        { status: 403, headers: getRateLimitHeaders(rateLimit) },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided in request." },
        { status: 400, headers: getRateLimitHeaders(rateLimit) },
      );
    }

    // Size limit: 5 MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds maximum allowed limit of 5 MB." },
        { status: 400, headers: getRateLimitHeaders(rateLimit) },
      );
    }

    // Allowed extensions / MIME types
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const originalName = file.name || "resume.pdf";
    const ext = originalName.substring(originalName.lastIndexOf(".")).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file format. Only PDF, DOC, and DOCX files are supported." },
        { status: 400, headers: getRateLimitHeaders(rateLimit) },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads/resumes
    const uploadDir = join(process.cwd(), "public", "uploads", "resumes");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const cleanBaseName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/\.[^/.]+$/, "");
    const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}${ext}`;
    const filePath = join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/resumes/${uniqueFileName}`;

    await recordAuditLog({
      actorId: actor?.user.id,
      orgId: actor?.user.orgId,
      action: "upload.file_created",
      entityType: "document",
      entityId: uniqueFileName,
      metadata: {
        originalName,
        fileSize: file.size,
        mimeType: file.type || ext,
        clientIp,
      },
    });

    return NextResponse.json(
      {
        success: true,
        fileUrl: publicUrl,
        fileName: originalName,
        fileSize: file.size,
      },
      {
        headers: getRateLimitHeaders(rateLimit),
      },
    );
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload file." },
      { status: 500 },
    );
  }
}
