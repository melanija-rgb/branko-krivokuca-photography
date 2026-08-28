const {
  ADMIN_PASSWORD,
  json,
  parseBody,
  isSecureRequest,
  secureEqual,
  makeToken,
  sessionCookie,
} = require("../lib/admin-auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  const password = String(parseBody(event).password || "");
  if (!secureEqual(password, ADMIN_PASSWORD)) {
    return json(401, { error: "Incorrect password." });
  }

  return json(200, { ok: true }, {
    "Set-Cookie": sessionCookie(makeToken(), isSecureRequest(event)),
  });
};
