"use client";

/** 2.3 Bulk PDF upload — multi-file queue with progress. */
import { useState } from "react";

export interface PdfJob {
  id: string;
  filename: string;
  status: "queued" | "processing" | "done" | "error";
  progress: number;
  error?: string;
}

export function usePdfQueue() {
  const [jobs, setJobs] = useState<PdfJob[]>([]);
  const [processing, setProcessing] = useState(false);

  const addFiles = (files: FileList | File[]) => {
    const newJobs: PdfJob[] = Array.from(files).map(f => ({
      id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      filename: f.name,
      status: "queued",
      progress: 0,
    }));
    setJobs(prev => [...prev, ...newJobs]);
  };

  const processQueue = async (onComplete: (job: PdfJob, text: string) => void) => {
    setProcessing(true);
    for (const job of jobs) {
      if (job.status !== "queued") continue;
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "processing" } : j));
      try {
        // Simulate PDF extraction (in production, use PDF.js or send to engine)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "done", progress: 100 } : j));
        onComplete(job, `[Extracted text from ${job.filename}]`);
      } catch (e) {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: "error", error: e instanceof Error ? e.message : "Failed" } : j));
      }
    }
    setProcessing(false);
  };

  const clearDone = () => setJobs(prev => prev.filter(j => j.status !== "done"));

  return { jobs, processing, addFiles, processQueue, clearDone };
}
