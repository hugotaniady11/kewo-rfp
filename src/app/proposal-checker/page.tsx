"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Progress from "@radix-ui/react-progress";
import { extractText } from "unpdf";

interface Step {
  id: number;
  title: string;
  description: string;
  key: string;
}

const steps: Step[] = [
  {
    id: 1,
    title: "Upload Company Profile",
    description: "Please upload company profile (PDF only)",
    key: "companyProfile",
  },
  {
    id: 2,
    title: "Upload User CV",
    description: "Please upload user CV (PDF only)",
    key: "userCV",
  },
  {
    id: 3,
    title: "Upload Portfolio",
    description: "Please upload portfolio (PDF only)",
    key: "portfolio",
  },
  {
    id: 4,
    title: "Upload Technical Document",
    description: "Please upload technical document (PDF only)",
    key: "technicalDoc",
  },
  {
    id: 5,
    title: "Upload Financial Document",
    description: "Please upload financial document (PDF only)",
    key: "financialDoc",
  },
];

export default function ProposalCheckerPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [uploads, setUploads] = useState<Record<string, File | null>>({});
  const [previewTexts, setPreviewTexts] = useState<Record<string, string>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  useEffect(() => setHydrated(true), []);
  if (!hydrated) return null;

  // --- PDF text extraction using unpdf ---
  const extractPdfText = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const result = await extractText(buffer);
    const text =
      Array.isArray(result.text) ? result.text.join(" ") : result.text || "";
    return text;
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    stepKey: string,
    stepId: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file only.");
      return;
    }

    setLoadingStep(stepId);
    try {
      const text = await extractPdfText(file);
      setUploads((prev) => ({ ...prev, [stepKey]: file }));
      setPreviewTexts((prev) => ({ ...prev, [stepKey]: text.substring(0, 500) }));
    } catch (err) {
      console.error("Failed to read PDF:", err);
      alert("Error reading PDF file.");
    } finally {
      setLoadingStep(null);
    }
  };

  const handleSubmit = () => {
    const allUploaded = steps.every((s) => uploads[s.key]);
    if (!allUploaded) {
      alert("Please upload all required PDFs before submitting.");
      return;
    }
    alert("✅ All documents uploaded successfully!");
  };

  // Determine how many steps are complete
  const completedSteps = steps.filter((s) => uploads[s.key]).length;
  const progressValue = (completedSteps / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow-lg">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 rounded-full bg-blue-900 px-6 py-3 text-white">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-900 font-semibold">
              {completedSteps}
            </div>
            <h2 className="text-lg font-semibold">Upload your file</h2>
          </div>
          <div className="mt-4">
            <Progress.Root
              className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200"
              value={progressValue}
            >
              <Progress.Indicator
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </Progress.Root>
          </div>
        </div>

        {/* Step Sections */}
        <div className="space-y-8">
          {steps.map((step, index) => {
            const previousCompleted =
              index === 0 || !!uploads[steps[index - 1].key];
            const visible = previousCompleted;

            if (!visible) return null;

            return (
              <div
                key={step.id}
                className="grid grid-cols-1 gap-6 border border-gray-300 rounded-lg p-6 md:grid-cols-2"
              >
                {/* Upload Section */}
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Section {step.id.toString().padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="text-sm text-red-500 mt-1">{step.description}</p>

                  <label
                    htmlFor={`upload-${step.key}`}
                    className={`mt-4 flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl ${
                      uploads[step.key]
                        ? "bg-blue-700"
                        : "bg-blue-900 hover:bg-blue-800"
                    } text-center text-white transition-all`}
                  >
                    {loadingStep === step.id ? (
                      <p className="text-sm animate-pulse">Processing PDF...</p>
                    ) : (
                      <>
                        <div className="h-6 w-6 rounded-full bg-white mb-3"></div>
                        <p className="text-orange-400 font-semibold">
                          {uploads[step.key] ? "Uploaded ✔" : "Upload PDF"}
                        </p>
                      </>
                    )}
                  </label>
                  <input
                    id={`upload-${step.key}`}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, step.key, step.id)}
                  />
                </div>

                {/* Preview Section */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Preview
                  </h3>
                  {previewTexts[step.key] ? (
                    <div className="rounded-lg bg-blue-100 p-4 text-gray-800 text-sm max-h-60 overflow-y-auto">
                      {previewTexts[step.key]}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">
                      Upload a PDF to see a text preview.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 flex justify-between">
          <button
            onClick={() => router.push("/")}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Back
          </button>

          <button
            onClick={handleSubmit}
            disabled={completedSteps !== steps.length}
            className={`rounded px-6 py-2 text-white ${
              completedSteps === steps.length
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
