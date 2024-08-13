const nodeMailer = require('nodemailer');
const { NODEMAILER_EMAIL, NODEMAILER_PASSWORD } = process.env;

const sendEmail = async (to, subject, text, html) => {
  const transporter = nodeMailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: NODEMAILER_EMAIL,
      pass: NODEMAILER_PASSWORD,
    },
  });

  const mailOptions = {
    from : NODEMAILER_EMAIL,
    to : to,
    subject : subject,
    text : text,
    html : html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
