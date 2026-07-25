import { Cookie } from "./utils/interfaces";
import { iCloudHME } from "./modules/icloud";
import { sleepMs, logEmailToFile } from "./utils/functions";
import fs from "fs";
import path from "path";

let cliFile: string | undefined;
let cliAmount: string | undefined;

if (process.argv[2]) {
  if (isNaN(parseInt(process.argv[2]))) {
    cliFile = process.argv[2];
    cliAmount = process.argv[3];
  } else {
    cliAmount = process.argv[2];
  }
}

const findCookieFiles = (): string[] => {
  const targetFile = process.env.COOKIE_FILE || cliFile;
  if (targetFile) {
    if (fs.existsSync(targetFile)) {
      return [targetFile];
    }
    console.log(`File ${targetFile} tidak ditemukan.`);
    process.exit(1);
  }

  const files = fs.readdirSync("./").filter((f) => f.endsWith("_cookies.json"));
  if (files.length > 0) {
    return files;
  }
  if (fs.existsSync("cookies.json")) {
    return ["cookies.json"];
  }
  return [];
};

const deriveOutputFile = (cookieFileName: string): string => {
  const base = path.basename(cookieFileName, ".json");
  if (base === "cookies") {
    return "emails.txt";
  }
  const name = base.replace(/_cookies$/, "");
  return `emails-${name}.txt`;
};

const generateEmails = async (
  iCloud: iCloudHME,
  amount: number,
  allowDot: boolean,
  outputFile: string,
  label: string
) => {
  let counter = 0;
  while (counter < amount) {
    console.log(`[${label}] [${counter}/${amount}] Generating email...`);

    let email = "";
    let isClean = false;

    while (!isClean) {
      email = await iCloud.generateEmail();
      if (!email) {
        console.log(`[${label}] [${counter}/${amount}] Failed to generate email. Retrying...`);
        await sleepMs(1000);
        continue;
      }

      const prefix = email.split("@")[0];
      if (!allowDot && prefix.includes(".")) {
        console.log(`[${label}] [${counter}/${amount}] Dapat email dengan titik (${email}), skip...`);
        await sleepMs(500);
      } else {
        isClean = true;
      }
    }

    const claimResult = await iCloud.claimEmail(email);
    if (claimResult && (claimResult.reason === "Invalid global session" || claimResult.error === 2)) {
      throw new Error("Cookie kadaluarsa / Invalid global session! Silakan perbarui file cookies.");
    }

    if (!claimResult.success) {
      console.log(
        `[${label}] [${counter}/${amount}] Failed to claim: ${claimResult.error?.errorMessage || "Unknown error"}`
      );

      if (claimResult.error?.errorCode === "-41015") {
        console.log(`[${label}] [${counter}/${amount}] Reached limit, waiting 20 minutes...`);
        await sleepMs(20 * 60 * 1000);
      }
      continue;
    }

    await logEmailToFile(email, outputFile);
    counter++;
    console.log(`[${label}] [${counter}/${amount}] Generated email ${email}`);
  }
};

const runAllAccounts = async () => {
  const cookieFiles = findCookieFiles();

  if (cookieFiles.length === 0) {
    console.log("Tidak ada file *_cookies.json ditemukan.");
    process.exit(1);
  }

  const amount = parseInt(process.env.AMOUNT || cliAmount || "5");
  const allowDot = (process.env.ALLOW_DOT || "y").toLowerCase() === "y";

  console.log(`Ditemukan ${cookieFiles.length} akun:`);
  cookieFiles.forEach((f) => console.log(`  - ${f} -> ${deriveOutputFile(f)}`));
  console.log(`Amount: ${amount}, AllowDot: ${allowDot}\n`);

  const tasks = cookieFiles.map(async (file) => {
    const label = path.basename(file, ".json").replace(/_cookies$/, "");
    const outputFile = deriveOutputFile(file);
    const cookies: Cookie[] = JSON.parse(fs.readFileSync(`./${file}`, "utf8"));
    const iCloud = new iCloudHME(cookies);

    try {
      await generateEmails(iCloud, amount, allowDot, outputFile, label);
      console.log(`[${label}] Selesai.`);
    } catch (err: any) {
      console.error(`[${label}] Error: ${err.message}`);
    }
  });

  await Promise.all(tasks);
  console.log("\nSemua akun selesai.");
  process.exit(0);
};

runAllAccounts();
