import { time } from "console";

// Helper function to shorten address
export const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper function to convert hex to decimal and format it
export const formatAmount = (hex: string) => {
    const decimal = parseInt(hex, 16);
    return decimal.toString();
};

// Convert timestamp to date
export function convertTimestampToDate(timestamp: number): string {
    console.log("timestamp:",  timestamp)
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }