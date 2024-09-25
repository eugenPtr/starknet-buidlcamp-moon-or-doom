"use client";  // This tells Next.js this component is a Client Component

import React, { useEffect, useState } from 'react';
import axios from 'axios';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';


// Function to convert the timestamp array to a formatted date array
const formatData = (data: [number, number][]): any[] => {
  debugger;
  return data.map(item => ({
    // date: new Date(item[0]).toLocaleString(), // Convert timestamp to readable date
    date: item[0], // Convert timestamp to readable date
    price: item[1]
  }));
};


const PriceChart = ({ tokenId = 'STRK', currency = 'usd' }) => {

    const [data, setChartData] = useState<any[] | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);  // Define error as a string or null

    useEffect(() => {

        const fetchTokenChart = async () => {
        try {
                setLoading(true);

                const currency = 'usd';
                const response = await axios.get(
                    `https://pro-api.coingecko.com/api/v3/coins/starknet/market_chart?vs_currency=${currency}&days=1&x_cg_pro_api_key=CG-dYFgmxYcU7L2XbAca3KHXL4S`
                );

                let data = formatData(response.data['prices']);
                data = data?.slice(-96); 

                console.log(data);

                setChartData(data);
            } catch (err) {
                setError('Error fetching chart data for token STRK ' + err);
            } finally {
                setLoading(false);
            }
        };


    fetchTokenChart();

    // Optionally, set up an interval to fetch the price regularly (e.g., every 90 seconds)
    const chartDataInterval = setInterval(fetchTokenChart, 90000);

    // Cleanup the interval on component unmount
    return () => {
        clearInterval(chartDataInterval);
    }
  }, [tokenId, currency]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  };

  return (
 
  <ResponsiveContainer width="100%" height={400} background-color='#0e1a2b'>
    <LineChart data={data} margin={{ top: 20, right: 50, left: 0, bottom: 20 }}>
      {/* Grid lines */}
      <CartesianGrid stroke="#2c3e50" strokeDasharray="3 3" />
      {/* X Axis */}
      <XAxis
        dataKey="date"
        tickFormatter={formatTimestamp}
        stroke="#d0d0d0"
        tick={{ fontSize: 12 }}
      />
      {/* Y Axis */}
      <YAxis
        stroke="#d0d0d0"
        tick={{ fontSize: 12 }}
        domain={["auto", "auto"]}
      />
      {/* Line for price */}
      <Line
        type="monotone"
        dataKey="price"
        stroke="#4caf50" // Green for uptrend
        strokeWidth={2}
        dot={false}
        isAnimationActive={true}
      />
      {/* Tooltip customization */}
      <Tooltip
        contentStyle={{ backgroundColor: "#2c3e50", border: "none", color: "#fff" }}
        labelFormatter={(label) => `Time: ${formatTimestamp(label)}`}
        formatter={(value: number) => [`Price: $${value.toFixed(6)}`, ""]}
      />
    </LineChart>
  </ResponsiveContainer>
  
  );
};


export default PriceChart;
