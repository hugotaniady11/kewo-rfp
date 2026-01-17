"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { supabase } from "@/lib/db";

interface ProposalRequirement {
  id: string;
  name: string;
  description: Record<string, string>;
  fieldName: string;
  required: boolean;
}

const TEMPLATE_REQUIREMENTS: ProposalRequirement[] = [
  {
    id: "past-performance",
    name: "Past Performance Details",
    fieldName: "past_performance",
    required: true,
    description: {
      "Past Content": "Details of previously completed projects",
      "Requirements": "Timelines or outcomes, and must be completed successfully",
      "Evidence": "With the last 3 years or service requirements. Evidence of success",
    },
  },
  {
    id: "key-personnel",
    name: "Key Personnel",
    fieldName: "key_personnel",
    required: true,
    description: {
      "Requirements": "Key personnel must have relevant education, experience",
      "Certifications": "With required certifications, licenses, professional credentials",
    },
  },
  {
    id: "financial-statements",
    name: "Financial Statements",
    fieldName: "financial_statements",
    required: true,
    description: {
      "Include": "Balance sheets, income statements, funding",
      "Requirements": "Financial data from the past 3 years",
      "Evidence": "Most recent audited by certified accountants",
    },
  },
];

export default function ProposalCheckerPage() {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [fileStatuses, setFileStatuses] = useState<Record<string, string>>({});
  const [readyCount, setReadyCount] = useState(0);
  const [allData, setAllData] = useState<any[]>([]); // Load on mount
  const [loading, setLoading] = useState(true);

  const uploadInstructions =
    "Please upload all required proposal documents. Files will be analyzed against RFP requirements.";

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

  const handleSubmit = async () => {
    const formData = new FormData();

    Object.entries(files).forEach(([reqId, file]) => {
      if (file) {
        formData.append(`proposal-doc-${reqId}`, file);
      }
    });

    // TODO: call your proposal checker API
    try {
      const res = await fetch("/api/proposal-checker", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        alert("Proposal submitted successfully!");
        console.log("Result:", result);
      } else {
        alert("Submission failed");
      }
    } catch (error) {
      alert("Error submitting proposal");
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ai_agent_result_docs")
        .select("id, session_id, folder_number, file_name, docs_url,created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setAllData(data || []);
      console.log("✅", data?.length || 0, "records");
    } catch (error) {
      console.error("❌", error);
    } finally {
      setLoading(false);
    }
  };

  const isSubmitReady = readyCount >= TEMPLATE_REQUIREMENTS.filter(r => r.required).length;

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Data Table - Shows on refresh */}
        {allData.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
                📊 Supabase Records ({allData.length})
              </h2>
              <button
                onClick={fetchAllData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-xl shadow-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Folder Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document Url
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allData.map((record, idx) => (
                    <tr key={record.id || idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.session_id || record.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.folder_number || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.file_name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-wrap text-sm text-gray-900">
                        {record.docs_url || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.created_at ? new Date(record.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {record.docs_url && (
                          <a
                            href={record.docs_url}
                            target="_blank"
                            className="text-blue-600 hover:text-blue-900 mr-2"
                          >
                            📖 Open
                          </a>
                        )}
                        {record.docs_url && (
                          <a
                            href={`${record.docs_url}`}
                            target="_blank"
                            className="text-green-600 hover:text-green-900"
                          >
                            📥 PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 shadow-md">
        <div className="proposal-upload-form">
          {/* Header */}
          <div className="upload-form-header mb-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">📄 Upload Proposal Documents</h3>
            <p className="text-gray-600 mb-3">{uploadInstructions}</p>
            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              RFP Requirements
            </span>
          </div>

          {/* Upload Fields */}
          <div className="upload-fields-container space-y-6">
            {TEMPLATE_REQUIREMENTS.map((req) => (
              <div key={req.id} className="upload-field-item border border-gray-200 rounded-lg p-6 bg-gray-50">
                <label className="block mb-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-lg text-gray-900">{req.name}</strong>
                    {req.required && (
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                        *Required
                      </span>
                    )}
                  </div>
                </label>
                <p className="text-sm text-gray-600 mb-4 space-y-1">
                  {Object.entries(req.description).map(([key, value]) => (
                    <span key={key}>
                      <strong>{key}:</strong> {value}
                      <br />
                    </span>
                  ))}
                </p>
                <input
                  type="file"
                  id={`proposal-doc-${req.id}`}
                  name={req.fieldName}
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => handleFileChange(req.id, e.target.files?.[0] || null, e)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {fileStatuses[req.id] && (
                  <div
                    id={`status-${req.id}`}
                    className="file-status mt-2 text-sm bg-green-50 text-green-700 p-2 rounded"
                  >
                    {fileStatuses[req.id]}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          {readyCount > 0 && (
            <div className="upload-summary mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <strong>Files Ready:</strong> <span className="font-bold text-blue-800">{readyCount}</span> document(s)
            </div>
          )}

          {/* Actions */}
          <div className="upload-actions flex justify-end gap-4 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isSubmitReady}
              className={`px-6 py-2 rounded-lg transition ${isSubmitReady
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-400 text-gray-500 cursor-not-allowed"
                }`}
            >
              Submit Documents
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}