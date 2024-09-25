"use client";

import Image from "next/image";
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Bet } from './contract';
import { RoundInfo } from './types';
import WalletBar from '../components/WalletBar';
import { useContract, useAccount, useReadContract, useSendTransaction, useBlockNumber } from "@starknet-react/core";
import { type Abi, CairoCustomEnum, RpcProvider, Contract, hash, num } from "starknet";
import { formatAmount } from "@/lib/utils";
import { Button } from "@/components/ui";
import { PriceChart } from "@/components/PriceChart";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

import ABI from "../abi/moon_or_doom.json";
import ERC20_ABI from "../abi/erc20.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const STRK_TOKEN_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const BET_AMOUNT = 1;

const mockChartData = [
  { time: '15:45:35', price: 2611.19 },
  { time: '15:45:40', price: 2611.25 },
  { time: '15:45:45', price: 2611.30 },
  { time: '15:45:50', price: 2611.40 },
  { time: '15:45:55', price: 2611.50 },
  { time: '15:46:00', price: 2611.70 },
  { time: '15:46:05', price: 2611.85 },
  { time: '15:46:10', price: 2611.80 },
  { time: '15:46:15', price: 2611.75 },
  { time: '15:46:20', price: 2611.60 },
  { time: '15:46:25', price: 2611.70 },
  { time: '15:46:30', price: 2611.85 },
  { time: '15:46:35', price: 2611.90 },
  { time: '15:46:40', price: 2611.94 },
];

export default function Home() {
  const [bet, setBet] = useState<CairoCustomEnum>(Bet.MOON);

  const { contract } = useContract({ abi: ABI as Abi, address: CONTRACT_ADDRESS });
  const { contract: strkContract } = useContract({ abi: ERC20_ABI as Abi, address: STRK_TOKEN_ADDRESS });

  const { address: userAddress } = useAccount();
  const { data: roundInfoData, error: roundInfoError } = useReadContract({ abi: ABI, functionName: "get_round_info", address: CONTRACT_ADDRESS, args: [] });

  const { send: sendStartRoundTx, error: errorSendStartRoundTx, isPending: isStartingRound } = useSendTransaction({
    calls:
      contract && userAddress
        ? [contract.populate("start_round", [1000])]
        : undefined,
  });

  const { send: sendEndRoundTx, error: errorSendEndRoundTx, isPending: isEndingRound } = useSendTransaction({
    calls:
      contract && userAddress
        ? [contract.populate("end_round", [5000])]
        : undefined,
  });

  const { send: sendPlaceBetTx, error: errorPlaceBetTx, isPending: isPlacingBet } = useSendTransaction({
    calls:
      contract && userAddress
        ? [contract.populate("bet", [bet])]
        : undefined,
  });

  const { send: sendApproveTx, isPending: isApprovalPending } = useSendTransaction({
    calls:
      strkContract && userAddress
        ? [strkContract.populate("approve", [CONTRACT_ADDRESS, BET_AMOUNT])]
        : undefined,
  });

  const handleStartRound = async () => {
    await sendStartRoundTx();
  };

  const handleEndRound = async () => {
    await sendEndRoundTx();
  };

  const handlePlaceBet = async (isMoon: boolean) => {
    const allowance = await strkContract.allowance(userAddress, CONTRACT_ADDRESS);

    if (allowance < BET_AMOUNT) {
      await sendApproveTx();
    } else {
      setBet(isMoon ? Bet.MOON : Bet.DOOM);
      await sendPlaceBetTx();
    }
  };

  const RoundInfo = () => {
    if (roundInfoError) {
      return <p>Error fetching round info: {roundInfoError.message}</p>;
    } else if (roundInfoData) {
      const roundInfo: RoundInfo = {
        roundId: Number(roundInfoData[0]),
        isActive: Boolean(roundInfoData[1].variant.Active),
        startTimestamp: Number(roundInfoData[2]),
        endTimestamp: Number(roundInfoData[3]),
        startPrice: Number(roundInfoData[4]),
        endPrice: Number(roundInfoData[5]),
      }

      return (
        <div>
          <h2 className="text-xl font-semibold mb-4">Round Information</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Round ID:</span> {roundInfo.roundId}</p>
            <p><span className="font-medium">Start Price:</span> ${roundInfo.startPrice.toFixed(2)}</p>
            <p><span className="font-medium">Current/End Price:</span> ${roundInfo.endPrice.toFixed(2)}</p>
            <p><span className="font-medium">Status:</span> {roundInfo.isActive ? 'Active' : 'Inactive'}</p>
            {/* <p><span className="font-medium">Elapsed time:</span> {elapsedTime} seconds</p> */}
          </div>
        </div>
      )
    }
  };

  // Reading Contract Events
  type ContractEvent = {
    from_address: string;
    keys: string[];
    data: string[];
  };

  const provider = useMemo(() => new RpcProvider({ nodeUrl: process.env.NEXT_PUBLIC_RPC_URL }), []);
  const [events, setEvents] = useState<ContractEvent[]>([]);
  const lastCheckedBlockRef = useRef(0);
  const { data: blockNumber } = useBlockNumber({ refetchInterval: 3000 });

  const checkForEvents = useCallback(async (contract: Contract, currentBlockNumber: number) => {
    if (currentBlockNumber <= lastCheckedBlockRef.current) {
      return; // No new blocks, skip checking for events
    }
    try {
      // Fetch events only for the new blocks
      const fromBlock = lastCheckedBlockRef.current + 1;
      const keyFilter = [[num.toHex(hash.starknetKeccak('RoundEnded'))]];
      const fetchedEvents = await provider.getEvents({
        address: contract.address,
        from_block: { block_number: fromBlock },
        to_block: { block_number: currentBlockNumber },
        keys: keyFilter, // Only fetch RoundEnded events
        chunk_size: 10,
      });

      if (fetchedEvents && fetchedEvents.events) {
        setEvents(prevEvents => [...prevEvents, ...fetchedEvents.events]);
      }

      lastCheckedBlockRef.current = currentBlockNumber;
    } catch (error) {
      console.error('Error checking for events:', error);
    }
  }, [provider]);

  useEffect(() => {
    if (contract && blockNumber) {
      checkForEvents(contract, blockNumber);
    }
  }, [contract, blockNumber, checkForEvents]);


  const lastTenEvents = useMemo(() => {
    return [...events].reverse().slice(0, 10);
  }, [events]);



  const isRoundActive = roundInfoData && Boolean(roundInfoData[1].variant.Active);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 min-h-screen font-[family-name:var(--font-geist-sans)]">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Image
            width={200}
            height={50}  // Adjust this value as needed
            src="https://www.starknet.io/wp-content/themes/Starknet/assets/img/starknet-logo.svg"
            alt="Starknet Logo"
          />
          <WalletBar />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-md">
            <PriceChart
              currentPrice={2611.94}
              priceChange={0.75}
              chartData={mockChartData}
              startPrice={2611.19}
              endPrice={2611.94}
            />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <RoundInfo />
            <div className="mt-6 flex space-x-4">
              <Button
                variant="success"
                onClick={() => handlePlaceBet(true)}
                disabled={isPlacingBet || isApprovalPending}
              >
                <ArrowUpIcon className="w-5 h-5 mr-2" />
                Moon
              </Button>
              <Button
                variant="danger"
                onClick={() => handlePlaceBet(false)}
                disabled={isPlacingBet || isApprovalPending}
              >
                <ArrowDownIcon className="w-5 h-5 mr-2" />
                Doom
              </Button>
            </div>
            <div>
              {errorPlaceBetTx && <p>Error placing bet: {errorPlaceBetTx.message}</p>}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md overflow-x-auto">
          <h2 className="text-xl font-semibold mb-4">Past Rounds ({events.length})</h2>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Round</th>
                <th className="p-2 text-left">Start price</th>
                <th className="p-2 text-left">End price</th>
                <th className="p-2 text-left">Moon Bets Count</th>
                <th className="p-2 text-left">Doom Bets Count</th>
              </tr>
            </thead>
            <tbody>
              {lastTenEvents.map((event, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">{Number(event.data[0])}</td>
                  <td className="p-2">{formatAmount(event.data[3])}</td>
                  <td className="p-2">{formatAmount(event.data[4])}</td>
                  <td className="p-2">{Number(event.data[5])}</td>
                  <td className="p-2">{Number(event.data[6])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center p-4">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="https://nextjs.org/icons/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="https://nextjs.org/icons/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="https://nextjs.org/icons/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}
