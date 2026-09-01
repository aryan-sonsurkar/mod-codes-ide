import { NextResponse } from "next/server";

const PUBLISHER_ID = process.env.ADSENSE_PUBLISHER_ID || "";

export async function GET() {
  if (!PUBLISHER_ID) {
    return new NextResponse("Not configured", { status: 404 });
  }

  const content = `google.com, ${PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
