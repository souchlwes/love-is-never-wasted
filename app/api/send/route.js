import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let to, subject, message, sendTime, attachments = [];

    // 1. SCENARIO A: QStash is waking the site up to send a delayed email
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
      sendTime = null; // Force it to send right now
      
    // 2. SCENARIO B: A user is clicking "Send" on your website
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
          base64: buffer.toString('base64') // Save this to send to QStash
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

    // 3. EXECUTE: Send Immediately
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
       
    // 4. EXECUTE: Queue for the Future
    } else {
       // Convert their chosen time into a Unix Timestamp for QStash
       const scheduledDate = new Date(sendTime);
       const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);

       const payload = {
         to,
         subject,
         message,
         attachmentName: attachments.length > 0 ? attachments[0].filename : null,
         attachmentBase64: attachments.length > 0 ? attachments[0].base64 : null
       };

       // Tell QStash to call your live Vercel URL when the time comes!
       const targetUrl = 'https://love-is-never-wasted-when-it-is-shared.vercel.app/api/send';

       const qstashResponse = await fetch(`https://qstash.upstash.io/v2/publish/${targetUrl}`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
           'Content-Type': 'application/json',
           'Upstash-Not-Before': unixTimestamp.toString()
         },
         body: JSON.stringify(payload)
       });

       if (!qstashResponse.ok) throw new Error("Failed to schedule");

       return NextResponse.json({ success: true, message: "Queued for the future!" });
    }

  } catch (error) {
    console.error("Email Error:", error);
    return NextResponse.json({ success: false, error: "Failed to process request" }, { status: 500 });
  }
}