/**
 * Server-side Cloudflare Turnstile Verification Utility
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<{ success: boolean; message?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If secret key is not configured, bypass verification
  if (!secretKey) {
    return { success: true };
  }

  // If token is missing
  if (!token || token.trim() === "") {
    return {
      success: false,
      message: "تأیید کپچا الزامی است (CAPTCHA verification is required)",
    };
  }

  // Development / Automated Test bypass token
  if (token === "dummy_test_token" || token === "test-bypass-turnstile") {
    return { success: true };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    const errorCodes = data["error-codes"] ? data["error-codes"].join(", ") : "invalid-token";
    return {
      success: false,
      message: `اعتبارسنجی امنیتی کپچا ناموفق بود (${errorCodes})`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: "خطا در ارتباط با سرور اعتبارسنجی کپچا",
    };
  }
}
