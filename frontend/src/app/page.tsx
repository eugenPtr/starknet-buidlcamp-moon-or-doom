"use client";

import Image from "next/image";
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Bet } from './contract';
import { RoundInfo } from './types';
import WalletBar from '../components/WalletBar';
import { useContract, useAccount, useReadContract, useSendTransaction, useBlockNumber } from "@starknet-react/core";
import { type Abi, CairoCustomEnum, RpcProvider, Contract, hash, num } from "starknet";
import { formatAmount } from "../lib/utils";

import ABI from "../abi/moon_or_doom.json";
import ERC20_ABI from "../abi/erc20.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const STRK_TOKEN_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const BET_AMOUNT = 1;

export default function Home() {
	const [bet, setBet] = useState<CairoCustomEnum>(Bet.MOON);

	const { contract } = useContract({ abi: ABI as Abi, address: CONTRACT_ADDRESS });
  const { contract: strkContract } = useContract({ abi: ERC20_ABI as Abi, address: STRK_TOKEN_ADDRESS });

	const { address: userAddress } = useAccount();
	const { data: roundInfoData, error: roundInfoError } = useReadContract({abi: ABI, functionName: "get_round_info", address: CONTRACT_ADDRESS, args: []});

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
			const roundInfo : RoundInfo = {
				roundId: Number(roundInfoData[0]),
				isActive: Boolean(roundInfoData[1].variant.Active),
				startTimestamp: Number(roundInfoData[2]),
				endTimestamp: Number(roundInfoData[3]),
				startPrice: Number(roundInfoData[4]),
				endPrice: Number(roundInfoData[5]),
			}

			return (
				<ul>
					<li>Round ID: {roundInfo.roundId}</li>
          <li>Start Price: ${roundInfo.startPrice.toFixed(2)}</li>
          <li>Current/End Price: ${roundInfo.endPrice.toFixed(2)}</li>
          <li>Status: {roundInfo.isActive ? 'Active' : 'Inactive'}</li>
          {/* <li>Elapsed Time: {elapsedTime} seconds</li> */}
				</ul>
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
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header>
				<WalletBar />
			</header>
			<main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Image
            width={200} 
            height={50}  // Adjust this value as needed
            src="https://www.starknet.io/wp-content/themes/Starknet/assets/img/starknet-logo.svg"
            alt="Starknet Logo"
          />
        </div>

        {/* <div className="flex gap-4 items-center flex-col sm:flex-row">
          <TokenPrice />
        </div> */}

        <div className="flex flex-col gap-4 items-center">
          <RoundInfo />
        </div>

        <div className="flex gap-4 items-center justify-center flex-col sm:flex-row">

          <button
            onClick={() => handlePlaceBet(true)}
            disabled={isPlacingBet || isApprovalPending}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:bg-gray-400"
          >
            <Image
              className="dark:invert"
              src="https://www.svgrepo.com/show/489109/rocket-launch.svg"
              alt="Arrow Up"
              width={20}
              height={20}
            />
            { isApprovalPending ? 'Approve Bet Amount' : 'Moon' }
          </button>
          <button
            onClick={() => handlePlaceBet(false)}
            disabled={isPlacingBet}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:bg-gray-400"
          >
            <Image
              className="dark:invert"
              src="https://www.svgrepo.com/show/444703/explosion.svg"
              alt="Arrow Down"
              width={20}
              height={20}
            />
            { isApprovalPending ? 'Approve Bet Amount' : 'Doom' }
          </button>
        </div>

				<div>
					{errorSendStartRoundTx && <p>Error starting round: {errorSendStartRoundTx.message}</p>}
					{errorSendEndRoundTx && <p>Error ending round: {errorSendEndRoundTx.message}</p>}
					{errorPlaceBetTx && <p>Error placing bet: {errorPlaceBetTx.message}</p>}
				</div>

        <div className="flex flex-col gap-4 items-center justify-center w-full max-w-md">
          <button
            onClick={handleStartRound}
            disabled={isStartingRound || isRoundActive}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:bg-gray-400 w-full"
          >
            
            {isStartingRound ? 'Starting Round...' : 'Start Round'}
          </button>

          <button
            onClick={handleEndRound}
            disabled={isEndingRound || !isRoundActive}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-red-500 text-background gap-2 hover:bg-red-600 dark:hover:bg-red-400 text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:bg-gray-400 w-full"
          >
           
            {isEndingRound ? 'Ending Round...' : 'End Round'}
          </button>
        </div>
        <div className="p-4 bg-white border-black border">
            <h3 className="text-lg font-bold mb-2">
              Past Rounds ({events.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-gray-300 text-right p-2 font-semibold">Round</th>
                    {/* <th className="border-b border-gray-300 text-left p-2 font-semibold">Round start</th> */}
                    {/* <th className="border-b border-gray-300 text-right p-2 font-semibold">Round end</th> */}
                    <th className="border-b border-gray-300 text-right p-2 font-semibold">Start price</th>
                    <th className="border-b border-gray-300 text-right p-2 font-semibold">End price</th>
                    <th className="border-b border-gray-300 text-right p-2 font-semibold">Moon Bets Count</th>
                    <th className="border-b border-gray-300 text-right p-2 font-semibold">Doom Bets Count</th>
                  </tr>
                </thead>
                <tbody>
                  {lastTenEvents.map((event, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="border-b border-gray-200 p-2">{Number(event.data[0])}</td>
                      {/* <td className="border-b border-gray-200 p-2">{convertTimestampToDate(Number(event.data[2]))}</td> */}
                      {/* <td className="border-b border-gray-200 p-2">{convertTimestampToDate(Number(event.data[2]))}</td> */}
                      <td className="border-b border-gray-200 p-2">{formatAmount(event.data[3])}</td>
                      <td className="border-b border-gray-200 p-2">{formatAmount(event.data[4])}</td>
                      <td className="border-b border-gray-200 p-2">{Number(event.data[5])}</td>
                      <td className="border-b border-gray-200 p-2">{Number(event.data[6])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
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
