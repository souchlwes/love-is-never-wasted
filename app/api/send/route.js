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

    // 1. STRIP EVERYTHING: This removes any hidden spaces, tabs, or newlines 
    // that might be hiding in your Vercel Environment Variables.
    const rawToken = process.env.QSTASH_TOKEN || '';
    const cleanToken = rawToken.replace(/[\n\r\t\s]/g, ''); 

    if (!cleanToken) throw new Error("QSTASH_TOKEN is empty in Vercel settings.");

    const scheduledDate = new Date(sendTime);
    const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);

    // 2. USE THE GLOBAL ENDPOINT: QStash will automatically route this 
    // to your US region based on your token.
    const url = "https://qstash.upstash.io/v2/publish/https://loveisneverwasted.vercel.app/api/send";

    console.log("Attempting call with cleaned headers...");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cleanToken}`,
        "Content-Type": "application/json",
        "Upstash-Not-Before": unixTimestamp.toString(),
      },
      body: JSON.stringify({ to, subject, message }),
      // This forces Node to use a fresh connection
      cache: 'no-store' 
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upstash error: ${errorText}`);
    }

    return NextResponse.json({ success: true, message: "Queued!" });

  } catch (error) {
    // This logs the "Cause" which tells us if it's a SSL or DNS issue
    console.error("CRITICAL ERROR:", error.message);
    if (error.cause) console.error("ERROR CAUSE:", error.cause);
    
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
