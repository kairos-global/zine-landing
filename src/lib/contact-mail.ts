import { CONTACT_EMAIL, CONTACT_TOPICS, type ContactRequest } from "@/lib/contact";
import { getSiteBaseUrl } from "@/lib/site-url";

export async function notifyContactMailbox(request: ContactRequest) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const from = process.env.GMAIL_SENDER || CONTACT_EMAIL;
  if (!clientId || !clientSecret || !refreshToken) return { status: "unconfigured" };

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!tokenResponse.ok) throw new Error(`Gmail OAuth returned ${tokenResponse.status}`);
  const { access_token: accessToken } = await tokenResponse.json();
  if (typeof accessToken !== "string") throw new Error("Missing Gmail access token");

  const subject = `[Zineground] ${CONTACT_TOPICS[request.topic].label} / ${request.id.slice(0, 8).toUpperCase()}`;
  const body = [
    `From ${request.name} <${request.email}>`,
    `Reference: ${request.reference || "None"}`,
    "",
    request.message,
    "",
    `Request ${request.id}`,
    `${getSiteBaseUrl()}/dashboard/admin/contact?request=${request.id}`,
  ].join("\r\n");
  const encodedBody = Buffer.from(body).toString("base64").match(/.{1,76}/g)?.join("\r\n");
  const mime = [
    `From: Zineground <${from}>`,
    `To: ${CONTACT_EMAIL}`,
    `Reply-To: ${request.email}`,
    `Subject: ${subject}`,
    `Message-ID: <contact-${request.id}@zineground.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url") }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`Gmail delivery returned ${response.status}`);
  const { id } = await response.json();
  return { status: "sent", id: typeof id === "string" ? id : null };
}
