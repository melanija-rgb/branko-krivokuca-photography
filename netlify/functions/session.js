const { json, isAdmin } = require("../lib/admin-auth");

exports.handler = async (event) => {
  return json(200, { authenticated: isAdmin(event) });
};
