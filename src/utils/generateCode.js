// src/utils/generateCode.js
function generateCode() {
  // 6-digit numeric code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = { generateCode };
