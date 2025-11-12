import { getDocumentProxy, extractText } from "unpdf";

export const extractPdfText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocumentProxy(arrayBuffer);
    const text = await extractText(pdf);

    // limit for performance
    return text.text.join(' ').trim().slice(0, 5000) || "No text found in PDF.";
  } catch (err) {
    console.error("⚠️ PDF extraction failed:", err);
    return "⚠️ Failed to read PDF content.";
  }
};