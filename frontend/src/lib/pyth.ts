import { useState, useEffect, useCallback, useRef } from 'react';
import { PriceServiceConnection, PriceFeed } from '@pythnetwork/price-service-client';

const PYTH_ENDPOINT = 'https://hermes.pyth.network';
const STRK_PRICE_FEED_ID = '6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870';

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000; // 3 seconds

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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const connection = useRef<PriceServiceConnection | null>(null);
  const retryCount = useRef<number>(0);

  const buffer = useRef<PriceData[]>([]);
  const isSmoothing = useRef<boolean>(false);

  const bufferSize = 2;
  const maxBufferSize = 4;
  const frameTime = 1000 / 60; // For 60 FPS

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

      setPriceHistory(prev => {
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
  }, [shouldSmooth, frameTime]); // Added frameTime to the dependency array

  const onPriceUpdate = useCallback((priceFeed: PriceFeed) => {
    const price = priceFeed.getPriceNoOlderThan(30);
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

  const connectToPyth = useCallback(() => {
    if (connection.current) {
      connection.current.closeWebSocket();
    }

    connection.current = new PriceServiceConnection(PYTH_ENDPOINT);
    setConnectionStatus('connecting');

    connection.current.onWsError = (error: unknown) => { // Changed 'any' to 'unknown'
      console.error('WebSocket error:', error);
      setConnectionStatus('error');
      if (retryCount.current < MAX_RETRIES) {
        setTimeout(() => {
          retryCount.current += 1;
          connectToPyth();
        }, RETRY_DELAY);
      }
    };

    // connection.current.onConnected = () => {
    //   setConnectionStatus('connected');
    //   retryCount.current = 0;
    // };

    connection.current.subscribePriceFeedUpdates([feedId], onPriceUpdate);
  }, [feedId, onPriceUpdate]);

  useEffect(() => {
    if (isEnabled) {
      connectToPyth();

      return () => {
        if (connection.current) {
          connection.current.closeWebSocket();
        }
      };
    }
  }, [isEnabled, connectToPyth]);

  return { currentPrice, priceHistory, connectionStatus };
};