import { NextResponse } from "next/server";

export async function GET() {
  const version = process.env.npm_package_version || "unknown";
  const env = process.env.NODE_ENV || "development";
  const uptime = typeof process !== "undefined" ? Math.floor(process.uptime()) : 0;

  return NextResponse.json({
    status: "ok",
    version,
    environment: env,
    timestamp: new Date().toISOString(),
    uptime,
    services: {
      ads: process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ? "configured" : "unconfigured",
    },
  });
}
