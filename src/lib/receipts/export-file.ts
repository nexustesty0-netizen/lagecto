import { maxWidthForSize, resolveReceiptTheme, type ReceiptView } from "@/lib/receipts";
import { buildReceiptHtml } from "@/lib/receipts/templates";

function safeFileName(value: string) {
  return String(value || "receipt")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "receipt";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Unable to read this image.");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function jpegToPdf(jpeg: Uint8Array, widthPx: number, heightPx: number) {
  const imgW = Math.max(1, Math.round(widthPx));
  const imgH = Math.max(1, Math.round(heightPx));
  const pageW = Math.min(595, Math.round(imgW * 0.75));
  const pageH = Math.max(1, Math.round(imgH * (pageW / imgW)));
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const write = (data: string | Uint8Array) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const offsets: number[] = [];
  const obj = (n: number, body: string) => {
    offsets[n] = offset;
    write(`${n} 0 obj\n${body}\nendobj\n`);
  };

  write("%PDF-1.4\n%\x80\x80\x80\x80\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offsets[4] = offset;
  write(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  write(jpeg);
  write("\nendstream\nendobj\n");
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = offset;
  write("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i += 1) {
    write(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  const out = new Uint8Array(offset);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  return out;
}

async function waitForImages(doc: Document) {
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

async function renderReceiptNode(receipt: ReceiptView) {
  const theme = resolveReceiptTheme(receipt.shop_details);
  const width = maxWidthForSize(theme.size);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: `${width}px`,
    height: "200px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    throw new Error("Unable to prepare this receipt.");
  }
  doc.open();
  doc.write(buildReceiptHtml(receipt));
  doc.close();
  await waitForImages(doc);
  const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 400);
  iframe.style.height = `${height}px`;
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  return { iframe, node: doc.body, width, height };
}

async function rasterize(node: HTMLElement, kind: "png" | "jpeg", backgroundColor: string) {
  const htmlToImage = await import("html-to-image");
  const options = {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor,
    width: Math.max(node.scrollWidth, node.clientWidth),
    height: Math.max(node.scrollHeight, node.clientHeight),
  };
  return kind === "png" ? htmlToImage.toPng(node, options) : htmlToImage.toJpeg(node, { ...options, quality: 0.95 });
}

async function captureReceipt(receipt: ReceiptView, kind: "png" | "jpeg") {
  const backgroundColor = resolveReceiptTheme(receipt.shop_details).paper;
  const { iframe, node } = await renderReceiptNode(receipt);
  try {
    return await rasterize(node, kind, backgroundColor);
  } catch {
    iframe.remove();
    const live = document.querySelector("[data-receipt-paper]");
    if (live instanceof HTMLElement) return rasterize(live, kind, backgroundColor);
    throw new Error("Unable to capture this receipt.");
  } finally {
    iframe.remove();
  }
}

export async function saveReceiptAsImage(receipt: ReceiptView) {
  const dataUrl = await captureReceipt(receipt, "png");
  const bytes = dataUrlToBytes(dataUrl);
  downloadBlob(new Blob([bytes], { type: "image/png" }), `${safeFileName(receipt.receipt_number)}.png`);
}

export async function saveReceiptAsPdf(receipt: ReceiptView) {
  const dataUrl = await captureReceipt(receipt, "jpeg");
  const jpeg = dataUrlToBytes(dataUrl);
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const pdf = jpegToPdf(jpeg, image.naturalWidth || image.width, image.naturalHeight || image.height);
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `${safeFileName(receipt.receipt_number)}.pdf`);
}
