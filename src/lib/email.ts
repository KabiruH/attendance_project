import { Resend } from 'resend';

interface EmailParams {
    to: string;
    subject: string;
    text: string;
   }
   
   export async function sendEmail({ to, subject, text }: EmailParams) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    return resend.emails.send({
      from: 'onboarding@resend.dev',
      to,
      subject,
      text
    });
   }