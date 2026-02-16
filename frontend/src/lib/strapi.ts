import type { StrapiResponse } from './types';

const STRAPI_URL = import.meta.env.PUBLIC_STRAPI_URL || 'http://localhost:1337';

interface FetchOptions {
  populate?: string | Record<string, unknown>;
  filters?: Record<string, unknown>;
  sort?: string | string[];
  pagination?: {
    page?: number;
    pageSize?: number;
  };
  fields?: string[];
}

function buildQueryString(options: FetchOptions): string {
  const params = new URLSearchParams();

  if (options.populate) {
    if (typeof options.populate === 'string') {
      params.set('populate', options.populate);
    } else {
      flattenObject(options.populate, 'populate', params);
    }
  }

  if (options.filters) {
    flattenObject(options.filters, 'filters', params);
  }

  if (options.sort) {
    const sorts = Array.isArray(options.sort) ? options.sort : [options.sort];
    sorts.forEach((s, i) => params.set(`sort[${i}]`, s));
  }

  if (options.pagination) {
    if (options.pagination.page) params.set('pagination[page]', String(options.pagination.page));
    if (options.pagination.pageSize) params.set('pagination[pageSize]', String(options.pagination.pageSize));
  }

  if (options.fields) {
    options.fields.forEach((f, i) => params.set(`fields[${i}]`, f));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function flattenObject(obj: Record<string, unknown>, prefix: string, params: URLSearchParams): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = `${prefix}[${key}]`;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenObject(value as Record<string, unknown>, fullKey, params);
    } else {
      params.set(fullKey, String(value));
    }
  }
}

async function fetchFromStrapi<T>(endpoint: string, options: FetchOptions = {}): Promise<StrapiResponse<T>> {
  const queryString = buildQueryString(options);
  const url = `${STRAPI_URL}/api/${endpoint}${queryString}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Strapi fetch error: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

export function getStrapiURL(path: string = ''): string {
  return `${STRAPI_URL}${path}`;
}

export function getStrapiMedia(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${STRAPI_URL}${url}`;
}

// Homepage
export async function getHomepage() {
  return fetchFromStrapi<any>('homepage', {
    populate: { heroImage: true, seo: { populate: 'shareImage' } },
  });
}

// Sections
export async function getSections() {
  return fetchFromStrapi<any[]>('sections', {
    populate: { heroImage: true, subPages: { fields: ['title', 'slug'] }, externalLinks: { populate: 'logo' } },
    sort: 'name',
  });
}

export async function getSectionBySlug(slug: string) {
  return fetchFromStrapi<any[]>('sections', {
    filters: { slug: { $eq: slug } },
    populate: {
      heroImage: true,
      subPages: { populate: { gallery: { populate: 'image' } } },
      externalLinks: { populate: 'logo' },
      events: { populate: 'image', sort: 'startDate:desc' },
      seo: { populate: 'shareImage' },
    },
  });
}

// Sub-Pages
export async function getSubPageBySlug(slug: string) {
  return fetchFromStrapi<any[]>('sub-pages', {
    filters: { slug: { $eq: slug } },
    populate: {
      gallery: { populate: 'image' },
      section: { fields: ['name', 'slug'] },
      seo: { populate: 'shareImage' },
    },
  });
}

export async function getSubPagesBySectionSlug(sectionSlug: string) {
  return fetchFromStrapi<any[]>('sub-pages', {
    filters: { section: { slug: { $eq: sectionSlug } } },
    populate: { gallery: { populate: 'image' }, section: { fields: ['name', 'slug'] } },
  });
}

// Events
export async function getEventsBySection(sectionSlug: string) {
  return fetchFromStrapi<any[]>('events', {
    filters: { section: { slug: { $eq: sectionSlug } } },
    populate: { image: true, section: { fields: ['name', 'slug'] } },
    sort: 'startDate:asc',
  });
}

export async function getAllEvents() {
  return fetchFromStrapi<any[]>('events', {
    populate: { image: true, section: { fields: ['name', 'slug'] } },
    sort: 'startDate:asc',
    pagination: { pageSize: 100 },
  });
}

// Pages (Info)
export async function getPages() {
  return fetchFromStrapi<any[]>('pages', {
    populate: { seo: { populate: 'shareImage' } },
  });
}

export async function getPageBySlug(slug: string) {
  return fetchFromStrapi<any[]>('pages', {
    filters: { slug: { $eq: slug } },
    populate: { seo: { populate: 'shareImage' } },
  });
}

// Products
export async function getProducts(filters: Record<string, unknown> = {}) {
  return fetchFromStrapi<any[]>('products', {
    filters,
    populate: { images: true, subcategory: { populate: 'category' } },
    pagination: { pageSize: 100 },
  });
}

export async function getProductBySlug(slug: string) {
  return fetchFromStrapi<any[]>('products', {
    filters: { slug: { $eq: slug } },
    populate: { images: true, subcategory: { populate: 'category' } },
  });
}

export async function getProductsByCategory(categorySlug: string) {
  return fetchFromStrapi<any[]>('products', {
    filters: { subcategory: { category: { slug: { $eq: categorySlug } } } },
    populate: { images: true, subcategory: { populate: 'category' } },
    pagination: { pageSize: 100 },
  });
}

export async function getProductsBySubcategory(subcategorySlug: string) {
  return fetchFromStrapi<any[]>('products', {
    filters: { subcategory: { slug: { $eq: subcategorySlug } } },
    populate: { images: true, subcategory: { populate: 'category' } },
    pagination: { pageSize: 100 },
  });
}

// Categories
export async function getCategories() {
  return fetchFromStrapi<any[]>('product-categories', {
    populate: { subcategories: true },
    sort: 'name',
  });
}

export async function getCategoryBySlug(slug: string) {
  return fetchFromStrapi<any[]>('product-categories', {
    filters: { slug: { $eq: slug } },
    populate: { subcategories: { populate: { products: { populate: 'images' } } } },
  });
}

// Subcategories
export async function getSubcategoryBySlug(subcategorySlug: string) {
  return fetchFromStrapi<any[]>('product-subcategories', {
    filters: { slug: { $eq: subcategorySlug } },
    populate: { category: true, products: { populate: 'images' } },
  });
}

// Orders
export async function submitOrder(orderData: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress: string;
  message?: string;
  items: Array<{ productName: string; sku: string; quantity: number; unitPrice: number; subtotal: number }>;
  totalAmount: number;
}) {
  const response = await fetch(`${STRAPI_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: orderData }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || 'Bestellung fehlgeschlagen');
  }

  return response.json();
}
