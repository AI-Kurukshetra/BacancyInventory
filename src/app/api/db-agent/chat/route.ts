import { NextResponse } from "next/server";
import { askAgent } from "@/lib/db-agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : null;
    if (!message) {
      return NextResponse.json(
        { error: "Missing or invalid 'message' in body." },
        { status: 400 }
      );
    }

    const { answer, data, sql } = await askAgent(message);
    return NextResponse.json({
      response: answer,
      data,
      sql,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[db-agent/chat]", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
