import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let to, subject, message, sendTime;

    // 1. Get the data
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

    // 2. Immediate Send (Confirmation test)
    if (!sendTime) {
      await transporter.sendMail({
        from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
        to, subject, text: message,
      });
      return NextResponse.json({ success: true, message: "Sent!" });
    }

    // 3. Scheduling (The fix is here)
    const scheduledDate = new Date(sendTime);
    const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);
    
    // Safety check for the token
    const token = process.env.QSTASH_TOKEN?.trim();
    if (!token) throw new Error("QSTASH_TOKEN is missing in Vercel Settings!");

    // ✅ NEW APPROACH: We use the US-EAST-1 regional URL but WITHOUT encoding the destination.
    // This is the most stable way to prevent "fetch failed" on Vercel.
    const qstashUrl = `https://qstash.us-east-1.upstash.io/v2/publish/https://loveisneverwasted.vercel.app/api/send`;

    const response = await fetch(qstashUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Not-Before': unixTimestamp.toString()
      },
      body: JSON.stringify({ to, subject, message })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Upstash Error:", errorData);
      throw new Error(`Upstash rejected: ${errorData}`);
    }

    return NextResponse.json({ success: true, message: "Queued!" });

  } catch (error) {
    console.error("CRITICAL ERROR:", error.message);
    // This will tell us if it's a network error or a code error
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
