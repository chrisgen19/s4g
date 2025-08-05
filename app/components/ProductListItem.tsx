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

export default function ProductListItem({ product }: { product: Product }) {
  return (
    <a
      href={product.URL}
      target="_blank"
      rel="noopener noreferrer"
      // Changed to light mode colors with a light hover effect
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-100/50 transition-colors duration-200"
    >
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        {/* Left Side: Title and Details */}
        <div className="flex-grow">
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            {product["AD Title"]}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>Brand: <span className="text-gray-700 font-medium">{product.Brand || 'N/A'}</span></span>
            <span>Model: <span className="text-gray-700 font-medium">{product.Model || 'N/A'}</span></span>
            <span>Year: <span className="text-gray-700 font-medium">{product.Year || 'N/A'}</span></span>
            <span>Location: <span className="text-gray-700 font-medium">{product.Location || 'N/A'}</span></span>
          </div>
        </div>

        {/* Right Side: Price */}
        <div className="flex-shrink-0 text-left sm:text-right">
          <p className="text-xl font-semibold text-green-600">
            {product.Price || 'N/A'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            (View Listing)
          </p>
        </div>
      </div>
    </a>
  );
}