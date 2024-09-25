"use client";  // This tells Next.js this component is a Client Component

import React, { useEffect, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { fetchHistoricalData, fetchTokenPrice } from '../lib/coingecko';

// Ensure we have the modules for real-time updates and animations
import HC_more from 'highcharts/highcharts-more';
import HC_exporting from 'highcharts/modules/exporting';

HC_more(Highcharts);
HC_exporting(Highcharts);

interface ChartOptions extends Highcharts.Options {
  series: Array<Highcharts.SeriesLineOptions>;
}

const STRKPriceChart: React.FC = () => {
  const [chartOptions, setChartOptions] = useState<ChartOptions>({
    chart: {
      type: 'line',
      animation: Highcharts.svg,
      height: '400px'
    },
    title: {
      text: 'STRK Token Price Chart'
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
        return '<b>' + this.series.name + '</b><br/>' +
          Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x as number) + '<br/>' +
          Highcharts.numberFormat(this.y as number, 4);
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
      name: 'STRK Price',
      data: []
    }]
  });

  const chartComponentRef = useRef<HighchartsReact.RefObject>(null);
  const lastFetchTime = useRef<number>(0);

  const contractAddress = '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

  useEffect(() => {
    const updateHistoricalData = async () => {
      try {
        // Fetch 1 hour of historical data
        const data = await fetchHistoricalData(contractAddress, 1/24);
        // Filter data to get points approximately 5 seconds apart
        const filteredData = data.filter((_, index) => index % 12 === 0);
        setChartOptions(prevOptions => ({
          ...prevOptions,
          series: [{
            ...prevOptions.series[0],
            data: filteredData
          }]
        }));
        lastFetchTime.current = filteredData[filteredData.length - 1][0];
      } catch (error) {
        console.error('Error fetching historical data:', error);
      }
    };

    const updateLatestPrice = async () => {
      try {
        const latestPrice = await fetchTokenPrice(contractAddress);
        if (latestPrice !== null) {
          const timestamp = new Date().getTime();
          setChartOptions(prevOptions => {
            const newData = [...prevOptions.series[0].data as [number, number][]];
            if (timestamp - lastFetchTime.current >= 5000) {
              newData.push([timestamp, latestPrice]);
              if (newData.length > 720) newData.shift(); // Keep only last hour of data (3600 / 5 = 720)
              lastFetchTime.current = timestamp;
            }
            return {
              ...prevOptions,
              series: [{
                ...prevOptions.series[0],
                data: newData
              }]
            };
          });
        }
      } catch (error) {
        console.error('Error fetching latest price:', error);
      }
    };

    updateHistoricalData();
    const intervalId = setInterval(updateLatestPrice, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={chartOptions}
        ref={chartComponentRef}
      />
    </div>
  );
};

export default STRKPriceChart;