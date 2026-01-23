/**
 * Test product fixtures for E2E tests
 * Sample products for stands with various categories and pricing
 */

export interface TestProduct {
  id: string;
  standId: string;
  festivalId: string;
  name: string;
  description?: string;
  price: number;
  priceInTokens: number;
  category: string;
  isAvailable: boolean;
  stock?: number;
  maxPerTransaction?: number;
  image?: string;
  allergens?: string[];
  variants?: TestProductVariant[];
}

export interface TestProductVariant {
  id: string;
  name: string;
  priceModifier: number;
}

/**
 * Bar products
 */
export const barProducts: TestProduct[] = [
  {
    id: 'product-bar-001',
    standId: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Beer 25cl',
    description: 'Local Belgian beer',
    price: 4.00,
    priceInTokens: 40,
    category: 'BEER',
    isAvailable: true,
    maxPerTransaction: 6,
  },
  {
    id: 'product-bar-002',
    standId: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Beer 50cl',
    description: 'Local Belgian beer - Large',
    price: 7.00,
    priceInTokens: 70,
    category: 'BEER',
    isAvailable: true,
    maxPerTransaction: 4,
  },
  {
    id: 'product-bar-003',
    standId: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Soft Drink',
    description: 'Cola, Sprite, or Fanta',
    price: 3.00,
    priceInTokens: 30,
    category: 'SOFT_DRINK',
    isAvailable: true,
    variants: [
      { id: 'variant-001', name: 'Cola', priceModifier: 0 },
      { id: 'variant-002', name: 'Sprite', priceModifier: 0 },
      { id: 'variant-003', name: 'Fanta', priceModifier: 0 },
    ],
  },
  {
    id: 'product-bar-004',
    standId: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Water',
    description: 'Still or sparkling water 50cl',
    price: 2.50,
    priceInTokens: 25,
    category: 'WATER',
    isAvailable: true,
    variants: [
      { id: 'variant-004', name: 'Still', priceModifier: 0 },
      { id: 'variant-005', name: 'Sparkling', priceModifier: 0 },
    ],
  },
  {
    id: 'product-bar-005',
    standId: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Cocktail',
    description: 'House special cocktail',
    price: 9.00,
    priceInTokens: 90,
    category: 'COCKTAIL',
    isAvailable: true,
    maxPerTransaction: 2,
  },
  {
    id: 'product-bar-006',
    standId: 'test-stand-001',
    festivalId: 'test-festival-001',
    name: 'Wine Glass',
    description: 'Red or white wine',
    price: 5.00,
    priceInTokens: 50,
    category: 'WINE',
    isAvailable: true,
    variants: [
      { id: 'variant-006', name: 'Red', priceModifier: 0 },
      { id: 'variant-007', name: 'White', priceModifier: 0 },
    ],
  },
];

/**
 * Food products
 */
export const foodProducts: TestProduct[] = [
  {
    id: 'product-food-001',
    standId: 'test-stand-002',
    festivalId: 'test-festival-001',
    name: 'Classic Burger',
    description: 'Beef patty, lettuce, tomato, cheese, and special sauce',
    price: 12.00,
    priceInTokens: 120,
    category: 'MAIN',
    isAvailable: true,
    allergens: ['gluten', 'dairy'],
  },
  {
    id: 'product-food-002',
    standId: 'test-stand-002',
    festivalId: 'test-festival-001',
    name: 'Veggie Burger',
    description: 'Plant-based patty with all the fixings',
    price: 13.00,
    priceInTokens: 130,
    category: 'MAIN',
    isAvailable: true,
    allergens: ['gluten', 'soy'],
  },
  {
    id: 'product-food-003',
    standId: 'test-stand-002',
    festivalId: 'test-festival-001',
    name: 'Fries',
    description: 'Belgian-style crispy fries',
    price: 5.00,
    priceInTokens: 50,
    category: 'SIDE',
    isAvailable: true,
    variants: [
      { id: 'variant-008', name: 'Regular', priceModifier: 0 },
      { id: 'variant-009', name: 'Large', priceModifier: 2 },
    ],
  },
  {
    id: 'product-food-004',
    standId: 'test-stand-002',
    festivalId: 'test-festival-001',
    name: 'Chicken Wings',
    description: '6 pieces with BBQ or hot sauce',
    price: 10.00,
    priceInTokens: 100,
    category: 'MAIN',
    isAvailable: true,
    variants: [
      { id: 'variant-010', name: 'BBQ Sauce', priceModifier: 0 },
      { id: 'variant-011', name: 'Hot Sauce', priceModifier: 0 },
    ],
  },
  {
    id: 'product-food-005',
    standId: 'test-stand-002',
    festivalId: 'test-festival-001',
    name: 'Combo Meal',
    description: 'Burger + Fries + Soft Drink',
    price: 18.00,
    priceInTokens: 180,
    category: 'COMBO',
    isAvailable: true,
    allergens: ['gluten', 'dairy'],
  },
];

/**
 * Merchandise products
 */
export const merchandiseProducts: TestProduct[] = [
  {
    id: 'product-merch-001',
    standId: 'test-stand-003',
    festivalId: 'test-festival-001',
    name: 'Festival T-Shirt',
    description: 'Official Summer Fest 2026 t-shirt',
    price: 25.00,
    priceInTokens: 250,
    category: 'CLOTHING',
    isAvailable: true,
    stock: 500,
    variants: [
      { id: 'variant-012', name: 'S', priceModifier: 0 },
      { id: 'variant-013', name: 'M', priceModifier: 0 },
      { id: 'variant-014', name: 'L', priceModifier: 0 },
      { id: 'variant-015', name: 'XL', priceModifier: 0 },
      { id: 'variant-016', name: 'XXL', priceModifier: 5 },
    ],
  },
  {
    id: 'product-merch-002',
    standId: 'test-stand-003',
    festivalId: 'test-festival-001',
    name: 'Festival Hoodie',
    description: 'Premium hoodie with festival logo',
    price: 55.00,
    priceInTokens: 550,
    category: 'CLOTHING',
    isAvailable: true,
    stock: 200,
    variants: [
      { id: 'variant-017', name: 'S', priceModifier: 0 },
      { id: 'variant-018', name: 'M', priceModifier: 0 },
      { id: 'variant-019', name: 'L', priceModifier: 0 },
      { id: 'variant-020', name: 'XL', priceModifier: 0 },
    ],
  },
  {
    id: 'product-merch-003',
    standId: 'test-stand-003',
    festivalId: 'test-festival-001',
    name: 'Poster',
    description: 'Limited edition festival poster',
    price: 15.00,
    priceInTokens: 150,
    category: 'COLLECTIBLE',
    isAvailable: true,
    stock: 1000,
  },
  {
    id: 'product-merch-004',
    standId: 'test-stand-003',
    festivalId: 'test-festival-001',
    name: 'Sunglasses',
    description: 'Festival branded sunglasses',
    price: 10.00,
    priceInTokens: 100,
    category: 'ACCESSORY',
    isAvailable: true,
    stock: 300,
  },
  {
    id: 'product-merch-005',
    standId: 'test-stand-003',
    festivalId: 'test-festival-001',
    name: 'Water Bottle',
    description: 'Reusable water bottle with festival branding',
    price: 12.00,
    priceInTokens: 120,
    category: 'ACCESSORY',
    isAvailable: true,
    stock: 400,
  },
];

/**
 * All products by stand
 */
export const productsByStand = {
  'test-stand-001': barProducts,
  'test-stand-002': foodProducts,
  'test-stand-003': merchandiseProducts,
};

/**
 * All products flat list
 */
export const allProducts: TestProduct[] = [
  ...barProducts,
  ...foodProducts,
  ...merchandiseProducts,
];

/**
 * Get products for a specific stand
 */
export function getProductsForStand(standId: string): TestProduct[] {
  return productsByStand[standId as keyof typeof productsByStand] || [];
}

/**
 * Get a product by ID
 */
export function getProductById(productId: string): TestProduct | undefined {
  return allProducts.find((product) => product.id === productId);
}

/**
 * Calculate cart total from product IDs and quantities
 */
export interface CartItem {
  productId: string;
  quantity: number;
  variantId?: string;
}

export function calculateCartTotal(items: CartItem[]): {
  totalEur: number;
  totalTokens: number;
  itemCount: number;
} {
  let totalEur = 0;
  let totalTokens = 0;
  let itemCount = 0;

  for (const item of items) {
    const product = getProductById(item.productId);
    if (product) {
      let price = product.price;
      let priceInTokens = product.priceInTokens;

      // Apply variant price modifier if applicable
      if (item.variantId && product.variants) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (variant) {
          price += variant.priceModifier;
          priceInTokens += variant.priceModifier * 10;
        }
      }

      totalEur += price * item.quantity;
      totalTokens += priceInTokens * item.quantity;
      itemCount += item.quantity;
    }
  }

  return { totalEur, totalTokens, itemCount };
}

/**
 * Sample cart for testing
 */
export const sampleCart: CartItem[] = [
  { productId: 'product-bar-001', quantity: 2 },
  { productId: 'product-food-001', quantity: 1 },
  { productId: 'product-bar-004', quantity: 1, variantId: 'variant-004' },
];
