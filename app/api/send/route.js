import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let to, subject, message, sendTime;

    // 1. Parse incoming data
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
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // 2. Immediate Send (This is what Upstash triggers)
    if (!sendTime) {
       console.log("Processing immediate send...");
       await transporter.sendMail({
         from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
         to, subject, text: message,
       });
       return NextResponse.json({ success: true, message: "Sent!" });
    }

    // 3. Scheduling (This is where the site calls Upstash)
    const token = (process.env.QSTASH_TOKEN || '').trim();
    const scheduledDate = new Date(sendTime);
    const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);

    console.log("Attempting to call Upstash...");

    // ✅ THE CLEANEST FETCH POSSIBLE
    // We use the direct publish URL with NO extra encoding
    const response = await fetch("https://qstash.us-east-1.upstash.io/v2/publish/https://loveisneverwasted.vercel.app/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Not-Before": unixTimestamp.toString()
      },
      body: JSON.stringify({ to, subject, message })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Upstash Error Response:", errorText);
      throw new Error(`Upstash said: ${errorText}`);
    }

    const result = await response.json();
    console.log("Upstash Success:", result);

    return NextResponse.json({ success: true, message: "Queued!" });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
