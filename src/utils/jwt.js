import jwt from "jsonwebtoken";

export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email }, 
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES }
  );
}

export function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id }, 
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}
