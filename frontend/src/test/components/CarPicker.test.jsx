import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarPicker } from '../../components/CarPicker';

const mockCars = [
  { folder: 'porsche992rgt3', display: 'Porsche 911 GT3 R (992)' },
  { folder: 'ferrari488gte', display: 'Ferrari 488 GTE' },
  { folder: 'bmwm4gt3', display: 'BMW M4 GT3' },
];

describe('CarPicker component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders trigger with placeholder when no car selected', () => {
    render(<CarPicker cars={mockCars} selectedFolder="" onChange={() => {}} />);
    expect(screen.getByText('Select a car…')).toBeInTheDocument();
  });

  it('shows selected car name', () => {
    render(<CarPicker cars={mockCars} selectedFolder="porsche992rgt3" onChange={() => {}} />);
    expect(screen.getByText('Porsche 911 GT3 R (992)')).toBeInTheDocument();
  });

  it('opens dropdown on click', () => {
    render(<CarPicker cars={mockCars} selectedFolder="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search cars…')).toBeInTheDocument();
  });

  it('filters cars by search query', () => {
    render(<CarPicker cars={mockCars} selectedFolder="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));

    const search = screen.getByPlaceholderText('Search cars…');
    fireEvent.change(search, { target: { value: 'porsche' } });

    expect(screen.getByText('Porsche 911 GT3 R (992)')).toBeInTheDocument();
    expect(screen.queryByText('Ferrari 488 GTE')).not.toBeInTheDocument();
  });

  it('calls onChange when car is selected', () => {
    const onChange = vi.fn();
    render(<CarPicker cars={mockCars} selectedFolder="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));

    const carItem = screen.getByText('Porsche 911 GT3 R (992)');
    fireEvent.click(carItem);

    expect(onChange).toHaveBeenCalledWith('porsche992rgt3');
  });
});
