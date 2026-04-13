import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Client } from "@upstash/qstash";

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let to, subject, message, sendTime, attachments = [];

    if (contentType.includes('application/json')) {
      const body = await request.json();
      to = body.to;
      subject = body.subject;
      message = body.message;
      if (body.attachmentName && body.attachmentBase64) {
         attachments.push({
           filename: body.attachmentName,
           content: Buffer.from(body.attachmentBase64, 'base64')
         });
      }
      sendTime = null; 
    } else {
      const formData = await request.formData();
      to = formData.get('to');
      subject = formData.get('subject');
      message = formData.get('message');
      sendTime = formData.get('send_time');
      const file = formData.get('attachment');

      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({
          filename: file.name,
          content: buffer,
          base64: buffer.toString('base64')
        });
      }
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
         from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
         replyTo: 'do-not-reply@acoupleminutes.com',
         to,
         subject,
         text: message,
         attachments: attachments.map(a => ({ filename: a.filename, content: a.content })),
       });
       return NextResponse.json({ success: true, message: "Sent!" });
       
    } else {
       const scheduledDate = new Date(sendTime);
       
       if (scheduledDate < new Date()) {
         await transporter.sendMail({
           from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
           to,
           subject,
           text: message,
         });
         return NextResponse.json({ success: true, message: "Sent immediately!" });
       }

       // ✅ UPDATED CLIENT FOR US REGION
       const qstash = new Client({ 
         token: process.env.QSTASH_TOKEN?.trim(),
         baseUrl: "https://qstash.us-east-1.upstash.io" 
       });

       await qstash.publishJSON({
         url: `https://loveisneverwasted.vercel.app/api/send`,
         body: {
           to,
           subject,
           message,
           attachmentName: attachments.length > 0 ? attachments[0].filename : null,
           attachmentBase64: attachments.length > 0 ? attachments[0].base64 : null
         },
         notBefore: Math.floor(scheduledDate.getTime() / 1000),
       });

       return NextResponse.json({ success: true, message: "Queued!" });
    }

  } catch (error) {
    console.error("FINAL ERROR LOG:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
