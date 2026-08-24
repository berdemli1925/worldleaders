import { NextResponse } from "next/server";

import { getMomentumData, serializeMomentum } from "@/lib/momentum";

// Backs AŞAMA 4's rank-change arrows/tabs on the client (Dashboard.tsx
// polls this — see the comment there for why polling, not realtime, is
// enough here). Cheap to compute (see src/lib/momentum.ts) but not free, so
// this is meant to be called every so often, not on every render.
export async function GET() {
  try {
    const data = await getMomentumData();
    return NextResponse.json(serializeMomentum(data));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
