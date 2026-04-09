import { NextResponse } from 'next/server';

/**
 * This route is no longer used.
 * PDF parsing is handled entirely client-side via lib/pdfParser.ts
 * using pdfjs-dist loaded from /public/pdf.min.mjs with webpackIgnore.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use client-side PDF parsing instead.' },
    { status: 410 }
  );
}
