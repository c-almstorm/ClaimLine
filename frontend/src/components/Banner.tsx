import React from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { ChainConfig } from '../config';

interface BannerProps {
  activeConfig: ChainConfig;
}

export const Banner: React.FC<BannerProps> = ({ activeConfig }) => {
  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-amber-800 text-xs sm:text-sm font-medium">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Experimental Protocol:</strong> Claimline is an unaudited prototype on {activeConfig.name}. Please use small test amounts only.
          </span>
        </div>
        <a
          href={`${activeConfig.blockExplorers.default.url}/address/${activeConfig.claimLineAddress}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-amber-700 hover:text-amber-900 underline flex-shrink-0"
        >
          <span>Contract: {activeConfig.claimLineAddress.slice(0, 6)}...{activeConfig.claimLineAddress.slice(-4)}</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
