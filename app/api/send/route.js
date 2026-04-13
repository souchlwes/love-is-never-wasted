import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

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
         return NextResponse.json({ success: true, message: "Sent immediately (time was in the past)!" });
       }

       const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);
       const payload = {
         to,
         subject,
         message,
         attachmentName: attachments.length > 0 ? attachments[0].filename : null,
         attachmentBase64: attachments.length > 0 ? attachments[0].base64 : null
       };

       const targetUrl = 'https://loveisneverwasted.vercel.app/api/send';

       // ✅ UPDATED: Added ".us-east-1" to the URL
       const qstashResponse = await fetch(`https://qstash.us-east-1.upstash.io/v2/publish/${targetUrl}`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
           'Content-Type': 'application/json',
           'Upstash-Not-Before': unixTimestamp.toString()
         },
         body: JSON.stringify(payload)
       });

       if (!qstashResponse.ok) {
         const errorText = await qstashResponse.text();
         console.error("QStash Error Details:", errorText);
         throw new Error(`QStash rejected: ${errorText}`);
       }

       return NextResponse.json({ success: true, message: "Queued!" });
    }

  } catch (error) {
    console.error("Email Error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
