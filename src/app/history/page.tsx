"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { useRouter } from "next/navigation";

type UploadedFile = {
  id: string;
  file_name: string;
  file_path: string;
  text_content: string | null;
  created_at: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        router.replace("/signin");
        return;
      }

      const userId = session.user.id;

      const { data, error } = await supabase
        .from("uploaded_files")
        .select("id, file_name, file_path, text_content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching files:", error);
        setFiles([]);
      } else if (data) {
        setFiles(data);
      }
      setLoading(false);
    };

    fetchFiles();
  }, [router]);

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("documents").getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10 text-gray-800">
      <h1 className="text-2xl font-bold mb-6">Upload History</h1>

      {loading ? (
        <p className="text-gray-500">Loading your uploaded files...</p>
      ) : files.length === 0 ? (
        <p className="text-gray-500">No files uploaded yet.</p>
      ) : (
        <ul className="space-y-4">
          {files.map((file) => {
            const fileUrl = getPublicUrl(file.file_path);
            return (
              <li
                key={file.id}
                className="rounded-lg bg-white p-5 shadow-sm border border-gray-200 hover:shadow-md transition"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-medium hover:underline"
                    >
                      {file.file_name}
                    </a>
                    <p className="text-xs text-gray-500">
                      {new Date(file.created_at).toLocaleString()}
                    </p>
                  </div>
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded bg-blue-600 px-3 py-1 text-white text-sm hover:bg-blue-700"
                  >
                    View PDF
                  </a>
                </div>

                {file.text_content && (
                  <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-700 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    <p className="font-semibold mb-1 text-gray-800">
                      Extracted Text Preview:
                    </p>
                    {file.text_content.slice(0, 400)}{" "}
                    {file.text_content.length > 400 && "…"}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}