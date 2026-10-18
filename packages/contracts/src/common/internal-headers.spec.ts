import { describe, expect, it } from 'vitest';

import { CLIENT_IP_HEADER, INTERNAL_TOKEN_HEADER } from './internal-headers';

describe('cabeceras internas web a API (RT-022)', () => {
  it('RT-022: conserva los nombres acordados', () => {
    expect(INTERNAL_TOKEN_HEADER).toBe('X-Perchados-Internal-Token');
    expect(CLIENT_IP_HEADER).toBe('X-Perchados-Client-Ip');
  });
});
