export interface ImageResponse {
  id: string;
  style_name: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  image_url?: string | null;
  error_message?: string | null;
  variants?: {
    youtube?: string;
    shorts?: string;
    square?: string;
    landscape?: string;
    linkedin?: string;
    coverpage?: string;
  } | null;
}

export interface JobResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  snapshot_url: string;
  num_images: number;
  images: ImageResponse[];
}

export interface CreateJobRequest {
  prompt: string;
  num_images: number;
  snapshot_url: string;
}

export interface CreateJobResponse {
  job_id: string;
}

export interface ImageReadyEvent {
  image_id: string;
  style_name: string;
  image_url: string;
  variants: Record<string, string>;
}

export interface ImageFailedEvent {
  image_id: string;
  style_name: string;
  error: string;
}

export interface JobCompletedEvent {
  job_id: string;
  status: string;
}

/**
 * Uploads a snapshot image file to the backend
 * @param file The image file to upload
 * @returns The uploaded ImageKit CDN URL
 */
export async function uploadSnapshot(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload-snapshot", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to upload snapshot image.");
  }

  return res.json();
}

/**
 * Creates a new image generation job
 */
export async function createJob(request: CreateJobRequest): Promise<CreateJobResponse> {
  const res = await fetch("/api/job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to create generation job.");
  }

  return res.json();
}

/**
 * Fetches all jobs from the backend
 */
export async function listJobs(): Promise<JobResponse[]> {
  const res = await fetch("/api/jobs");
  if (!res.ok) {
    throw new Error("Failed to retrieve jobs history.");
  }
  return res.json();
}

/**
 * Fetches a single job's current status
 */
export async function getJobStatus(jobId: string): Promise<JobResponse> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`Failed to retrieve job details for ${jobId}.`);
  }
  return res.json();
}

export interface StreamHandlers {
  onImageReady?: (event: ImageReadyEvent) => void;
  onImageFailed?: (event: ImageFailedEvent) => void;
  onJobCompleted?: (event: JobCompletedEvent) => void;
  onError?: (error: any) => void;
}

/**
 * Connects to the real-time EventSource stream for a job and registers listeners
 * @param jobId The job UUID to stream
 * @param handlers Callback event handlers
 * @returns Cleanup function to close the stream
 */
export function streamJobStatus(jobId: string, handlers: StreamHandlers): () => void {
  const eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

  eventSource.addEventListener("image_ready", (e) => {
    try {
      const data: ImageReadyEvent = JSON.parse(e.data);
      handlers.onImageReady?.(data);
    } catch (err) {
      console.error("Error parsing image_ready event:", err);
    }
  });

  eventSource.addEventListener("image_failed", (e) => {
    try {
      const data: ImageFailedEvent = JSON.parse(e.data);
      handlers.onImageFailed?.(data);
    } catch (err) {
      console.error("Error parsing image_failed event:", err);
    }
  });

  eventSource.addEventListener("job_completed", (e) => {
    try {
      const data: JobCompletedEvent = JSON.parse(e.data);
      handlers.onJobCompleted?.(data);
    } catch (err) {
      console.error("Error parsing job_completed event:", err);
    }
  });

  eventSource.onerror = (err) => {
    handlers.onError?.(err);
  };

  return () => {
    eventSource.close();
  };
}
