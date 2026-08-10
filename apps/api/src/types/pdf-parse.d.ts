declare module "pdf-parse" {
  interface PdfParseData {
    text: string;
    numpages: number;
    info: unknown;
    metadata: unknown;
    version: string;
  }
  function pdfParse(buffer: Buffer, options?: Record<string, unknown>): Promise<PdfParseData>;
  export default pdfParse;
}
