export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

export interface CapacityValidationResult {
  valid: boolean;
  error?: string;
  totalCapacity: number;
}

export function calculateRepaymentOwed(capacity: number | string, premiumPercent: number | string): number {
  const cap = typeof capacity === 'string' ? parseFloat(capacity) || 0 : capacity;
  const prem = typeof premiumPercent === 'string' ? parseFloat(premiumPercent) || 0 : premiumPercent;
  if (cap <= 0) return 0;
  const owed = cap * (1 + prem / 100);
  return Math.round(owed * 1e6) / 1e6;
}

export function calculateRepaymentOwedBigInt(capacityUSDC: string, premiumPercent: string): bigint {
  const cap = parseFloat(capacityUSDC) || 0;
  const prem = parseFloat(premiumPercent) || 0;
  if (cap <= 0) return 0n;
  const owed = cap * (1 + prem / 100);
  const microUnits = BigInt(Math.round(owed * 1e6));
  return microUnits;
}

export function validateCapacities(
  faceValueStr: string,
  seniorCapStr: string,
  juniorCapStr: string
): CapacityValidationResult {
  const faceVal = parseFloat(faceValueStr) || 0;
  const senior = parseFloat(seniorCapStr) || 0;
  const junior = parseFloat(juniorCapStr) || 0;
  const total = Math.round((senior + junior) * 1e6) / 1e6;

  if (faceVal <= 0) {
    return { valid: false, error: 'Face value must be greater than 0', totalCapacity: total };
  }
  if (senior < 0 || junior < 0) {
    return { valid: false, error: 'Capacities cannot be negative', totalCapacity: total };
  }
  if (total <= 0) {
    return { valid: false, error: 'Total capacity (senior + junior) must be greater than 0', totalCapacity: total };
  }
  if (total > faceVal) {
    return {
      valid: false,
      error: `Total capacity (${total} USDC) exceeds face value (${faceVal} USDC). Maximum you can raise = face value.`,
      totalCapacity: total
    };
  }
  return { valid: true, totalCapacity: total };
}

export function isSeniorPremiumHigher(seniorPremStr: string, juniorPremStr: string): boolean {
  const senior = parseFloat(seniorPremStr) || 0;
  const junior = parseFloat(juniorPremStr) || 0;
  return senior > junior;
}

export function formatRegistrationSummary(
  assetType: string,
  faceVal: string,
  seniorCap: string,
  seniorPrem: string,
  juniorCap: string,
  juniorPrem: string
): string {
  const sOwed = calculateRepaymentOwed(seniorCap, seniorPrem);
  const jOwed = calculateRepaymentOwed(juniorCap, juniorPrem);
  const totalRaise = (parseFloat(seniorCap) || 0) + (parseFloat(juniorCap) || 0);
  const totalOwed = Math.round((sOwed + jOwed) * 1e6) / 1e6;

  return `${assetType || 'Asset'}: Raising ${totalRaise} USDC (Senior: ${seniorCap || '0'} @ ${seniorPrem || '0'}% -> ${sOwed} USDC, Junior: ${juniorCap || '0'} @ ${juniorPrem || '0'}% -> ${jOwed} USDC) | Total repayment owed: ${totalOwed} USDC on ${faceVal || '0'} USDC face value.`;
}
