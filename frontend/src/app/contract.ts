import { Account, RpcProvider, Contract, CairoCustomEnum } from 'starknet';
import { RoundInfo } from './types';

// Shared instances
let provider: RpcProvider;
let account: Account;
let contract: Contract;

// Initialize shared instances
async function initializeContract() {
  if (provider && account && contract) {
    return; // Already initialized
  }

  provider = new RpcProvider();

  const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY;
  const accountAddress = process.env.NEXT_PUBLIC_ACCOUNT_ADDRESS;

  if (!privateKey || !accountAddress) {
    throw new Error('Private key or account address not found in environment variables');
  }

  account = new Account(provider, accountAddress as string, privateKey as string);

  const contractAddress = "0x04cfe4fbea86ab273e75f6e0fdaca06de1c3a8495dd3d5a65afa4822339306ef";

  const { abi: abi } = await provider.getClassAt(contractAddress);
    
  if (abi === undefined) {
    throw new Error('no abi.');
 }

  contract = new Contract(abi, contractAddress, provider);
  contract.connect(account);
}

export async function startRound() {
  await initializeContract();

  const result = await contract.start_round(1000);
  
  // Wait for the transaction to be confirmed
  await provider.waitForTransaction(result.transaction_hash);

  return result;
}


export const Bet = {
  MOON: new CairoCustomEnum({MOON: 0}),
  DOOM: new CairoCustomEnum({DOOM: 1})
}

export async function placeBet(bet: CairoCustomEnum) {
  await initializeContract();

  const result = await contract.bet(bet);
  
  // Wait for the transaction to be confirmed
  await provider.waitForTransaction(result.transaction_hash);

  return result;
}

export async function getRoundInfo(): Promise<RoundInfo> {
  await initializeContract();

  try {
    const result = await contract.get_round_info();
    
    return {
      roundId: Number(result[0]),
      isActive: Boolean(result[1].variant.Active),
      startTimestamp: Number(result[2]),
      endTimestamp: Number(result[3]),
      startPrice: Number(result[4]),
      endPrice: Number(result[5]),
    };
  } catch (error) {
    console.error('Failed to fetch round info:', error);
    return {
      roundId: 0,
      isActive: false,
      startTimestamp: 0,
      endTimestamp: 0,
      startPrice: 0,
      endPrice: 0,
    };
  }
}

export async function endRound() {
  await initializeContract();

  try {
    const result = await contract.end_round(5000);
    
    // Wait for the transaction to be confirmed
    await provider.waitForTransaction(result.transaction_hash);

    return result;
  } catch (error) {
    console.error('Failed to end round:', error);
    throw error;
  }
}