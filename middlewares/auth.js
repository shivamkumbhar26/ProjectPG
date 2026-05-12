const jwt = require("jsonwebtoken");
const result = require("../utils/result");

function auth(req, res, next) {
  const allAllowedUrls = [
    "/auth/login",
    "/auth/register",
    "/auth/resend-otp",
    "/verify-otp"
  ];

  if (allAllowedUrls.includes(req.url)) {
    return next();
  }

  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) 
    return res.send(result.createResult("Token is missing"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    res.send(result.createResult("Token is Invalid"));
  }
}

module.exports = auth