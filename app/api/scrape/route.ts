import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface ProductData {
  title: string;
  price: string;
  location: string;
  condition: string;
  category: string;
  make: string;
  model: string;
  year: string;
  seller: string;
  description: string;
  imageUrl: string;
  productUrl: string;
}

export const runtime = 'nodejs';

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    next: { revalidate: 0 }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.text();
}

async function scrapeProductDetail(productUrl: string): Promise<Partial<ProductData>> {
  try {
    const html = await fetchPage(productUrl);
    const $ = cheerio.load(html);
    
    // Extract detailed product information
    const title = $('h1.list-title').text().trim() || 
                  $('h1.m-x-t-0.list-title').text().trim() || '';
    
    const price = $('.price_normal.price_gstex b').text().trim() || 
                  $('.price_container').text().trim() || '';
    
    const location = $('.adv_header_loc').text().replace(/\s+/g, ' ').trim() || '';
    
    // Extract specs from the details section
    const getDetailValue = (label: string): string => {
      const element = $(`.ad_det_children:contains("${label}:")`).next('.ad_det_children');
      return element.text().trim() || '';
    };
    
    const condition = getDetailValue('Condition');
    const category = getDetailValue('Category');
    const make = getDetailValue('Make');
    const model = getDetailValue('Model');
    const year = getDetailValue('Year');
    
    const seller = $('.business-name').text().trim() || '';
    const description = $('.advert_row_desc').first().text().trim() || '';
    
    return {
      title,
      price,
      location,
      condition,
      category,
      make,
      model,
      year,
      seller,
      description,
      productUrl
    };
  } catch (error) {
    console.error(`Error scraping product detail: ${productUrl}`, error);
    return { productUrl };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;
    
    console.log('Received URL:', url);
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    
    // Fetch the main page
    console.log('Fetching main page...');
    const html = await fetchPage(url);
    const $ = cheerio.load(html);
    
    console.log('Page loaded, searching for products...');
    const products: ProductData[] = [];
    
    // Find all sections and process only "Listings" or "Search Results"
    const sections = $('.search-right-head-panel');
    let isInListingsSection = false;
    
    sections.each((index, element) => {
      const sectionText = $(element).text().trim();
      if (sectionText === 'Listings' || sectionText === 'Search Results') {
        isInListingsSection = true;
      } else if (sectionText === 'Spotlight Ads' || sectionText.includes('Other')) {
        isInListingsSection = false;
      }
    });
    
    // Process all product containers
    const allProducts: any[] = [];
    
    // First, let's log what sections we find
    console.log('Found sections:');
    $('.search-right-head-panel').each((i, el) => {
      console.log(`- ${$(el).text().trim()}`);
    });
    
    $('.tiled_results_container').each((index, element) => {
      const $element = $(element);
      
      // Check if this product is after a "Listings" or "Search Results" section
      const prevSections = $element.prevAll('.search-right-head-panel');
      let shouldInclude = false;
      
      prevSections.each((i, section) => {
        const sectionText = $(section).text().trim();
        if (sectionText === 'Listings' || sectionText === 'Search Results') {
          // Check if there's no other section between this and the product
          const betweenSections = $element.prevUntil($(section), '.search-right-head-panel');
          if (betweenSections.length === 0) {
            shouldInclude = true;
            return false; // break the loop
          }
        }
      });
      
      if (shouldInclude) {
        const productLink = $element.find('a.equip_link').attr('href');
        const imageUrl = $element.find('img.img-responsive').attr('src') || '';
        const title = $element.find('a.equip_link').text().trim();
        const price = $element.find('.price_container').text().trim();
        const location = $element.find('.list_state').text().trim();
        const description = $element.find('.advert_row_desc').text().trim();
        
        if (productLink) {
          const fullUrl = productLink.startsWith('http') 
            ? productLink 
            : `https://www.machines4u.com.au${productLink}`;
          
          allProducts.push({
            title,
            price,
            location,
            description,
            imageUrl,
            productUrl: fullUrl
          });
        }
      }
    });
    
    console.log(`Found ${allProducts.length} products to scrape`);
    
    if (allProducts.length === 0) {
      console.log('No products found. HTML preview:', html.substring(0, 500));
    }
    
    // Scrape detailed information for each product
    console.log('Scraping detailed information for each product...');
    const detailedProducts = await Promise.all(
      allProducts.map(async (product) => {
        const details = await scrapeProductDetail(product.productUrl);
        return {
          ...product,
          ...details
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      count: detailedProducts.length,
      products: detailedProducts
    });
    
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape the website' },
      { status: 500 }
    );
  }
}