import axios, { AxiosInstance, AxiosResponse } from "axios";
import { Cookie } from "../utils/interfaces";
import crypto from "crypto";

export class iCloudHME {
  private session: AxiosInstance;
  private sessionV2: AxiosInstance;

  constructor(cookies: Cookie[]) {
    const cookieString = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join(";");

    const userCookie = cookies.find((c) => c.name === "X-APPLE-WEBAUTH-USER");
    let dsid = "";
    if (userCookie) {
      const match = userCookie.value.match(/d=(\d+)/);
      if (match) dsid = match[1];
    }

    const clientId = crypto.randomUUID();

    const commonHeaders = {
      Origin: "https://www.icloud.com",
      Referer: "https://www.icloud.com/",
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      Cookie: cookieString,
    };

    const commonParams = {
      clientBuildNumber: "2624Build22",
      clientMasteringNumber: "2624Build22",
      clientId: clientId,
      dsid: dsid,
    };

    this.session = axios.create({
      baseURL: "https://p121-maildomainws.icloud.com/v1/hme",
      responseType: "json",
      validateStatus: null,
      headers: {
        ...commonHeaders,
        "Content-Type": "text/plain",
      },
      params: commonParams,
    });

    this.sessionV2 = axios.create({
      baseURL: "https://p123-maildomainws.icloud.com/v2/hme",
      responseType: "json",
      validateStatus: null,
      headers: commonHeaders,
      params: commonParams,
    });
  }

  public async generateEmail(): Promise<string> {
    try {
      const response: AxiosResponse = await this.session.post(
        "/generate",
        JSON.stringify({ langCode: "en-us" })
      );
      
      console.log("Status:", response.status);
      console.log("Response:", JSON.stringify(response.data, null, 2));
      
      if (!response.data.result) {
        console.error("Error: result tidak ada dalam respons");
        if (response.data.error) {
          console.error("Error code:", response.data.error.errorCode);
          console.error("Error message:", response.data.error.errorMessage);
          throw new Error(`iCloud API Error: ${response.data.error.errorMessage}`);
        }
        throw new Error("Struktur respons tidak sesuai harapan");
      }
      
      return response.data.result.hme;
    } catch (error: any) {
      console.error("Error pada generateEmail:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }

  public async claimEmail(email: string, label: string = "DZ GEN") {
    const response = await this.session.post(
      "/reserve",
      JSON.stringify({ hme: email, label: label, note: "" })
    );
    return response.data;
  }

  public async listEmails() {
    try {
      const response = await this.sessionV2.get("/list");
      console.log("List Status:", response.status);
      return response.data;
    } catch (error: any) {
      console.error("Error pada listEmails:", error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }

  public async deactivateEmail(anonymousId: string) {
    try {
      console.log(`Menonaktifkan email dengan anonymousId: ${anonymousId}`);
      
      const response = await this.session.post(
        "/deactivate",
        JSON.stringify({ anonymousId: anonymousId })
      );
      
      console.log("Deactivate Status:", response.status);
      return response.data;
    } catch (error: any) {
      console.error(`Error saat menonaktifkan email ${anonymousId}:`, error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }

  public async activateEmail(anonymousId: string) {
    try {
      console.log(`Mengaktifkan email dengan anonymousId: ${anonymousId}`);
      
      const response = await this.session.post(
        "/reactivate",
        JSON.stringify({ anonymousId: anonymousId })
      );
      
      console.log("Reactivate Status:", response.status);
      return response.data;
    } catch (error: any) {
      console.error(`Error saat mengaktifkan email ${anonymousId}:`, error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }

  public async deleteEmail(anonymousId: string) {
    try {
      console.log(`Menghapus email dengan anonymousId: ${anonymousId}`);
      
      console.log("Langkah 1: Menonaktifkan email terlebih dahulu...");
      const deactivateResult = await this.deactivateEmail(anonymousId);
      console.log("Deactivate response:", JSON.stringify(deactivateResult, null, 2));
      
      console.log("Langkah 2: Menghapus email...");
      const response = await this.session.post(
        "/delete",
        JSON.stringify({ anonymousId: anonymousId })
      );
      
      console.log("Delete Status:", response.status);
      console.log("Delete Response:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error(`Error saat menghapus email ${anonymousId}:`, error.message);
      if (error.response) {
        console.error("Response data:", error.response.data);
      }
      throw error;
    }
  }
}

