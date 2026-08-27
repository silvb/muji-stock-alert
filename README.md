# muji-stock-alert

Watches the [MUJI Herren Heavyweight T-Shirt aus Jersey](https://germany.muji.eu/products/Mens-Thick-Jersey-Short-Sleeve-Tshirt-P-AB1PN-F-000000)
and sends a push notification via [ntfy.sh](https://ntfy.sh) when a watched
variant comes back in stock.

**Watched:** Rauchblau (smoky blue), size L — SKU `4548076182146`
(edit `WATCHED_VARIANTS` in `check.js` to change).

## How it works

- A GitHub Actions cron job runs `check.js` every 15 minutes.
- MUJI runs on BigCommerce, so there is no Shopify-style `.js` endpoint.
  Instead the script reads the JSON-LD `ProductGroup` embedded in the product
  page, which lists every variant with its schema.org availability.
- On a sold-out → in-stock transition it POSTs to `https://ntfy.sh/$NTFY_TOPIC`.
- `state.json` records the last seen availability so you only get notified
  once per restock, not every 15 minutes.

Rauchblau is hidden from the colour swatches on the site while every size is
sold out, but the variants are still in the catalog — which is what a
restockable item looks like rather than a discontinued one. If the SKU ever
disappears from the JSON-LD entirely, the run logs `no longer listed`.

## Setup

1. Install the [ntfy app](https://ntfy.sh/app) (or use the web app) and
   subscribe to the topic stored in the `NTFY_TOPIC` repo secret.
2. That's it — the workflow runs on its own. Trigger it manually from the
   Actions tab ("Check MUJI stock" → Run workflow) to test.

## Run locally

```sh
NTFY_TOPIC=your-topic node check.js
```
