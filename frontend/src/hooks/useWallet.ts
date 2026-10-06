import { useState, useEffect, useCallback } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  http,
  formatUnits,
  parseUnits,
  type PublicClient,
  type WalletClient,
  type Transport,
} from 'viem';
import { CHAINS_CONFIG, DEFAULT_CHAIN_ID, ERC20_ABI, CLAIMLINE_ABI } from '../config';

// Custom transport wrapper that rejects any RPC endpoint whose chain ID does not match expectedChainId
function createValidatedHttpTransport(url: string, expectedChainId: number) {
  const baseHttp = http(url, { retryCount: 3, retryDelay: 1000 });
  let verified = false;

  return custom(
    {
      async request({ method, params }: { method: string; params?: any }) {
        const httpInstance = baseHttp({ chain: undefined });

        // Automatically validate chainId on first request if not already verified
        if (!verified && method !== 'eth_chainId') {
          const chainIdHex = (await httpInstance.request({ method: 'eth_chainId' })) as string;
          const actualChainId =
            typeof chainIdHex === 'string' ? parseInt(chainIdHex, 16) : Number(chainIdHex);
          if (actualChainId !== expectedChainId) {
            throw new Error(
              `RPC ${url} rejected: chain ID mismatch (expected ${expectedChainId}, got ${actualChainId})`
            );
          }
          verified = true;
        }

        const res = await httpInstance.request({ method, params } as any);

        if (method === 'eth_chainId' && res) {
          const actualChainId = typeof res === 'string' ? parseInt(res, 16) : Number(res);
          if (actualChainId !== expectedChainId) {
            throw new Error(
              `RPC ${url} rejected: chain ID mismatch (expected ${expectedChainId}, got ${actualChainId})`
            );
          }
          verified = true;
        }

        return res;
      },
    },
    {
      retryCount: 3,
      retryDelay: 1000,
    }
  );
}

export function useWallet() {
  const [chainId, setChainId] = useState<number>(DEFAULT_CHAIN_ID);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeConfig = CHAINS_CONFIG[chainId] || CHAINS_CONFIG[DEFAULT_CHAIN_ID];

  // Public Viem client using validated fallback transport over official public endpoints tried in order
  // (endpoints cited from official Arc documentation: https://docs.arc.network/developers/networks)
  const rpcTransports = activeConfig.rpcUrls.default.http.map((url) =>
    createValidatedHttpTransport(url, activeConfig.id)
  );

  const publicClient: PublicClient = createPublicClient({
    chain: activeConfig,
    transport: fallback(rpcTransports, {
      rank: false, // Strict in-order sequential fallback
      retryCount: 3,
      retryDelay: 1000,
    }),
  });

  // Wallet Viem client for user interactions
  const getWalletClient = useCallback((): WalletClient | null => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return null;
    }
    return createWalletClient({
      chain: activeConfig,
      transport: custom((window as any).ethereum),
    });
  }, [activeConfig]);

  // Refresh user balances
  const refreshBalances = useCallback(async () => {
    if (!address) return;
    try {
      const [rawNative, rawUsdc] = await Promise.all([
        publicClient.getBalance({ address }),
        publicClient.readContract({
          address: activeConfig.usdcAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) as Promise<bigint>,
      ]);

      setNativeBalance(formatUnits(rawNative, 18));
      setUsdcBalance(formatUnits(rawUsdc, 6));
    } catch (err: any) {
      console.error('Error fetching balances:', err);
    }
  }, [address, activeConfig, publicClient]);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError('No Ethereum wallet detected. Please install MetaMask or Rabby.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const walletClient = getWalletClient();
      if (!walletClient) throw new Error('Wallet client unavailable');

      const [acc] = await walletClient.requestAddresses();
      setAddress(acc);

      // Check current chain
      const hexChain = await (window as any).ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(hexChain, 16);
      if (CHAINS_CONFIG[currentChainId]) {
        setChainId(currentChainId);
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err?.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  }, [getWalletClient]);

  // Disconnect
  const disconnect = useCallback(() => {
    setAddress(null);
    setUsdcBalance('0');
    setNativeBalance('0');
  }, []);

  // Switch network
  const switchChain = useCallback(async (targetChainId: number) => {
    const target = CHAINS_CONFIG[targetChainId];
    if (!target) return;

    setError(null);
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setChainId(targetChainId);
      return;
    }

    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      setChainId(targetChainId);
    } catch (switchError: any) {
      // If chain not added to wallet (error 4902), add it
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${targetChainId.toString(16)}`,
                chainName: target.name,
                nativeCurrency: target.nativeCurrency,
                rpcUrls: target.rpcUrls.default.http,
                blockExplorerUrls: [target.blockExplorers.default.url],
              },
            ],
          });
          setChainId(targetChainId);
        } catch (addError: any) {
          setError(addError?.message || 'Failed to add Arc network to wallet');
        }
      } else {
        setError(switchError?.message || 'Failed to switch network');
      }
    }
  }, []);

  // Add Arc Network explicitly button
  const addArcNetwork = useCallback(async () => {
    const target = activeConfig;
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError('Please install a Web3 wallet (MetaMask) to add network');
      return;
    }

    try {
      await (window as any).ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${target.id.toString(16)}`,
            chainName: target.name,
            nativeCurrency: target.nativeCurrency,
            rpcUrls: target.rpcUrls.default.http,
            blockExplorerUrls: [target.blockExplorers.default.url],
          },
        ],
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to add Arc network');
    }
  }, [activeConfig]);

  // Listen to wallet events
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const eth = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAddress(accounts[0] as `0x${string}`);
      } else {
        disconnect();
      }
    };

    const handleChainChanged = (hexChain: string) => {
      const newChainId = parseInt(hexChain, 16);
      if (CHAINS_CONFIG[newChainId]) {
        setChainId(newChainId);
      }
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect]);

  // Initial and periodic balance updates (15s interval, paused when tab is hidden)
  useEffect(() => {
    if (!address) return;
    refreshBalances();

    let intervalId: any = null;

    const startPolling = () => {
      if (!intervalId && typeof document !== 'undefined' && !document.hidden) {
        intervalId = setInterval(() => {
          if (typeof document !== 'undefined' && !document.hidden) {
            refreshBalances();
          }
        }, 15000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopPolling();
      } else {
        refreshBalances();
        startPolling();
      }
    };

    startPolling();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [address, chainId, refreshBalances]);

  return {
    chainId,
    activeConfig,
    address,
    usdcBalance,
    nativeBalance,
    isConnecting,
    error,
    publicClient,
    getWalletClient,
    connect,
    disconnect,
    switchChain,
    addArcNetwork,
    refreshBalances,
  };
}
