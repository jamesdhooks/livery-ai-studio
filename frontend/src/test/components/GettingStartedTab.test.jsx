import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GettingStartedTab } from '../../components/tabs/GettingStartedTab';

describe('GettingStartedTab component', () => {
  it('renders the main heading', () => {
    render(<GettingStartedTab />);
    expect(screen.getByText(/Getting Started with Livery AI Studio/i)).toBeInTheDocument();
  });

  it('renders all main sections', () => {
    render(<GettingStartedTab />);
    expect(screen.getByText(/Requirements/i)).toBeInTheDocument();
    expect(screen.getByText(/Quick Start/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Generate Tab/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Troubleshooting/i)).toBeInTheDocument();
  });

  it('renders all eight quick-start steps', () => {
    render(<GettingStartedTab />);
    expect(screen.getByText(/Launch the app/i)).toBeInTheDocument();
    expect(screen.getByText(/Add your Gemini API key/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Enter your iRacing Customer ID/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Configure your data folder/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Install Trading Paints/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pick a car and generate your first livery/i)).toBeInTheDocument();
    expect(screen.getByText(/Review your history/i)).toBeInTheDocument();
    expect(screen.getByText(/Share your livery online/i)).toBeInTheDocument();
  });

  it('renders FAQ questions collapsed by default', () => {
    render(<GettingStartedTab />);
    const faqQuestion = screen.getByText(/Invalid API key/i);
    expect(faqQuestion).toBeInTheDocument();
    // The answer should not be visible before clicking
    expect(screen.queryByText(/billing is enabled/i)).not.toBeInTheDocument();
  });

  it('expands a FAQ item when clicked', () => {
    render(<GettingStartedTab />);
    const faqButton = screen.getByText(/Invalid API key/i).closest('button');
    fireEvent.click(faqButton);
    expect(screen.getByText(/billing is enabled/i)).toBeInTheDocument();
  });

  it('collapses a FAQ item when clicked again', () => {
    render(<GettingStartedTab />);
    const faqButton = screen.getByText(/Invalid API key/i).closest('button');
    fireEvent.click(faqButton);
    expect(screen.getByText(/billing is enabled/i)).toBeInTheDocument();
    fireEvent.click(faqButton);
    expect(screen.queryByText(/billing is enabled/i)).not.toBeInTheDocument();
  });

  it('can independently expand multiple FAQ items', () => {
    render(<GettingStartedTab />);
    const apiFaq = screen.getByText(/Invalid API key/i).closest('button');
    const qualityFaq = screen.getByText(/looks low quality/i).closest('button');
    fireEvent.click(apiFaq);
    fireEvent.click(qualityFaq);
    expect(screen.getByText(/billing is enabled/i)).toBeInTheDocument();
    expect(screen.getByText(/vague prompts produce generic results/i)).toBeInTheDocument();
  });

  it('renders the generate tab options section', () => {
    render(<GettingStartedTab />);
    expect(screen.getAllByText(/Flash/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2K Resolution/i)).toBeInTheDocument();
    expect(screen.getAllByText(/GPU Upscale/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wireframe/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Base Texture/i).length).toBeGreaterThan(0);
  });

  it('renders the workflow and disclaimer notice', () => {
    render(<GettingStartedTab />);
    expect(screen.getByText(/AI output is a starting point/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended workflow/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini API costs — your responsibility/i)).toBeInTheDocument();
    expect(screen.getByText(/Content & intellectual property/i)).toBeInTheDocument();
  });

  it('renders the content/IP FAQ item', () => {
    render(<GettingStartedTab />);
    expect(screen.getByText(/Who is responsible for the content Gemini generates/i)).toBeInTheDocument();
  });



  it('renders the tips section', () => {
    render(<GettingStartedTab />);
    expect(screen.getByText(/Tips for better results/i)).toBeInTheDocument();
  });
});
