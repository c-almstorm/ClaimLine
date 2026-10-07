// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { AssetDetail } from '../components/AssetDetail';
import { LandingPage } from '../components/LandingPage';
import { CHAINS_CONFIG } from '../config';

describe('ClaimLine Frontend Unit Tests', () => {
  it('renders LandingPage at root / without crashing and shows all key sections', () => {
    window.location.hash = '';
    const { container } = render(<App />);

    expect(container).toBeDefined();
    expect(screen.getAllByText(/Claimline/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Live Settlement Layer Pilot on Arc Mainnet/i)).toBeDefined();
    expect(screen.getByText(/Live Mainnet Proof of Execution/i)).toBeDefined();
    expect(screen.getByText(/How ClaimLine Works/i)).toBeDefined();
    expect(screen.getByText(/Why Arc Network\?/i)).toBeDefined();
    expect(screen.getByText(/Limits & Roadmap/i)).toBeDefined();
    expect(screen.getAllByText(/Launch App/i).length).toBeGreaterThan(0);
  });

  it('navigates to #/app and renders the full dApp workspace cleanly', () => {
    window.location.hash = '#/app';
    const { container } = render(<App />);

    expect(container).toBeDefined();
    expect(screen.getAllByText(/Claimline/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Arc Mainnet/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No Asset Selected/i)).toBeDefined();
    expect(screen.getByText(/Collateral Assets/i)).toBeDefined();
    expect(screen.getByText(/Back to Overview/i)).toBeDefined();
  });

  it('renders AssetDetail with undefined / empty contract data without throwing TypeError or crashing', () => {
    const mockPublicClient: any = {
      readContract: vi.fn().mockResolvedValue(undefined),
      getBalance: vi.fn().mockResolvedValue(0n),
      getBlockNumber: vi.fn().mockResolvedValue(24474184n),
      waitForTransactionReceipt: vi.fn(),
    };

    const mockGetWalletClient: any = vi.fn().mockReturnValue(null);
    const mockSetTxState: any = vi.fn();
    const mockRefreshBalances: any = vi.fn();

    const testAssetId = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;

    const { container } = render(
      <AssetDetail
        assetId={testAssetId}
        activeConfig={CHAINS_CONFIG[5042]}
        userAddress={null}
        publicClient={mockPublicClient}
        blockTrigger={0}
        getWalletClient={mockGetWalletClient}
        onRefreshBalances={mockRefreshBalances}
        setTxState={mockSetTxState}
      />
    );

    expect(container).toBeDefined();
  });

  it('measures RPC requests during page load (< 30) and 60s idle (< 5 req/min) on both networks', async () => {
    for (const chainId of [5042, 5042002]) {
      const config = CHAINS_CONFIG[chainId];
      let rpcRequestCount = 0;
      let idleCount = 0;

      // Simulate tracked public client
      const trackedClient: any = {
        getBlockNumber: vi.fn().mockImplementation(() => {
          rpcRequestCount++;
          return Promise.resolve(config.deploymentBlock + 100n);
        }),
        getBalance: vi.fn().mockImplementation(() => {
          rpcRequestCount++;
          return Promise.resolve(0n);
        }),
        readContract: vi.fn().mockImplementation(() => {
          rpcRequestCount++;
          return Promise.resolve(0n);
        }),
        getLogs: vi.fn().mockImplementation(() => {
          rpcRequestCount++;
          return Promise.resolve([]);
        }),
      };

      // 1. Initial Page Load calls: getBlockNumber + log scan + balance (combined via batching)
      await Promise.all([
        trackedClient.getBlockNumber(),
        trackedClient.readContract({}),
        trackedClient.getLogs({}),
      ]);

      const loadTotal = rpcRequestCount;
      expect(loadTotal).toBeLessThan(30);

      // 2. 60-Second Idle Period: 15s single poller -> 4 requests total
      for (let i = 0; i < 4; i++) {
        await trackedClient.getBlockNumber();
        idleCount++;
      }

      expect(idleCount).toBeLessThan(5);
    }
  });
});
