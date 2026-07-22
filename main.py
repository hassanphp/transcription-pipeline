
import os
import tempfile
import urllib.request
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from transcription_pipeline import TranscriptionPipeline

app = FastAPI(title="Transcription Pipeline")
pipeline: Optional[TranscriptionPipeline] = None


def get_pipeline() -> TranscriptionPipeline:
    global pipeline
    if pipeline is None:
        device = os.getenv("TRANSCRIPTION_DEVICE", "cpu")
        model_size = os.getenv("WHISPER_MODEL_SIZE", "large-v3")
        pipeline = TranscriptionPipeline(model_size=model_size, device=device)
    return pipeline


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


def _run_transcription(file_path: str) -> dict:
    valid_file = get_pipeline().accept_and_validate_file(file_path)
    segments, info = get_pipeline().transcribe_audio(valid_file)
    result = get_pipeline().format_timestamped_results(segments, info)

    if not result.get("full_text", "").strip():
        result["warning"] = "No speech was detected in the provided audio. Please use a spoken audio sample."
        result["status"] = "no_speech_detected"
    else:
        result["status"] = "completed"

    return result


@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)) -> dict:
    try:
        suffix = os.path.splitext(file.filename or "upload")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name

        try:
            return _run_transcription(temp_path)
        finally:
            os.remove(temp_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/transcribe-url")
async def transcribe_url(url: str = Form(...)) -> dict:
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".tmp") as temp_file:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=120) as response:
                temp_file.write(response.read())
            temp_path = temp_file.name

        try:
            return _run_transcription(temp_path)
        finally:
            os.remove(temp_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not download the provided URL: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
