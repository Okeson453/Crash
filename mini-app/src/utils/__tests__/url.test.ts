import { describe, expect, it } from 'vitest';
import { isAllowedUrl } from '@/utils/url';
describe('URL allow-list', () => { it('accepts trusted https hosts', () => expect(isAllowedUrl('https://t.me/example')).toBe(true)); it('rejects javascript and unknown hosts', () => { expect(isAllowedUrl('javascript:alert(1)')).toBe(false); expect(isAllowedUrl('https://evil.example')).toBe(false); }); });
