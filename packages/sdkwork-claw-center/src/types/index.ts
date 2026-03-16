import { LucideIcon } from 'lucide-react';

export interface ClawCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
}

export type ProductType = 'physical' | 'auction' | 'recharge' | 'content' | 'ai_image' | 'ai_video' | 'ai_music' | 'service' | 'coupon' | 'food' | 'software';

export interface BaseProduct {
  id: string;
  type: ProductType;
  name: string;
  description: string;
  price: string;
  coverImage?: string;
}

export interface PhysicalProduct extends BaseProduct {
  type: 'physical';
  stock: number;
  shippingCost: string;
}

export interface AuctionProduct extends BaseProduct {
  type: 'auction';
  currentBid: string;
  endTime: string;
  bidCount: number;
}

export interface RechargeProduct extends BaseProduct {
  type: 'recharge';
  provider: string; // e.g., China Mobile, State Grid
  denominations: string[];
}

export interface ContentProduct extends BaseProduct {
  type: 'content';
  author: string;
  chapters: number;
  latestUpdate: string;
  category: string; // e.g., Novel, Article
}

export interface AIGenerationProduct extends BaseProduct {
  type: 'ai_image' | 'ai_video' | 'ai_music';
  resolution?: string;
  duration?: string;
  format: string;
  deliveryTime: string;
}

export interface ServiceProduct extends BaseProduct {
  type: 'service';
  category: string;
}

export interface CouponProduct extends BaseProduct {
  type: 'coupon';
  discount: string;
  validUntil: string;
  merchant: string;
}

export interface FoodProduct extends BaseProduct {
  type: 'food';
  restaurant: string;
  deliveryTime: string;
  rating: number;
}

export interface SoftwareProduct extends BaseProduct {
  type: 'software';
  supportedTypes: string[]; // e.g., ['Web App', 'Mobile App', 'API']
  deploymentOptions: string[]; // e.g., ['Vercel', 'AWS', 'Docker']
  features: string[];
}

export type ClawProduct = PhysicalProduct | AuctionProduct | RechargeProduct | ContentProduct | AIGenerationProduct | ServiceProduct | CouponProduct | FoodProduct | SoftwareProduct;

export interface Review {
  id: string;
  user: string;
  avatar: string;
  rating: number;
  date: string;
  content: string;
}

export interface ClawInstance {
  id: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  completedOrders: number;
  location: string;
  verified: boolean;
  tags: string[];
  logo: string;
}

export interface ClawDetailData extends ClawInstance {
  about: string;
  established: string;
  responseRate: string;
  products: ClawProduct[];
  reviews: Review[];
  contactEmail: string;
  website: string;
}

export interface CreateClawDTO {
  name: string;
  description: string;
  category: string;
  location: string;
  tags: string[];
  logo: string;
  about: string;
  established: string;
  contactEmail: string;
  website: string;
}

export interface UpdateClawDTO extends Partial<CreateClawDTO> {}
