const { json, optionsResponse, isSecureRequest, clearCookie } = require("../lib/admin-auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  return json(
    200,
    { ok: true },
    { "Set-Cookie": clearCookie(isSecureRequest(event)) },
    event
  );
};
