// Renders the SVG icon to the PNG sizes the manifest needs, using the Playwright Chromium bundled in this repo's dev toolchain.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch();
const render = async (size, name, { maskable = false } = {}) => {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = maskable
    ? `<div style="width:${size}px;height:${size}px;background:#304A3B;display:flex;align-items:center;justify-content:center"><div style="width:${size * 0.7}px;height:${size * 0.7}px">${svg.replace(/<rect[^>]*\/>/, "")}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  await page.setContent(`<body style="margin:0">${inner}</body>`);
  await page.evaluate((s) => document.querySelectorAll("svg").forEach((e) => { e.setAttribute("width", s); e.setAttribute("height", s); }), String(maskable ? size * 0.7 : size));
  writeFileSync(`public/icons/${name}`, await page.screenshot({ type: "png", omitBackground: !maskable }));
  await page.close();
};
await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(180, "apple-touch-icon.png");
await render(512, "maskable-512.png", { maskable: true });
await browser.close();
console.log("icons written");
