"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileAudio2, Link2, LoaderCircle, Sparkles, UploadCloud, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type UploadItem = {
  id: string;
  fileName: string;
  sizeLabel: string;
  status: "queued" | "uploading" | "processing" | "complete" | "error";
  progress: number;
  result?: string;
  error?: string;
  file?: File;
  source?: "upload" | "url";
};

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function TranscriptionDashboard() {
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const completedCount = useMemo(() => files.filter((item) => item.status === "complete").length, [files]);
  const totalCount = files.length;
  const overallProgress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;

    const nextItems = selectedFiles.map((file, index) => ({
      id: `${file.name}-${Date.now()}-${index}`,
      fileName: file.name,
      sizeLabel: formatSize(file.size),
      status: "queued" as const,
      progress: 0,
      file,
    }));

    setFiles((prev) => [...prev, ...nextItems]);
    event.target.value = "";
  };

  const startUploads = async () => {
    if (!files.length) return;

    setIsUploading(true);
    const pending = files.filter((item) => item.status === "queued");
    if (!pending.length) return;

    const uploadPromises = pending.map((item) => uploadSingleFile(item));
    await Promise.allSettled(uploadPromises);
    setIsUploading(false);
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    const item: UploadItem = {
      id: `url-${Date.now()}`,
      fileName: new URL(urlInput).hostname,
      sizeLabel: "remote audio",
      status: "queued",
      progress: 0,
      source: "url",
    };

    setFiles((prev) => [...prev, item]);
    setIsUploading(true);

    await uploadSingleFile(item, urlInput.trim());
    setIsUploading(false);
  };

  const uploadSingleFile = async (item: UploadItem, explicitUrl?: string) => {
    setFiles((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading", progress: 18 } : entry)));

    const timer = window.setInterval(() => {
      setFiles((prev) => prev.map((entry) => {
        if (entry.id !== item.id) return entry;
        const nextValue = Math.min(92, entry.progress + 8);
        return { ...entry, progress: nextValue };
      }));
    }, 180);

    try {
      let response: Response;
      let payload: any;

      if (explicitUrl) {
        const formData = new FormData();
        formData.append("url", explicitUrl);
        response = await fetch("/api/transcribe-url", {
          method: "POST",
          body: formData,
        });
      } else {
        const formData = new FormData();
        formData.append("file", item.file as File);
        response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
      }

      payload = await response.json().catch(() => ({ detail: "The transcription service did not return a valid payload." }));
      window.clearInterval(timer);

      if (!response.ok) {
        throw new Error(payload.detail || "The transcription service failed to process the file.");
      }

      const message = payload.warning || payload.full_text?.trim() || "Transcription completed successfully.";
      const nextStatus = payload.status === "no_speech_detected" ? "error" : "complete";

      setFiles((prev) => prev.map((entry) => {
        if (entry.id !== item.id) return entry;
        return {
          ...entry,
          status: nextStatus,
          progress: 100,
          result: message,
          error: nextStatus === "error" ? message : undefined,
        };
      }));
    } catch (error) {
      window.clearInterval(timer);
      setFiles((prev) => prev.map((entry) => {
        if (entry.id !== item.id) return entry;
        return {
          ...entry,
          status: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "Unable to process this file.",
        };
      }));
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,_#f8fbff_0%,_#eef4ff_45%,_#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-[32px] border border-slate-200/70 bg-white/75 p-6 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.45)] backdrop-blur xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700">
              <Sparkles className="h-4 w-4" />
              Enterprise transcription orchestration
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Scalable media intelligence workspace</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                Upload, monitor, and orchestrate multiple audio files with resilient progress states, reusable components, and parallel-ready architecture.
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-[360px] flex-col gap-2">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelection} accept="audio/*,.wav,.m4a,.mp3,.mp4" />
            <Button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-950 hover:bg-slate-800">
              <UploadCloud className="mr-2 h-4 w-4" />
              Select files
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <Link2 className="h-4 w-4 text-slate-500" />
              <input
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://example.com/audio.mp3"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <Button type="button" onClick={handleUrlSubmit} disabled={isUploading || !urlInput.trim()} className="bg-cyan-600 hover:bg-cyan-500">
              <Link2 className="mr-2 h-4 w-4" />
              Transcribe URL
            </Button>
            <Button type="button" onClick={startUploads} disabled={isUploading || !files.some((item) => item.status === "queued")} className="bg-cyan-600 hover:bg-cyan-500">
              {isUploading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
              Start transcription
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Batch transcription pipeline</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Parallel-ready handoff for multiple files and live delivery states.</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {completedCount}/{totalCount} completed
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Overall completion</span>
                  <span className="font-semibold text-slate-900">{overallProgress}%</span>
                </div>
                <ProgressBar value={overallProgress} />
              </div>

              <div className="space-y-3">
                {files.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center text-sm text-slate-600">
                    Choose one or more audio files to start the pipeline.
                  </div>
                ) : (
                  files.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-white p-2 shadow-sm">
                            <FileAudio2 className="h-5 w-5 text-cyan-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{item.fileName}</p>
                            <p className="text-sm text-slate-500">{item.sizeLabel}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                          {item.status === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
                          {item.status === "error" ? <XCircle className="h-4 w-4 text-rose-600" /> : null}
                          {item.status === "uploading" || item.status === "processing" ? <LoaderCircle className="h-4 w-4 animate-spin text-amber-500" /> : null}
                          {item.status === "queued" ? <Zap className="h-4 w-4 text-slate-500" /> : null}
                          {item.status}
                        </div>
                      </div>
                      <div className="mt-3">
                        {item.status === "queued" ? <ProgressBar value={0} /> : item.status === "uploading" || item.status === "processing" ? <Skeleton className="h-2 w-full" /> : <ProgressBar value={item.progress} />}
                      </div>
                      {item.result ? <p className="mt-3 text-sm text-slate-600">{item.result}</p> : null}
                      {item.error ? <p className="mt-3 text-sm text-rose-600">{item.error}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Architecture highlights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-900">Scalable UI system</p>
                <p className="mt-1 text-sm text-slate-600">Reusable cards, buttons, skeletons, and progress primitives support consistent enterprise-grade experiences.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-900">Parallel delivery strategy</p>
                <p className="mt-1 text-sm text-slate-600">Multiple files fan out concurrently and each job resolves independently as soon as the backend completes.</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                <p className="font-semibold text-slate-900">Production readiness</p>
                <p className="mt-1 text-sm text-slate-600">The design is structured to evolve into real-time sockets, resumable uploads, and observability dashboards.</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
