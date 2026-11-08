import type { Metadata } from 'next';
import Confirmation from './confirmation';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirmar e-mail de recuperação', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function Page() { return <Confirmation />; }
