import Image from 'next/image';

import styles from './BrandShowcase.module.css';

interface Tile {
  id: string;
  src: string;
  width: number;
  height: number;
  label: string;
  tone: 'orange' | 'light' | 'teal' | 'pink' | 'dark';
}

const TILES: readonly Tile[] = [
  { id: 'shirt', src: '/brand/garment-shirt.svg', width: 160, height: 160, label: 'Como nueva', tone: 'orange' },
  { id: 'jacket', src: '/brand/garment-jacket.svg', width: 160, height: 160, label: 'Revisada', tone: 'pink' },
  { id: 'dress', src: '/brand/garment-dress.svg', width: 160, height: 200, label: 'Vintage', tone: 'light' },
  { id: 'sneaker', src: '/brand/garment-sneaker.svg', width: 160, height: 120, label: 'Muy buen estado', tone: 'teal' },
  { id: 'trousers', src: '/brand/garment-trousers.svg', width: 140, height: 180, label: 'Como nuevo', tone: 'dark' },
];

/** Panel de marca de la pantalla de login: solo presentación, sin JS (diseno.md 001). */
export function BrandShowcase() {
  return (
    <aside className={styles.root} aria-label="Perchados" data-testid="brand-showcase">
      <div className={styles.top}>
        <p className={styles.brand}>
          <Image src="/brand/logo-mark.svg" alt="" width={56} height={56} unoptimized className={styles.mark} />
          <span className={styles.wordmark}>
            perchados<span className={styles.dot}>.</span>
          </span>
        </p>
        <p className={styles.chip}>
          <span className={styles.chipText}>Panel de administración</span>
        </p>
      </div>

      <ul className={styles.mosaic} data-testid="brand-mosaic">
        {TILES.map((tile) => (
          <li key={tile.id} className={[styles.tile, styles[tile.tone], styles[tile.id]].filter(Boolean).join(' ')}>
            <Image src={tile.src} alt="" width={tile.width} height={tile.height} unoptimized className={styles.garment} />
            <span className={styles.tag}>{tile.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.copy}>
        <p className={styles.headline}>Cada prenda merece una segunda vida.</p>
        <p className={styles.subtitle}>
          Revisa, publica y vende ropa usada de buena calidad. Acceso solo para el equipo autorizado.
        </p>
      </div>
    </aside>
  );
}
