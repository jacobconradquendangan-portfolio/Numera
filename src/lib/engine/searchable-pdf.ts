import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface SearchableWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SearchablePage {
  jpeg: Buffer;
  words: SearchableWord[];
}

const MAX_EDGE_POINTS = 792;

/**
 * Builds a PDF from scanned page images with an invisible, perfectly aligned
 * text layer so the pages become searchable, selectable, and highlightable in
 * any viewer (not just browsers that OCR scans on their own).
 */
export async function buildSearchablePdf(pages: SearchablePage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Numera searchable source');
  doc.setProducer('Numera');
  doc.setCreator('Numera OCR');

  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (const { jpeg, words } of pages) {
    let image;
    try {
      image = await doc.embedJpg(new Uint8Array(jpeg));
    } catch {
      continue;
    }

    const scale = MAX_EDGE_POINTS / Math.max(image.width, image.height);
    const width = image.width * scale;
    const height = image.height * scale;

    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });

    for (const word of words) {
      const text = word.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const size = Math.max(1, (word.y1 - word.y0) * scale);
      const x = word.x0 * scale;
      const y = height - word.y1 * scale;
      try {
        page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0), opacity: 0 });
      } catch {
        // Skip glyphs the standard font cannot encode.
      }
    }
  }

  return doc.save();
}
