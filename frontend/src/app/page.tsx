"use client";

import Image from "next/image";
import React, { useState, useEffect } from 'react';
import { startRound, placeBet, getRoundInfo, endRound, Bet } from './contract';

export default function Home() {
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [isEndingRound, setIsEndingRound] = useState(false);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [roundInfo, setRoundInfo] = useState({ 
    roundId: 0, 
    startPrice: 0, 
    endPrice: 0, 
    totalBets: 0, 
    isActive: false, 
    startTimestamp: 0 
  });
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const fetchRoundInfo = async () => {
      try {
        const info = await getRoundInfo();
        setRoundInfo(info);
      } catch (error) {
        console.error('Failed to fetch round info:', error);
      }
    };

    fetchRoundInfo(); // Fetch immediately on component mount

    const intervalId = setInterval(fetchRoundInfo, 10000); // Update every 10 seconds

    return () => clearInterval(intervalId); // Clean up on component unmount
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (roundInfo.isActive && roundInfo.startTimestamp > 0) {
      timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        setElapsedTime(now - roundInfo.startTimestamp);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [roundInfo.isActive, roundInfo.startTimestamp]);

  const handleStartRound = async () => {
    setIsStartingRound(true);
    try {
      const result = await startRound();
      console.log('Round started successfully:', result);
      // You might want to add some success feedback here
    } catch (error) {
      console.error('Failed to start round:', error);
      // You might want to add some error feedback here
    } finally {
      setIsStartingRound(false);
    }
  };

  const handleEndRound = async () => {
    setIsEndingRound(true);
    try {
      const result = await endRound();
      console.log('Round ended successfully:', result);
      // You might want to add some success feedback here
    } catch (error) {
      console.error('Failed to end round:', error);
      // You might want to add some error feedback here
    } finally {
      setIsEndingRound(false);
    }
  };

  const handlePlaceBet = async (isMoon: boolean) => {
    setIsPlacingBet(true);
    try {
      const result = await placeBet(isMoon ? Bet.MOON : Bet.DOOM);
      console.log(`Bet placed successfully (${isMoon ? 'Moon' : 'Doom'}):`, result);
      // You might want to add some success feedback here
    } catch (error) {
      console.error('Failed to place bet:', error);
      // You might want to add some error feedback here
    } finally {
      setIsPlacingBet(false);
    }
  };

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
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
          <h2 className="text-xl font-bold">Round Information</h2>
          <p>Round ID: {roundInfo.roundId}</p>
          <p>Start Price: ${roundInfo.startPrice.toFixed(2)}</p>
          <p>Current/End Price: ${roundInfo.endPrice.toFixed(2)}</p>
          <p>Status: {roundInfo.isActive ? 'Active' : 'Inactive'}</p>
          <p>Elapsed Time: {elapsedTime} seconds</p>
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
            disabled={isStartingRound || roundInfo.isActive}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 disabled:bg-gray-400 w-full"
          >
            
            {isStartingRound ? 'Starting Round...' : 'Start Round'}
          </button>

          <button
            onClick={handleEndRound}
            disabled={isEndingRound || !roundInfo.isActive}
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
