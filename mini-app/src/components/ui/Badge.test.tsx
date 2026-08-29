import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';
import { describe, expect, it } from 'vitest';
describe('Badge',()=>it('renders',()=>{render(<Badge>Active</Badge>); expect(screen.getByText(/Active/i)).toBeInTheDocument();}));
