import React, { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { usePythRealtime, PriceData } from '../lib/pyth'; // Adjust the import path as needed
import { Options } from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import * as Highcharts from 'highcharts';

// Динамический импорт с типами
const HighchartsReactComponent = dynamic(() => import('highcharts-react-official'), { 
  ssr: false 
}) as typeof HighchartsReact;

interface PythPriceChartProps {
  // Add any props here if needed
}

const PythPriceChart = forwardRef<HighchartsReact.RefObject, PythPriceChartProps>((props, ref) => {
  const [smoothing, setSmoothing] = useState(true);
  const { currentPrice, priceHistory } = usePythRealtime({ shouldSmooth: smoothing });
  const [chartOptions, setChartOptions] = useState<Options>({});
  const [HighchartsModule, setHighchartsModule] = useState<typeof Highcharts | null>(null);

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
      if (!smoothing) {
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

      if (ref && 'current' in ref && ref.current && ref.current.chart) {
        const chart = ref.current.chart;
        if (chart.series[0]) {
          chart.series[0].addPoint([frameValues.timestamp, frameValues.price], true, false, false);
        }
      }

      if (frameValues.timestamp >= toData.timestamp - deltaTime) {
        buffer.current.shift();
        isSmoothing.current = false;
      } else {
        setTimeout(updatePrices, frameTime);
      }
    };

    updatePrices();
  }, [smoothing, ref]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('highcharts').then((HighchartsImport) => {
        setHighchartsModule(HighchartsImport);
        import('highcharts/highcharts-more').then(module => module.default(HighchartsImport));
        import('highcharts/modules/exporting').then(module => module.default(HighchartsImport));

        setChartOptions({
          chart: {
            type: 'line',
            animation: HighchartsImport.svg,
            height: '400px'
          },
          title: {
            text: 'STRK/USD Price'
          },
          xAxis: {
            type: 'datetime',
            tickPixelInterval: 150
          },
          yAxis: {
            title: {
              text: 'Price (USD)'
            },
            plotLines: [{
              value: 0,
              width: 1,
              color: '#808080'
            }]
          },
          tooltip: {
            formatter: function(this: Highcharts.TooltipFormatterContextObject): string {
              return '<b>STRK/USD</b><br/>' +
                HighchartsImport.dateFormat('%Y-%m-%d %H:%M:%S', this.x as number) + '<br/>' +
                HighchartsImport.numberFormat(this.y as number, 4);
            }
          },
          legend: {
            enabled: false
          },
          exporting: {
            enabled: true
          },
          series: [{
            type: 'line',
            name: 'STRK/USD Price',
            data: []
          }]
        });
      });
    }
  }, []);

  const toggleSmoothing = () => {
    setSmoothing(!smoothing);
  };

  useEffect(() => {
    if (ref && 'current' in ref && ref.current && ref.current.chart) {
      const chart = ref.current.chart;
      if (chart.series[0]) {
        if (smoothing) {
          priceHistory.forEach(data => addToBuffer(data));
          if (!isSmoothing.current) {
            isSmoothing.current = true;
            doSmoothing();
          }
        } else {
          chart.series[0].setData(priceHistory.map((d: PriceData) => [d.timestamp, d.price]), true, false, false);
        }
      }
    }
  }, [priceHistory, smoothing, addToBuffer, doSmoothing]);

  return (
    <div style={{ width: '100%', height: '450px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2>STRK/USD Price: ${currentPrice.toFixed(4)}</h2>
        <button onClick={toggleSmoothing}>
          {smoothing ? 'Disable Smoothing' : 'Enable Smoothing'}
        </button>
      </div>
      {HighchartsModule && (
        <HighchartsReactComponent
          highcharts={HighchartsModule}
          options={chartOptions}
          ref={ref}
        />
      )}
    </div>
  );
});

PythPriceChart.displayName = 'PythPriceChart';

export default dynamic(() => Promise.resolve(PythPriceChart), { ssr: false });