declare module 'pdf-parse/lib/pdf-parse.js' {
  type PDFResult = { text: string; numpages: number; info: Record<string, unknown>; metadata: unknown; version: string }
  export default function parse(data: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PDFResult>
}
