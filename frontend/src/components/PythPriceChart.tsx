"use client";  

import React, { useEffect, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { usePythPriceFeed, PriceData } from '../lib/pyth';

import HC_more from 'highcharts/highcharts-more';
import HC_exporting from 'highcharts/modules/exporting';

HC_more(Highcharts);
HC_exporting(Highcharts);

const STRKPriceChart: React.FC = () => {
  const latestPriceData = usePythPriceFeed();
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const [priceHistory, setPriceHistory] = useState<PriceData[]>([]);

  useEffect(() => {
    if (latestPriceData) {
      setPriceHistory(prev => {
        const newHistory = [...prev, latestPriceData];
        // Keep only the last hour of data (720 points at 5-second intervals)
        return newHistory.slice(-720);
      });
    }
  }, [latestPriceData]);

  useEffect(() => {
    if (chartRef.current && chartRef.current.chart) {
      const chart = chartRef.current.chart;
      chart.series[0].setData(priceHistory.map(d => [d.timestamp, d.price]), true, false, false);
    }
  }, [priceHistory]);

  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      // animation: Highcharts.svg,
      height: '400px'
    },
    title: {
      text: 'STRK/USD'
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
      name: 'STRK/USD Price',
      data: []
    }]
  };

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        ref={chartRef}
      />
    </div>
  );
};

export default STRKPriceChart;