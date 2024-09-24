"use client";

import Image from "next/image";
import React, { useState } from 'react';
import { Bet } from './contract';
import { RoundInfo } from './types';
import WalletBar from '../components/WalletBar';
import { useContract, useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { type Abi, CairoCustomEnum } from "starknet";

import ABI from "../abi/moon_or_doom.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

export default function Home() {
	const [bet, setBet] = useState<CairoCustomEnum>(Bet.MOON);
  const [elapsedTime, setElapsedTime] = useState(0);

	const { contract } = useContract({ abi: ABI as Abi, address: CONTRACT_ADDRESS });
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

  const handleStartRound = async () => {
    await sendStartRoundTx();
  };

  const handleEndRound = async () => {
    await sendEndRoundTx();
  };

  const handlePlaceBet = async (isMoon: boolean) => {
		setBet(isMoon ? Bet.MOON : Bet.DOOM);
    await sendPlaceBetTx();
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
          <li>Elapsed Time: {elapsedTime} seconds</li>
				</ul>
			)
		}
	};

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
            disabled={isPlacingBet}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:bg-gray-400"
          >
            <Image
              className="dark:invert"
              src="https://www.svgrepo.com/show/489109/rocket-launch.svg"
              alt="Arrow Up"
              width={20}
              height={20}
            />
            Moon
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
            Doom
          </button>
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
