import { render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';
import { describe, expect, it } from 'vitest';
describe('ErrorState',()=>it('renders',()=>{render(<ErrorState />); expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();}));
