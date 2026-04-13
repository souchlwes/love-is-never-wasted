import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let to, subject, message, sendTime;

    // 1. Data Parsing
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

    // 2. Immediate Send Logic
    if (!sendTime) {
       await transporter.sendMail({
         from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
         to, subject, text: message,
       });
       return NextResponse.json({ success: true, message: "Sent!" });
    } 

    // 3. Scheduling Logic (The Problem Area)
    const scheduledDate = new Date(sendTime);
    
    // Safety check: Is the date valid?
    if (isNaN(scheduledDate.getTime())) {
      throw new Error("The time you picked is invalid.");
    }

    // Safety check: Is the token actually there?
    const token = process.env.QSTASH_TOKEN?.trim();
    if (!token) {
      throw new Error("Vercel cannot see your QSTASH_TOKEN. Check your environment variables.");
    }

    const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);
    const targetUrl = 'https://loveisneverwasted.vercel.app/api/send';
    
    console.log(`Attempting to schedule for: ${scheduledDate.toLocaleString()}`);

    // We are using the US-East-1 region specifically
    const qstashEndpoint = `https://qstash.us-east-1.upstash.io/v2/publish/${encodeURIComponent(targetUrl)}`;

    const response = await fetch(qstashEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Upstash-Not-Before': unixTimestamp.toString()
      },
      body: JSON.stringify({ to, subject, message })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("QStash Rejected Us:", errorBody);
      throw new Error(`QStash Error: ${errorBody}`);
    }

    return NextResponse.json({ success: true, message: "Queued!" });

  } catch (error) {
    console.error("LOGGED ERROR:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
