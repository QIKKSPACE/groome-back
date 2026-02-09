const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(to, code) {
  const mailOptions = {
    from: `"Aurameter" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your Aurameter account",
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is <b>${code}</b></p>`,
  };

  await transporter.sendMail(mailOptions);
  console.log(`📧 Verification email sent to ${to}`);
}

module.exports = { sendVerificationEmail };
