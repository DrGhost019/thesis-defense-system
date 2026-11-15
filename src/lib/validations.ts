import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const LoginSchema = z
  .object({
    username: z
      .string()
      .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
      .max(50, "نام کاربری حداکثر ۵۰ کاراکتر است")
      .regex(/^[a-zA-Z0-9._-]+$/, "نام کاربری فقط می‌تواند شامل حروف، ارقام، نقطه، زیرخط و خط تیره باشد"),
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
  })
  .openapi("LoginRequest");

export const CreateUserSchema = z
  .object({
    username: z
      .string()
      .min(3, "نام کاربری باید حداقل ۳ کاراکتر باشد")
      .max(50, "نام کاربری حداکثر ۵۰ کاراکتر است")
      .regex(/^[a-zA-Z0-9._-]+$/, "نام کاربری نامعتبر است"),
    password: z.string().min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد"),
    full_name: z.string().min(2, "نام کامل باید حداقل ۲ کاراکتر باشد").max(120, "نام کامل حداکثر ۱۲۰ کاراکتر است"),
    email: z.string().email("ایمیل نامعتبر است").optional().or(z.literal("")),
    role: z.enum(["student", "professor", "higher_education_staff", "admin"]),
    // Student fields
    student_number: z.string().regex(/^[a-zA-Z0-9]{4,20}$/, "شماره دانشجویی باید ۴ تا ۲۰ رقم یا حرف باشد").optional(),
    degree_level: z.enum(["master", "phd"]).optional(),
    thesis_title: z.string().min(5, "عنوان پایان‌نامه باید حداقل ۵ کاراکتر باشد").max(300, "عنوان پایان‌نامه حداکثر ۳۰۰ کاراکتر است").optional(),
    // Professor fields
    department: z.string().min(1, "دانشکده الزامی است").max(100).optional(),
    academic_title: z.string().min(1, "مرتبه علمی الزامی است").max(60).optional(),
    office_location: z.string().max(100).optional(),
  })
  .refine((data) => data.password !== data.username, {
    message: "رمز عبور نباید با نام کاربری یکسان باشد",
    path: ["password"],
  })
  .refine(
    (data) => {
      if (data.role === "student") {
        return !!data.student_number && !!data.degree_level && !!data.thesis_title;
      }
      return true;
    },
    {
      message: "اطلاعات دانشجویی (شماره دانشجویی، مقطع و عنوان پایان‌نامه) الزامی است",
      path: ["student_number"],
    }
  )
  .refine(
    (data) => {
      if (data.role === "professor" || data.role === "higher_education_staff") {
        return !!data.department && !!data.academic_title;
      }
      return true;
    },
    {
      message: "اطلاعات استاد (دانشکده و مرتبه علمی) الزامی است",
      path: ["department"],
    }
  )
  .openapi("CreateUserRequest");

export const CreateCommitteeSchema = z
  .object({
    name: z.string().min(3, "نام هیئت داوران باید حداقل ۳ کاراکتر باشد").max(100, "نام هیئت داوران حداکثر ۱۰۰ کاراکتر است"),
    professor_ids: z.array(z.number().int()).min(1, "هیئت داوران باید حداقل یک عضو استاد داشته باشد"),
  })
  .openapi("CreateCommitteeRequest");

export const CreateSlotSchema = z
  .object({
    owner_type: z.enum(["professor", "committee"]),
    committee_id: z.number().int().optional(),
    slot_type: z.enum(["single", "recurring"]),
    slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید به فرمت YYYY-MM-DD باشد").optional(),
    recurrence_pattern: z.enum(["odd_days", "even_days", "weekly"]).optional(),
    weekday: z.enum(["sat", "sun", "mon", "tue", "wed"]).optional(),
    start_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "زمان شروع نامعتبر است"),
    end_time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, "زمان پایان نامعتبر است"),
    valid_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ شروع نامعتبر است").optional(),
    valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ پایان نامعتبر است").optional(),
  })
  .refine(
    (data) => {
      if (data.owner_type === "committee") {
        return !!data.committee_id;
      }
      return true;
    },
    {
      message: "شناسه هیئت داوران الزامی است",
      path: ["committee_id"],
    }
  )
  .refine(
    (data) => {
      if (data.slot_type === "single") {
        return !!data.slot_date;
      }
      if (data.slot_type === "recurring") {
        return !!data.recurrence_pattern && !!data.valid_from && !!data.valid_until;
      }
      return false;
    },
    {
      message: "اطلاعات بازه زمانی کامل نیست",
      path: ["slot_type"],
    }
  )
  .refine(
    (data) => {
      if (data.recurrence_pattern === "weekly") {
        return !!data.weekday;
      }
      return true;
    },
    {
      message: "برای الگوی هفتگی، روز هفته الزامی است",
      path: ["weekday"],
    }
  )
  .openapi("CreateSlotRequest");

export const CreateRequestSchema = z
  .object({
    note: z.string().max(1000, "یادداشت حداکثر ۱۰۰۰ کاراکتر است").optional(),
  })
  .openapi("CreateDefenseRequest");

export const AssignRequestSchema = z
  .object({
    slot_id: z.number().int({ message: "شناسه بازه الزامی است" }),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ باید به فرمت YYYY-MM-DD باشد"),
  })
  .openapi("AssignRequest");

export const DeclineRequestSchema = z
  .object({
    reason: z.string().min(5, "دلیل رد درخواست باید حداقل ۵ کاراکتر باشد").max(500, "دلیل رد درخواست حداکثر ۵۰۰ کاراکتر است"),
  })
  .openapi("DeclineRequest");

export const SeatDecisionSchema = z
  .object({
    approve: z.boolean(),
  })
  .openapi("SeatDecisionRequest");

export const CancelSessionSchema = z
  .object({
    reason: z.string().max(500, "دلیل لغو حداکثر ۵۰۰ کاراکتر است").optional(),
  })
  .openapi("CancelSessionRequest");

export const CreateMessageSchema = z
  .object({
    content: z.string().min(1, "پیام نمی‌تواند خالی باشد").max(2000, "پیام حداکثر ۲۰۰۰ کاراکتر است"),
  })
  .openapi("CreateMessageRequest");

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
