import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Página no encontrada' };

export default function NotFound() {
  return (
    <main>
      <h1>Página no encontrada</h1>
      <p>La página que buscas no existe o fue movida.</p>
      <Link href="/" data-testid="not-found-home">
        Volver al inicio
      </Link>
    </main>
  );
}
