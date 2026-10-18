export interface Listenable {
  listen(port: number): Promise<unknown>;
}

export interface ErrorLogger {
  error(message: string): void;
}

function isAddressInUse(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
}

/**
 * Abre el puerto; si no puede, registra el motivo con el puerto y pide terminar con código 1.
 * `exit` se inyecta para poder probarlo.
 */
export async function listenOrExit(
  app: Listenable,
  port: number,
  logger: ErrorLogger,
  exit: (code: number) => void,
): Promise<boolean> {
  try {
    await app.listen(port);
    return true;
  } catch (error) {
    logger.error(
      isAddressInUse(error)
        ? `Port ${String(port)} is already in use; set API_PORT to a free port`
        : `API could not listen on port ${String(port)}`,
    );
    exit(1);
    return false;
  }
}
