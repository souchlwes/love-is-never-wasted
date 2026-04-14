import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(request) {
  try {
    // 1. Find emails ready to be sent
    const { data: queue, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('is_sent', false)
      .lte('send_at', new Date().toISOString());

    if (error) throw error;
    if (!queue || queue.length === 0) return NextResponse.json({ message: "No emails to process." });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    // 2. Process each email in the batch
    for (const item of queue) {
      await transporter.sendMail({
        from: `"love's never wasted" <${process.env.EMAIL_USER}>`,
        to: item.recipient_email,
        subject: item.subject,
        html: item.message_body, // ✅ THE FIX: Changed 'text' to 'html' so formatting works!
        attachments: item.image_url ? [{ path: item.image_url }] : []
      });

      // 3. Mark as sent so we don't send it again
      await supabase.from('email_queue').update({ is_sent: true }).eq('id', item.id);

      // 4. THE CLEANUP: Delete the photo from the storage bucket
      if (item.image_url) {
        // This splits the long URL by '/' and grabs the very last piece (the filename)
        const fileName = item.image_url.split('/').pop();
        
        const { error: deleteError } = await supabase.storage
          .from('email-attachments')
          .remove([fileName]);

        if (deleteError) {
          console.error(`Failed to delete ${fileName}:`, deleteError.message);
        } else {
          console.log(`Successfully deleted ${fileName} from storage.`);
        }
      }
    }

    return NextResponse.json({ success: true, count: queue.length });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
