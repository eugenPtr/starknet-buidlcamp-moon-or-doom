import { useCallback, useEffect, useRef, useState } from "react";
import { PriceServiceConnection, PriceFeed } from "@pythnetwork/price-service-client";

const PYTH_ENDPOINT = 'https://hermes.pyth.network';
const STRK_PRICE_FEED_ID = '6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870';

// Represents the maximum acceptable age from now of the price
// update measured in seconds
const ageLimitSecs = 30;
const bufferSize = 2;
const maxBufferSize = 4;
const frameTime = 1000 / 60; // For 60 FPS

export interface PriceData {
  timestamp: number;
  price: number;
}

interface UsePythRealtimeProps {
  feedId?: string;
  isEnabled?: boolean;
  shouldSmooth?: boolean;
}

export const usePythRealtime = ({ 
  feedId = STRK_PRICE_FEED_ID, 
  isEnabled = true, 
  shouldSmooth = true 
}: UsePythRealtimeProps) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);
  const [smoothPriceHistory, setSmoothPriceHistory] = useState<PriceData[]>([]);
  const connection = useRef<PriceServiceConnection | null>(null);
  const buffer = useRef<PriceData[]>([]);
  const isSmoothing = useRef<boolean>(false);

  const addToBuffer = useCallback((priceData: PriceData) => {
    if (buffer.current.length > 0 && buffer.current[buffer.current.length - 1].timestamp === priceData.timestamp) {
      return;
    }
    buffer.current.push(priceData);
    if (buffer.current.length > maxBufferSize) {
      buffer.current = buffer.current.slice(-maxBufferSize);
    }
  }, []);

  const doSmoothing = useCallback(async () => {
    if (buffer.current.length < bufferSize) {
      return;
    }

    const [fromData, toData] = buffer.current;
    const priceDiff = toData.price - fromData.price;
    const timeDiff = toData.timestamp - fromData.timestamp;

    const updateStartTime = Date.now();
    let lastUpdateTime = updateStartTime;

    const updatePrices = async () => {
      if (!shouldSmooth) {
        isSmoothing.current = false;
        return;
      }

      const deltaTime = Date.now() - lastUpdateTime;
      const totalElapsedTime = Date.now() - updateStartTime;
      lastUpdateTime = Date.now();

      const elapsedTimePercent = totalElapsedTime / timeDiff;
      const currentFramePrice = fromData.price + priceDiff * elapsedTimePercent;

      const frameValues: PriceData = {
        timestamp: fromData.timestamp + totalElapsedTime,
        price: currentFramePrice
      };

      setSmoothPriceHistory(prev => {
        const newHistory = [...prev, frameValues];
        return newHistory.slice(-720); // Keep last hour of data
      });

      if (frameValues.timestamp >= toData.timestamp - deltaTime) {
        buffer.current.shift();
        isSmoothing.current = false;
      } else {
        setTimeout(updatePrices, frameTime);
      }
    };

    updatePrices();
  }, [shouldSmooth]);

  const onPriceUpdate = useCallback((priceFeed: PriceFeed) => {
    const price = priceFeed.getPriceNoOlderThan(ageLimitSecs);
    if (price) {
      const { publishTime, price: priceValue, expo } = price;
      const actualPrice = parseFloat(priceValue) * Math.pow(10, expo);
      const newPriceData: PriceData = {
        timestamp: publishTime * 1000, // Convert to milliseconds
        price: actualPrice,
      };

      setCurrentPrice(actualPrice);
      
      if (shouldSmooth) {
        addToBuffer(newPriceData);
        if (!isSmoothing.current) {
          isSmoothing.current = true;
          doSmoothing();
        }
      } else {
        setPriceHistory(prev => {
          const newHistory = [...prev, newPriceData];
          return newHistory.slice(-720); // Keep last hour of data
        });
      }
    }
  }, [addToBuffer, doSmoothing, shouldSmooth]);

  useEffect(() => {
    if (isEnabled) {
      connection.current = new PriceServiceConnection(PYTH_ENDPOINT);
      
      const fetchInitialData = async () => {
        try {
          const latestPriceFeeds = await connection.current!.getLatestPriceFeeds([feedId]);
          if (latestPriceFeeds && latestPriceFeeds.length > 0) {
            onPriceUpdate(latestPriceFeeds[0]);
          }
        } catch (error) {
          console.error('Error fetching initial price data:', error);
        }
      };

      fetchInitialData();

      connection.current.subscribePriceFeedUpdates([feedId], onPriceUpdate);

      return () => {
        if (connection.current) {
          connection.current.closeWebSocket();
        }
      };
    }
  }, [feedId, isEnabled, onPriceUpdate]);

  return { currentPrice, priceHistory: shouldSmooth ? smoothPriceHistory : priceHistory };
};