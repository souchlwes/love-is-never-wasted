import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const to = formData.get('to');
    const subject = formData.get('subject');
    const message = formData.get('message');
    const sendTime = formData.get('send_time');
    const file = formData.get('attachment');

    let attachments = [];
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      attachments.push({
        filename: file.name,
        content: buffer,
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    if (!sendTime) {
       await transporter.sendMail({
         // Sets your custom lowercase sender name
         from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
         
         // Forces replies to go to a fake, dead-end address
         replyTo: 'do-not-reply@acoupleminutes.com', 
         
         to,
         subject,
         text: message,
         attachments,
       });
       return NextResponse.json({ success: true, message: "Sent immediately!" });
    } else {
       // FUTURE QUEUE LOGIC WILL GO HERE
       return NextResponse.json({ success: true, message: "Queued for the future!" });
    }

  // 👇 THIS is the missing piece that catches errors and closes the function!
  } catch (error) {
    console.error("Email Error:", error);
    return NextResponse.json({ success: false, error: "Failed to send" }, { status: 500 });
  }
}