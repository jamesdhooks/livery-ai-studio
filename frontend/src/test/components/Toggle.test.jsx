import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from '../../components/common/Toggle';

describe('Toggle component', () => {
  it('renders with label', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Enable feature" />);
    expect(screen.getByText('Enable feature')).toBeInTheDocument();
  });

  it('calls onChange when toggled', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} id="toggle1" />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders as checked', () => {
    render(<Toggle checked={true} onChange={() => {}} id="toggle2" />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Toggle checked={false} onChange={() => {}} disabled id="toggle3" />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});
