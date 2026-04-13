import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import https from 'https'; // ✅ Use Node's built-in security module

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

    // 1. Clean the token aggressively
    const cleanToken = (process.env.QSTASH_TOKEN || '').trim().replace(/[\n\r\t\s]/g, '');
    if (!cleanToken) throw new Error("QSTASH_TOKEN is missing!");

    const scheduledDate = new Date(sendTime);
    const unixTimestamp = Math.floor(scheduledDate.getTime() / 1000);
    const targetUrl = "https://loveisneverwasted.vercel.app/api/send";
    const postData = JSON.stringify({ to, subject, message });

    console.log(`Token Length: ${cleanToken.length} characters`); // Debug check

    // 2. USE NATIVE HTTPS REQUEST (The Fix)
    // This bypasses Vercel's fetch engine and talks directly to the internet
    const scheduleWithHttps = () => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'qstash.us-east-1.upstash.io',
          port: 443,
          path: `/v2/publish/${targetUrl}`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
            'Upstash-Not-Before': unixTimestamp.toString(),
            'Content-Length': Buffer.byteLength(postData)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`Upstash Status ${res.statusCode}: ${data}`));
            }
          });
        });

        req.on('error', (e) => { reject(e); });
        req.write(postData);
        req.end();
      });
    };

    console.log("Calling Upstash via native HTTPS...");
    await scheduleWithHttps();

    return NextResponse.json({ success: true, message: "Queued!" });

  } catch (error) {
    console.error("--- SYSTEM ERROR LOG ---");
    console.error("Message:", error.message);
    if (error.stack) console.error("Stack:", error.stack);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
