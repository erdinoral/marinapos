import { Link } from "react-router-dom";
import { formatPrice, type Product } from "../data/products";
import { useCart } from "../context/CartContext";
import "./ProductCard.css";

type Props = {
  product: Product;
};

export function ProductCard({ product }: Props) {
  const { addItem } = useCart();

  return (
    <article className="product-card">
      <Link to={`/urun/${product.slug}`} className="product-card-media">
        <div
          className="product-card-visual"
          style={{ background: `linear-gradient(145deg, ${product.imageTone}55, var(--media-end))` }}
          aria-hidden
        >
          <span className="product-card-mark">MN</span>
        </div>
        {product.badge ? <span className="product-card-badge">{product.badge}</span> : null}
        {product.isNew ? <span className="product-card-new">Yeni</span> : null}
      </Link>
      <div className="product-card-body">
        <p className="product-card-brand">{product.brand}</p>
        <h3>
          <Link to={`/urun/${product.slug}`}>{product.name}</Link>
        </h3>
        <p className="product-card-desc">{product.shortDescription}</p>
        <div className="product-card-footer">
          <p className="price">
            {product.compareAt ? (
              <span className="price-old">{formatPrice(product.compareAt)}</span>
            ) : null}
            {formatPrice(product.price)}
          </p>
          <button
            type="button"
            className="btn btn-outline product-card-add"
            onClick={() => addItem(product.id)}
          >
            Sepete
          </button>
        </div>
      </div>
    </article>
  );
}
