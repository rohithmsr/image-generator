import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import type { Route } from "./+types/home";
import {
  Sparkles,
  UploadCloud,
  Trash2,
  Image as ImageIcon,
  Grid,
  Calendar,
  ChevronRight,
  Loader2,
  Plus,
  Compass,
  Layout,
  Film
} from "lucide-react";
import { uploadSnapshot, createJob, listJobs, type JobResponse } from "../api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AI Image Generator" },
    { name: "description", content: "Transform snapshots into styled social media and design images in seconds." },
  ];
}

const PRESET_PROMPTS = [
  "A tech review of the latest futuristic smartphone showing glowing specs",
  "A software developer code debug crisis with coffee, dark room, neon lighting",
  "An epic travel vlog adventure featuring a stunning sunset over mountains",
  "A hyper-realistic gaming setup desk setup tour with RGB keyboard and mouse"
];

const STYLE_INFO = [
  { name: "Bold & Dramatic", desc: "High contrast, moody background, cinematic highlights" },
  { name: "Clean & Minimal", desc: "Bright professional lighting, spacious modern aesthetic" },
  { name: "Fun & Cartoony", desc: "Bright saturated colors, playful proportions, high energy" },
  { name: "Vibrant & Energetic", desc: "Dynamic pop-art colors, color gradients, action-ready" }
];

export default function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [prompt, setPrompt] = useState("");
  const [numImages, setNumImages] = useState(4);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // UI State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // History State
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

  // Load history
  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await listJobs();
        setJobs(data);
      } catch (err) {
        console.error("Failed to load jobs history:", err);
      } finally {
        setIsLoadingJobs(false);
      }
    }
    fetchHistory();
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type.startsWith("image/")) {
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
        setErrorMessage(null);
      } else {
        setErrorMessage("Please select a valid image file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setErrorMessage(null);
    }
  };

  const removeSelectedFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setErrorMessage("Please provide a prompt description.");
      return;
    }
    if (!file) {
      setErrorMessage("Please upload a snapshot / screenshot of the subject.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // 1. Upload Snapshot
      const { url: snapshotUrl } = await uploadSnapshot(file);
      setIsUploading(false);

      // 2. Create Job
      const { job_id } = await createJob({
        prompt: prompt.trim(),
        num_images: numImages,
        snapshot_url: snapshotUrl
      });

      // 3. Redirect to Job Details
      navigate(`/job/${job_id}`);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred during submission.");
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white font-sans selection:bg-purple-500 selection:text-white pb-16">
      
      {/* Premium Navigation Header */}
      <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <Sparkles className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                ImageGen
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 block -mt-1">
                AI Studio
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-white/5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              FastAPI Server Connected
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Left Side: Creation Form */}
        <section className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight">
              Create Stunning <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Images</span> in Seconds.
            </h1>
            <p className="text-slate-400 mt-3 text-lg">
              Upload your snapshot, choose how many styles to generate, and describe your concept. Our AI will handle the rest.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900/60 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
            
            {/* 1. Prompt Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-bold tracking-wider text-slate-300 uppercase block">
                1. Describe your Image Idea
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe what the final image should represent (e.g. 'Excited reaction with neon colors, glowing gadgets...')"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
              />
              
              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2 pt-1.5">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(p)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5"
                  >
                    <Compass className="h-3 w-3" />
                    {p.length > 35 ? p.substring(0, 35) + "..." : p}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Drag & Drop File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-bold tracking-wider text-slate-300 uppercase block">
                2. Upload Screenshot / Snapshot
              </label>
              
              {!previewUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerUploadClick}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-purple-500 bg-purple-500/10 text-purple-300"
                      : "border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-400"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <UploadCloud className="h-10 w-10 text-violet-400 mb-3" />
                  <p className="font-semibold text-sm text-white">Drag & drop your snapshot image here</p>
                  <p className="text-xs text-slate-500 mt-1">or click to browse local files (PNG, JPG)</p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950 p-2 group">
                  <img
                    src={previewUrl}
                    alt="Upload snapshot preview"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all gap-3">
                    <button
                      type="button"
                      onClick={triggerUploadClick}
                      className="px-4 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs hover:bg-slate-800 transition-all font-semibold flex items-center gap-1.5"
                    >
                      <Plus className="h-4 w-4" /> Change
                    </button>
                    <button
                      type="button"
                      onClick={removeSelectedFile}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-xl text-xs transition-all font-semibold flex items-center gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* 3. Style Count & Previews */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold tracking-wider text-slate-300 uppercase block">
                  3. Select Number of Style Variations
                </label>
                <span className="text-xs font-black px-2 py-1 bg-violet-600/30 text-violet-300 border border-violet-500/20 rounded">
                  {numImages} styles Selected
                </span>
              </div>

              {/* Styled Variation Count Buttons */}
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumImages(num)}
                    className={`py-3 px-4 rounded-xl font-bold border transition-all text-center ${
                      numImages === num
                        ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/30"
                        : "bg-slate-950/40 border-white/5 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Style List Previews */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {STYLE_INFO.slice(0, numImages).map((style, idx) => (
                  <div key={idx} className="flex gap-3 items-start p-3 bg-slate-950/40 border border-white/5 rounded-xl">
                    <span className="flex-shrink-0 h-6 w-6 rounded bg-violet-900/60 text-violet-300 text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{style.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{style.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 bg-red-950/30 border border-red-500/20 text-red-400 text-sm rounded-2xl font-medium">
                {errorMessage}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl font-black bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-violet-850 disabled:to-fuchsia-850 transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-xl hover:shadow-purple-900/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>
                    {isUploading ? "Uploading Screenshot to ImageKit..." : "Spawning AI Workers..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>Generate AI Images</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right Side: Generation History */}
        <section className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Grid className="h-5 w-5 text-indigo-400" /> Recent Studio Generations
            </h2>
          </div>

          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
            {isLoadingJobs ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="bg-slate-900/30 border border-white/5 rounded-2xl p-4 animate-pulse space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-1/3 bg-slate-800 rounded"></div>
                    <div className="h-4 w-16 bg-slate-800 rounded-full"></div>
                  </div>
                  <div className="h-3 w-5/6 bg-slate-800 rounded"></div>
                  <div className="flex gap-2">
                    <div className="h-10 w-16 bg-slate-800 rounded-lg"></div>
                    <div className="h-10 w-16 bg-slate-800 rounded-lg"></div>
                  </div>
                </div>
              ))
            ) : jobs.length === 0 ? (
              // Empty state
              <div className="text-center py-16 border border-white/5 border-dashed rounded-2xl bg-slate-900/10 text-slate-500">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold text-sm">No generations found</p>
                <p className="text-xs mt-1 max-w-[240px] mx-auto">Create a job on the left to start generating images.</p>
              </div>
            ) : (
              // History items
              jobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/job/${job.id}`}
                  className="block bg-slate-900/40 hover:bg-slate-900/80 border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all hover:translate-x-1 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <p className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        {job.images && job.images[0]?.id ? "Job Ready" : "Initial Job"}
                      </p>
                      <h3 className="font-bold text-sm truncate text-slate-200 group-hover:text-white transition-all">
                        {job.prompt}
                      </h3>
                    </div>
                    
                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border flex-shrink-0 ${
                        job.status === "completed"
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                          : job.status === "failed"
                          ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                          : "bg-indigo-500/10 border-indigo-500/25 text-indigo-400 animate-pulse"
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {/* Image Row */}
                  <div className="flex gap-2.5 mt-4 items-center justify-between">
                    <div className="flex gap-2 overflow-hidden">
                      {job.snapshot_url && (
                        <div className="relative h-12 w-18 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-slate-950">
                          <img
                            src={job.snapshot_url}
                            alt="Snapshot"
                            className="h-full w-full object-cover opacity-60"
                          />
                          <span className="absolute bottom-0 right-0 bg-slate-900/90 text-[8px] font-extrabold px-1 rounded-tl">
                            SRC
                          </span>
                        </div>
                      )}
                      
                      {job.images && job.images.filter(im => im.status === "completed").map((img) => (
                        <div key={img.id} className="relative h-12 w-18 rounded-lg overflow-hidden border border-purple-500/20 flex-shrink-0 bg-slate-950">
                          <img
                            src={img.image_url || ""}
                            alt={img.style_name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                    
                    <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
