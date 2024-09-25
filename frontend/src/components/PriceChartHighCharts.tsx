import React, { useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface PriceChartProps {
  currentPrice: number;
  priceChange: number;
  chartData: { time: number; price: number }[];
}

export const PriceChartHighCharts: React.FC<PriceChartProps> = ({ currentPrice, priceChange, chartData }) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  const options: Highcharts.Options = {
    chart: {
      type: 'line',
      animation: Highcharts.svg,
      marginRight: 10,
      height: 400,
      backgroundColor: 'transparent',
    },
    title: {
      text: '',
    },
    xAxis: {
      type: 'datetime',
      tickPixelInterval: 150,
    },
    yAxis: {
      title: {
        text: 'Price',
      },
      plotLines: [{
        value: 0,
        width: 1,
        color: '#808080',
      }],
    },
    tooltip: {
      formatter: function () {
        return '<b>' + Highcharts.numberFormat(this.y as number, 2) + '</b><br/>' +
          Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x as number);
      },
    },
    legend: {
      enabled: false,
    },
    series: [{
      type: 'line',
      name: 'Price',
      data: chartData,
    }] as Highcharts.SeriesOptionsType[],
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