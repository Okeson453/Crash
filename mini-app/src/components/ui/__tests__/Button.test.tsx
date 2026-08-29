import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
describe('Button', () => { it('exposes its accessible name and loading state', () => { render(<Button loading>Save</Button>); expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled(); expect(screen.getByRole('button')).toHaveAttribute('aria-busy','true'); }); });
