"use client";

import { extractText } from "unpdf";
import { createWorker } from "tesseract.js";

export const extractDocumentHybrid = async (file: File): Promise<string> => {
  try {
    const originalBuffer = await file.arrayBuffer();

    // Clone for unpdf
    const bufferForUnpdf = originalBuffer.slice(0);
    const unpdfResult = await extractText(bufferForUnpdf) as {
      text: string[] | string;
    };

    let text = Array.isArray(unpdfResult.text)
      ? unpdfResult.text.join(" ").trim()
      : unpdfResult.text?.trim() || "";

    if (text.length > 100) {
      return text.slice(0, 5000);
    }

    // Clone for pdf.js
    const bufferForPdfJs = originalBuffer.slice(0);

    // ✅ Import pdf.js API
    const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(bufferForPdfJs),
    }).promise;

    // Only first page (browser safety)
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context failed");

    await page.render({ canvasContext: ctx, viewport }).promise;

    const worker = await createWorker("eng");
    const { data } = await worker.recognize(canvas);
    await worker.terminate();

    return data.text?.trim().slice(0, 5000) || "⚠️ OCR failed";
  } catch (err) {
    console.error("Extraction failed:", err);
    return `ERROR_${file.name}`;
  }
};