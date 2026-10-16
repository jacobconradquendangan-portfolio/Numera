import { NextResponse } from 'next/server';
import { TAXONOMY } from '@/lib/engine/parser';

export const runtime = 'nodejs';

export async function GET() {
  const categories = TAXONOMY.map((definition) => ({
    key: definition.key,
    label: definition.label,
    statement: definition.statement,
    section: definition.section,
  }));
  return NextResponse.json({ categories });
}
