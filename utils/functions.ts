import { promises as fs } from "fs";

export const logEmailToFile = async (email: string, filePath: string = "emails.txt"): Promise<void> => {
  try {
    await fs.appendFile(filePath, email + "\n");
  } catch (err) {
    console.log(err);
  }
};

export const sleepMs = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
