// firebase.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // get from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
