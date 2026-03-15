import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../components/common/Modal';

describe('Modal component', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Test">Content</Modal>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and children when isOpen=true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="My Modal">
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('My Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>);
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>
    );
    // The overlay div is the second child of the modal wrapper
    const overlay = container.querySelector('.absolute.inset-0');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when closed', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={false} onClose={onClose} title="Test">Content</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies custom className to modal panel', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test" className="my-custom-class">
        Content
      </Modal>
    );
    expect(container.querySelector('.my-custom-class')).toBeInTheDocument();
  });

  it('applies size class for xl size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test" size="xl">
        Content
      </Modal>
    );
    expect(container.querySelector('.max-w-4xl')).toBeInTheDocument();
  });

  it('does not propagate clicks inside the modal panel to the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <button>Inner button</button>
      </Modal>
    );
    // Click on an element inside the panel
    fireEvent.click(screen.getByText('Inner button'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
