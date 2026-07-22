import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const url = formData.get("url");

    if (typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ detail: "A URL is required." }, { status: 400 });
    }

    const backendUrl = process.env.TRANSCRIPTION_BACKEND_URL || "http://127.0.0.1:8000/transcribe-url";
    const uploadForm = new FormData();
    uploadForm.append("url", url);

    const response = await fetch(backendUrl, {
      method: "POST",
      body: uploadForm,
    });

    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
