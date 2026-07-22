import os


class TranscriptionPipeline:
    def __init__(self, model_size="large-v3", device=None):
        """
        Initializes the model.
        Engineering Decision: We use compute_type="int8".
        This quantization drops VRAM usage dramatically with <0.1% impact on accuracy,
        making it highly efficient for production GPU instances.
        """
        if device is None:
            device = "cuda" if os.getenv("USE_CUDA", "0").lower() in {"1", "true", "yes"} else "cpu"

        try:
            from faster_whisper import WhisperModel
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "faster-whisper is not installed. Install it with `pip install faster-whisper` "
                "and use a supported Python version."
            ) from exc

        self.model = WhisperModel(model_size, device=device, compute_type="int8")

    def accept_and_validate_file(self, file_path: str) -> str:
        """Validates that the file exists before attempting to process."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Audio file not found: {file_path}")
        return file_path

    def transcribe_audio(self, valid_file_path: str):
        """
        Transcribes the audio.
        Engineering Decision: vad_filter=True is critical.
        It applies Voice Activity Detection to strip silent audio chunks, 
        preventing the well-known "Whisper hallucination" loop on dead air.
        """
        segments, info = self.model.transcribe(
            valid_file_path, 
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        return segments, info

    def format_timestamped_results(self, segments, info) -> dict:
        """Formats the output to include segment-level timestamps and metadata."""
        pipeline_result = {
            "metadata": {
                "detected_language": info.language,
                "language_probability": round(info.language_probability, 4)
            },
            "full_text": "",
            "segments": []
        }

        text_buffer = []
        for segment in segments:
            # Extracting exact segment timestamps
            pipeline_result["segments"].append({
                "start_time": round(segment.start, 2),
                "end_time": round(segment.end, 2),
                "text": segment.text.strip()
            })
            text_buffer.append(segment.text.strip())

        pipeline_result["full_text"] = " ".join(text_buffer)
        return pipeline_result
