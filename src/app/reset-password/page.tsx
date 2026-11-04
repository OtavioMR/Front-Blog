import type { Metadata } from "next";
import AccountFlow from "../_account-flow/flow";
export const metadata: Metadata = { title: "Redefinir senha", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function Page() { return <AccountFlow mode="reset" />; }
