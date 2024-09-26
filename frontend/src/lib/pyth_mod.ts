import { useCallback, useEffect, useRef, useState } from "react";
import { EvmPriceServiceConnection, PriceFeed } from "@pythnetwork/pyth-evm-js";
import { sub } from "date-fns/sub";
import { fromUnixTime } from "date-fns/fromUnixTime";
import { XYDataType } from "@looksrare/uikit";
import { sleep, useOnAccountChange, useOnVisibilityChange } from "@looksrare/utils";
import { MoDAssetPair } from "@looksrare/yolo-games-gql-typegen";
import { PYTH_BTC_USD_FEED_ID, PYTH_ETH_USD_FEED_ID, PYTH_REALTIME_CONNECTION_URL } from "../../config/constants";

// Represents the maximum acceptable age from now of the price
// update measured in seconds
const ageLimitSecs = 30;
const bufferSize = 2;
const maxBufferSize = 4;
const frameTime = 1000 / 60;

const AssetPairFeedIds = {
  ETHUSD: PYTH_ETH_USD_FEED_ID,
  BTCUSD: PYTH_BTC_USD_FEED_ID,
};

interface UsePythRealtimeProps {
  feedId: string;
  onUpdate: (update: PriceFeed) => void;
  onClose?: () => void;
  isEnabled?: boolean;
}

export const usePythRealtime = ({ feedId, onUpdate, onClose, isEnabled = true }: UsePythRealtimeProps) => {
  useEffect(() => {
    if (isEnabled) {
      const connection = new EvmPriceServiceConnection(PYTH_REALTIME_CONNECTION_URL);

      connection.subscribePriceFeedUpdates([feedId], onUpdate);

      return () => {
        connection.unsubscribePriceFeedUpdates([feedId]);
        connection.closeWebSocket();
        onClose?.();
      };
    }
  }, [feedId, isEnabled, onClose, onUpdate]);
};

const hasSameTimestampAsLast = (array: XYDataType, item: [number, number]) => {
  return array.length > 0 && array[array.length - 1][0] === item[0];
};

interface UsePythRealtimeOptions {
  isEnabled?: boolean;
  shouldSmooth?: boolean;
}

export const usePythPriceRealtimeHistory = (assetPair: MoDAssetPair, options?: UsePythRealtimeOptions) => {
  const isHidden = useRef(false);
  const isSmoothing = useRef(false);
  const currentAssetPair = useRef(assetPair);
  const shouldSmooth = useRef(options?.shouldSmooth ?? true);
  const priceTimeouts = useRef<NodeJS.Timeout[]>([]);

  const buffer = useRef<XYDataType>([]);

  // We create a seperate array for interpolated values,
  // so that we can remove them quickly when they're no longer needed
  // and avoid storing too much data
  const [intermediatePrices, setIntermediatePrices] = useState<XYDataType>([]);
  const [prices, setPrices] = useState<XYDataType>([]);

  // We update the refs instead of using the values directly, so they can be accessed
  // without re-instancing the smoothing functions
  useEffect(() => {
    currentAssetPair.current = assetPair;
  }, [assetPair]);

  useEffect(() => {
    shouldSmooth.current = options?.shouldSmooth ?? true;
  }, [options]);

  // ==SETTERS==
  const addToPrices = useCallback((item: [number, number]) => {
    setPrices((prev) => {
      if (hasSameTimestampAsLast(prev, item)) {
        return prev;
      }

      // To make sure we don't store an abundance of data, we filter out items that are older than 10 minutes
      const filteredPrev = prev.filter(([timestamp]) => {
        return timestamp > sub(Date.now(), { minutes: 10 }).getTime();
      });

      return [...filteredPrev, item];
    });
  }, []);

  const addToIntermediatePrices = useCallback((item: [number, number]) => {
    setIntermediatePrices((prev) => {
      if (hasSameTimestampAsLast(prev, item)) {
        return prev;
      }

      // Since these are just the intermidiate prices, we can remove
      // older values quickly.
      const filteredPrev = prev.filter(([timestamp]) => {
        return timestamp > sub(Date.now(), { seconds: 10 }).getTime();
      });

      return [...filteredPrev, item];
    });
  }, []);

  const addToBuffer = useCallback(([publishTime, price]: [number, number]) => {
    if (hasSameTimestampAsLast(buffer.current, [publishTime, price])) {
      return;
    }

    buffer.current.push([publishTime, price]);
  }, []);

  const reset = useCallback(() => {
    setPrices([]);
    setIntermediatePrices([]);
    buffer.current = [];

    // Cancel any ongoing price timeouts to avoid
    // adding prices from previous asset pair to the current array
    priceTimeouts.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
  }, []);

  // ==UTILS==
  const awaitBuffer = useCallback(async () => {
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (buffer.current.length === bufferSize) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }, []);

  const doSmoothing = useCallback(
    async (_pair: MoDAssetPair) => {
      if (buffer.current.length < bufferSize) {
        await awaitBuffer();
      }

      const [fromTimestamp, fromPrice] = buffer.current[0];
      const [toTimestamp, toPrice] = buffer.current[1];

      const priceDiff = toPrice - fromPrice;
      const timeDiff = toTimestamp - fromTimestamp;

      const updateStartTime = Date.now();

      let lastUpdateTime = updateStartTime;

      const updatePrices = async () => {
        // Cancel current iterations if the asset pair has changed
        // to avoid adding incorrect prices to the intermediate prices array
        if (_pair !== currentAssetPair.current) {
          doSmoothing(currentAssetPair.current);
          return;
        }

        // If page is hidden while iterating, we just stop completely
        // to mitigate any potential issues
        if (isHidden.current || !shouldSmooth.current) {
          await sleep(500);
          doSmoothing(_pair);

          return;
        }

        const deltaTime = Date.now() - lastUpdateTime;
        const totalElapsedTime = Date.now() - updateStartTime;
        lastUpdateTime = Date.now();

        // To calculate what the interpolated price should be at the current time,
        // we calculate the percentage of time that has passed since the start of the update
        // and apply that percentage to the price difference.
        // (Not really a percentage, but it's the same principle)
        const elapsedTimePercent = totalElapsedTime / timeDiff;
        const currentFramePrice = fromPrice + priceDiff * elapsedTimePercent;

        const frameValues: [number, number] = [fromTimestamp + totalElapsedTime, currentFramePrice];

        const isAtFinalFrame = frameValues[0] < toTimestamp - deltaTime;

        addToIntermediatePrices(frameValues);

        if (!isAtFinalFrame) {
          buffer.current.shift();
          doSmoothing(_pair);
        } else {
          setTimeout(updatePrices, frameTime);
        }
      };

      updatePrices();
    },
    [addToIntermediatePrices, awaitBuffer]
  );

  // ==EFFECTS==
  useEffect(() => {
    (async () => {
      // Make sure we're just running one instance
      if (!isSmoothing.current) {
        isSmoothing.current = true;
        doSmoothing(assetPair);
      }
    })();
  }, [assetPair, awaitBuffer, doSmoothing]);

  useOnAccountChange(() => reset());

  // If the page is hidden, we clear the buffer and add those items to the prices array
  useOnVisibilityChange((_isHidden) => {
    isHidden.current = _isHidden;
    if (_isHidden) {
      setPrices((prev) => [...prev, ...buffer.current]);
      buffer.current = [];
    }
  });

  // When users turns smoothing off, we add the buffer and intermediate prices to the prices array.
  // We then clear the buffer and any ongoing timeouts. This ensures a smooth transition between the two states.
  useEffect(() => {
    if (options?.shouldSmooth === false) {
      setPrices((prev) => [...prev, ...intermediatePrices, ...buffer.current]);
      setIntermediatePrices([]);
      buffer.current = [];

      priceTimeouts.current.forEach((timeout) => {
        clearTimeout(timeout);
      });
    }

    // should only trigger when user toggles smoothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.shouldSmooth]);

  const onPythUpdate = useCallback(
    (update: PriceFeed) => {
      const price = update.getPriceNoOlderThan(ageLimitSecs);

      if (price) {
        const { publishTime, expo, price: priceValue } = price;

        const publishTimeMs = fromUnixTime(publishTime).getTime();
        const realPrice = parseFloat(priceValue) * Math.pow(10, expo);

        if (isHidden.current || !shouldSmooth.current) {
          addToPrices([publishTimeMs, realPrice]);
        } else {
          addToBuffer([publishTimeMs, realPrice]);

          // We add the price to the prices array after 5 seconds
          // as interpolation will have ended by then, and this makes sure
          // the user gets the most accurate graph
          const priceTimeout = setTimeout(() => addToPrices([publishTimeMs, realPrice]), 5000);
          priceTimeouts.current.push(priceTimeout);

          // Just to make sure we don't fall behind,
          // we force sync when buffer exceeds max length
          if (buffer.current.length > maxBufferSize) {
            buffer.current = buffer.current.slice(-(maxBufferSize - 1));
          }
        }
      }
    },
    [addToBuffer, addToPrices]
  );

  usePythRealtime({
    feedId: AssetPairFeedIds[assetPair],
    onUpdate: onPythUpdate,
    onClose: reset,
    isEnabled: options?.isEnabled,
  });

  // no need to memoize as it's going to update rapidly anyway
  const combinedPrices = [...intermediatePrices, ...prices].sort((a, b) => a[0] - b[0]);

  return combinedPrices;
};

export const usePythPriceRealtime = (assetPair: MoDAssetPair, options?: UsePythRealtimeOptions) => {
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  const onUpdate = useCallback((update: PriceFeed) => {
    const price = update.getPriceNoOlderThan(ageLimitSecs);

    if (price) {
      const { expo, price: priceValue } = price;
      const actualPrice = parseFloat(priceValue) * Math.pow(10, expo);

      setCurrentPrice(actualPrice);
    }
  }, []);

  usePythRealtime({
    feedId: AssetPairFeedIds[assetPair],
    onUpdate,
    isEnabled: options?.isEnabled,
  });

  return currentPrice;
};
