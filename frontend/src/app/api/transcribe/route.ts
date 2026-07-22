import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ detail: "A file is required." }, { status: 400 });
    }

    const backendUrl = process.env.TRANSCRIPTION_BACKEND_URL || "http://127.0.0.1:8000/transcribe";
    const uploadForm = new FormData();
    uploadForm.append("file", file, (file as File).name || "upload.wav");

    const response = await fetch(backendUrl, {
      method: "POST",
      body: uploadForm,
    });

    const payload = await response.text();
    try {
      return new NextResponse(payload, {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    } catch {
      return NextResponse.json({ detail: payload || "The transcription backend returned an invalid response." }, { status: response.status });
    }
  } catch (error) {
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
