import { readFileSync } from "node:fs";

export interface ArCorpus {
  version: number;
  description: string;
  names: string[];
  phones: string[];
  prices: { text: string; amount: number; currency: "SAR" | "AED" }[];
  dates: { text: string; calendar: "hijri" | "gregorian" }[];
  addresses: string[];
  urls: string[];
  codeSwitched: string[];
  diacritics: string[];
}

/** Path of the Arabic fixture corpus JSON inside the installed package. */
export const corpusPath = new URL("../../fixtures/ar-corpus.json", import.meta.url);

/** The Arabic fixture corpus, for use in your own tests. */
export const corpus: ArCorpus = JSON.parse(readFileSync(corpusPath, "utf8"));
