import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Shield, Zap } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-5xl mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/logo.png"
            alt="pilotCFO"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="font-semibold">pilotCFO</span>
        </div>
        <div className="flex items-center gap-3">
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

      <main className="max-w-3xl mx-auto px-8 py-24 text-center">
        <p className="text-sm font-medium text-accent mb-4 tracking-wide uppercase">
          CFO virtuel pour Shopify
        </p>
        <h1 className="text-5xl font-semibold tracking-tight text-foreground leading-tight">
          Comprenez enfin où va votre argent.
        </h1>
        <p className="text-lg text-muted mt-6 leading-relaxed max-w-xl mx-auto">
          pilotCFO analyse votre boutique comme un directeur financier.
          Rentabilité, trésorerie, croissance, risques — des réponses claires,
          pas des graphiques.
        </p>
        <div className="flex items-center justify-center gap-4 mt-10">
          <Link href="/signup">
            <Button size="lg">
              Démarrer gratuitement
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted mt-4">14 jours d&apos;essai · Sans carte bancaire</p>
      </main>

      <section className="max-w-4xl mx-auto px-8 py-16 grid grid-cols-3 gap-6">
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
            className="p-6 rounded-xl border border-border bg-card text-left"
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
