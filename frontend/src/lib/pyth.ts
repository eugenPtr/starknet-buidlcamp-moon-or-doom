import { useState, useEffect } from 'react';
import { PriceServiceConnection } from '@pythnetwork/price-service-client';

export interface PriceData {
  timestamp: number;
  price: number;
}

const PYTH_ENDPOINT = 'https://hermes.pyth.network'; 
const STRK_PRICE_FEED_ID = '6a182399ff70ccf3e06024898942028204125a819e519a335ffa4579e66cd870'; 

export const usePythPriceFeed = (): PriceData | null => {
    const [priceData, setPriceData] = useState<PriceData | null>(null);
  
    useEffect(() => {
      const connection = new PriceServiceConnection(PYTH_ENDPOINT);
  
      const fetchLatestPrice = async () => {
        try {
          const latestPriceFeeds = await connection.getLatestPriceFeeds([STRK_PRICE_FEED_ID]);
          if (latestPriceFeeds && latestPriceFeeds.length > 0) {
            const priceFeed = latestPriceFeeds[0];
            const price = priceFeed.getPriceNoOlderThan(60);
            if (price) {
              setPriceData({
                timestamp: price.publishTime,
                price: price.price ? Number(price.price.slice(4))/10**4 : 0
              });
            }
          }
        } catch (error) {
          console.error('Error fetching latest price:', error);
        }
      };
  
      const subscribeToPriceFeed = async () => {
        await connection.subscribePriceFeedUpdates(
          [STRK_PRICE_FEED_ID],
          (priceFeed) => {
            const price = priceFeed.getPriceNoOlderThan(60);
            if (price) {
              setPriceData({
                timestamp: price.publishTime,
                price: price.price ? Number(price.price.slice(4))/10**4 : 0
              });
            }
          }
        );
      };
  
      fetchLatestPrice();
      subscribeToPriceFeed();
  
      // Cleanup function to close the WebSocket connection
      return () => {
        connection.closeWebSocket();
      };
    }, []);
  
    return priceData;
  };