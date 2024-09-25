// tokenPriceUtils.ts

import axios from 'axios';

export type TokenPriceData = {
  [contractAddress: string]: {
    [currency: string]: number;
  };
};

const API_BASE_URL = 'https://pro-api.coingecko.com/api/v3';
const API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '';

if (!API_KEY) {
  console.warn('CoinGecko API key is not set. Some features may not work correctly.');
}

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'x-cg-pro-api-key': API_KEY
  }
});

export async function fetchTokenPrice(contractAddress: string, currency: string = 'usd'): Promise<number | null> {
  try {
    const response = await axiosInstance.get<TokenPriceData>(
      `/simple/token_price/starknet?contract_addresses=${contractAddress}&vs_currencies=${currency}`
    );

    const price = response.data[contractAddress][currency];
    return price;
  } catch (error) {
    console.error('Error fetching token price:', error);
    throw new Error('Error fetching token price');
  }
}

export async function fetchHistoricalData(contractAddress: string, days: number = 7, currency: string = 'usd'): Promise<[number, number][]> {
  try {
    const response = await axiosInstance.get(
      `/coins/starknet/contract/${contractAddress}/market_chart/?vs_currency=${currency}&days=${days}`
    );

    return response.data.prices;
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw new Error('Error fetching historical data');
  }
}