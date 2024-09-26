import { RefObject, useEffect, useState } from "react";

export const useOracleChartZoom = (chartElementRef: RefObject<HTMLDivElement>) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const chartElement = chartElementRef.current;

    if (chartElement) {
      const listener = (event: WheelEvent) => {
        event.preventDefault();

        setZoomLevel((prev) => {
          const { deltaY } = event;
          const zoomLevelChange = deltaY / 10;

          if (prev + zoomLevelChange < 0) {
            return 0;
          }

          return prev + zoomLevelChange;
        });
      };

      chartElement.addEventListener("wheel", listener);

      return () => chartElement.removeEventListener("wheel", listener);
    }
  }, [chartElementRef]);

  return zoomLevel;
};
