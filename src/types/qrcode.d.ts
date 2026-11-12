declare module "qrcode" {
  const QRCode: {
    toDataURL(text: string): Promise<string>;
    /** The encoded symbol; `segments` hold the text exactly as it goes into the QR code. */
    create(text: string): { segments: Array<{ data: string | Uint8Array }> };
  };

  export default QRCode;
}
