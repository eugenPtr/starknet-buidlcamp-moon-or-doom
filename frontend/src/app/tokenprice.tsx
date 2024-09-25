
"use client";  // This tells Next.js this component is a Client Component

import React, { useEffect, useState } from 'react';
import axios from 'axios';

const TokenPrice = ({ tokenId = 'STRK', currency = 'usd' }) => {
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);  // Define error as a string or null

  useEffect(() => {
    const fetchTokenPrice = async () => {
      try {
        setLoading(true);

        const currency = 'usd';
        const contractAddresses = '0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

        const response = await axios.get(
          `https://pro-api.coingecko.com/api/v3/simple/token_price/starknet?contract_addresses=${contractAddresses}&vs_currencies=${currency}&x_cg_pro_api_key=CG-dYFgmxYcU7L2XbAca3KHXL4S`
        );

        console.log(response.data[contractAddresses][currency]);
        
        setPrice(response.data[contractAddresses][currency]);
      } catch (err) {
        setError('Error fetching token price' + err);
      } finally {
        setLoading(false);
      }
    };


    fetchTokenPrice();

    // Optionally, set up an interval to fetch the price regularly (e.g., every 10 seconds)
    const tokenPriceInterval = setInterval(fetchTokenPrice, 10000);

    // Cleanup the interval on component unmount
    return () => {
        clearInterval(tokenPriceInterval);
    }
  }, [tokenId, currency]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <p>
        {price}
      </p>
    </div>
  );
};

export default TokenPrice;
