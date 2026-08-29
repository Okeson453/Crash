import { render, screen } from '@testing-library/react';
import { Tabs } from './Tabs';
import { describe, expect, it } from 'vitest';
describe('Tabs',()=>it('renders',()=>{render(<Tabs tabs={[{id:"a",label:"A"}]} value="a" onChange={()=>undefined}/>); expect(screen.getByText(/A/i)).toBeInTheDocument();}));
