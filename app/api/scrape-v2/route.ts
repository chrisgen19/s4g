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
  try {
    console.log(`  Fetching: ${url}`);
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const productName = $('h1.list-title').text().trim() || 'N/A';
    
    // Fixed price extraction - get only the first price value
    let price = 'N/A';
    const priceElement = $('span.price_normal b').first();
    if (priceElement.length > 0) {
      price = priceElement.text().trim();
    } else {
      const altPriceElement = $('span.price_gstex b').first();
      if (altPriceElement.length > 0) {
        price = altPriceElement.text().trim();
      } else {
        const containerPrice = $('.price_container').first().text().trim();
        if (containerPrice) {
          // Extract just the price part, not labels like "Ex GST"
          const priceMatch = containerPrice.match(/\$[\d,]+/);
          price = priceMatch ? priceMatch[0] : containerPrice;
        }
      }
    }
    
    const sellerName = $('.business-name').text().trim() || 'N/A';

    // Location extraction
    let location = 'N/A';
    const locationElement = $('a[onclick="showAdvertMap()"]');
    if (locationElement.length > 0) {
      const fullLocationText = locationElement.text().trim();
      const locationParts = fullLocationText.split(',');
      if (locationParts.length > 1) {
        location = locationParts[locationParts.length - 1].trim();
      } else {
        location = fullLocationText;
      }
    }

    // Extract details
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
      "Price": price,
      "URL": url,
      "AD Title": productName
    };
  } catch (error) {
    console.error(`  ✗ Error scraping ${url}:`, error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log('Starting scrape for:', url);
    
    // Fetch the main listing page
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    // Find product URLs using a simpler approach
    const productUrls: string[] = [];
    let foundListingsSection = false;
    let stopCollecting = false;
    
    // Iterate through all elements in the main container
    $('.col-md-9.col-sm-9.col-xs-12.search-right-column.view-type-1').find('*').each((index, element) => {
      const $el = $(element);
      
      // Check for section headers
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
      
      // Collect product links if we're in the right section
      if (foundListingsSection && !stopCollecting && $el.hasClass('equip_link')) {
        const href = $el.attr('href');
        if (href) {
          const fullUrl = href.startsWith('http') ? href : `https://www.machines4u.com.au${href}`;
          productUrls.push(fullUrl);
        }
      }
    });
    
    // Remove duplicates
    const uniqueUrls = [...new Set(productUrls)];
    console.log(`Found ${uniqueUrls.length} unique products to scrape`);
    
    if (uniqueUrls.length === 0) {
      return NextResponse.json({
        error: "No products found in the Listings section",
        success: false,
        products: []
      });
    }
    
    // Scrape each product
    console.log('Starting detailed scraping...');
    const allData: ProductData[] = [];
    
    for (let i = 0; i < uniqueUrls.length; i++) {
      console.log(`\nProduct ${i + 1}/${uniqueUrls.length}:`);
      const data = await scrapeDetailedPage(uniqueUrls[i]);
      if (data) {
        allData.push(data);
      }
      
      // Add a small delay to avoid overwhelming the server
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