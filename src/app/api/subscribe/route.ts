import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid email address' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('email_subscribers')
      .insert({ email });

    if (error) {
      // Unique constraint violation — already subscribed
      if (error.code === '23505') {
        return NextResponse.json({ status: 'already_subscribed' });
      }
      return NextResponse.json(
        { status: 'error', message: 'Subscription failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: 'subscribed' });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Invalid request' },
      { status: 400 },
    );
  }
}
