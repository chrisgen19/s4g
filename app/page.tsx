'use client';

import { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import ProductListItem from './components/ProductListItem';
import Image from 'next/image';

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
  
  const eventSourceRef = useRef<EventSource | null>(null);

  const generateDefaultFileName = (scrapeUrl: string) => {
    const now = new Date();
    // Using Philippine time (UTC+8) for the date
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const dateString = `${month}-${day}`;
    const match = scrapeUrl.match(/brand\/([^/]+)\/([^/]+)/);
    if (match && match[1] && match[2]) return `${match[1]}-${match[2]}-${dateString}.csv`;
    return `products-${dateString}.csv`;
  };

  const handleScrape = async () => {
    if (!url) {
      setError('Please enter a URL to scrape.');
      return;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setLoading(true);
    setError('');
    setProducts([]);
    setStatus('Initializing connection...');
    setFileName('');

    const encodedUrl = encodeURIComponent(url);
    const eventSource = new EventSource(`/api/scrape-v2?url=${encodedUrl}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setStatus('Connection opened. Starting scrape...');
    };

    // --- FIX APPLIED TO ALL LISTENERS BELOW ---

    eventSource.addEventListener('status', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);
    });

    eventSource.addEventListener('product', (e: MessageEvent) => {
      const newProduct = JSON.parse(e.data);
      setProducts((prevProducts) => [...prevProducts, newProduct]);
    });

    eventSource.addEventListener('done', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      setStatus(data.message);
      setFileName(generateDefaultFileName(url));
      setLoading(false);
      eventSource.close();
    });

    // This is the listener that caused the error. Now fixed.
    eventSource.addEventListener('error', (e: MessageEvent) => {
        if (e.data) {
            const data = JSON.parse(e.data);
            setError(data.message);
        } else {
            setError('An unknown error occurred with the connection.');
        }
        setStatus('Process failed.');
        setLoading(false);
        eventSource.close();
    });
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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
        <div className="bg-white border border-gray-200 shadow-lg rounded-xl p-8">
          
          <div className="mb-10 text-center">
            <div className="flex justify-center items-center gap-4 mb-2">
              <Image src="/logo.png" alt="Scrape4Gel Logo" width={50} height={50} className="rounded-md" />
              <h1 className="text-4xl font-bold text-gray-900">Scrape4Gel</h1>
            </div>
            <p className="text-gray-600">Enter a Machines4U listing URL to extract product data.</p>
          </div>

          <div className="space-y-6 max-w-2xl mx-auto">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">Enter Machines4U URL</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input type="text" id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.machines4u.com.au/..." className="flex-1 block w-full rounded-none rounded-l-md border-gray-300 bg-white text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-4 py-3" disabled={loading} />
                <button onClick={handleScrape} disabled={loading || !url} className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-r-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors">
                  {loading ? (<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : 'Scrape'}
                </button>
              </div>
              <button onClick={() => setUrl('https://www.machines4u.com.au/brand/jlg/4394rt/')} className="text-sm text-gray-600 hover:text-indigo-600 mt-2 transition-colors" disabled={loading}>or use a test URL</button>
            </div>

            {loading && (
              <div className="text-center p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm text-indigo-800 font-medium">{status}</p>
              </div>
            )}
            
            {error && (<div className="rounded-md bg-red-50 p-4"><p className="text-sm font-medium text-center text-red-800">{error}</p></div>)}
          </div>
          
          {products.length > 0 && (
            <div className="mt-12">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-semibold text-gray-900">Found {products.length} products</h2>
                {!loading && (
                  <div className="flex rounded-md shadow-sm">
                    <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="flex-1 block w-full rounded-none rounded-l-md border-gray-300 bg-white text-gray-900 focus:ring-green-500 focus:border-green-500 sm:text-sm px-3 py-2" />
                    <button onClick={downloadCSV} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                      Download CSV
                    </button>
                  </div>
                )}
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