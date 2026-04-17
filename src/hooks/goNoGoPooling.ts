"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/db";

interface PollingHookProps {
  sessionId: string;
  onAgentResult?: (data: any) => void;
  onComplete?: (sessionId: string, documentData: any) => void;
}

/**
 * Reusable polling hook for monitoring AI agent results and workflow sessions.
 * It watches `ai_agent_results` and `workflow_sessions` in Supabase.
 */
export function useGoNoGoPolling({
  sessionId,
  onAgentResult,
  onComplete,
}: PollingHookProps) {
  const pollerRef = useRef<NodeJS.Timeout | null>(null);
  const completedAgents = useRef<Set<string>>(new Set());
  const isRunning = useRef(false);

  useEffect(() => {
    if (!sessionId || isRunning.current) return;

    isRunning.current = true;
    console.log("🚀 Starting Supabase polling for session:", sessionId);

    const poll = async () => {
      try {
        // ✅ Poll completed agent results
        const { data: agentResults, error: agentError } = await supabase
          .from("ai_agent_results")
          .select("*")
          .eq("session_id", sessionId)
          .eq("status", "completed");

        if (agentError) throw agentError;

        if (agentResults && agentResults.length > 0) {
          agentResults.forEach((result) => {
            if (!completedAgents.current.has(result.agent_name)) {
              completedAgents.current.add(result.agent_name);

              const agentData = {
                sessionId,
                agentName: result.agent_name,
                result: result.result?.output || result.result,
                processingTime: result.processing_time || 0,
                characterCount:
                  typeof result.result === "string"
                    ? result.result.length
                    : JSON.stringify(result.result).length,
                tokenUsage: result.token_usage?.total_tokens || 0,
                completedAt: result.updated_at,
              };

              onAgentResult?.(agentData);
            }
          });
        }

        // ✅ Poll workflow session status
        const { data: sessionData, error: sessionError } = await supabase
          .from("workflow_sessions")
          .select("*")
          .eq("session_id", sessionId)
          .maybeSingle();

        if (sessionError && sessionError.code !== "PGRST116")
          throw sessionError;

        if (sessionData) {
          // 🔥 NEW: detect OCR done
          if (
            sessionData.status === "ocr_analysis_done" &&
            !completedAgents.current.has("OCR_DONE")
          ) {
            console.log("🔥 OCR DONE detected");

            completedAgents.current.add("OCR_DONE");

            onAgentResult?.({
              sessionId,
              agentName: "OCR_DONE",
              result: sessionData.metadata?.extracted_text,
              processingTime: 0,
              characterCount: sessionData.metadata?.extracted_text?.length || 0,
              tokenUsage: 0,
              completedAt: sessionData.updated_at,
            });
          }

          // 🔥 ADD THIS
          if (
            sessionData.status === "ai_agents_processing" &&
            !completedAgents.current.has("AI_STARTED")
          ) {
            console.log("🔥 AI STARTED detected");

            completedAgents.current.add("AI_STARTED");

            onAgentResult?.({
              sessionId,
              agentName: "AI_STARTED",
              result: null,
              completedAt: sessionData.updated_at,
            });
          }

          // ✅ existing logic (unchanged)
          if (sessionData.status === "completed") {
            const documentData = {
              docId: sessionData.metadata?.doc_id,
              documentUrl: sessionData.metadata?.document_url,
              documentName: sessionData.metadata?.file_name,
            };

            console.log("✅ Session complete, document ready:", documentData);
            onComplete?.(sessionId, documentData);
            stopPolling();
          }
        }
      } catch (err: any) {
        console.warn("⚠️ Polling error:", err.message);
      }
    };

    const stopPolling = () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
      pollerRef.current = null;
      isRunning.current = false;
    };

    pollerRef.current = setInterval(poll, 4000);
    return () => {
      stopPolling();
      console.log("🛑 Stopped polling for session:", sessionId);
    };
  }, [sessionId]);
}