import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let to, subject, message, sendTime;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      to = body.to; subject = body.subject; message = body.message;
      sendTime = null; 
    } else {
      const formData = await request.formData();
      to = formData.get('to'); subject = formData.get('subject');
      message = formData.get('message'); sendTime = formData.get('send_time');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    if (!sendTime) {
       await transporter.sendMail({
         from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
         to, subject, text: message,
       });
       return NextResponse.json({ success: true, message: "Sent!" });
    }

    // 1. Clean the token (this fixed the fetch error!)
    const rawToken = process.env.QSTASH_TOKEN || '';
    const cleanToken = rawToken.replace(/[\n\r\t\s]/g, ''); 

    const scheduledDate = new Date(sendTime);
    const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);

    // 2. USE THE SPECIFIC US REGION URL
    // This stops it from defaulting to Europe (eu-central-1)
    const url = "https://qstash.us-east-1.upstash.io/v2/publish/https://loveisneverwasted.vercel.app/api/send";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cleanToken}`,
        "Content-Type": "application/json",
        "Upstash-Not-Before": unixTimestamp.toString(),
      },
      body: JSON.stringify({ to, subject, message }),
      cache: 'no-store' 
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstash error: ${errorText}`);
    }

    return NextResponse.json({ success: true, message: "Queued!" });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
