import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

interface PriceChartProps {
  currentPrice: number;
  priceChange: number;
  chartData: { time: string; price: number }[];
  startPrice: number;
  endPrice: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({ currentPrice, priceChange, chartData, startPrice, endPrice }) => {
  const formatPrice = (price: number) => price.toFixed(2);
  const priceChangeColor = priceChange >= 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div>
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
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="time"
              stroke="#6b7280"
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              stroke="#6b7280"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              domain={['dataMin - 1', 'dataMax + 1']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#22c55e"
              dot={false}
              strokeWidth={2}
            />
            <ReferenceLine
              x={chartData[0].time}
              stroke="#6b7280"
              label={{ value: 'Start', fill: '#6b7280', fontSize: 12 }}
            />
            <ReferenceLine
              x={chartData[chartData.length - 1].time}
              stroke="#6b7280"
              label={{ value: 'End', fill: '#6b7280', fontSize: 12 }}
            />
            <ReferenceLine
              y={startPrice}
              stroke="#6b7280"
              strokeDasharray="3 3"
              label={{ value: `$${formatPrice(startPrice)}`, position: 'left', fill: '#6b7280', fontSize: 12 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};