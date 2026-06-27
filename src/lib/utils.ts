import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
/**
 * Obfuscate a string by replacing all but the first 3 characters with asterisks
 * @param str
 * @returns
 */
export const obfuscate = (str: string | null) => {
  return str ? str.slice(0, 3) + "****" + str.slice(-4) : "";
};
