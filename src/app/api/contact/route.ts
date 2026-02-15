import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!name || name.length < 2) {
      return NextResponse.json(
        { status: 'error', message: 'Name is required' },
        { status: 400 },
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid email address' },
        { status: 400 },
      );
    }

    if (!message || message.length < 10) {
      return NextResponse.json(
        { status: 'error', message: 'Message must be at least 10 characters' },
        { status: 400 },
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { status: 'error', message: 'Message is too long' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('contact_submissions')
      .insert({ name, email, message });

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Submission failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: 'sent' });
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Invalid request' },
      { status: 400 },
    );
  }
}
