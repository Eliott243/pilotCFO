"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

interface CompanyFormProps {
  company: {
    name: string | null;
    country: string | null;
    currency: string | null;
    founded_year: number | null;
    employee_count: number | null;
  } | null;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "CHF", "AUD", "JPY", "SEK", "DKK", "NOK"];

export function CompanyForm({ company }: CompanyFormProps) {
  const router = useRouter();
  const [name, setName] = useState(company?.name ?? "");
  const [country, setCountry] = useState(company?.country ?? "");
  const [currency, setCurrency] = useState(company?.currency ?? "EUR");
  const [foundedYear, setFoundedYear] = useState(
    company?.founded_year ? String(company.founded_year) : ""
  );
  const [employeeCount, setEmployeeCount] = useState(
    company?.employee_count != null ? String(company.employee_count) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          country: country.trim() || undefined,
          currency,
          founded_year: foundedYear ? Number(foundedYear) : undefined,
          employee_count: employeeCount ? Number(employeeCount) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'enregistrer.");
        setSaving(false);
        return;
      }

      setSaved(true);
      router.refresh();
      router.push("/settings");
    } catch {
      setError("Erreur réseau. Réessayez.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-5 rounded-xl border border-border bg-card space-y-4 max-w-md"
    >
      <div>
        <Label htmlFor="name">Nom de l&apos;entreprise</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ma boutique"
          required
        />
      </div>

      <div>
        <Label htmlFor="country">Pays</Label>
        <Input
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="France"
        />
      </div>

      <div>
        <Label htmlFor="currency">Devise</Label>
        <Select
          id="currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted mt-1">
          Utilisée pour formater tous les montants des tableaux de bord.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="founded_year">Année de création</Label>
          <Input
            id="founded_year"
            type="number"
            value={foundedYear}
            onChange={(e) => setFoundedYear(e.target.value)}
            placeholder="2022"
          />
        </div>
        <div>
          <Label htmlFor="employee_count">Employés</Label>
          <Input
            id="employee_count"
            type="number"
            min={0}
            value={employeeCount}
            onChange={(e) => setEmployeeCount(e.target.value)}
            placeholder="3"
          />
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Enregistrement..." : "Enregistrer"}
        </Button>
        <a href="/settings" className="text-sm text-muted hover:text-foreground">
          Annuler
        </a>
        {saved && <span className="text-sm text-accent">Enregistré ✓</span>}
      </div>
    </form>
  );
}
