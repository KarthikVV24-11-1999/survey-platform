import { env } from "./env";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// In development the link is printed to the console instead.
export const emailSignInEnabled = () => Boolean(env().RESEND_API_KEY) || env().NODE_ENV !== "production";

export async function sendMagicLinkEmail(to: string, url: string) {
  const e = env();
  if (!e.RESEND_API_KEY) {
    if (e.NODE_ENV === "production") throw new Error("Email is not configured");
    console.info(`\n[dev] Magic sign-in link for ${to}:\n${url}\n`);
    return;
  }

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5">
<p>Click the button below to sign in. The link expires in 10 minutes and works once.</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 16px;background:#4f46e5;color:#fff;border-radius:6px;text-decoration:none">Sign in</a></p>
<p style="color:#666;font-size:13px">If you didn't request this, you can ignore this email.</p>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: e.EMAIL_FROM,
      to: [to],
      subject: "Your sign-in link",
      html,
      text: `Sign in: ${url}\n\nThe link expires in 10 minutes. If you didn't request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.error("[email] Resend rejected the message", res.status);
    throw new Error("Could not send the sign-in email");
  }
}
