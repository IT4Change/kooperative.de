// Strapi base types
export interface StrapiImage {
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
  formats?: {
    thumbnail?: StrapiImageFormat;
    small?: StrapiImageFormat;
    medium?: StrapiImageFormat;
    large?: StrapiImageFormat;
  };
}

export interface StrapiImageFormat {
  url: string;
  width: number;
  height: number;
}

export interface StrapiResponse<T> {
  data: T;
  meta: {
    pagination?: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

// Shared components
export interface SEO {
  metaTitle: string;
  metaDescription: string;
  shareImage?: StrapiImage;
}

export interface GalleryImage {
  image: StrapiImage;
  caption?: string;
}

export interface OrderItem {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// Content Types
export interface Homepage {
  id: number;
  title: string;
  subtitle: string;
  heroImage: StrapiImage;
  introText: string;
  seo?: SEO;
}

export interface Section {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string;
  heroImage?: StrapiImage;
  subPages?: SubPage[];
  externalLinks?: ExternalLink[];
  events?: Event[];
  seo?: SEO;
}

export interface SubPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  gallery?: GalleryImage[];
  section?: Section;
  seo?: SEO;
}

export interface Event {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  image?: StrapiImage;
  section?: Section;
}

export interface ExternalLink {
  id: number;
  documentId: string;
  name: string;
  url: string;
  teaser: string;
  logo?: StrapiImage;
  section?: Section;
}

export interface Product {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  sku: string;
  images?: StrapiImage[];
  subcategory?: ProductSubcategory;
  inStock: boolean;
}

export interface ProductCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  subcategories?: ProductSubcategory[];
}

export interface ProductSubcategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  category?: ProductCategory;
  products?: Product[];
}

export interface Page {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string;
  seo?: SEO;
}

export interface Order {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress: string;
  message?: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  orderNumber: string;
}

// Cart types (frontend only)
export interface CartItem {
  productId: number;
  documentId: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface CartState {
  items: CartItem[];
}

// Order form data
export interface OrderFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  message: string;
}
