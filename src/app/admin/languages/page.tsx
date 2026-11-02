import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/ui/primitives";

const STRINGS = [
  { key: "tagline", en: "Smart Shopping, Khula Nathi Mhlobo", nd: "Smart Shopping, Khula Nathi Mhlobo" },
  { key: "shops", en: "Shops", nd: "Amazitolo" },
  { key: "cart", en: "Cart", nd: "Inqola" },
  { key: "orders", en: "Orders", nd: "Ama-oda" },
  { key: "support", en: "Support", nd: "Usizo" },
  { key: "sign_in", en: "Sign in", nd: "Ngena" },
];

export default async function LanguagesPage() {
  await requireAdminLevel("super_admin");
  return (
    <>
      <PageHeader title="Languages" subtitle="English and isiNdebele strings used across LaGecto." />
      <Card>
        <div className="app-table-wrap">
          <table className="app-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>English</th>
                <th>isiNdebele</th>
              </tr>
            </thead>
            <tbody>
              {STRINGS.map((row) => (
                <tr key={row.key}>
                  <td className="font-mono text-xs">{row.key}</td>
                  <td>{row.en}</td>
                  <td>{row.nd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
