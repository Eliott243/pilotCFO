"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  AI_PREFILL_STORAGE_KEY,
  CFO_DONE_COOKIE,
  CFO_DRAFT_STORAGE_KEY,
  CFO_QUESTIONS,
} from "@/lib/questionnaire/cfo-questions";
import {
  buildAiMessage,
  buildPriorityTags,
  type QuestionnaireAnswers,
} from "@/lib/questionnaire/build-summary";

const PURPLE = "#6366F1";
const PURPLE_LIGHT = "#EEF2FF";

type Step = "questions" | "result";

export function CfoQuestionnaire() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("questions");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(
    Array(CFO_QUESTIONS.length).fill(null)
  );
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Restore a draft from sessionStorage after mount. setState here is intentional:
    // sessionStorage is unavailable during SSR, so we hydrate once on the client and
    // render a loading state until `hydrated` is true to avoid hydration mismatches.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = sessionStorage.getItem(CFO_DRAFT_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as {
          answers?: QuestionnaireAnswers;
          step?: Step;
          currentIndex?: number;
        };
        if (draft.answers?.length === CFO_QUESTIONS.length) {
          setAnswers(draft.answers);
        }
        if (draft.step === "result") setStep("result");
        if (typeof draft.currentIndex === "number") setCurrentIndex(draft.currentIndex);
      }
    } catch {
      // ignore
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    sessionStorage.setItem(
      CFO_DRAFT_STORAGE_KEY,
      JSON.stringify({ answers, step, currentIndex })
    );
  }, [answers, step, currentIndex, hydrated]);

  const question = CFO_QUESTIONS[currentIndex];
  const selected = answers[currentIndex];
  const isLast = currentIndex === CFO_QUESTIONS.length - 1;
  const tags = step === "result" ? buildPriorityTags(answers) : [];

  function selectOption(optionIndex: number) {
    const next = [...answers] as QuestionnaireAnswers;
    next[currentIndex] = optionIndex;
    setAnswers(next);
  }

  function goNext() {
    if (selected == null) return;
    if (isLast) {
      setStep("result");
      return;
    }
    setDirection(1);
    setCurrentIndex((i) => i + 1);
  }

  function goBack() {
    if (step === "result") {
      setStep("questions");
      setCurrentIndex(CFO_QUESTIONS.length - 1);
      return;
    }
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  }

  async function launchAnalysis() {
    setSubmitting(true);
    setError("");
    const message = buildAiMessage(answers);
    sessionStorage.setItem(AI_PREFILL_STORAGE_KEY, message);

    try {
      const res = await fetch("/api/questionnaire/complete", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de finaliser le questionnaire.");
        setSubmitting(false);
        return;
      }

      document.cookie = `${CFO_DONE_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
      sessionStorage.removeItem(CFO_DRAFT_STORAGE_KEY);
      router.push("/ai-cfo?autostart=1");
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion et réessayez.");
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-sm text-[#64748B]">
        Chargement...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Progress dots */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-center gap-2">
          {CFO_QUESTIONS.map((_, i) => {
            const done =
              step === "result" || i < currentIndex || (i === currentIndex && selected != null);
            const active = step === "questions" && i === currentIndex;
            return (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-colors duration-300"
                style={{
                  backgroundColor: done || active ? PURPLE : "#E2E8F0",
                  opacity: active ? 1 : done ? 0.85 : 1,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-8 pb-8 flex flex-col">
        <AnimatePresence mode="wait" custom={direction}>
          {step === "questions" ? (
            <motion.div
              key={`q-${currentIndex}`}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="flex-1 flex flex-col"
            >
              <p
                className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#94A3B8] mb-3"
              >
                Question {currentIndex + 1} sur {CFO_QUESTIONS.length}
              </p>
              <h1 className="text-[18px] font-medium text-[#0F172A] leading-snug">
                {question.title}
              </h1>
              <p className="text-[13px] text-[#64748B] mt-2 mb-6">{question.subtitle}</p>

              <div className="space-y-3 flex-1">
                {question.options.map((opt, idx) => {
                  const isSelected = selected === idx;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => selectOption(idx)}
                      className={cn(
                        "w-full text-left rounded-xl px-4 py-3.5 transition-all duration-200",
                        "border-[1.5px]"
                      )}
                      style={{
                        borderColor: isSelected ? PURPLE : "#E2E8F0",
                        backgroundColor: isSelected ? PURPLE_LIGHT : "#FFFFFF",
                      }}
                    >
                      <div className="flex gap-3 items-start">
                        <span className="text-xl leading-none shrink-0">{opt.emoji}</span>
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{opt.label}</p>
                          <p className="text-[13px] text-[#64748B] mt-0.5">{opt.sublabel}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              className="flex-1 flex flex-col"
            >
              <h1 className="text-[22px] font-semibold text-[#0F172A] tracking-tight">
                Ton profil CFO est prêt
              </h1>
              <p className="text-[13px] text-[#64748B] mt-2 mb-8">
                Voici les points prioritaires que ton assistant va analyser.
              </p>

              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-8">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs font-medium px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: PURPLE_LIGHT, color: PURPLE }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#64748B] mb-8">
                  Ton assistant va analyser ta situation globale.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        {step === "questions" ? (
          <div className="flex items-center justify-between gap-3 mt-8 pt-4 border-t border-[#F1F5F9]">
            <button
              type="button"
              onClick={goBack}
              disabled={currentIndex === 0}
              className={cn(
                "px-5 py-2.5 text-sm font-medium rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B]",
                "hover:bg-[#F8FAFC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              Retour
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={selected == null}
              className="px-5 py-2.5 text-sm font-medium rounded-xl text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: PURPLE }}
            >
              {isLast ? "Voir mon analyse →" : "Suivant"}
            </button>
          </div>
        ) : (
          <div className="mt-8 pt-4 border-t border-[#F1F5F9] space-y-3">
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="button"
              onClick={launchAnalysis}
              disabled={submitting}
              className="w-full py-3.5 text-sm font-medium rounded-xl text-white disabled:opacity-60"
              style={{ backgroundColor: PURPLE }}
            >
              {submitting ? "Lancement..." : "Lancer mon analyse CFO →"}
            </button>
            <button
              type="button"
              onClick={goBack}
              className="w-full py-2.5 text-sm font-medium rounded-xl border-[1.5px] border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
            >
              Retour
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
