import type { Metadata } from 'next';
import RecoveryForm from './recovery-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Recuperar autenticador', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function RecoveryPage() { return <RecoveryForm />; }
