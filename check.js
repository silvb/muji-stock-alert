// Checks MUJI Germany stock for specific variants and pushes a notification
// via ntfy.sh when a watched variant comes back in stock.
//
// Requires: Node 18+ (native fetch), NTFY_TOPIC env var.

import { readFile, writeFile } from "node:fs/promises";

const PRODUCT_PAGE =
  "https://germany.muji.eu/products/Mens-Thick-Jersey-Short-Sleeve-Tshirt-P-AB1PN-F-000000";

const WATCHED_VARIANTS = [{ sku: "4548076182146", label: "Rauchblau L" }];

const STATE_FILE = new URL("./state.json", import.meta.url);

const topic = process.env.NTFY_TOPIC;
if (!topic) {
  console.error("NTFY_TOPIC env var is not set");
  process.exit(1);
}

async function loadState() {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function notify(labels) {
  const sizes = labels.join(", ");
  const res = await fetch(`https://ntfy.sh/${topic}`, {
    method: "POST",
    headers: {
      Title: `MUJI shirt back in stock: ${sizes}`,
      Priority: "urgent",
      Tags: "tada",
      Click: PRODUCT_PAGE,
    },
    body: `Herren Heavyweight T-Shirt aus Jersey is available in ${sizes}. Go go go!`,
  });
  if (!res.ok) throw new Error(`ntfy responded with ${res.status}`);
}

// MUJI runs on BigCommerce, so there is no Shopify-style .js endpoint. The
// product page does embed a JSON-LD ProductGroup listing every variant with
// its schema.org availability, which is the cleanest stock signal available.
function parseVariants(html) {
  const scripts = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  );
  for (const [, body] of scripts) {
    let data;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    if (data["@type"] === "ProductGroup" && Array.isArray(data.hasVariant)) {
      return data.hasVariant;
    }
  }
  throw new Error("No ProductGroup JSON-LD found — page layout may have changed");
}

const res = await fetch(PRODUCT_PAGE, {
  headers: {
    // MUJI's CDN serves an error page to unrecognised clients.
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
});
if (!res.ok) throw new Error(`MUJI responded with ${res.status}`);
const variants = parseVariants(await res.text());

const previous = await loadState();
const current = {};
const nowInStock = [];

for (const { sku, label } of WATCHED_VARIANTS) {
  const variant = variants.find((v) => v.sku === sku);
  if (!variant) {
    // The variant vanishing from the catalog means discontinued, not restocked.
    console.warn(`${label}: no longer listed`);
    current[label] = false;
    continue;
  }
  const available = variant.offers?.availability?.endsWith("InStock") ?? false;
  current[label] = available;
  console.log(`${label}: ${available ? "IN STOCK" : "sold out"}`);
  // Only alert on the sold-out -> in-stock transition, so a variant that
  // stays available doesn't ping every run.
  if (available && !previous[label]) nowInStock.push(label);
}

if (nowInStock.length > 0) {
  await notify(nowInStock);
  console.log(`Notified for: ${nowInStock.join(", ")}`);
}

if (JSON.stringify(current) !== JSON.stringify(previous)) {
  await writeFile(STATE_FILE, JSON.stringify(current, null, 2) + "\n");
  console.log("State updated");
}
