import { useConnect, useDisconnect, useAccount } from '@starknet-react/core';
import { Button } from "./ui";
import { WalletIcon } from 'lucide-react';
import { shortenAddress } from '@/lib/utils';

const WalletBar: React.FC = () => {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address } = useAccount();

  return !address ? (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <Button
          rounded
          key={connector.id}
          onClick={() => connect({ connector })}
        >
          Connect {connector.id}
        </Button>
      ))}
    </div>
  ) : (
    <div className="flex gap-4 align-center">
      <div className="bg-gray-200 px-4 py-2 rounded-full flex items-center">
        <WalletIcon className="w-5 h-5 mr-2 text-gray-600" />
        <span className="text-sm font-medium">Connected: {shortenAddress(address)}</span>
      </div>
      <Button
        rounded
        onClick={() => disconnect()}
      >
        Disconnect
      </Button>
    </div>
  )
}


export default WalletBar;
