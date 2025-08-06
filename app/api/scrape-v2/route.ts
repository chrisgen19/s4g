import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export const runtime = 'nodejs';

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

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.text();
}

async function scrapeDetailedPage(url: string): Promise<ProductData | null> {
  
  // --- NEW HELPER FUNCTION FOR CLEANING PRICE ---
  const cleanPrice = (priceStr: string): string => {
    if (!priceStr) return '';

    const lowerCasePrice = priceStr.toLowerCase();

    // Rule 3: Handle "Ask for Price" or similar text
    if (lowerCasePrice.includes('ask') || !/\d/.test(lowerCasePrice)) {
      return '';
    }

    let processedPrice = priceStr;

    // Rule 2: Handle price ranges like "$12,000 - $14,500"
    if (processedPrice.includes('-')) {
      const parts = processedPrice.split('-');
      processedPrice = parts[1] || ''; // Take the part after the hyphen
    }

    // Rule 1: Remove all non-numeric characters ($, AUD, commas)
    const finalPrice = processedPrice.replace(/[^0-9]/g, '');
    
    return finalPrice;
  };

  try {
    console.log(`  Fetching: ${url}`);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const productName = $('h1.list-title').text().trim() || 'N/A';
    
    // Step 1: Extract the raw price text
    let rawPrice = 'N/A';
    const priceElement = $('span.price_normal b').first();
    if (priceElement.length > 0) {
      rawPrice = priceElement.text().trim();
    } else {
      const altPriceElement = $('span.price_gstex b').first();
      if (altPriceElement.length > 0) {
        rawPrice = altPriceElement.text().trim();
      } else {
        const containerPrice = $('.price_container').first().text().trim();
        rawPrice = containerPrice || 'N/A';
      }
    }
    
    // Step 2: Clean the raw price using our new function
    const finalCleanedPrice = cleanPrice(rawPrice);
    
    const sellerName = $('.business-name').text().trim() || 'N/A';

    let location = 'N/A';
    const locationElement = $('a[onclick="showAdvertMap()"]');
    if (locationElement.length > 0) {
      const fullLocationText = locationElement.text().trim();
      const locationParts = fullLocationText.split(',');
      location = locationParts.length > 1 ? locationParts[locationParts.length - 1].trim() : fullLocationText;
    }

    const details: { [key: string]: string } = {
      'Condition': 'N/A',
      'Make': 'N/A',
      'Model': 'N/A',
      'Year': 'N/A',
    };

    $('.ad_det_children').each((index, element) => {
      const $element = $(element);
      const label = $element.text().trim().replace(':', '');
      
      if (details.hasOwnProperty(label)) {
        const $next = $element.next('.ad_det_children');
        if ($next.length > 0) {
          details[label] = $next.text().trim();
        }
      }
    });

    console.log(`  ✓ Scraped: ${productName}`);

    return {
      "Brand": details.Make,
      "Model": details.Model,
      "Condition": details.Condition,
      "Location": location,
      "Seller": sellerName,
      "Year": details.Year,
      "Price": finalCleanedPrice, // <-- USE THE CLEANED PRICE
      "URL": url,
      "AD Title": productName
    };
  } catch (error) {
    console.error(`  ✗ Error scraping ${url}:`, error);
    return null;
  }
}

// The main POST function remains the same, no changes needed here.
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log('Starting scrape for:', url);
    
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    const productUrls: string[] = [];
    let foundListingsSection = false;
    let stopCollecting = false;
    
    $('.col-md-9.col-sm-9.col-xs-12.search-right-column.view-type-1').find('*').each((index, element) => {
      const $el = $(element);
      
      if ($el.hasClass('search-right-head-panel')) {
        const sectionText = $el.text().trim();
        console.log(`Found section: "${sectionText}"`);
        
        if (sectionText === 'Listings' || sectionText.includes('Search Results')) {
          foundListingsSection = true;
          stopCollecting = false;
        } else if (foundListingsSection && (sectionText.includes('Other') || sectionText === 'Spotlight Ads')) {
          stopCollecting = true;
        }
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
    console.log(`Found ${uniqueUrls.length} unique products to scrape`);
    
    if (uniqueUrls.length === 0) {
      return NextResponse.json({
        error: "No products found in the Listings section",
        success: false,
        products: []
      });
    }
    
    console.log('Starting detailed scraping...');
    const allData: ProductData[] = [];
    
    for (let i = 0; i < uniqueUrls.length; i++) {
      console.log(`\nProduct ${i + 1}/${uniqueUrls.length}:`);
      const data = await scrapeDetailedPage(uniqueUrls[i]);
      if (data) {
        allData.push(data);
      }
      
      if (i < uniqueUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`\n✓ Scraping complete! Successfully scraped ${allData.length} products`);
    
    return NextResponse.json({
      success: true,
      count: allData.length,
      products: allData
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to scrape the website',
        success: false,
        products: []
      },
      { status: 500 }
    );
  }
}