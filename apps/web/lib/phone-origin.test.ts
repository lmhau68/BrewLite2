import { describe, expect, it } from 'vitest';
import { getPhoneReachableOrigin } from './phone-origin';

describe('getPhoneReachableOrigin', () => {
  it('uses the configured LAN fallback when the desktop page uses localhost', () => {
    expect(getPhoneReachableOrigin('http://localhost:3000')).toBe(
      'http://192.168.1.12:3000',
    );
  });

  it('preserves the host when the page is already opened over the LAN', () => {
    expect(getPhoneReachableOrigin('http://192.168.1.12:3000')).toBe(
      'http://192.168.1.12:3000',
    );
  });
});
