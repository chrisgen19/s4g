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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.text();
}

async function scrapeDetailedPage(url: string): Promise<ProductData | null> {
  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const productName = $('h1.list-title').text().trim() || 'N/A';
    const price = $('span.price_normal b').text().trim() || 'N/A';
    const sellerName = $('.business-name').text().trim() || 'N/A';

    // Location extraction logic
    let location = 'N/A';
    const locationElement = $('a[onclick="showAdvertMap()"]');
    if (locationElement.length > 0) {
      const fullLocationText = locationElement.text().trim();
      const locationParts = fullLocationText.split(',');
      if (locationParts.length > 1) {
        // Get the last part (the state) and trim any whitespace
        location = locationParts[locationParts.length - 1].trim();
      } else {
        location = fullLocationText;
      }
    }

    // Extract details from the ad_det_children elements
    const details: { [key: string]: string } = {
      'Condition': 'N/A',
      'Category': 'N/A',
      'Make': 'N/A',
      'Model': 'N/A',
      'Year': 'N/A',
      'Type of Sale': 'N/A'
    };

    $('.ad_det_children').each((index, element) => {
      const $element = $(element);
      const label = $element.text().trim().replace(':', '');
      
      if (details.hasOwnProperty(label)) {
        const $valueElement = $element.next('.ad_det_children');
        if ($valueElement.length > 0) {
          details[label] = $valueElement.text().trim();
        }
      }
    });

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
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    console.log('Fetching URL:', url);
    
    // Fetch the main listing page
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    // 1. Find the relevant section header (Listings or Search Results)
    const allPanels = $('.search-right-head-panel').toArray();
    let targetPanelIndex = -1;
    
    for (let i = 0; i < allPanels.length; i++) {
      const text = $(allPanels[i]).text().trim();
      if (text === 'Listings' || text.includes('Search Results')) {
        targetPanelIndex = i;
        break;
      }
    }
    
    if (targetPanelIndex === -1) {
      return NextResponse.json({
        error: "Could not find a 'Listings' or 'Search Results' section.",
        success: false,
        products: []
      });
    }
    
    // 2. Find all product tiles between this header and the next one
    const allTiles = $('.tiled_results_container').toArray();
    const targetPanel = allPanels[targetPanelIndex];
    const nextPanel = allPanels[targetPanelIndex + 1] || null;
    
    // Get the parent container
    const mainContainer = $('.col-md-9.col-sm-9.col-xs-12.search-right-column.view-type-1');
    
    // Filter tiles that are after the target panel and before the next panel
    const targetTiles: cheerio.Element[] = [];
    let inTargetSection = false;
    
    mainContainer.children().each((index, element) => {
      const $el = $(element);
      
      // Check if this is our target panel
      if (element === targetPanel) {
        inTargetSection = true;
        return; // continue to next element
      }
      
      // Check if this is the next panel (stop collecting)
      if (nextPanel && element === nextPanel) {
        inTargetSection = false;
        return; // continue to next element
      }
      
      // If we're in the target section and this is a row, collect its tiles
      if (inTargetSection && $el.hasClass('row')) {
        $el.find('.tiled_results_container').each((i, tile) => {
          targetTiles.push(tile);
        });
      }
    });
    
    console.log(`Found ${targetTiles.length} product tiles in the target section`);
    
    if (targetTiles.length === 0) {
      return NextResponse.json({
        error: "No product tiles were found within the target section.",
        success: false,
        products: []
      });
    }
    
    // 3. Extract unique URLs from the filtered tiles
    const urls: string[] = [];
    
    targetTiles.forEach(tile => {
      const $tile = $(tile);
      const link = $tile.find('a.equip_link').attr('href');
      if (link) {
        const fullUrl = link.startsWith('http') ? link : `https://www.machines4u.com.au${link}`;
        urls.push(fullUrl);
      }
    });
    
    const uniqueUrls = [...new Set(urls)];
    console.log(`Found ${uniqueUrls.length} unique product URLs to scrape`);
    
    // 4. Scrape each unique URL with progress reporting
    const allData: ProductData[] = [];
    const totalUrls = uniqueUrls.length;
    
    for (let i = 0; i < totalUrls; i++) {
      console.log(`Scraping product ${i + 1}/${totalUrls}: ${uniqueUrls[i]}`);
      
      try {
        const data = await scrapeDetailedPage(uniqueUrls[i]);
        if (data) {
          allData.push(data);
        }
      } catch (error) {
        console.error(`Failed to scrape product ${i + 1}:`, error);
      }
      
      // Log progress
      const progress = Math.round(((i + 1) / totalUrls) * 100);
      console.log(`Progress: ${progress}% (${i + 1}/${totalUrls})`);
    }
    
    console.log(`Successfully scraped ${allData.length} products`);
    
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