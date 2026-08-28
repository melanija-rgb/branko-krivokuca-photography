const { json, isSecureRequest, clearCookie } = require("../lib/admin-auth");

exports.handler = async (event) => {
  return json(200, { ok: true }, {
    "Set-Cookie": clearCookie(isSecureRequest(event)),
  });
};
