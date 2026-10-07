import { describe, it, expect } from 'vitest';
import {
  ZERO_ADDRESS,
  calculateRepaymentOwed,
  calculateRepaymentOwedBigInt,
  validateCapacities,
  isSeniorPremiumHigher,
  formatRegistrationSummary,
} from '../utils/calc';

describe('Collateral Registration Calculations & Validations', () => {
  describe('calculateRepaymentOwed (6-decimal precision)', () => {
    it('calculates flat repayment owed with given premium %', () => {
      // 2 USDC at 10% premium -> 2.2 USDC
      expect(calculateRepaymentOwed(2, 10)).toBe(2.2);
      expect(calculateRepaymentOwed('2', '10')).toBe(2.2);

      // 1 USDC at 20% premium -> 1.2 USDC
      expect(calculateRepaymentOwed(1, 20)).toBe(1.2);
      expect(calculateRepaymentOwed('1', '20')).toBe(1.2);
    });

    it('handles 6-decimal precision and rounding correctly', () => {
      // 0.333333 USDC at 15.5% premium
      // 0.333333 * 1.155 = 0.384999615 -> rounded to 6 decimals: 0.385
      const res = calculateRepaymentOwed('0.333333', '15.5');
      expect(res).toBe(0.385);

      // 100 USDC at 0% premium -> 100 USDC
      expect(calculateRepaymentOwed('100', '0')).toBe(100);
    });

    it('returns 0 for non-positive or empty capacity', () => {
      expect(calculateRepaymentOwed('', '10')).toBe(0);
      expect(calculateRepaymentOwed('0', '10')).toBe(0);
      expect(calculateRepaymentOwed('-5', '10')).toBe(0);
    });
  });

  describe('calculateRepaymentOwedBigInt (USDC 6 decimals)', () => {
    it('converts USDC repayment owed to 6-decimal micro-units bigint', () => {
      // 2 USDC at 10% -> 2.2 USDC -> 2,200,000 micro-units
      expect(calculateRepaymentOwedBigInt('2', '10')).toBe(2200000n);

      // 1 USDC at 20% -> 1.2 USDC -> 1,200,000 micro-units
      expect(calculateRepaymentOwedBigInt('1', '20')).toBe(1200000n);

      // 3.5 USDC at 8.25% -> 3.5 * 1.0825 = 3.78875 USDC -> 3,788,750 micro-units
      expect(calculateRepaymentOwedBigInt('3.5', '8.25')).toBe(3788750n);
    });

    it('returns 0n for zero or empty values', () => {
      expect(calculateRepaymentOwedBigInt('', '')).toBe(0n);
      expect(calculateRepaymentOwedBigInt('0', '10')).toBe(0n);
    });
  });

  describe('validateCapacities', () => {
    it('accepts valid capacities within face value', () => {
      // Face value 3, senior 2, junior 1 -> total 3 (equal to face value)
      const res = validateCapacities('3', '2', '1');
      expect(res.valid).toBe(true);
      expect(res.totalCapacity).toBe(3);
    });

    it('accepts total capacity less than face value', () => {
      const res = validateCapacities('10', '4', '3');
      expect(res.valid).toBe(true);
      expect(res.totalCapacity).toBe(7);
    });

    it('rejects total capacity exceeding face value', () => {
      // Face value 3, senior 2.5, junior 1 -> total 3.5 > 3
      const res = validateCapacities('3', '2.5', '1');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('exceeds face value');
      expect(res.error).toContain('Maximum you can raise = face value');
    });

    it('rejects invalid face value or total capacity of zero', () => {
      expect(validateCapacities('0', '0', '0').valid).toBe(false);
      expect(validateCapacities('10', '0', '0').valid).toBe(false);
    });

    it('rejects negative capacities', () => {
      expect(validateCapacities('10', '-2', '5').valid).toBe(false);
    });
  });

  describe('isSeniorPremiumHigher', () => {
    it('returns true if senior premium is higher than junior premium', () => {
      expect(isSeniorPremiumHigher('25', '10')).toBe(true);
      expect(isSeniorPremiumHigher('15.5', '15.0')).toBe(true);
    });

    it('returns false if senior premium is lower than or equal to junior premium', () => {
      expect(isSeniorPremiumHigher('10', '20')).toBe(false);
      expect(isSeniorPremiumHigher('10', '10')).toBe(false);
      expect(isSeniorPremiumHigher('', '10')).toBe(false);
    });
  });

  describe('formatRegistrationSummary & ZERO_ADDRESS', () => {
    it('formats human-readable summary line accurately', () => {
      const summary = formatRegistrationSummary('Invoice', '3', '2', '10', '1', '20');
      expect(summary).toContain('Invoice: Raising 3 USDC');
      expect(summary).toContain('Senior: 2 @ 10% -> 2.2 USDC');
      expect(summary).toContain('Junior: 1 @ 20% -> 1.2 USDC');
      expect(summary).toContain('Total repayment owed: 3.4 USDC on 3 USDC face value');
    });

    it('defines standard EVM zero address constant', () => {
      expect(ZERO_ADDRESS).toBe('0x0000000000000000000000000000000000000000');
    });
  });
});
