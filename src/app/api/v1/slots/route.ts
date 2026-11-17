import { NextRequest } from "next/server";
import { getAuthenticatedUser, hasRole } from "@/lib/server-auth";
import { SlotService } from "@/services/SlotService";
import { CreateSlotSchema } from "@/lib/validations";
import { apiSuccess, apiError, handleZodError } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  const isEn =
    req.headers.get("accept-language")?.startsWith("en") ||
    req.nextUrl.searchParams.get("lang") === "en";

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return apiError(
      "UNAUTHENTICATED",
      isEn ? "Please authenticate first" : "ابتدا وارد سیستم شوید",
      401
    );
  }
  if (!hasRole(authUser, ["professor", "higher_education_staff"])) {
    return apiError(
      "FORBIDDEN",
      isEn
        ? "Only faculty members can define availability slots"
        : "تنها اساتید می‌توانند بازه حضور تعریف نمایند",
      403
    );
  }

  try {
    const body = await req.json();
    const parsed = CreateSlotSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error, isEn);
    }

    const result = await SlotService.define(
      parsed.data as any,
      authUser.userId,
      authUser.professorId
    );

    if (!result.success) {
      let errMsg = result.message || "";
      if (isEn) {
        if (errMsg.includes("هم‌پوشانی")) {
          errMsg = "This time slot overlaps with an existing defined slot";
        } else if (errMsg.includes("روزهای کاری")) {
          errMsg = "Selected day must be a working day (Saturday to Wednesday)";
        } else if (errMsg.includes("۱۲ ماه")) {
          errMsg = "Recurring slot validity cannot exceed 12 months";
        } else if (errMsg.includes("در گذشته")) {
          errMsg = "Single session date cannot be in the past";
        } else if (errMsg.includes("قبل از تاریخ شروع")) {
          errMsg = "Valid until date cannot be before valid from date";
        } else if (errMsg.includes("عضو این هیئت") || errMsg.includes("هیئت غیرفعال")) {
          errMsg = "You are not an active member of this committee";
        } else if (errMsg.includes("هیچ روز کاری")) {
          errMsg = "The selected interval contains no working days matching the pattern";
        } else if (errMsg.includes("فقط اساتید")) {
          errMsg = "Only faculty members can define availability slots";
        } else if (errMsg.includes("شناسه هیئت")) {
          errMsg = "Committee ID is required";
        } else if (errMsg.includes("تاریخ بازه")) {
          errMsg = "Slot date is required";
        } else if (errMsg.includes("روز هفته")) {
          errMsg = "Day of week is required for weekly recurrence pattern";
        } else if (errMsg.includes("الزامی")) {
          errMsg = "All required fields must be filled";
        } else {
          errMsg = "An error occurred while creating availability slot";
        }
      }
      return apiError(result.code as any, errMsg, result.status || 400);
    }

    return apiSuccess(result.slot, 201);
  } catch {
    return apiError(
      "INTERNAL_ERROR",
      isEn ? "Internal error creating availability slot" : "خطا در ایجاد بازه زمانی",
      500
    );
  }
}
