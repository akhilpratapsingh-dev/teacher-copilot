'use client';

/**
 * Extracts all text from a PDF file using pdfjs-dist in the browser.
 *
 * IMPORTANT: We use /* webpackIgnore: true *\/ so webpack does NOT bundle
 * pdfjs-dist. Instead the browser fetches it as a native ES module from
 * /public/pdf.min.mjs — this avoids the "Object.defineProperty called on
 * non-object" error caused by webpack mangling pdfjs internals.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Load pdfjs as a native ES module — webpack MUST NOT bundle this
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — webpackIgnore prevents bundling; types still work via cast
  const pdfjsLib = await import(/* webpackIgnore: true */ '/pdf.min.mjs') as typeof import('pdfjs-dist');

  // Worker is also served from /public/ — no CDN needed
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const loadingTask = pdfjsLib.getDocument({ data: uint8 });
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

  return pages.join('\n');
}
