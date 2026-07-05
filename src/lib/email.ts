import nodemailer from "nodemailer";
import { env } from "./env";

const transporter = (env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD) 
  ? nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: env.EMAIL_SERVER_USER,
        pass: env.EMAIL_SERVER_PASSWORD,
      },
    })
  : null;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!transporter) {
    console.log("=========================================");
    console.log(`[Email Development Mode] No EMAIL_SERVER_USER or EMAIL_SERVER_PASSWORD found.`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (HTML): ${html}`);
    console.log("=========================================");
    return { success: true, dummy: true };
  }

  const from = `"Vivu No Plan" <${env.EMAIL_SERVER_USER}>`;
  
  try {
    const data = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error("Error sending email via Nodemailer:", error);
    return { success: false, error };
  }
}
