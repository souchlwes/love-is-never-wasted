import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase securely using Vercel Environment Variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const to = formData.get('to');
    const subject = formData.get('subject');
    const message = formData.get('message');
    const sendTime = formData.get('send_time');
    const file = formData.get('attachment');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    // --- 1. IMMEDIATE SEND ---
    if (!sendTime) {
      let attachments = [];
      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        attachments.push({ filename: file.name, content: buffer });
      }

      await transporter.sendMail({
        from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
        to, subject, text: message, attachments
      });
      return NextResponse.json({ success: true, message: "Sent immediately!" });
    }

    // --- 2. SCHEDULED SEND (Save to Supabase) ---
    let imageUrl = null;

    // A. Upload the photo to Supabase Storage
    if (file && file.size > 0) {
        // Create a unique name for the file so they don't overwrite each other
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('email-attachments')
          .upload(fileName, file, { contentType: file.type });

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

        // Get the public URL to save in the database
        const { data: publicUrlData } = supabase.storage
          .from('email-attachments')
          .getPublicUrl(fileName);

        imageUrl = publicUrlData.publicUrl;
    }

    // B. Save the email into the queue table
    const { error: dbError } = await supabase
      .from('email_queue')
      .insert([
        {
          recipient_email: to,
          subject: subject,
          message_body: message,
          image_url: imageUrl,
          send_at: new Date(sendTime).toISOString(),
        }
      ]);

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    return NextResponse.json({ success: true, message: "Queued successfully!" });

  } catch (error) {
    console.error("API ERROR:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}