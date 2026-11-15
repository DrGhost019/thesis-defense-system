import { apiSuccess } from "@/lib/api-response";

export async function POST() {
  const response = apiSuccess({ message: "خروج با موفقیت انجام شد" });
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}
