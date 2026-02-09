// hashPassword.js
import bcrypt from "bcrypt";

const password = "Njha@963";
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) throw err;
    console.log("Hashed password:", hash,"/");
});
