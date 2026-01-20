"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "@/lib/db";
import Link from "next/link";
import router from "next/router";
import { extractText } from "unpdf";

type ProposalRequirement = {
  id: string;
  name: string;
  description: Record<string, string>;
  fieldName: string;
  required: boolean;
};

type N8nResponse = {
  success: boolean;
  sessionId: string;
  data: {
    requirements: ProposalRequirement[];
  };
  hasSpecificRequirements: boolean;
  uploadInstructions: string;
  timestamp: string;
};

type AgentDocRow = {
  id: number;
  session_id: string;
  folder_number: number;
  file_name: string;
  docs_url: string;
  created_at: string;
};

export default function ProposalCheckerPage() {
  // table state
  const [allData, setAllData] = useState<AgentDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(allData.length / pageSize));
  const pagedData = allData.slice((page - 1) * pageSize, page * pageSize);

  // phase-2 state
  const [selectedSession, setSelectedSession] = useState<AgentDocRow | null>(
    null
  );
  const [requirements, setRequirements] = useState<ProposalRequirement[]>([]);
  const [uploadInstructions, setUploadInstructions] = useState(
    "Please upload all required proposal documents."
  );
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  // file upload state
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [fileStatuses, setFileStatuses] = useState<Record<string, string>>({});
  const [readyCount, setReadyCount] = useState(0);

  //phase-3 state
  const [submitting, setSubmitting] = useState(false);
  const [apiResult, setApiResult] = useState<{
    docId: string;
    documentName: string;
    documentUrl: string;
    pdfUrl: string;
  } | null>(null);

  // -------- load table data --------
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_agent_result_docs")
        .select("id, session_id, folder_number, file_name, docs_url, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAllData((data || []) as AgentDocRow[]);
      setPage(1);
      setSelectedSession(null);
      console.log("✅", data?.length || 0, "records");
    } catch (error) {
      console.error("❌", error);
    } finally {
      setLoading(false);
    }
  };

  // -------- phase 2: hit n8n API --------
  const handleCreateDocument = async () => {
    if (!selectedSession) return;
    setCreatingDoc(true);
    setCreateMessage(null);

    try {
      const payload = {
        sessionId: selectedSession.session_id,
        timestamp: new Date().toISOString(),
      };

      console.log("🚀 Phase 2 API call:", payload);

      const res = await axios.post(
        "https://kewo.app.n8n.cloud/webhook/proposal-checker",
        payload, // data 2nd param
        {
          headers: { "Content-Type": "application/json" } // headers 3rd param
        }
      );

      const response = res.data;
      console.log("✅ Phase 2 response:", response);

      // Update form with dynamic requirements from API
      setRequirements(response.data.requirements || []);
      setUploadInstructions(response.uploadInstructions || "Upload documents.");
      setCreateMessage(
        `✅ Phase 2 complete! Requirements loaded for session ${response.sessionId}.`
      );

      // Reset file uploads
      setFiles({});
      setFileStatuses({});
      setReadyCount(0);
    } catch (err: any) {
      console.error("❌ Phase 2 error:", err.response?.data || err.message);
      setCreateMessage(`❌ Failed to create document: ${err.message}`);
    } finally {
      setCreatingDoc(false);
    }
  };

  // -------- file uploads --------
  const handleFileChange = (
    reqId: string,
    file: File | null,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (file) {
      setFiles((prev) => ({ ...prev, [reqId]: file }));
      setFileStatuses((prev) => ({
        ...prev,
        [reqId]: `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      }));
      setReadyCount((prev) => prev + 1);
    } else {
      setFiles((prev) => ({ ...prev, [reqId]: null }));
      setFileStatuses((prev) => ({ ...prev, [reqId]: "" }));
      setReadyCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleCancel = () => {
    setFiles({});
    setFileStatuses({});
    setReadyCount(0);
  };

  // --- PDF text extraction using unpdf ---
  const extractPdfText = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const result = await extractText(buffer);
    const text =
      Array.isArray(result.text) ? result.text.join(" ") : result.text || "";
    return text;
  };

  //Phase 3
  const handleSubmit = async () => {
    if (!selectedSession) {
      alert("Please select a session first.");
      return;
    }

    setSubmitting(true);
    setApiResult(null);

    // Build extract_document array
    const extract_document = [];

    for (const req of requirements) {
      const file = files[req.id];
      if (!file) continue;

      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      let resultText = "";

      if (isPdf) {
        resultText = await extractPdfText(file); // Your utility ✅
      } else {
        resultText = `Unsupported file type: ${file.name}`;
      }

      extract_document.push({
        title: req.name,
        result: resultText,
      });
    }

    const payload = {
      sessionId: selectedSession.session_id,
      folderNumber: String(selectedSession.folder_number),
      extract_document,
    };

    try {
      const res = await fetch("https://kewo.app.n8n.cloud/webhook/proposal-maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await res.json(); // Now safe - returns JSON
      console.log("✅ API Response:", responseData);

      if (!res.ok) {
        alert(`❌ Error ${res.status}: ${JSON.stringify(responseData)}`);
        return;
      }

      // Store result for buttons
      setApiResult(responseData);
      alert("✅ Proposal generated!");
    } catch (error: any) {
      console.error("❌ Phase 3 error:", error);
      alert("❌ Network error: " + error.message);
    } finally {
      setLoading(false); // Reset loading
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/signin");
  };

  const isSubmitReady =
    readyCount >= requirements.filter((r) => r.required).length;

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
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
      <div className="mx-auto max-w-7xl space-y-8 mt-8">
        {/* Table + Phase 2 */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">
              📊 Phase 1 Records ({allData.length})
            </h2>
            <button
              onClick={fetchAllData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "⏳ Loading..." : "🔄 Refresh"}
            </button>
          </div>

          <div className="overflow-x-auto bg-white rounded-xl shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Select
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Session ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Folder
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    File Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading records...</p>
                    </td>
                  </tr>
                ) : pagedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No records found
                    </td>
                  </tr>
                ) : (
                  pagedData.map((record) => {
                    const isSelected = selectedSession?.id === record.id;
                    return (
                      <tr
                        key={record.id}
                        className={`cursor-pointer hover:bg-gray-50 border-l-4 ${isSelected
                          ? "border-blue-500 bg-blue-50"
                          : "border-transparent"
                          }`}
                        onClick={() => setSelectedSession(record)}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="radio"
                            name="session"
                            checked={isSelected}
                            onChange={() => setSelectedSession(record)}
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-mono text-blue-700">
                          {record.session_id}
                        </td>
                        <td className="px-4 py-4 text-sm font-medium">
                          {record.folder_number}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900 max-w-md truncate">
                          {record.file_name}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {new Date(record.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-sm space-x-2">
                          {record.docs_url && (
                            <>
                              <a
                                href={record.docs_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-900"
                              >
                                📖
                              </a>
                              <a
                                href={record.docs_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-600 hover:text-green-900"
                              >
                                📥
                              </a>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white border rounded-lg">
              <div className="text-sm text-gray-700">
                Page <strong>{page}</strong> of <strong>{pageCount}</strong>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm font-medium rounded border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-1 text-sm font-medium rounded border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Phase 2 - Document Creator */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
            📄 Phase 2: Document Creator
          </h3>

          {selectedSession ? (
            <div className="space-y-3 mb-4 p-4 bg-white rounded-lg border">
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Selected:</span>{" "}
                <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                  {selectedSession.session_id}
                </code>
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">Folder:</span> {selectedSession.folder_number}
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              👆 Select a session from the table above to generate requirements
            </div>
          )}

          <button
            onClick={handleCreateDocument}
            disabled={!selectedSession || creatingDoc}
            className={`w-full py-3 px-6 rounded-lg text-lg font-semibold transition-all ${selectedSession && !creatingDoc
              ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
          >
            {creatingDoc ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Generating Requirements...
              </>
            ) : (
              "🚀 Run Phase 2 - Generate Document Requirements"
            )}
          </button>

          {createMessage && (
            <div
              className={`mt-4 p-4 rounded-lg text-center text-sm ${createMessage.includes("✅")
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
                }`}
            >
              {createMessage}
            </div>
          )}
        </div>

        {/* Dynamic Upload Form */}
        <div className="mx-auto max-w-6xl">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-8 border-b bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                📋 Upload Documents
              </h3>
              <p className="text-gray-600 mb-2">{uploadInstructions}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                  {requirements.length} requirements
                </span>
                <span className="text-gray-500">
                  {readyCount}/{requirements.filter(r => r.required).length} files ready
                </span>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {requirements.map((req, index) => (
                  <div
                    key={req.id}
                    className={`group border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg border-gray-200 bg-gray-50 hover:border-blue-300 }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b">
                      <div>
                        <h4 className="font-bold text-xl text-gray-900 mb-1">
                          {req.name}
                        </h4>
                        {req.required && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Required
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description - Better spacing */}
                    <div className="space-y-3 mb-6 text-sm leading-relaxed">
                      {Object.entries(req.description).map(([key, value]) => (
                        <div key={key} className="group/desc flex gap-3 p-3 bg-white/50 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                          <div className="w-32 font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded text-xs tracking-wide flex-shrink-0">
                            {key}
                          </div>
                          <div className="text-gray-700 flex-1">
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* File input */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload {req.name}
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          id={`proposal-doc-${req.id}`}
                          name={req.fieldName}
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) =>
                            handleFileChange(req.id, e.target.files?.[0] || null, e)
                          }
                          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-blue-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 hover:border-blue-400"
                        />
                      </div>

                      {/* Status */}
                      {fileStatuses[req.id] && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-800 font-medium">
                            {fileStatuses[req.id]}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            {readyCount > 0 && (
              <div className="p-6 border-t bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Progress: {readyCount}/{requirements.length}
                  </span>
                  <span className="text-lg font-bold text-blue-800">
                    {readyCount}/{requirements.filter(r => r.required).length} required
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${(readyCount / requirements.length) * 100
                        }%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-6 sm:p-8 border-t bg-gray-50">
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-8 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium flex-1 sm:flex-none shadow-sm"
                >
                  🔄 Reset Form
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!isSubmitReady || submitting || !!apiResult}
                  className={`px-8 py-3 rounded-xl text-lg font-semibold shadow-lg transition-all flex-1 sm:flex-none ... ${submitting ? "opacity-75 cursor-wait" : ""}`}
                >
                  {submitting
                    ? "⏳ Extracting PDFs..."
                    : `✅ Submit ${requirements.length} Documents`
                  }
                </button>
              </div>
            </div>

            {/* Success buttons - show after API response */}
            {apiResult && (
              <div className="p-6 border-t bg-gradient-to-r from-green-50 to-emerald-50">
                <h4 className="font-bold text-lg mb-4 text-green-800 flex items-center gap-2">
                  ✅ Proposal Generated: {apiResult.documentName}
                </h4>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href={apiResult.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-white border-2 border-green-300 hover:border-green-400 text-green-800 px-6 py-3 rounded-xl font-semibold hover:shadow-md hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    📝 Open Document
                  </a>
                  <a
                    href={apiResult.pdfUrl}
                    target="_blank"
                    download={apiResult.documentName + ".pdf"}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                  >
                    ⬇️ Download PDF
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}