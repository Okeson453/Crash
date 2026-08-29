import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
function Broken(){throw new Error('boom');}
describe('ErrorBoundary',()=>it('renders a recovery state',()=>{render(<ErrorBoundary><Broken/></ErrorBoundary>);expect(screen.getByRole('button',{name:'Try Again'})).toBeInTheDocument();}));
