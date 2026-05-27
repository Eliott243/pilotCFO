"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Wallet,
  MessageSquare,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

const STEPS = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Bienvenue dans pilotCFO",
    description: "Comprenez enfin où va votre argent.",
    detail:
      "pilotCFO remplace vos tableurs financiers et vos analyses manuelles par un directeur financier virtuel spécialisé Shopify.",
  },
  {
    id: "revenue",
    icon: BarChart3,
    title: "Revenue Intelligence",
    description: "Analyse du chiffre d'affaires, croissance, commandes et panier moyen.",
    detail:
      "Est-ce que mon entreprise est saine ? Suivez votre CA réel depuis Shopify, pas des estimations.",
  },
  {
    id: "profitability",
    icon: TrendingUp,
    title: "Profitability",
    description: "Analyse des marges et de la rentabilité réelle.",
    detail:
      "Pourquoi ma marge baisse ? Identifiez automatiquement les produits et coûts qui détruisent votre rentabilité.",
  },
  {
    id: "cashflow",
    icon: Wallet,
    title: "Cash Flow",
    description: "Comprendre la trésorerie et anticiper les risques.",
    detail:
      "Vais-je manquer de trésorerie ? Runway, alertes et projections basées sur vos vraies données.",
  },
  {
    id: "ai",
    icon: MessageSquare,
    title: "AI CFO",
    description: "Posez des questions comme à un directeur financier.",
    detail:
      "Puis-je embaucher ? Augmenter mon budget Meta ? L'IA interprète vos métriques calculées, elle n'invente rien.",
  },
  {
    id: "connect",
    icon: ShoppingBag,
    title: "Connect Shopify",
    description: "Connexion de la boutique et lancement du premier diagnostic.",
    detail:
      "Connectez votre boutique pour importer commandes, produits, clients et lancer votre premier audit financier.",
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const current = STEPS[step];
  const Icon = current.icon;
  const progress = ((step + 1) / STEPS.length) * 100;

  async function complete() {
    setLoading(true);
    await fetch("/api/onboarding/complete", { method: "POST" });
    window.location.href = "/questionnaire";
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else complete();
  }

  async function skip() {
    setLoading(true);
    await fetch("/api/onboarding/complete", { method: "POST" });
    window.location.href = "/questionnaire";
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/logo.png"
            alt="pilotCFO"
            width={28}
            height={28}
            className="rounded-lg"
            priority
          />
          <span className="font-semibold text-sm">pilotCFO</span>
        </div>
        <button
          onClick={skip}
          className="text-sm text-muted hover:text-foreground transition-colors"
          disabled={loading}
        >
          Passer
        </button>
      </header>

      <div className="px-8 mb-4">
        <div className="h-1 bg-stone-100 rounded-full overflow-hidden max-w-md">
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <p className="text-xs text-muted mt-2">
          Étape {step + 1} sur {STEPS.length}
        </p>
      </div>

      <main className="flex-1 flex items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="max-w-lg text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-6">
              <Icon className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{current.title}</h1>
            <p className="text-muted mt-3 text-lg">{current.description}</p>
            <p className="text-sm text-muted mt-4 leading-relaxed">{current.detail}</p>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="px-8 py-8 flex justify-center gap-3">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={loading}>
            Retour
          </Button>
        )}
        <Button onClick={next} disabled={loading} size="lg">
          {loading
            ? "Chargement..."
            : step === STEPS.length - 1
            ? "Configurer mon entreprise"
            : "Continuer"}
        </Button>
      </footer>
    </div>
  );
}
