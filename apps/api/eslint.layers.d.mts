import type { Linter } from 'eslint';

export declare const LAYERS: readonly string[];
export declare function listModules(rootDir: string): string[];
export declare function createLayerRules(modules: readonly string[]): Linter.Config[];
