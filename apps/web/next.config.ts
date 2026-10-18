import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // ui-web se publica como fuente TypeScript (ADR-009): Next.js la transpila
  transpilePackages: ['@perchados/ui-web'],
  // Next.js genera AGENTS.md y CLAUDE.md propios; las reglas de agentes viven en la raíz (CLAUDE.md)
  agentRules: false,
};

export default nextConfig;
