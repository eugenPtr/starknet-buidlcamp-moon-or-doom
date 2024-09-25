// pragmaOracleUtils.ts

import { useEffect, useRef, useState } from 'react';

const PRAGMA_API_BASE_URL = "ws.dev.pragma.build";
const URI = "node/v1/data/subscribe";
const WS_URL = `ws://${PRAGMA_API_BASE_URL}/${URI}`;

interface PriceData {
  timestamp: number;
  price: number;
}

export const usePragmaOracleWebSocket = (pair: string) => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connectWebSocket = () => {
      socket.current = new WebSocket(WS_URL);

      socket.current.onopen = () => {
        console.log('WebSocket connection established');
        const subscribeMessage = JSON.stringify({
          msg_type: "subscribe",
          pairs: [pair]
        });
        socket.current?.send(subscribeMessage);
      };

      socket.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Assuming the data structure. Adjust if necessary.
        if (data.price && data.timestamp) {
          setPriceData(prevData => {
            const newData = [...prevData, { timestamp: data.timestamp, price: parseFloat(data.price) }];
            // Keep only the last hour of data (720 points at 5-second intervals)
            return newData.slice(-720);
          });
        }
      };

      socket.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.current.onclose = () => {
        console.log('WebSocket connection closed');
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 5000);
      };
    };

    connectWebSocket();

    return () => {
      socket.current?.close();
    };
  }, [pair]);

  return priceData;
};