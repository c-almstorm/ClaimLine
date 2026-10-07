import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { CHAINS_CONFIG, DEFAULT_CHAIN_ID, ERC20_ABI, CLAIMLINE_ABI, ChainConfig } from '../config';

// Resolve starting chain ID in order: ?chain= URL param (search or hash) -> localStorage -> Default Mainnet (5042)
function resolveInitialChainId(): number {
  if (typeof window !== 'undefined') {
    try {
      let chainParam: string | null = null;
      if (window.location.search) {
        const urlParams = new URLSearchParams(window.location.search);
        chainParam = urlParams.get('chain');
      }
      if (!chainParam && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        chainParam = hashParams.get('chain');
      }
      if (chainParam) {
        const lower = chainParam.toLowerCase();
        if (lower === '5042' || lower === 'mainnet' || lower === 'arc-mainnet') return 5042;
        if (lower === '5042002' || lower === 'testnet' || lower === 'arc-testnet') return 5042002;
        const num = parseInt(chainParam, 10);
        if (CHAINS_CONFIG[num]) return num;
      }
    } catch (e) {
      console.warn('Failed to parse URL chain param:', e);
    }

    try {
      const stored = window.localStorage.getItem('claimline_selected_chain');
      if (stored) {
        const num = parseInt(stored, 10);
        if (CHAINS_CONFIG[num]) return num;
      }
    } catch (e) {
      console.warn('Failed to read chain from localStorage:', e);
    }
  }
  return DEFAULT_CHAIN_ID;
}

// Custom transport wrapper that rejects any RPC endpoint whose chain ID does not match expectedChainId
// and enables HTTP request batching for combining concurrent calls
function createValidatedHttpTransport(url: string, expectedChainId: number): Transport {
  const baseHttp = http(url, {
    batch: {
      batchSize: 50,
      wait: 10,
    },
    retryCount: 3,
    retryDelay: 1000,
  });
  let verified = false;

  return custom(
    {
      async request({ method, params }: { method: string; params?: any }) {
        const httpInstance = baseHttp({ chain: undefined });

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
  const [chainId, setChainId] = useState<number>(resolveInitialChainId);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [nativeBalance, setNativeBalance] = useState<string>('0');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Single shared block number and trigger across components
  const [currentBlock, setCurrentBlock] = useState<bigint | null>(null);
  const [blockTrigger, setBlockTrigger] = useState<number>(0);

  const activeConfig = CHAINS_CONFIG[chainId] || CHAINS_CONFIG[DEFAULT_CHAIN_ID];

  // Public Viem client using validated fallback transport with HTTP batching
  const publicClient: PublicClient = useMemo(() => {
    const rpcTransports = activeConfig.rpcUrls.default.http.map((url) =>
      createValidatedHttpTransport(url, activeConfig.id)
    );
    return createPublicClient({
      chain: activeConfig,
      transport: fallback(rpcTransports, {
        rank: false,
        retryCount: 3,
        retryDelay: 1000,
      }),
    });
  }, [activeConfig]);

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
      console.warn('Error fetching balances:', err);
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

  // Switch network with URL & localStorage sync
  const switchChain = useCallback(async (targetChainId: number) => {
    const target = CHAINS_CONFIG[targetChainId];
    if (!target) return;

    setError(null);
    setChainId(targetChainId);
    setCurrentBlock(null);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('claimline_selected_chain', String(targetChainId));
      } catch (e) {
        console.warn('localStorage write error:', e);
      }

      try {
        const url = new URL(window.location.href);
        url.searchParams.set('chain', String(targetChainId));
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        console.warn('URL update error:', e);
      }
    }

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${targetChainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
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
          } catch (addError: any) {
            setError(addError?.message || 'Failed to add Arc network to wallet');
          }
        }
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
        switchChain(newChainId);
      }
    };

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);

    return () => {
      eth.removeListener('accountsChanged', handleAccountsChanged);
      eth.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnect, switchChain]);

  // SINGLE SHARED BLOCK POLLER (15s interval, paused when tab is hidden)
  useEffect(() => {
    let cancelled = false;
    let intervalId: any = null;

    const pollBlockNumber = async () => {
      if (cancelled || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const latest = await publicClient.getBlockNumber();
        if (cancelled) return;
        setCurrentBlock((prev) => {
          if (prev === null || latest > prev) {
            setBlockTrigger((t) => t + 1);
            return latest;
          }
          return prev;
        });
      } catch (err) {
        console.warn('Block poll warning:', err);
      }
    };

    // Initial query
    pollBlockNumber();

    const startTimer = () => {
      if (!intervalId && typeof document !== 'undefined' && !document.hidden) {
        intervalId = setInterval(pollBlockNumber, 15000);
      }
    };

    const stopTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopTimer();
      } else {
        pollBlockNumber();
        startTimer();
      }
    };

    startTimer();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      cancelled = true;
      stopTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [chainId, publicClient]);

  // Refresh balances whenever block advances
  useEffect(() => {
    if (address && currentBlock) {
      refreshBalances();
    }
  }, [address, currentBlock, refreshBalances]);

  return {
    chainId,
    activeConfig,
    address,
    usdcBalance,
    nativeBalance,
    isConnecting,
    error,
    currentBlock,
    blockTrigger,
    publicClient,
    getWalletClient,
    connect,
    disconnect,
    switchChain,
    addArcNetwork,
    refreshBalances,
  };
}
