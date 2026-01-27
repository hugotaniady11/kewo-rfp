// src/app/extract-tester/page.tsx
"use client";

import { useState } from "react";
import { extractDocumentHybrid } from "@/utils/extractDocs";

export default function ExtractTesterPage() {
  const [fileName, setFileName] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setOutput("");
    setLoading(true);

    try {
      const text = await extractDocumentHybrid(file);
      setOutput(text);
    } catch (err: any) {
      setOutput("Error: " + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-4">
        PDF Hybrid Extract Tester
      </h1>

      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="mb-4"
      />

      {fileName && (
        <p className="text-sm text-gray-600 mb-2">
          Selected: <span className="font-mono">{fileName}</span>
        </p>
      )}

      {loading && <p className="text-blue-600 mb-2">⏳ Extracting...</p>}

      <textarea
        className="w-full h-80 p-3 border rounded bg-white text-sm font-mono"
        readOnly
        value={output}
        placeholder="Extracted text will appear here..."
      />
    </div>
  );
}
