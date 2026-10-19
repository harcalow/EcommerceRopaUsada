import { z } from 'zod';

import { CORRELATION_ID_PATTERN } from './correlation-constants';

export { CORRELATION_ID_HEADER, CORRELATION_ID_PATTERN } from './correlation-constants';

export const correlationIdSchema = z.string().regex(CORRELATION_ID_PATTERN);
