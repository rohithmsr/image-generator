import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import type { Route } from "./+types/job-detail";
import {
  ArrowLeft,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  Copy,
  ExternalLink,
  Tv,
  Smartphone,
  Share2,
  Grid,
  Info,
  Loader2
} from "lucide-react";
import { getJobStatus, streamJobStatus, type JobResponse, type ImageResponse } from "../api";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "AI Generation Studio - Live Stream" },
  ];
}

const STYLE_NAMES_MAP: Record<string, string> = {
  bold_dramatic: "Bold & Dramatic",
  clean_minimal: "Clean & Minimal",
  fun_cartoony: "Fun & Cartoony",
  vibrant_energetic: "Vibrant & Energetic"
};

const ASPECT_RATIO_DESCS: Record<string, string> = {
  youtube: "YouTube Video Banner (1280x720)",
  shorts: "YouTube Shorts / Reels (1080x1920)",
  square: "Instagram / Square Post (1080x1080)",
  landscape: "Standard Landscape (1280x720)",
  linkedin: "LinkedIn Cover (1000x760)",
  coverpage: "Facebook Cover Page (1200x630)"
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Job Data State
  const [job, setJob] = useState<JobResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Modal State
  const [previewImage, setPreviewImage] = useState<ImageResponse | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>("youtube");
  const [mockupType, setMockupType] = useState<"none" | "youtube" | "shorts" | "linkedin">("youtube");

  // Load initial data and connect stream
  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    let unsubscribeStream: (() => void) | null = null;

    async function initialize() {
      try {
        // Fetch current snapshot state
        const initialJob = await getJobStatus(id!);
        if (isMounted) {
          setJob(initialJob);
          setIsLoading(false);
        }

        // Connect SSE if not already completed/failed
        if (initialJob.status === "pending" || initialJob.status === "processing") {
          unsubscribeStream = streamJobStatus(id!, {
            onImageReady: (event) => {
              if (!isMounted) return;
              setJob((prev) => {
                if (!prev) return null;
                const updatedImages = prev.images.map((img) => {
                  if (img.style_name === event.style_name || img.id === event.image_id) {
                    return {
                      ...img,
                      status: "completed" as const,
                      image_url: event.image_url,
                      variants: event.variants
                    };
                  }
                  return img;
                });
                return { ...prev, images: updatedImages };
              });
            },
            onImageFailed: (event) => {
              if (!isMounted) return;
              setJob((prev) => {
                if (!prev) return null;
                const updatedImages = prev.images.map((img) => {
                  if (img.style_name === event.style_name || img.id === event.image_id) {
                    return {
                      ...img,
                      status: "failed" as const,
                      error_message: event.error
                    };
                  }
                  return img;
                });
                return { ...prev, images: updatedImages };
              });
            },
            onJobCompleted: (event) => {
              if (!isMounted) return;
              setJob((prev) => {
                if (!prev) return null;
                return { ...prev, status: event.status as any };
              });
            },
            onError: (err) => {
              console.error("SSE stream error:", err);
            }
          });
        }
      } catch (err: any) {
        console.error("Initialization failed:", err);
        if (isMounted) {
          setError(err.message || "Failed to load job details.");
          setIsLoading(false);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
      if (unsubscribeStream) {
        unsubscribeStream();
      }
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Sparkles className="h-10 w-10 text-purple-500 animate-spin mb-4" />
        <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">Connecting to live generation stream...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-4">
        <AlertCircle className="h-16 w-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-black mb-2">Error Loading Job</h2>
        <p className="text-slate-400 mb-6 text-center max-w-md">{error || "The requested generation job does not exist."}</p>
        <Link to="/" className="px-6 py-3 bg-slate-900 border border-white/10 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> Return to Studio
        </Link>
      </div>
    );
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getVariantUrl = (img: ImageResponse, key: string): string => {
    if (!img.image_url) return "";
    if (img.variants && img.variants[key as keyof typeof img.variants]) {
      return img.variants[key as keyof typeof img.variants] || "";
    }
    // Fallback using manual transform params
    if (key === "youtube") return `${img.image_url}?tr=w-1280,h-720,c-maintain_ratio,fo-auto`;
    if (key === "shorts") return `${img.image_url}?tr=w-1080,h-1920,c-maintain_ratio,fo-auto`;
    if (key === "square") return `${img.image_url}?tr=w-1080,h-1080,c-maintain_ratio,fo-auto`;
    if (key === "landscape") return `${img.image_url}?tr=w-1280,h-720,c-maintain_ratio,fo-auto`;
    if (key === "linkedin") return `${img.image_url}?tr=w-1000,h-760,c-maintain_ratio,fo-auto`;
    if (key === "coverpage") return `${img.image_url}?tr=w-1200,h-630,c-maintain_ratio,fo-auto`;
    return img.image_url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-indigo-950 text-white font-sans selection:bg-purple-500 selection:text-white pb-24">
      
      {/* Upper Navigation Bar */}
      <header className="border-b border-white/5 bg-slate-950/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-all text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                job.status === "completed"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : job.status === "failed"
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse"
              }`}
            >
              {job.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {job.status === "failed" && <XCircle className="h-3.5 w-3.5" />}
              {job.status === "processing" && <Clock className="h-3.5 w-3.5 animate-spin" />}
              {job.status}
            </span>

            <button
              onClick={handleCopyLink}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 border border-white/10 rounded-xl hover:bg-slate-800 transition-all"
            >
              {isCopied ? "Link Copied!" : "Share Studio URL"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-10">
        
        {/* Job Summary Banner */}
        <section className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 sm:p-8 backdrop-blur-xl flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-2 text-xs text-violet-400 font-bold uppercase tracking-wider">
              <Sparkles className="h-4 w-4 animate-spin text-purple-400" />
              Active Generation Job
            </div>
            <h2 className="text-xl sm:text-2xl font-black leading-snug text-slate-100">
              &ldquo;{job.prompt}&rdquo;
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
              <span>Images Count: <strong className="text-white">{job.num_images}</strong></span>
              <span>•</span>
              <span>Created: <strong className="text-white">{new Date().toLocaleTimeString()}</strong></span>
            </div>
          </div>

          {/* Reference Snapshot Image */}
          {job.snapshot_url && (
            <div className="w-full md:w-56 shrink-0 space-y-1.5">
              <label className="text-[10px] uppercase font-black tracking-wider text-slate-500 block">
                Reference Base Snapshot
              </label>
              <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-slate-950">
                <img
                  src={job.snapshot_url}
                  alt="Base Snapshot"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          )}
        </section>

        {/* Image Outputs Grid */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Grid className="h-5 w-5 text-purple-400" /> Style Variations
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {job.images.map((image) => {
              const friendlyStyleName = STYLE_NAMES_MAP[image.style_name] || image.style_name;
              
              // Completed state
              if (image.status === "completed" && image.image_url) {
                return (
                  <div
                    key={image.id}
                    className="bg-slate-900/40 border border-purple-500/10 hover:border-purple-500/25 rounded-3xl p-5 backdrop-blur-md flex flex-col gap-4 shadow-xl transition-all hover:-translate-y-1 group"
                  >
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">
                        {friendlyStyleName}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Ready
                      </span>
                    </div>

                    <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/5 bg-slate-950 shadow-inner group-hover:shadow-2xl">
                      <img
                        src={image.image_url}
                        alt={`${friendlyStyleName} render`}
                        className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            setPreviewImage(image);
                            setSelectedVariant("youtube");
                            setMockupType("youtube");
                          }}
                          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs transition-all font-bold flex items-center gap-2 shadow-lg shadow-violet-900/50 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" /> Preview Mockups
                        </button>
                        <a
                          href={image.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-white transition-all"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                      <span className="flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-slate-500" /> Aspect transformation crops enabled
                      </span>
                    </div>
                  </div>
                );
              }

              // Failed state
              if (image.status === "failed") {
                return (
                  <div
                    key={image.id}
                    className="bg-slate-900/40 border border-rose-500/10 rounded-3xl p-6 flex flex-col justify-center min-h-[300px] text-center"
                  >
                    <XCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
                    <h4 className="font-extrabold text-sm uppercase tracking-wider text-rose-400">
                      {friendlyStyleName} Failed
                    </h4>
                    <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto">
                      {image.error_message || "An unknown error was encountered during generation."}
                    </p>
                  </div>
                );
              }

              // Loading / Processing State
              return (
                <div
                  key={image.id}
                  className="bg-slate-900/30 border border-white/5 rounded-3xl p-5 flex flex-col gap-4 animate-pulse"
                >
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-slate-850 rounded"></div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase bg-violet-600/10 text-violet-400 border border-violet-500/20 flex items-center gap-1 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {image.status}
                    </span>
                  </div>

                  <div className="aspect-video rounded-2xl border border-white/5 bg-slate-850 flex flex-col items-center justify-center text-slate-500">
                    <Sparkles className="h-8 w-8 animate-pulse text-purple-500/30 mb-2" />
                    <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                      Drawing {friendlyStyleName}...
                    </span>
                  </div>

                  <div className="h-3 w-5/6 bg-slate-850 rounded mt-2"></div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* Mockups Preview Modal Overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-6xl w-full flex flex-col md:flex-row shadow-2xl overflow-hidden min-h-[500px]">
            
            {/* Modal Left Column: Image Canvas & Aspect Ratio Crops */}
            <div className="md:w-1/2 p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5 bg-slate-950/40">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-white">
                    {STYLE_NAMES_MAP[previewImage.style_name]} Mode
                  </h3>
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    Smartcrop Transformations
                  </span>
                </div>

                {/* Aspect Crop Buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(ASPECT_RATIO_DESCS).map((cropKey) => (
                    <button
                      key={cropKey}
                      onClick={() => {
                        setSelectedVariant(cropKey);
                        // Align Mockup preview layout dynamically
                        if (cropKey === "shorts") setMockupType("shorts");
                        else if (cropKey === "linkedin") setMockupType("linkedin");
                        else if (cropKey === "youtube" || cropKey === "landscape") setMockupType("youtube");
                        else setMockupType("none");
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedVariant === cropKey
                          ? "bg-purple-600 border-purple-500 text-white"
                          : "bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {cropKey.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Dynamic Aspect Ratio Canvas */}
                <div className="relative aspect-video border border-white/10 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center p-1">
                  {selectedVariant === "shorts" ? (
                    <div className="h-full aspect-[9/16] rounded-lg overflow-hidden border border-white/5">
                      <img
                        src={getVariantUrl(previewImage, selectedVariant)}
                        alt="Shorts Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : selectedVariant === "square" ? (
                    <div className="h-full aspect-square rounded-lg overflow-hidden border border-white/5">
                      <img
                        src={getVariantUrl(previewImage, selectedVariant)}
                        alt="Square Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <img
                      src={getVariantUrl(previewImage, selectedVariant)}
                      alt="Landscape Preview"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  )}
                </div>

                <p className="text-xs text-slate-400 italic">
                  <strong>Active Transform:</strong> {ASPECT_RATIO_DESCS[selectedVariant]}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6">
                <a
                  href={getVariantUrl(previewImage!, selectedVariant)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" /> Open Full Image
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getVariantUrl(previewImage!, selectedVariant));
                    alert("CDN link copied!");
                  }}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-bold flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" /> Copy CDN URL
                </button>
              </div>
            </div>

            {/* Modal Right Column: Live Mockup Embed */}
            <div className="md:w-1/2 p-6 flex flex-col justify-between">
              
              {/* Mockup Selector Tabs */}
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-white">Live Mockup Preview</h3>
                  <div className="flex bg-slate-950/60 p-1 border border-white/5 rounded-xl">
                    <button
                      onClick={() => setMockupType("youtube")}
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        mockupType === "youtube" ? "bg-purple-600 text-white" : "text-slate-400"
                      }`}
                    >
                      <Tv className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMockupType("shorts")}
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        mockupType === "shorts" ? "bg-purple-600 text-white" : "text-slate-400"
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMockupType("linkedin")}
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        mockupType === "linkedin" ? "bg-purple-600 text-white" : "text-slate-400"
                      }`}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Mockup Render Area */}
                <div className="rounded-2xl border border-white/5 bg-slate-950/60 min-h-[350px] flex items-center justify-center p-4">
                  
                  {/* YouTube Desktop Player Mockup */}
                  {mockupType === "youtube" && (
                    <div className="w-full max-w-md bg-[#0f0f0f] border border-[#272727] rounded-xl overflow-hidden shadow-2xl text-left">
                      <div className="relative aspect-video w-full bg-black">
                        <img
                          src={getVariantUrl(previewImage, "youtube")}
                          alt="YouTube Player Mockup"
                          className="w-full h-full object-cover"
                        />
                        {/* YouTube player control bar overlay simulation */}
                        <div className="absolute bottom-0 inset-x-0 h-1 bg-red-600"></div>
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-bold font-mono">
                          10:14
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <h4 className="font-extrabold text-sm text-[#f1f1f1] leading-snug line-clamp-2">
                          {job.prompt}
                        </h4>
                        <div className="flex gap-2.5 items-center">
                          <div className="h-8 w-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-black shrink-0">
                            TG
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#f1f1f1]">ImageGen Channel</p>
                            <p className="text-[10px] text-[#aaa]">1.2M subscribers • 2 hours ago</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* YouTube Shorts Mobile Device Mockup */}
                  {mockupType === "shorts" && (
                    <div className="h-[380px] aspect-[9/16] bg-black border-[4px] border-[#222] rounded-[24px] relative overflow-hidden shadow-2xl flex flex-col justify-end text-left p-3">
                      <img
                        src={getVariantUrl(previewImage, "shorts")}
                        alt="Shorts Mobile Mockup"
                        className="absolute inset-0 w-full h-full object-cover opacity-90"
                      />
                      {/* Simulated overlay for Shorts */}
                      <div className="absolute top-4 inset-x-3 flex justify-between items-center text-[10px] font-bold text-white z-10 drop-shadow">
                        <span>Shorts</span>
                        <span>LIVE</span>
                      </div>
                      <div className="relative z-10 space-y-2">
                        <p className="text-xs font-bold text-white drop-shadow">@creator_studio</p>
                        <p className="text-[10px] text-white/90 drop-shadow leading-snug line-clamp-2">
                          {job.prompt} #ai #art #design
                        </p>
                      </div>
                      {/* Vertical side items */}
                      <div className="absolute right-2 bottom-12 flex flex-col gap-3 text-white text-[10px] font-bold items-center z-10 drop-shadow">
                        <div className="p-2 rounded-full bg-black/40 text-center">❤️ 24K</div>
                        <div className="p-2 rounded-full bg-black/40 text-center">💬 512</div>
                        <div className="p-2 rounded-full bg-black/40 text-center">↩️ Share</div>
                      </div>
                    </div>
                  )}

                  {/* LinkedIn Feed Post Mockup */}
                  {mockupType === "linkedin" && (
                    <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-xl p-3.5 space-y-3.5 shadow-2xl text-left">
                      <div className="flex gap-2">
                        <div className="h-9 w-9 rounded bg-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 text-white">
                          TG
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-100">ImageGen Studio</h4>
                          <p className="text-[9px] text-slate-500">10,501 followers • Promoted</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Check out our latest generated design using the customized prompt: <strong>&ldquo;{job.prompt}&rdquo;</strong>.
                      </p>
                      <div className="border border-white/5 rounded-lg overflow-hidden bg-slate-950">
                        <img
                          src={getVariantUrl(previewImage, "linkedin")}
                          alt="LinkedIn post mockup"
                          className="w-full aspect-[1.31] object-cover"
                        />
                        <div className="p-2.5 bg-slate-950">
                          <p className="text-xs font-black text-slate-200">ImageGen AI Output</p>
                          <p className="text-[9px] text-slate-500">imagegen.ai • 1 min read</p>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-white/5 pt-2.5 text-slate-400 text-[10px] font-semibold">
                        <span>👍 Like</span>
                        <span>💬 Comment</span>
                        <span>🔁 Repost</span>
                        <span>📨 Send</span>
                      </div>
                    </div>
                  )}

                  {mockupType === "none" && (
                    <div className="text-slate-500 text-sm flex flex-col items-center">
                      <Info className="h-8 w-8 mb-2 opacity-50" />
                      No mockup available for this aspect ratio.
                    </div>
                  )}

                </div>
              </div>

              {/* Close Button */}
              <div className="pt-6 flex justify-end">
                <button
                  onClick={() => setPreviewImage(null)}
                  className="py-3 px-6 bg-slate-950 hover:bg-slate-900 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Close Studio Preview
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
