import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Use pdfjs-dist legacy build for Node.js environments
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Point workerSrc to the local worker file so pdfjs can load it
    const workerPath = path.join(
      process.cwd(),
      'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath.replace(/\\/g, '/')}`;

    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => 'str' in item)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str)
        .join(' ');
      pages.push(text);
    }

    return NextResponse.json({ text: pages.join('\n') });
  } catch (err: unknown) {
    console.error('[parse-pdf]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
