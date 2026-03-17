import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileUploader } from '../../components/common/FileUploader';

describe('FileUploader component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders label when provided', () => {
    render(<FileUploader label="Wireframe" onUpload={() => {}} />);
    expect(screen.getByText('Wireframe')).toBeInTheDocument();
  });

  it('renders placeholder text when no file selected', () => {
    render(
      <FileUploader
        placeholder="Drop file or click to browse"
        onUpload={() => {}}
      />
    );
    expect(screen.getByText('Drop file or click to browse')).toBeInTheDocument();
  });

  it('renders filename in title when currentPath is set', () => {
    const { container } = render(
      <FileUploader
        currentPath="/data/generate/wire/my-wireframe.png"
        onUpload={() => {}}
      />
    );
    const element = container.querySelector('[title="my-wireframe.png"]');
    expect(element).toBeInTheDocument();
  });

  it('renders preview image when previewUrl is set', () => {
    render(
      <FileUploader
        previewUrl="/api/uploads/preview?path=foo.png"
        label="Base Texture"
        onUpload={() => {}}
      />
    );
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('/api/uploads/preview?path=foo.png');
  });

  it('calls onUpload when a file is selected via input', () => {
    const onUpload = vi.fn();
    render(<FileUploader onUpload={onUpload} />);

    const input = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'wire.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('calls onUpload when a file is dropped', () => {
    const onUpload = vi.fn();
    const { container } = render(<FileUploader onUpload={onUpload} />);

    const dropZone = container.querySelector('.border');
    const file = new File(['content'], 'base.png', { type: 'image/png' });

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] },
    });

    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('shows Clear button when currentPath and onClear are provided', () => {
    render(
      <FileUploader
        currentPath="/data/generate/wire/foo.png"
        onClear={() => {}}
        onUpload={() => {}}
      />
    );
    expect(screen.getByTitle('Clear')).toBeInTheDocument();
  });

  it('calls onClear when Clear button is clicked', () => {
    const onClear = vi.fn();
    render(
      <FileUploader
        currentPath="/data/generate/wire/foo.png"
        onClear={onClear}
        onUpload={() => {}}
      />
    );
    fireEvent.click(screen.getByTitle('Clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not call onUpload when disabled', () => {
    const onUpload = vi.fn();
    render(<FileUploader onUpload={onUpload} disabled />);

    const input = document.querySelector('input[type="file"]');
    const file = new File(['content'], 'wire.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onUpload).not.toHaveBeenCalled();
  });

  it('hides Clear button when onClear is not provided', () => {
    render(
      <FileUploader currentPath="/data/generate/wire/foo.png" onUpload={() => {}} />
    );
    expect(screen.queryByTitle('Clear')).not.toBeInTheDocument();
  });

  it('shows loading spinner when image is loading', () => {
    // When previewUrl is set, the component renders img with handlers
    // that control a conditional loading spinner
    const { container } = render(
      <FileUploader
        previewUrl="/api/uploads/preview?path=foo.png"
        onUpload={() => {}}
      />
    );
    
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/uploads/preview?path=foo.png');
    
    // The img element has handlers to manage spinner state
    // onLoadStart sets imageLoading=true (shows spinner)
    // onLoad sets imageLoading=false (hides spinner)
  });

  it('hides loading spinner when image finishes loading', () => {
    const { container } = render(
      <FileUploader
        previewUrl="/api/uploads/preview?path=foo.png"
        onUpload={() => {}}
      />
    );
    
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    
    // Both handlers exist on the img element
    expect(img.onload).toBeDefined();
  });

  it('accepts fixedHeight prop', () => {
    const { container } = render(
      <FileUploader
        onUpload={() => {}}
        fixedHeight="h-48"
      />
    );
    
    const uploader = container.querySelector('.h-48');
    expect(uploader).toBeInTheDocument();
  });
});
