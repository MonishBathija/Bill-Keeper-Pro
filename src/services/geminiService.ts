import { GoogleGenAI, Type } from "@google/genai";
import { BillFormData, BillStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const geminiService = {
  extractBillData: async (base64Image: string, mimeType: string): Promise<BillFormData[]> => {
    const prompt = `Extracted all bill entries from this image. Many bills have multiple line items or entries. Extract EACH row/entry separately:
    1. Bill Number (use the invoice number for all rows if it's a single invoice with multiple items, or individual numbers if multiple bills are visible)
    2. Party Name (the customer or vendor name)
    3. Date (the date of the document)
    4. Amount (the amount for this specific entry/line)
    5. Status (paid or unpaid)`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: mimeType,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              billNumber: { type: Type.STRING },
              partyName: { type: Type.STRING },
              date: { type: Type.STRING, description: "ISO date string YYYY-MM-DD" },
              amount: { type: Type.NUMBER },
              status: { type: Type.STRING, enum: ["paid", "unpaid"] },
            },
            required: ["billNumber", "partyName", "date", "amount", "status"],
          }
        },
      },
    });

    try {
      const entries = JSON.parse(response.text);
      return entries.map((data: any) => ({
        billNumber: data.billNumber || "UNKNOWN",
        partyName: data.partyName || "Unknown Party",
        date: data.date || new Date().toISOString().split('T')[0],
        amount: data.amount || 0,
        status: data.status === 'paid' ? BillStatus.PAID : BillStatus.UNPAID
      }));
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      return [];
    }
  }
};
