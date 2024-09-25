import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import dynamic from 'next/dynamic';
import { usePythRealtime, PriceData } from '../lib/pyth'; 
import { Options } from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import * as Highcharts from 'highcharts';

const HighchartsReactComponent = dynamic(() => import('highcharts-react-official'), { 
  ssr: false 
}) as typeof HighchartsReact;

interface PythPriceChartProps {
	anyProp: number // Add any props you want to pass to the component
}

const PythPriceChart = forwardRef<HighchartsReact.RefObject, PythPriceChartProps>((props, ref) => {
  const [smoothing, setSmoothing] = useState(true);
  const { currentPrice, priceHistory, connectionStatus } = usePythRealtime({ shouldSmooth: smoothing });
  const [chartOptions, setChartOptions] = useState<Options>({});
  const [HighchartsModule, setHighchartsModule] = useState<typeof Highcharts | null>(null);

  const updateChartData = useCallback(() => {
    console.log('updating chart data');
    console.log(ref);

    setChartOptions((prevOptions) => ({
      ...prevOptions,
      series: [
        {
          type: 'line',
          name: 'STRK/USD Price',
          data: priceHistory.map((d: PriceData) => [d.timestamp, d.price])
        }
      ],
    }));

    // if (ref && 'current' in ref && ref.current && ref.current.chart) {
    //   const chart = ref.current.chart;
    //   if (chart.series[0]) {
    //     chart.series[0].setData(priceHistory.map((d: PriceData) => [d.timestamp, d.price]), true, false, false);
    //   }
    // }
  }, [priceHistory, ref]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('highcharts').then((HighchartsImport) => {
        setHighchartsModule(HighchartsImport);
        import('highcharts/highcharts-more').then(module => module.default(HighchartsImport));
        import('highcharts/modules/exporting').then(module => module.default(HighchartsImport));

        setChartOptions({
          chart: {
            type: 'line',
            // @ts-expect-error no types available
            animation: Highcharts.svg,
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

  useEffect(() => {
    updateChartData();
  }, [priceHistory, updateChartData]);

  const toggleSmoothing = () => {
    setSmoothing(!smoothing);
  };

  return (
    <div style={{ width: '100%', height: '450px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2>STRK/USD Price: ${currentPrice.toFixed(4)}</h2>
        <div>
          <span style={{ marginRight: '10px' }}>
            Status: {connectionStatus === 'connected' ? '🟢 Connected' : connectionStatus === 'connecting' ? '🟠 Connecting' : '🔴 Error'}
          </span>
          <button onClick={toggleSmoothing}>
            {smoothing ? 'Disable Smoothing' : 'Enable Smoothing'}
          </button>
        </div>
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