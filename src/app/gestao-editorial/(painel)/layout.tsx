import { redirect } from "next/navigation";
import { adminIdentity } from "./_lib/data";

// Barreira de entrada do painel: sem sessão administrativa válida (ADMIN ou SUPER_ADMIN) não há renderização.
// Cada página e cada leitura da API repetem a verificação, pois layouts não são reexecutados em navegações internas.
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await adminIdentity())) redirect("/gestao-editorial/entrar");
  return children;
}
