import React, { useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface PriceChartProps {
  currentPrice: number;
  priceChange: number;
  chartData: { time: number; price: number }[];
}

const historicalData = [
    { time: new Date('15:45:35'), price: 2611.19 },
    { time: new Date('15:45:45'), price: 2611.30 },
    { time: new Date('15:45:50'), price: 2611.40 },
    { time: new Date('15:45:40'), price: 2611.25 },
    { time: new Date('15:45:55'), price: 2611.50 },
    { time: new Date('15:46:00'), price: 2611.70 },
    { time: new Date('15:46:05'), price: 2611.85 },
    { time: new Date('15:46:10'), price: 2611.80 },
    { time: new Date('15:46:15'), price: 2611.75 },
    { time: new Date('15:46:20'), price: 2611.60 },
    { time: new Date('15:46:25'), price: 2611.70 },
    { time: new Date('15:46:30'), price: 2611.85 },
    { time: new Date('15:46:35'), price: 2611.90 },
    { time: new Date('15:46:40'), price: 2611.94 },
  ];

export const PriceChartHighCharts: React.FC<PriceChartProps> = ({ currentPrice, priceChange, chartData }) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      animation: Highcharts.svg,
      marginRight: 10,
      events: {
        load: function () {
          // Set up the updating of the chart each second
          const series = this.series[0];
          setInterval(function () {
            const x = (new Date()).getTime(), // current time
              y = Math.random() * 100 + 3000; // random price between 3000 and 3100
            series.addPoint([x, y], true, true);
          }, 1000);
        }
      }
    },
    title: {
      text: 'ETH Price Chart'
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
      formatter: function () {
        return '<b>' + this.series.name + '</b><br/>' +
          Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x) + '<br/>' +
          Highcharts.numberFormat(this.y, 2);
      }
    },
    legend: {
      enabled: false
    },
    exporting: {
      enabled: true
    },
    series: [{
        name: 'ETH Price',
        data: historicalData
    }]
  };

  useEffect(() => {
    const chart = chartRef.current?.chart;
    if (chart) {
      const series = chart.series[0];
      const shift = series.data.length > 20;
      series.addPoint([Date.now(), currentPrice], true, shift);
    }
  }, [currentPrice]);

  const formatPrice = (price: number) => price.toFixed(2);
  const priceChangeColor = priceChange >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-4xl font-bold text-green-500">${formatPrice(currentPrice)}</h2>
        <div className={`flex items-center ${priceChangeColor}`}>
          {priceChange >= 0 ? (
            <ArrowUpIcon className="w-6 h-6 mr-2" />
          ) : (
            <ArrowDownIcon className="w-6 h-6 mr-2" />
          )}
          <span className="text-xl font-semibold">{Math.abs(priceChange).toFixed(2)}</span>
        </div>
      </div>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        ref={chartRef}
      />
    </div>
  );
};