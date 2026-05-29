import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Shield, Zap } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Image
            src="/brand/logo.png"
            alt="pilotCFO"
            width={32}
            height={32}
            className="rounded-lg shrink-0"
            priority
          />
          <span className="font-semibold truncate">pilotCFO</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              {dict.landing.signIn}
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">{dict.landing.start}</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24 text-center">
        <p className="text-xs sm:text-sm font-medium text-accent mb-3 sm:mb-4 tracking-wide uppercase">
          CFO virtuel pour Shopify
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight">
          Comprenez enfin où va votre argent.
        </h1>
        <p className="text-base sm:text-lg text-muted mt-4 sm:mt-6 leading-relaxed max-w-xl mx-auto">
          pilotCFO analyse votre boutique comme un directeur financier.
          Rentabilité, trésorerie, croissance, risques — des réponses claires,
          pas des graphiques.
        </p>
        <div className="flex items-center justify-center mt-8 sm:mt-10">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              Démarrer gratuitement
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted mt-4">14 jours d&apos;essai · Sans carte bancaire</p>
      </main>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[
          {
            icon: BarChart3,
            title: "Rentabilité réelle",
            desc: "Marges, coûts, profit par commande et par produit.",
          },
          {
            icon: Shield,
            title: "Trésorerie & risques",
            desc: "Runway, alertes et projections sur 12 mois.",
          },
          {
            icon: Zap,
            title: "AI CFO",
            desc: "Posez vos questions à un directeur financier, pas un chatbot.",
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="p-5 sm:p-6 rounded-xl border border-border bg-card text-left"
          >
            <Icon className="w-5 h-5 text-accent mb-3" />
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
