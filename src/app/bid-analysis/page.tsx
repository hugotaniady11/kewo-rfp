"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { useGoNoGoPolling } from "@/hooks/goNoGoPooling";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface WebhookConfig {
  id: string;
  name: string;
  description: string;
  url: string;
  enabled: boolean;
}

const WEBHOOK_CONFIGS: WebhookConfig[] = [
  {
    id: "flow1",
    name: "Frontend Workflow (n8n)",
    description: "Runs AI-based Go/No-Go analysis through n8n webhook.",
    url: "https://kewo.app.n8n.cloud/webhook/go-no-go-coordinator-fe",
    enabled: true,
  },
];

const LLM_MODELS = [
  { id: "gpt-4.1-mini", name: "Extract text + Merge all agent" },
  { id: "grok-3-mini", name: "Merge all agent" },
];

export default function BidAnalysisPage() {
  const [folderNumber, setFolderNumber] = useState(1);
  const [selectedFlows, setSelectedFlows] = useState<string[]>(["flow1"]);
  const [selectedLLM, setSelectedLLM] = useState<string>("gpt-4.1-mini");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Ready to start analysis...");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [documentData, setDocumentData] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiResult, setApiResult] = useState<any>(null);

  //Give recommendation
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);

  const [inputMode, setInputMode] = useState<"folder" | "upload">("folder");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");

  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const router = useRouter();

  // 🔁 Polling Hook
  useGoNoGoPolling({
    sessionId: sessionId ?? "",
    onAgentResult: (data) => {
      setResults((prev) => [...prev, data]);
      setProgress((p) => Math.min(p + 10, 90));
      setStatusText(`Agent ${data.agentName} completed`);
    },
    onComplete: (_sid, doc) => {
      setDocumentData(doc);
      setProgress(100);
      setStatusText("✅ Analysis completed successfully!");
      setIsRunning(false);
    },
  });

  // 🚀 Start Analysis
  const handleStart = async () => {
    if (isRunning) return;

    if (selectedFlows.length === 0) {
      alert("Please select at least one workflow");
      return;
    }

    if (inputMode === "upload" && files.length === 0) {
      alert("Please upload at least 1 PDF");
      return;
    }

    const newSessionId = `webapp-sess-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    setSessionId(newSessionId);
    setProgress(10);
    setStatusText("Initializing workflows...");
    setIsRunning(true);
    setResults([]);

    try {
      let finalText = extractedText;

      // 🔥 ONLY call OCR if not already done
      if (inputMode === "upload" && !extractedText) {
        finalText = await handleUploadBulk();

        if (!finalText) {
          alert("Failed to extract text from PDFs");
          setIsRunning(false);
          return;
        }
      }

      // 🔥 Directly go to workflows (your requirement)
      for (const flowId of selectedFlows) {
        const webhook = WEBHOOK_CONFIGS.find((w) => w.id === flowId);
        if (!webhook) continue;

        const formData = new FormData();

        formData.append("sessionId", newSessionId);
        formData.append("workflowName", webhook.name);
        formData.append("workflowId", webhook.id);
        formData.append("startTime", new Date().toISOString());
        formData.append("userAgent", navigator.userAgent);
        formData.append("selectedLLM", selectedLLM);
        formData.append("llmModel", selectedLLM);

        if (inputMode === "folder") {
          formData.append("folderNumber", String(folderNumber));
        } else {
          formData.append("extractedText", finalText || "");
        }

        // ✅ ALWAYS only this gets called after ready
        await fetch(webhook.url, {
          method: "POST",
          body: formData,
        });
      }

      setProgress(20);
      setStatusText("Workflows started. Waiting for AI results...");
    } catch (error: any) {
      console.error("❌ Error:", error);
      setStatusText("Failed to start workflows.");
      setIsRunning(false);
    }
  };

  const handleReset = () => {
    setFolderNumber(1);
    setSelectedLLM("gpt-4.1-mini");
    setResults([]);
    setDocumentData(null);
    setProgress(0);
    setStatusText("Ready to start analysis...");
    setIsRunning(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/signin");
  };

  function RenderObject({ data }: { data: any }) {
    if (!data || typeof data !== "object") return null;

    return (
      <div className="space-y-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <p className="font-semibold text-gray-900 mb-1 capitalize">
              {key.replace(/_/g, " ")}
            </p>

            {Array.isArray(value) ? (
              <div className="space-y-2 pl-3 border-l border-gray-200">
                {value.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-2 rounded-md text-gray-800 space-y-1"
                  >
                    {typeof item === "object" ? (
                      <RenderObject data={item} />
                    ) : (
                      <p>{String(item)}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : typeof value === "object" ? (
              <div className="pl-3 border-l border-gray-200">
                <RenderObject data={value} />
              </div>
            ) : (
              <p className="bg-gray-50 p-2 rounded-md text-gray-800 whitespace-pre-wrap">
                {String(value)}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  //submit recommendation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !sessionId) {
      alert("Missing file or session.");
      return;
    }

    setIsSubmitting(true);
    setApiResult(null);
    setStatusText("Extracting text...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1) Extract text from file
      const extractRes = await fetch(
        "https://kewo.app.n8n.cloud/webhook/ocr-test",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!extractRes.ok) {
        const txt = await extractRes.text();
        console.error("Extract failed", extractRes.status, txt);
        alert(`Extract failed (${extractRes.status})`);
        return;
      }

      const extractJson: { fullText: string }[] = await extractRes.json();
      const fullText = extractJson[0]?.fullText || "";

      // 2) Call proposal-maker with extracted text
      const payload = {
        sessionId,
        folderNumber: String(folderNumber),
        extract_document: fullText,
      };

      const res = await fetch(
        "https://kewo.app.n8n.cloud/webhook/Go/NoGoRecommendations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const responseData: any = await res.json();
      const firstItem = Array.isArray(responseData) ? responseData[0] : responseData;

      // Store full result (handles both immediate & job responses)
      setApiResult(firstItem);
      console.log("Analysis result:", firstItem);
    } catch (err) {
      console.error("Extract error", err);
      alert("Something went wrong while extracting text: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  //upload bulk document
  const handleUploadBulk = async () => {
    try {
      setIsUploading(true);
      setStatusText("Uploading & extracting text from PDFs...");

      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch(
        "https://kewo.app.n8n.cloud/webhook/ocr-multiple",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      console.log("OCR response:", data);

      if (!data[0]?.combinedText) {
        throw new Error("No text extracted");
      }

      setExtractedText(data[0].combinedText); // 🔥 cache result
      setStatusText("PDF processed successfully ✅");

      return data[0].combinedText;
    } catch (err) {
      console.error("❌ OCR Upload Error:", err);
      setStatusText("Failed to process PDFs");
      return null;
    } finally {
      setIsUploading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Project Dashboard</h1>

        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <Link href="/bid-analysis" className="hover:text-blue-600">
            Phase 1 / Bid Analysis
          </Link>
          <Link href="/proposal-checker" className="hover:text-blue-600">
            Phase 2 / Proposal Checker
          </Link>
          {/* <Link href="/proposal-maker" className="hover:text-blue-600">
            Phase 3 / Proposal Maker
          </Link> */}
          <Link href="/history" className="hover:text-blue-600">
            History
          </Link>

          <button
            onClick={handleLogout}
            className="rounded bg-red-600 px-3 py-1 text-white text-sm hover:bg-red-700"
          >
            Logout
          </button>
        </nav>
      </header>
      <div className="min-h-screen bg-gray-50 px-6 py-10">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-md">
          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              Kewo RFP Analysis Enhanced
            </h2>
            <p className="text-gray-500">
              Select folder number, workflow, and LLM to generate Go/No-Go reports.
            </p>
          </div>

          {/* Choose input method: */}
          <div className="mb-8">
            <label className="block font-medium text-gray-700 mb-2">
              Choose Input Method
            </label>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setInputMode("folder");
                  setFiles([]);
                  setFileError("");
                }}
                className={`px-4 py-2 rounded border ${inputMode === "folder"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300"
                  }`}
              >
                Folder Number
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputMode("upload");
                  setFileError("");
                }}
                className={`px-4 py-2 rounded border ${inputMode === "upload"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300"
                  }`}
              >
                Upload PDF
              </button>
            </div>
          </div>

          {/* Folder Selector */}
          {inputMode === "folder" && (
            <div className="mb-8">
              <label className="block font-medium text-gray-700 mb-2">
                📁 Folder Number
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={folderNumber}
                  onChange={(e) => setFolderNumber(Number(e.target.value))}
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-center"
                />
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={folderNumber}
                  onChange={(e) => setFolderNumber(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
              </div>
            </div>
          )}

          {inputMode === "upload" && (
            <div className="mb-8">
              <label className="block font-medium text-gray-700 mb-2">
                Upload PDF Files
              </label>

              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || []);
                  setFileError("");

                  if (selectedFiles.length > 10) {
                    setFileError("You can upload a maximum of 10 PDF files at once.");
                    e.target.value = "";
                    setFiles([]);
                    return;
                  }

                  const invalidFile = selectedFiles.find(
                    (file) =>
                      file.type !== "application/pdf" &&
                      !file.name.toLowerCase().endsWith(".pdf")
                  );

                  if (invalidFile) {
                    setFileError("Only PDF files are allowed.");
                    e.target.value = "";
                    setFiles([]);
                    return;
                  }

                  setFiles(selectedFiles);
                }}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />

              <p className="mt-2 text-sm text-gray-500">
                You can upload up to 10 PDF files at the same time.
              </p>

              {fileError && (
                <p className="mt-2 text-sm text-red-600">{fileError}</p>
              )}

              {files.length > 0 && (
                <div className="mt-3 rounded border border-gray-200 p-3">
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Selected files:
                  </p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        {index + 1}. {file.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Workflow Selection */}
          <div className="mb-8">
            <h3 className="font-semibold text-gray-800 mb-3">
              🔄 Select Analysis Workflows
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {WEBHOOK_CONFIGS.map((flow) => (
                <label
                  key={flow.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${selectedFlows.includes(flow.id)
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-400"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFlows.includes(flow.id)}
                    onChange={(e) => {
                      if (e.target.checked)
                        setSelectedFlows((prev) => [...prev, flow.id]);
                      else
                        setSelectedFlows((prev) =>
                          prev.filter((id) => id !== flow.id)
                        );
                    }}
                  />
                  <div>
                    <p className="font-semibold text-gray-800">{flow.name}</p>
                    <p className="text-sm text-gray-500">{flow.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* LLM Selection */}
          <div className="mb-8 text-center">
            <h3 className="font-semibold text-gray-800 mb-2">
              🤖 Select AI Language Model
            </h3>
            <select
              value={selectedLLM}
              onChange={(e) => setSelectedLLM(e.target.value)}
              className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LLM_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start & Reset Buttons */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className={`rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 transition ${isRunning ? "opacity-70 cursor-not-allowed" : ""
                }`}
            >
              {isRunning ? "Processing..." : "Start Analysis"}
            </button>
            <button
              onClick={handleReset}
              className="rounded bg-gray-200 px-5 py-2 hover:bg-gray-300"
            >
              Reset
            </button>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>Overall Progress</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-3 bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">{statusText}</p>
          </div>

          {/* Live Results */}
          {results.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold text-gray-800 mb-4">
                📊 Real-time Analysis Results
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {results
                  .sort((a, b) => {
                    const aName = a.agent_name || a.agentName;
                    const bName = b.agent_name || b.agentName;
                    if (aName === 'ai-general-summary') return -1;
                    if (bName === 'ai-general-summary') return 1;
                    return 0;
                  })
                  .map((r, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="text-lg font-semibold text-blue-700">
                          🤖 {r.agent_name || r.agentName}
                        </h4>
                        <span className="text-xs text-gray-500">
                          ⏱ {r.processing_time ?? r.processingTime ?? 0}s
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Completed at{" "}
                        {new Date(r.updated_at || r.completedAt).toLocaleTimeString()}
                      </p>

                      <div className="text-sm text-gray-800 space-y-3">
                        {(() => {
                          let output =
                            typeof r.result === "string"
                              ? r.result
                              : r.result?.output || r.result;

                          if (typeof output === "string") {
                            try {
                              const parsed = JSON.parse(output);
                              output = typeof parsed === "object" ? parsed : { content: output };
                            } catch {
                              output = { content: output };
                            }
                          }

                          return typeof output === "object" ? (
                            <RenderObject data={output} />
                          ) : (
                            <p className="whitespace-pre-wrap">{String(output)}</p>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Final Document */}
          {documentData && (
            <div className="mt-10 bg-green-50 border border-green-300 p-6 rounded-lg text-center">
              <h3 className="text-lg font-bold text-green-700 mb-2">
                ✅ Analysis Complete
              </h3>
              <p className="text-gray-600 mb-4">
                {documentData.documentName || "RFP Proposal"}
              </p>
              <div className="flex justify-center gap-4 mb-6">
                {documentData.documentUrl && (
                  <a
                    href={documentData.documentUrl}
                    target="_blank"
                    className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                  >
                    📖 Open Document
                  </a>
                )}
                {documentData.docId && (
                  <a
                    href={`https://docs.google.com/document/d/${documentData.docId}/export?format=pdf`}
                    target="_blank"
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    📥 Download PDF
                  </a>
                )}
              </div>

              <div>
                {/* <button
                  onClick={() => window.open("/proposal-checker", "_blank")}
                  className="rounded bg-orange-500 px-6 py-2 text-white hover:bg-orange-600"
                >
                  📝 Draft Proposal Maker
                </button> */}

                <button
                  onClick={() => setOpen(true)}
                  className="rounded bg-orange-500 px-6 py-2 text-white hover:bg-orange-600"
                >
                  Give Recommendation
                </button>

                {open && (
                  <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Upload proposal <span className="text-red-500">*</span>
                      </label>

                      <input
                        type="file"
                        required
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        accept=".pdf,.doc,.docx,.txt"
                        disabled={isSubmitting}
                        className="block w-full cursor-pointer rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    {file && (
                      <p className="text-xs text-gray-600">
                        Selected file: <span className="font-medium">{file.name}</span>
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setApiResult(null);
                          setOpen(false);
                        }}
                        disabled={isSubmitting}
                        className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={!file || isSubmitting}
                        className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Submit"
                        )}
                      </button>
                    </div>

                    {/* Result */}
                    {apiResult && (
                      <div className="p-4 bg-gray-50 rounded-lg max-h-128 overflow-auto border mt-3">
                        <h4 className="font-semibold mb-2 text-sm text-gray-900">Go/No-Go Result:</h4>
                        <pre className="text-xs whitespace-pre-wrap bg-white p-3 rounded border font-mono text-left">
                          {apiResult.output || JSON.stringify(apiResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </form>
                )}


              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}