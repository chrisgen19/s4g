import { NextRequest } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'edge'; // Use Edge Runtime for streaming

interface ProductData {
  Brand: string;
  Model: string;
  Condition: string;
  Location: string;
  Seller: string;
  Year: string;
  Price: string;
  URL: string;
  "AD Title": string;
}

// The fetchPage and scrapeDetailedPage functions remain mostly the same
async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.text();
}

async function scrapeDetailedPage(url: string): Promise<ProductData | null> {
  const cleanPrice = (priceStr: string): string => {
    if (!priceStr) return '';
    const lowerCasePrice = priceStr.toLowerCase();
    if (lowerCasePrice.includes('ask') || !/\d/.test(lowerCasePrice)) return '';
    let processedPrice = priceStr;
    if (processedPrice.includes('-')) {
      const parts = processedPrice.split('-');
      processedPrice = parts[1] || '';
    }
    return processedPrice.replace(/[^0-9]/g, '');
  };

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    const productName = $('h1.list-title').text().trim() || 'N/A';
    let rawPrice = 'N/A';
    const priceElement = $('span.price_normal b').first();
    if (priceElement.length > 0) rawPrice = priceElement.text().trim();
    else {
      const altPriceElement = $('span.price_gstex b').first();
      if (altPriceElement.length > 0) rawPrice = altPriceElement.text().trim();
      else rawPrice = $('.price_container').first().text().trim() || 'N/A';
    }
    const finalCleanedPrice = cleanPrice(rawPrice);
    const sellerName = $('.business-name').text().trim() || 'N/A';
    let location = 'N/A';
    const locationElement = $('a[onclick="showAdvertMap()"]');
    if (locationElement.length > 0) {
      const fullLocationText = locationElement.text().trim();
      const locationParts = fullLocationText.split(',');
      location = locationParts.length > 1 ? locationParts[locationParts.length - 1].trim() : fullLocationText;
    }
    const details: { [key: string]: string } = { 'Condition': 'N/A', 'Make': 'N/A', 'Model': 'N/A', 'Year': 'N/A' };
    $('.ad_det_children').each((index, element) => {
      const $element = $(element);
      const label = $element.text().trim().replace(':', '');
      if (details.hasOwnProperty(label)) {
        const $next = $element.next('.ad_det_children');
        if ($next.length > 0) details[label] = $next.text().trim();
      }
    });
    return { "Brand": details.Make, "Model": details.Model, "Condition": details.Condition, "Location": location, "Seller": sellerName, "Year": details.Year, "Price": finalCleanedPrice, "URL": url, "AD Title": productName };
  } catch (error) {
    console.error(`Error scraping detail page ${url}:`, error);
    return null;
  }
}

// This is now a GET handler that streams responses
export async function GET(req: NextRequest) {
  const urlToScrape = req.nextUrl.searchParams.get('url');
  if (!urlToScrape) {
    return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send events to the client
      const sendEvent = (eventName: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${eventName}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        sendEvent('status', { message: 'Starting scrape for: ' + urlToScrape });
        const html = await fetchPage(urlToScrape);
        const $ = cheerio.load(html);

        const productUrls: string[] = [];
        let foundListingsSection = false;
        let stopCollecting = false;

        $('.col-md-9.col-sm-9.col-xs-12.search-right-column.view-type-1').find('*').each((index, element) => {
          const $el = $(element);
          if ($el.hasClass('search-right-head-panel')) {
            const sectionText = $el.text().trim();
            if (sectionText === 'Listings' || sectionText.includes('Search Results')) { foundListingsSection = true; stopCollecting = false; }
            else if (foundListingsSection) { stopCollecting = true; }
          }
          if (foundListingsSection && !stopCollecting && $el.hasClass('equip_link')) {
            const href = $el.attr('href');
            if (href) {
              const fullUrl = href.startsWith('http') ? href : `https://www.machines4u.com.au${href}`;
              productUrls.push(fullUrl);
            }
          }
        });
        
        const uniqueUrls = [...new Set(productUrls)];
        sendEvent('status', { message: `Found ${uniqueUrls.length} unique products to scrape. Starting detail scraping...` });

        if (uniqueUrls.length === 0) {
          sendEvent('error', { message: "No products found in the Listings section" });
          controller.close();
          return;
        }

        for (let i = 0; i < uniqueUrls.length; i++) {
          sendEvent('status', { message: `Scraping product ${i + 1}/${uniqueUrls.length}...` });
          const data = await scrapeDetailedPage(uniqueUrls[i]);
          if (data) {
            sendEvent('product', data); // Send each product as it's scraped
          }
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
        }

        sendEvent('done', { message: `Scraping complete! Successfully scraped ${uniqueUrls.length} products.` });
        controller.close();

      } catch (error) {
        console.error('Scraping error:', error);
        sendEvent('error', { message: error instanceof Error ? error.message : 'A fatal error occurred.' });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}