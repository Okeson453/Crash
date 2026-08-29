import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { describe, expect, it } from 'vitest';
describe('Button',()=>it('renders an accessible button',()=>{render(<Button>Continue</Button>);expect(screen.getByRole('button',{name:'Continue'})).toBeInTheDocument();}));
