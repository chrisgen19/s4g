// This is the definition for the product data
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
  imageUrl?: string; // Optional image
}

// A simple SVG icon for the tags
const TagIcon = () => (
  <svg
    className="w-4 h-4 mr-1.5 text-gray-500"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M7 7h.01M7 3h5a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
    />
  </svg>
);

// The ProductCard component itself
export default function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden transform hover:-translate-y-1 transition-all duration-300">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-white hover:text-indigo-400 transition-colors">
            <a href={product.URL} target="_blank" rel="noopener noreferrer">
              {product["AD Title"]}
            </a>
          </h3>
          <span className="text-xl font-semibold text-green-400 whitespace-nowrap ml-4">
            {product.Price || 'N/A'}
          </span>
        </div>
        <p className="text-sm text-gray-400 mb-4 truncate">
          Sold by: <span className="font-medium text-gray-300">{product.Seller}</span>
        </p>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
            <TagIcon /> Brand: {product.Brand || 'N/A'}
          </span>
          <span className="flex items-center bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
            <TagIcon /> Model: {product.Model || 'N/A'}
          </span>
          <span className="flex items-center bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
            <TagIcon /> Year: {product.Year || 'N/A'}
          </span>
          <span className="flex items-center bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
            <TagIcon /> Condition: {product.Condition || 'N/A'}
          </span>
          <span className="flex items-center bg-gray-700 text-gray-300 px-2.5 py-1 rounded-full">
            <TagIcon /> Location: {product.Location || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}