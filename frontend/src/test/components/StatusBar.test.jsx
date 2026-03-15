import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../../components/common/StatusBar';

describe('StatusBar component', () => {
  it('renders success message', () => {
    render(<StatusBar status={{ type: 'success', message: 'Done!' }} />);
    expect(screen.getByText('Done!')).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<StatusBar status={{ type: 'error', message: 'Failed!' }} />);
    expect(screen.getByText('Failed!')).toBeInTheDocument();
  });

  it('renders nothing when status is null', () => {
    const { container } = render(<StatusBar status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies success style for success type', () => {
    const { container } = render(<StatusBar status={{ type: 'success', message: 'OK' }} />);
    expect(container.firstChild.className).toContain('text-success');
  });

  it('applies error style for error type', () => {
    const { container } = render(<StatusBar status={{ type: 'error', message: 'Error' }} />);
    expect(container.firstChild.className).toContain('text-error');
  });
});
