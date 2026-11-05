// GET /api/push-key → the public key phones need to subscribe to notifications.
import { vapidKeys } from "./_push.js";

export default function handler(req, res) {
  var k = vapidKeys();
  if (!k) return res.status(503).json({ error: "not_configured" });
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).json({ publicKey: k.publicKey });
}
