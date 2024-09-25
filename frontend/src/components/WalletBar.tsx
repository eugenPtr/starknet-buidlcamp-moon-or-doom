import { useConnect, useDisconnect, useAccount } from '@starknet-react/core';
import { Button } from "./ui";

const WalletBar: React.FC = () => {
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { address } = useAccount();

  return !address ? (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.id}
          onClick={() => connect({ connector })}
        >
          Connect {connector.id}
        </Button>
      ))}
    </div>
  ) : (
    <div className="flex gap-4 align-center">
      <span className="text-md bg-gray-200 text-black p-4 rounded-full">
        Connected: {address.slice(0, 6)}...{address.slice(-4)}
      </span>
      <Button
        onClick={() => disconnect()}
      >
        Disconnect
      </Button>
    </div>
  )
}


export default WalletBar;
