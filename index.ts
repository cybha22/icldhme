import readline from "readline";
import { Cookie, EmailInfo } from "./utils/interfaces";
import { iCloudHME } from "./modules/icloud";
import { sleepMs, logEmailToFile } from "./utils/functions";
import fs from "fs";
import path from "path";

const cookiesFile = process.env.COOKIES_FILE || "cookies.json";

const deriveOutputFile = (cookieFileName: string): string => {
  const base = path.basename(cookieFileName, ".json");
  if (base === "cookies") return "emails.txt";
  const name = base.replace(/_cookies$/, "");
  return `emails-${name}.txt`;
};

const outputFile = deriveOutputFile(cookiesFile);

console.log(`[CONFIG] Cookies: ${cookiesFile}`);
console.log(`[CONFIG] Output: ${outputFile}`);

const cookies: Cookie[] = JSON.parse(fs.readFileSync(`./${cookiesFile}`, "utf8"));
const iCloud = new iCloudHME(cookies);

const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const generateEmails = async (amount: number, allowDot: boolean) => {
  let counter = 0;
  while (counter < amount) {
    console.log(`[${counter}/${amount}] Generating email...`);

    let email = "";
    let isClean = false;
    
    while (!isClean) {
      email = await iCloud.generateEmail();
      if (!email) {
        console.log(`[${counter}/${amount}] Failed to generate email. Retrying...`);
        await sleepMs(1000);
        continue;
      }
      
      const prefix = email.split('@')[0];
      if (!allowDot && prefix.includes('.')) {
        console.log(`[${counter}/${amount}] Dapat email dengan titik (${email}), skip...`);
        await sleepMs(500);
      } else {
        isClean = true;
      }
    }

    const claimResult = await iCloud.claimEmail(email);
    if (!claimResult.success) {
      console.log(
        `[${counter}/${amount}] Failed to claim email ${email}, reason: ${claimResult.error.errorMessage}`
      );

      if (claimResult.error.errorCode === "-41015") {
        console.log(
          `[${counter}/${amount}] Reached limit, waiting 20 minutes for reset...`
        );
        await sleepMs(20 * 60 * 1000);
      }
      continue;
    }

    await logEmailToFile(email, outputFile);
    counter++;
    console.log(`[${counter}/${amount}] Generated email ${email}`);
  }
};

const listEmails = async () => {
  const emails = await iCloud.listEmails();
  const activeEmails = emails.result.hmeEmails
    .filter((email: EmailInfo) => email.isActive)
    .map((email: EmailInfo) => email.hme);
  for (const email of activeEmails) {
    console.log(email);
  }
};

const manageEmails = async () => {
  const emails = await iCloud.listEmails();
  if (!emails.success || !emails.result || !emails.result.hmeEmails) {
    console.log("Gagal mendapatkan daftar email");
    return;
  }

  console.log("\n=== Daftar Email ===");
  const hmeEmails = emails.result.hmeEmails;
  
  hmeEmails.forEach((email: EmailInfo, index: number) => {
    console.log(`[${index}] ${email.hme} - Label: ${email.label} - Status: ${email.isActive ? 'Aktif' : 'Nonaktif'} - ID: ${email.anonymousId}`);
  });
  
  prompt.question("\n[?] Pilih nomor email untuk dikelola: ", async (emailIndex) => {
    const index = parseInt(emailIndex);
    if (isNaN(index) || index < 0 || index >= hmeEmails.length) {
      console.log("Nomor email tidak valid");
      mainMenu();
      return;
    }

    const selectedEmail = hmeEmails[index];
    console.log(`\nEmail dipilih: ${selectedEmail.hme}`);
    console.log("1. Aktifkan email");
    console.log("2. Nonaktifkan email");
    console.log("3. Hapus email");
    console.log("4. Kembali");

    prompt.question("\n[?] Pilih tindakan: ", async (action) => {
      try {
        switch (action) {
          case "1":
            if (!selectedEmail.isActive) {
              const result = await iCloud.activateEmail(selectedEmail.anonymousId);
              if (result.success) {
                console.log(`Email ${selectedEmail.hme} berhasil diaktifkan`);
              }
            } else {
              console.log("Email sudah aktif");
            }
            break;
          case "2":
            if (selectedEmail.isActive) {
              const result = await iCloud.deactivateEmail(selectedEmail.anonymousId);
              if (result.success) {
                console.log(`Email ${selectedEmail.hme} berhasil dinonaktifkan`);
              }
            } else {
              console.log("Email sudah nonaktif");
            }
            break;
          case "3":
            const confirmDelete = await new Promise<string>((resolve) => {
              prompt.question(`\n[!] Yakin ingin menghapus email ${selectedEmail.hme}? (y/n): `, resolve);
            });
            
            if (confirmDelete.toLowerCase() === "y") {
              const result = await iCloud.deleteEmail(selectedEmail.anonymousId);
              if (result.success) {
                console.log(`Email ${selectedEmail.hme} berhasil dihapus`);
              }
            } else {
              console.log("Penghapusan dibatalkan");
            }
            break;
          case "4":
            console.log("Kembali ke menu utama");
            break;
          default:
            console.log("Pilihan tidak valid");
        }
      } catch (error) {
        console.error("Terjadi kesalahan:", (error as any).message);
      } finally {
        mainMenu();
      }
    });
  });
};

const mainMenu = () => {
  prompt.question(
    "\n[?] Apa yang ingin Anda lakukan? (1. Generate Emails, 2. List All Emails, 3. Kelola Email, 4. Keluar) ",
    async (answer) => {
      switch (answer) {
        case "1":
          prompt.question(
            "[?] Izinkan titik (.) pada email? (y/n, default: n): ",
            async (dotAnswer) => {
              const allowDot = dotAnswer.toLowerCase() === "y";
              prompt.question(
                "[?] Berapa banyak email yang ingin Anda hasilkan? ",
                async (amount) => {
                  await generateEmails(parseInt(amount), allowDot);
                  mainMenu();
                }
              );
            }
          );
          break;
        case "2":
          await listEmails();
          mainMenu();
          break;
        case "3":
          await manageEmails();
          break;
        case "4":
          console.log("Keluar dari program.");
          prompt.close();
          break;
        default:
          console.log("Pilihan tidak valid");
          mainMenu();
      }
    }
  );
};

const autoMode = process.env.MODE;

if (autoMode === "generate") {
  const amount = parseInt(process.env.AMOUNT || "5");
  const allowDot = (process.env.ALLOW_DOT || "n").toLowerCase() === "y";
  console.log(`[AUTO] Generating ${amount} emails (allowDot: ${allowDot})...`);
  generateEmails(amount, allowDot).then(() => {
    console.log("[AUTO] Selesai.");
    process.exit(0);
  });
} else if (autoMode === "list") {
  listEmails().then(() => process.exit(0));
} else {
  mainMenu();
}
