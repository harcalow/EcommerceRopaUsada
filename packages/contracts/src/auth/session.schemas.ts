import '../common/zod-openapi';
import { z } from 'zod';

export const sessionInfoSchema = z.strictObject({
  role: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;
