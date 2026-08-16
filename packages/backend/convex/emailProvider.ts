import { Email } from "@convex-dev/auth/providers/Email";

const CODE_LENGTH = 8;

/**
 * Passwordless email provider used by every brand deployment.
 *
 * Production: send a magic link + one-time code via Resend when
 * `RESEND_API_KEY` (or Convex Auth's `AUTH_RESEND_KEY`) is set.
 *
 * Dev fallback: log the code and link to the Convex function logs so
 * engineers can sign in without an email vendor. Tokens are 8 digits, so
 * Convex Auth requires the original email on verification (included in
 * the magic-link URL and the check-email form).
 */
export const MagicLink = Email({
  id: "email",
  maxAge: 60 * 15,
  from: process.env.AUTH_EMAIL_FROM ?? "LinkAll <noreply@localhost>",
  async generateVerificationToken() {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => (b % 10).toString()).join("");
  },
  async sendVerificationRequest({ identifier: email, token, expires }) {
    const appName = process.env.AUTH_APP_NAME ?? "LinkAll";
    const siteUrl = (process.env.SITE_URL ?? "http://localhost:3001").replace(
      /\/$/,
      "",
    );
    const verifyUrl = `${siteUrl}/signin/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const mobileScheme = process.env.AUTH_MOBILE_SCHEME ?? "linkall";
    const mobileUrl = `${mobileScheme}://signin?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const expiry = expires.toUTCString();

    const text = [
      `Sign in to ${appName}`,
      "",
      `Your one-time code: ${token}`,
      "",
      `Or open this magic link: ${verifyUrl}`,
      "",
      `On the mobile app: ${mobileUrl}`,
      "",
      `This code expires at ${expiry}. If you did not request it, you can ignore this email.`,
    ].join("\n");

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
        <h1 style="font-size:20px;margin:0 0 12px">Sign in to ${escapeHtml(appName)}</h1>
        <p style="margin:0 0 16px;line-height:1.5">Use the button below or enter this code:</p>
        <p style="font-size:28px;letter-spacing:0.2em;font-weight:700;margin:0 0 20px">${escapeHtml(token)}</p>
        <p style="margin:0 0 24px">
          <a href="${escapeHtml(verifyUrl)}"
             style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">
            Sign in to ${escapeHtml(appName)}
          </a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Mobile app: <a href="${escapeHtml(mobileUrl)}">${escapeHtml(mobileUrl)}</a></p>
        <p style="margin:0;font-size:12px;color:#9ca3af">Expires ${escapeHtml(expiry)}. If you didn't request this, ignore the email.</p>
      </div>
    `;

    const apiKey = process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY;
    const from =
      process.env.AUTH_EMAIL_FROM ??
      process.env.EMAIL_FROM ??
      `${appName} <noreply@localhost>`;

    if (!apiKey) {
      console.info(
        `[auth] No RESEND_API_KEY / AUTH_RESEND_KEY — dev magic code for ${email}: ${token}`,
      );
      console.info(`[auth] Magic link: ${verifyUrl}`);
      return;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: `Sign in to ${appName}`,
        text,
        html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend failed (${response.status}): ${detail}`);
    }
  },
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
