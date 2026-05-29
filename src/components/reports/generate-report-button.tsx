"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function GenerateReportButton() {
  const [pending, setPending] = useState(false);

  return (
    <form
      action="/api/reports/generate"
      method="POST"
      onSubmit={() => setPending(true)}
    >
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="w-full sm:w-auto"
        disabled={pending}
      >
        {pending ? "Génération..." : "Générer rapport mensuel"}
      </Button>
    </form>
  );
}
