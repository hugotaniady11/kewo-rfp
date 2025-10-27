"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { useGoNoGoPolling } from "@/hooks/goNoGoPooling";
import React from "react";

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

const PROPOSAL_CHECKER_WEBHOOK_URL =
  "https://kewo.app.n8n.cloud/webhook/proposal-checker";
const PROPOSAL_MAKER_WEBHOOK_URL =
  "https://kewo.app.n8n.cloud/webhook/proposal-maker";

const LLM_MODELS = [
  { id: "gpt-4.1-mini", name: "ChatGPT 4.1 Mini" },
  { id: "grok-3-mini", name: "Grok 3 Mini" },
  { id: "gpt-5-mini", name: "ChatGPT 5 Mini" },
];

interface ProposalRequirement {
  id: string;
  name: string;
  description: string;
  required: boolean;
  fieldName: string;
}

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

  // --- Proposal Maker States ---
  const [proposalVisible, setProposalVisible] = useState(false);
  const [requirements, setRequirements] = useState<ProposalRequirement[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, File>>(
    new Map()
  );
  const [proposalResult, setProposalResult] = useState<any | null>(null);
  const [isProposalProcessing, setIsProposalProcessing] = useState(false);

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
      setProposalVisible(true);
    },
  });

  // 🚀 Start Analysis
  const handleStart = async () => {
    if (isRunning) return;
    if (selectedFlows.length === 0) {
      alert("Please select at least one workflow");
      return;
    }

    const newSessionId = `sess-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    setSessionId(newSessionId);
    setProgress(10);
    setStatusText("Initializing workflows...");
    setIsRunning(true);
    setResults([]);
    setDocumentData(null);
    setProposalVisible(false);
    setProposalResult(null);

    try {
      for (const flowId of selectedFlows) {
        const webhook = WEBHOOK_CONFIGS.find((w) => w.id === flowId);
        if (!webhook) continue;

        const formData = new FormData();
        formData.append("folderNumber", String(folderNumber));
        formData.append("sessionId", newSessionId);
        formData.append("workflowName", webhook.name);
        formData.append("workflowId", webhook.id);
        formData.append("startTime", new Date().toISOString());
        formData.append("userAgent", navigator.userAgent);
        formData.append("selectedLLM", selectedLLM);
        formData.append("llmModel", selectedLLM);

        await fetch(webhook.url, { method: "POST", body: formData });
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
    setProposalVisible(false);
    setProposalResult(null);
  };

  // 🧠 Step 1 — Request Proposal Requirements
  const handleStartProposalMaker = async () => {
    if (!sessionId) return alert("Session not found");
    setStatusText("🔍 Checking proposal requirements...");
    try {
      const res = await fetch(PROPOSAL_CHECKER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRequirements(data.data.requirements);
        setProposalVisible(true);
        setStatusText("✅ Upload your proposal documents below.");
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }, 500);
      } else {
        alert("Failed to load proposal requirements.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to connect to proposal checker webhook.");
    }
  };

  // 📂 Handle Upload
  const handleFileChange = (reqId: string, file: File | null) => {
    setUploadedFiles((prev) => {
      const map = new Map(prev);
      if (file) map.set(reqId, file);
      else map.delete(reqId);
      return map;
    });
  };

  // 📤 Submit to Proposal Maker Webhook
  const handleSubmitProposal = async () => {
    if (uploadedFiles.size === 0) {
      alert("Please upload at least one document.");
      return;
    }

    setIsProposalProcessing(true);
    setStatusText("⏳ Uploading documents to Proposal Maker...");

    const formData = new FormData();
    formData.append("sessionId", sessionId ?? "");
    formData.append("folderNumber", String(folderNumber));
    formData.append("timestamp", new Date().toISOString());
    formData.append("userAgent", navigator.userAgent);

    uploadedFiles.forEach((file, id) => {
      formData.append(id, file, file.name);
    });

    const res = await fetch(PROPOSAL_MAKER_WEBHOOK_URL, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      alert("Failed to start proposal maker workflow.");
      setIsProposalProcessing(false);
      return;
    }

    setStatusText("🔄 Waiting for proposal draft to be generated...");
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 500);

    pollProposalResult(sessionId!);
  };

  // 🔁 Poll Supabase Proposal Documents
  const pollProposalResult = async (sid: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from("proposal_documents")
        .select("*")
        .eq("session_id", sid)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].status === "completed") {
        clearInterval(interval);
        setIsProposalProcessing(false);
        setProposalResult(data[0]);
        setStatusText("✅ Proposal draft ready!");
        setTimeout(() => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }, 400);
      }

      if (attempts >= 120) {
        clearInterval(interval);
        setIsProposalProcessing(false);
        alert("Timeout: Proposal taking too long.");
      }
    }, 4000);
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

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-8 shadow-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800">
            Kewo RFP Analysis Enhanced
          </h2>
          <p className="text-gray-500">
            Select folder number, workflow, and LLM to generate Go/No-Go
            reports.
          </p>
        </div>

        {/* Folder Selector */}
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
              {results.map((r, i) => {
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    {/* Header */}
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

                    {/* Output */}
                    <div className="text-sm text-gray-800 space-y-3">
                      {(() => {
                        let output =
                          typeof r.result === "string"
                            ? r.result
                            : r.result?.output || r.result;

                        // 🧩 Parse stringified JSON if needed
                        if (typeof output === "string") {
                          try {
                            const parsed = JSON.parse(output);
                            if (typeof parsed === "object") output = parsed;
                          } catch {
                            // leave as-is
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
                );
              })}
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
            <div className="flex justify-center gap-4">
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

            {/* Proposal Maker Trigger */}
            <div className="mt-6">
              <button
                onClick={handleStartProposalMaker}
                className="rounded bg-orange-500 px-6 py-2 text-white hover:bg-orange-600"
              >
                📝 Draft Proposal Maker
              </button>
            </div>
          </div>
        )}

        {/* Proposal Loading State */}
        {isProposalProcessing && !proposalResult && (
          <div className="mt-10">
            <div className="max-w-xl mx-auto bg-white p-10 rounded-2xl shadow-lg text-center border border-blue-100">
              <div className="relative w-12 h-12 mb-6 mx-auto">
                <div className="absolute inset-0 border-4 border-blue-300 rounded-full opacity-30"></div>
                <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-xl font-bold text-blue-800 mb-3">
                ⏳ Generating Your Proposal
              </h3>
              <p className="text-gray-600 mb-4">
                AI is creating your draft proposal based on the Go/No-Go
                analysis.
                <br />
                <strong>This process typically takes 3–5 minutes.</strong>
              </p>
              <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">
                💡 <strong>Tip:</strong> Please keep this page open — don’t
                refresh or close it.
              </div>
            </div>
          </div>
        )}

        {/* Proposal Upload Form */}
        {proposalVisible && requirements.length > 0 && !isProposalProcessing && (
          <div className="mt-10 border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              📄 Upload Proposal Documents
            </h3>
            {requirements.map((req) => (
              <div key={req.id} className="mb-4">
                <label className="block font-medium text-gray-700 mb-1">
                  {req.name}{" "}
                  {req.required ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="text-gray-400">(Optional)</span>
                  )}
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  {req.description}
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) =>
                    handleFileChange(req.id, e.target.files?.[0] ?? null)
                  }
                  className="block w-full rounded border border-gray-300 p-2"
                />
              </div>
            ))}
            <div className="flex justify-end mt-6">
              <button
                onClick={handleSubmitProposal}
                className="rounded bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"
              >
                Submit Documents
              </button>
            </div>
          </div>
        )}

        {/* Proposal Result */}
        {proposalResult && (
          <div className="mt-10 text-center bg-green-50 border border-green-300 rounded-lg p-8">
            <h3 className="text-xl font-bold text-green-800 mb-2">
              ✅ Proposal Successfully Created!
            </h3>
            <p className="text-gray-600 mb-4">
              {proposalResult.document_name || "RFP Draft Proposal"}
            </p>
            <div className="flex justify-center gap-4">
              <a
                href={proposalResult.document_url}
                target="_blank"
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                📖 Open Proposal
              </a>
              <a
                href={`https://docs.google.com/document/d/${proposalResult.document_id}/export?format=pdf`}
                target="_blank"
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                📥 Download PDF
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}