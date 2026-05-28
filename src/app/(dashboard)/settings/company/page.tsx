import { PageHeader } from "@/components/dashboard/page-header";
import { CompanyForm } from "@/components/settings/company-form";
import { createClient } from "@/lib/supabase/server";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = user
    ? await supabase
        .from("companies")
        .select("name, country, currency, founded_year, employee_count")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <PageHeader
        title="Entreprise"
        subtitle="Nom, pays et devise de votre entreprise. La devise est utilisée pour tous les montants."
      />
      <CompanyForm company={company} />
    </>
  );
}
