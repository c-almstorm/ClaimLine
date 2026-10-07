// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RegisterAssetModal } from '../components/RegisterAssetModal';

describe('RegisterAssetModal UI Unit Tests', () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    isOpen: true,
    userAddress: '0x1234567890123456789012345678901234567890' as const,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
  };

  it('renders modal with empty fields and warning text by default', () => {
    render(<RegisterAssetModal {...defaultProps} />);

    // Public chain warning is present
    expect(
      screen.getByText(/Everything you enter is public on-chain. Don't enter personal names or locations./i)
    ).toBeDefined();

    // "Maximum you can raise = face value" text is present
    expect(
      screen.getByText(/Maximum you can raise = face value/i)
    ).toBeDefined();

    // Quick action buttons
    expect(screen.getByText(/Fill an example/i)).toBeDefined();
    expect(screen.getByText(/Clear form/i)).toBeDefined();

    // Asset type select options
    expect(screen.getByRole('combobox')).toBeDefined();
    expect(screen.getByText(/Select asset type.../i)).toBeDefined();
    expect(screen.getByText(/Invoice/i)).toBeDefined();
    expect(screen.getByText(/Warehouse receipt/i)).toBeDefined();
    expect(screen.getByText(/Trade receivable/i)).toBeDefined();
    expect(screen.getByText(/Other/i)).toBeDefined();

    // Confirm button should be disabled when empty
    const submitBtn = screen.getByRole('button', { name: /Confirm Registration/i });
    expect(submitBtn).toHaveProperty('disabled', true);
  });

  it('fills the example values when "Fill an example" is clicked', () => {
    render(<RegisterAssetModal {...defaultProps} />);

    const fillExampleBtn = screen.getByRole('button', { name: /Fill an example/i });
    fireEvent.click(fillExampleBtn);

    // Expect inputs to have example values: Face value 3, senior 2 @ 10%, junior 1 @ 20%
    expect(screen.getByText(/You will owe 2.2 USDC/i)).toBeDefined();
    expect(screen.getByText(/You will owe 1.2 USDC/i)).toBeDefined();
    expect(screen.getByText(/Registration Summary:/i)).toBeDefined();

    // Confirm button should now be enabled
    const submitBtn = screen.getByRole('button', { name: /Confirm Registration/i });
    expect(submitBtn).toHaveProperty('disabled', false);
  });

  it('clears all fields when "Clear form" is clicked', () => {
    render(<RegisterAssetModal {...defaultProps} />);

    const fillExampleBtn = screen.getByRole('button', { name: /Fill an example/i });
    fireEvent.click(fillExampleBtn);

    const clearFormBtn = screen.getByRole('button', { name: /Clear form/i });
    fireEvent.click(clearFormBtn);

    const submitBtn = screen.getByRole('button', { name: /Confirm Registration/i });
    expect(submitBtn).toHaveProperty('disabled', true);
  });

  it('shows warning when senior premium % is higher than junior premium %', () => {
    render(<RegisterAssetModal {...defaultProps} />);

    const fillExampleBtn = screen.getByRole('button', { name: /Fill an example/i });
    fireEvent.click(fillExampleBtn);

    // Change senior premium to 25% (> junior 20%)
    const seniorPremInput = screen.getByPlaceholderText(/e\.g\. 10/i);
    fireEvent.change(seniorPremInput, { target: { value: '25' } });

    expect(
      screen.getByText(/Senior premium \(25%\) is higher than junior premium \(20%\)/i)
    ).toBeDefined();
  });
});
