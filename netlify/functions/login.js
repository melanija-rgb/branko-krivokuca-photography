const {
  ADMIN_PASSWORD,
  json,
  optionsResponse,
  parseBody,
  isSecureRequest,
  secureEqual,
  makeToken,
  sessionCookie,
} = require("../lib/admin-auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." }, {}, event);
  }

  const password = String(parseBody(event).password || "");
  if (!secureEqual(password, ADMIN_PASSWORD)) {
    return json(401, { error: "Incorrect password." }, {}, event);
  }

  return json(
    200,
    { ok: true },
    { "Set-Cookie": sessionCookie(makeToken(), isSecureRequest(event)) },
    event
  );
};
