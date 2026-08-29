const { json, optionsResponse, isAdmin } = require("../lib/admin-auth");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse(event);
  return json(200, { authenticated: isAdmin(event) }, {}, event);
};
