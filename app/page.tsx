'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import ProductListItem from './components/ProductListItem';
import Image from 'next/image'; // <-- 1. IMPORT THE IMAGE COMPONENT

interface Product {
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

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [fileName, setFileName] = useState('');

  const generateDefaultFileName = (scrapeUrl: string) => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateString = `${month}-${day}`;
    const match = scrapeUrl.match(/brand\/([^/]+)\/([^/]+)/);
    if (match && match[1] && match[2]) {
      return `${match[1]}-${match[2]}-${dateString}.csv`;
    }
    return `products-${dateString}.csv`;
  };

  const handleScrape = async () => {
    if (!url) {
      setError('Please enter a URL to scrape.');
      return;
    }
    setLoading(true);
    setError('');
    setProducts([]);
    setStatus('Connecting to website...');
    try {
      setStatus('Scraping product listings... This can take a minute.');
      const response = await fetch('/api/scrape-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to scrape the website.');
      }
      setProducts(data.products);
      setStatus('');
      if (data.products.length > 0) {
        setFileName(generateDefaultFileName(url));
      } else {
        setError('No products found. Please check the URL and make sure it contains a list of items.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStatus('');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (products.length === 0 || !fileName) return;
    const csv = Papa.unparse(products);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 shadow-2xl rounded-xl p-8">
          
          {/* --- MODIFIED SECTION --- */}
          <div className="mb-10 text-center">
            <div className="flex justify-center items-center gap-4 mb-2">
              <Image
                src="/logo.png" // <-- 2. REFERENCE THE IMAGE FROM THE PUBLIC FOLDER
                alt="Scrape4Gel Logo"
                width={50}     // Specify width
                height={50}    // Specify height
                className="rounded-md" // Optional styling
              />
              <h1 className="text-4xl font-bold text-white">Scrape4Gel</h1>
            </div>
            <p className="text-gray-400">Enter a Machines4U listing URL to extract product data.</p>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Form Section remains the same */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-400 mb-1">Enter Machines4U URL</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input type="text" id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.machines4u.com.au/..." className="flex-1 block w-full rounded-none rounded-l-md bg-gray-700 border-gray-600 text-white focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-4 py-3" disabled={loading} />
                <button onClick={handleScrape} disabled={loading || !url} className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                  {loading ? (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : 'Scrape'}
                </button>
              </div>
              <button onClick={() => setUrl('https://www.machines4u.com.au/brand/jlg/4394rt/')} className="text-sm text-gray-400 hover:text-indigo-400 mt-2 transition-colors" disabled={loading}>or use a test URL</button>
            </div>
            {loading && (<p className="text-center text-blue-400 animate-pulse">{status || 'Processing...'}</p>)}
            {error && (<div className="rounded-md bg-red-900/50 border border-red-500 p-4"><p className="text-sm font-medium text-center text-red-300">{error}</p></div>)}
          </div>
          
          {!loading && products.length > 0 && (
            <div className="mt-12">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-white">Found {products.length} products</h2>
                <div className="flex rounded-md shadow-sm">
                   <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1 block w-full rounded-none rounded-l-md bg-gray-700 border-gray-600 text-white focus:ring-green-500 focus:border-green-500 sm:text-sm px-3 py-2" />
                  <button onClick={downloadCSV} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500">
                    Download CSV
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {products.map((product, index) => (
                  <ProductListItem key={index} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}