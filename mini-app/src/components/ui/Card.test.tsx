import { render, screen } from '@testing-library/react';
import { Card } from './Card';
import { describe, expect, it } from 'vitest';
describe('Card',()=>it('renders',()=>{render(<Card>Content</Card>); expect(screen.getByText(/Content/i)).toBeInTheDocument();}));
