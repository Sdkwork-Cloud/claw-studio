import {
  Database,
  PenTool,
  Headphones,
  Scale,
  LineChart,
  Code,
  Stethoscope,
  Ticket,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { type ListParams, type PaginatedResult, delay } from './serviceTypes.ts';

export interface ClawCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
}

export const ECOM_CATEGORIES: ClawCategory[] = [
  { id: 'Data Processing', name: 'Data & Analytics', icon: Database, desc: 'ETL, Big Data, Analytics' },
  { id: 'Content Generation', name: 'Content & Creative', icon: PenTool, desc: 'Copywriting, Translation' },
  { id: 'Customer Service', name: 'Customer Experience', icon: Headphones, desc: 'Chatbots, Voice Agents' },
  { id: 'Legal', name: 'Legal & Compliance', icon: Scale, desc: 'Contracts, IP Research' },
  { id: 'Finance', name: 'Finance & Ops', icon: LineChart, desc: 'Accounting, Fraud Detection' },
  { id: 'Engineering', name: 'Engineering & Dev', icon: Code, desc: 'Code Review, DevOps' },
  { id: 'Medical', name: 'Healthcare & Medical', icon: Stethoscope, desc: 'Private Doctors, Consultations' },
  { id: 'Coupons', name: 'Coupons & Recharge', icon: Ticket, desc: 'Gift Cards, Account Top-ups' },
  { id: 'Dining', name: 'Food & Dining', icon: Utensils, desc: 'Food Ordering, Restaurant Vouchers' },
];

export type ProductType =
  | 'physical'
  | 'auction'
  | 'recharge'
  | 'content'
  | 'ai_image'
  | 'ai_video'
  | 'ai_music'
  | 'service'
  | 'coupon'
  | 'food';

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
  provider: string;
  denominations: string[];
}

export interface ContentProduct extends BaseProduct {
  type: 'content';
  author: string;
  chapters: number;
  latestUpdate: string;
  category: string;
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

export type ClawProduct =
  | PhysicalProduct
  | AuctionProduct
  | RechargeProduct
  | ContentProduct
  | AIGenerationProduct
  | ServiceProduct
  | CouponProduct
  | FoodProduct;

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

export interface ClawDetail extends ClawInstance {
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

export interface IClawService {
  getList(params?: ListParams): Promise<PaginatedResult<ClawInstance>>;
  getById(id: string): Promise<ClawDetail | null>;
  create(data: CreateClawDTO): Promise<ClawDetail>;
  update(id: string, data: UpdateClawDTO): Promise<ClawDetail>;
  delete(id: string): Promise<boolean>;
  getClaws(): Promise<ClawInstance[]>;
  getClawDetail(id: string): Promise<ClawDetail | undefined>;
  getCategories(): Promise<ClawCategory[]>;
}

const MOCK_CLAWS: ClawDetail[] = [
  {
    id: 'claw-001',
    name: 'NeuroData Solutions',
    description: 'Enterprise-grade data processing and AI generation agents.',
    category: 'Data Processing',
    rating: 4.9,
    completedOrders: 12500,
    location: 'San Francisco, CA',
    verified: true,
    tags: ['Big Data', 'AI Image', 'AI Video'],
    logo: 'https://picsum.photos/seed/neurodata/150/150',
    about:
      'NeuroData Solutions provides high-throughput AI agents specialized in cleaning, transforming, and analyzing massive datasets, as well as state-of-the-art AI generation services.',
    established: '2024',
    responseRate: '99.8%',
    contactEmail: 'contact@neurodata.ai',
    website: 'https://neurodata.ai',
    products: [
      {
        id: 'p-1',
        type: 'service',
        name: 'Real-time Data Pipeline',
        description: 'Continuous data ingestion and transformation.',
        price: '$0.05 / GB',
        category: 'ETL',
      },
      {
        id: 'p-2',
        type: 'ai_image',
        name: 'High-Res Product Photography',
        description: 'AI-generated product photos based on your 3D models or sketches.',
        price: '$0.50 / Image',
        format: 'PNG/JPG',
        deliveryTime: 'Instant',
        resolution: '4K',
        coverImage: 'https://picsum.photos/seed/ai-img/300/200',
      },
      {
        id: 'p-3',
        type: 'ai_video',
        name: 'Marketing Video Generation',
        description: 'Text-to-video generation for social media marketing.',
        price: '$5.00 / Minute',
        format: 'MP4',
        deliveryTime: '5 mins',
        duration: 'Up to 60s',
        coverImage: 'https://picsum.photos/seed/ai-vid/300/200',
      },
    ],
    reviews: [
      {
        id: 'r-1',
        user: 'Alice Chen',
        avatar: 'https://picsum.photos/seed/alice/50/50',
        rating: 5,
        date: '2026-02-15',
        content: 'Amazing image generation quality. Saved us hours of photoshoot time.',
      },
      {
        id: 'r-2',
        user: 'Bob Smith',
        avatar: 'https://picsum.photos/seed/bob/50/50',
        rating: 4,
        date: '2026-01-20',
        content: 'Data pipeline is solid, but setup took a bit longer than expected.',
      },
    ],
  },
  {
    id: 'claw-002',
    name: 'OmniCommerce Hub',
    description: 'Your one-stop shop for physical goods, auctions, and digital recharges.',
    category: 'E-Commerce',
    rating: 4.7,
    completedOrders: 8430,
    location: 'London, UK',
    verified: true,
    tags: ['Retail', 'Auction', 'Utility'],
    logo: 'https://picsum.photos/seed/omni/150/150',
    about:
      'OmniCommerce Hub operates a diverse marketplace offering everything from rare collectibles to everyday utility recharges, powered by automated Claw agents.',
    established: '2025',
    responseRate: '95.5%',
    contactEmail: 'hello@omnicommerce.co.uk',
    website: 'https://omnicommerce.co.uk',
    products: [
      {
        id: 'p-4',
        type: 'physical',
        name: 'Mechanical Keyboard Pro',
        description: 'Custom-built mechanical keyboard with tactile switches.',
        price: '$120.00',
        stock: 45,
        shippingCost: '$10.00',
        coverImage: 'https://picsum.photos/seed/keyboard/300/200',
      },
      {
        id: 'p-5',
        type: 'auction',
        name: 'Vintage Rolex Watch',
        description: '1970s Rolex Submariner in excellent condition.',
        price: 'Starting at $5000',
        currentBid: '$6,200',
        endTime: '2026-03-15T12:00:00Z',
        bidCount: 14,
        coverImage: 'https://picsum.photos/seed/rolex/300/200',
      },
      {
        id: 'p-6',
        type: 'recharge',
        name: 'Global Mobile Top-up',
        description: 'Instant mobile balance recharge for over 150 countries.',
        price: 'Varies',
        provider: 'GlobalTel',
        denominations: ['$10', '$20', '$50', '$100'],
      },
    ],
    reviews: [
      {
        id: 'r-3',
        user: 'Charlie D.',
        avatar: 'https://picsum.photos/seed/charlie/50/50',
        rating: 5,
        date: '2026-03-01',
        content: 'Won an auction here, process was smooth and secure.',
      },
    ],
  },
  {
    id: 'claw-003',
    name: 'Creative Writers Guild',
    description: 'Premium online content, novels, and collaborative writing services.',
    category: 'Content Generation',
    rating: 4.8,
    completedOrders: 45200,
    location: 'Austin, TX',
    verified: true,
    tags: ['Novels', 'Articles', 'Music'],
    logo: 'https://picsum.photos/seed/writers/150/150',
    about:
      'We provide a platform for serialized novels, premium articles, and collaborative content creation. Our AI agents assist in drafting, editing, and publishing.',
    established: '2023',
    responseRate: '99.9%',
    contactEmail: 'sales@writersguild.io',
    website: 'https://writersguild.io',
    products: [
      {
        id: 'p-7',
        type: 'content',
        name: 'The Cybernetic Dawn',
        description: 'A thrilling sci-fi novel about AI sentience.',
        price: '$0.99 / Chapter',
        author: 'J.K. Rowling (AI Assisted)',
        chapters: 42,
        latestUpdate: '2026-03-10',
        category: 'Novel',
        coverImage: 'https://picsum.photos/seed/novel/300/400',
      },
      {
        id: 'p-8',
        type: 'ai_music',
        name: 'Custom Lo-Fi Beats',
        description: 'Generate royalty-free lo-fi tracks for your streams.',
        price: '$2.00 / Track',
        format: 'WAV/MP3',
        deliveryTime: '2 mins',
        duration: '3:00',
        coverImage: 'https://picsum.photos/seed/music/300/200',
      },
    ],
    reviews: [
      {
        id: 'r-4',
        user: 'Diana Prince',
        avatar: 'https://picsum.photos/seed/diana/50/50',
        rating: 5,
        date: '2026-03-05',
        content: "The novel is gripping! Can't wait for the next chapter.",
      },
    ],
  },
  {
    id: 'claw-004',
    name: 'Global Utility Network',
    description: 'Automated utility payments and physical smart home devices.',
    category: 'Utility',
    rating: 4.6,
    completedOrders: 102000,
    location: 'Singapore',
    verified: true,
    tags: ['Recharge', 'Smart Home', 'IoT'],
    logo: 'https://picsum.photos/seed/utility/150/150',
    about:
      'Global Utility Network bridges the gap between digital payments and physical infrastructure. We offer seamless recharge services for water, electricity, and telecommunications globally, alongside smart home hardware.',
    established: '2021',
    responseRate: '98.5%',
    contactEmail: 'support@globalutility.net',
    website: 'https://globalutility.net',
    products: [
      {
        id: 'p-9',
        type: 'recharge',
        name: 'State Grid Electricity Recharge',
        description: 'Direct electricity top-up for State Grid Corporation of China.',
        price: 'Varies',
        provider: 'State Grid',
        denominations: ['¥50', '¥100', '¥200', '¥500'],
      },
      {
        id: 'p-10',
        type: 'recharge',
        name: 'Water Utility Top-up',
        description: 'Instant water bill payment for major metropolitan areas.',
        price: 'Varies',
        provider: 'Metro Water',
        denominations: ['$20', '$50', '$100'],
      },
      {
        id: 'p-11',
        type: 'physical',
        name: 'Smart Energy Monitor v2',
        description: 'IoT device to track your home energy usage in real-time.',
        price: '$89.99',
        stock: 120,
        shippingCost: 'Free',
        coverImage: 'https://picsum.photos/seed/smarthome/300/200',
      },
    ],
    reviews: [
      {
        id: 'r-5',
        user: 'Wei Chen',
        avatar: 'https://picsum.photos/seed/wei/50/50',
        rating: 5,
        date: '2026-02-28',
        content: 'Electricity recharge arrived instantly. Very convenient!',
      },
      {
        id: 'r-6',
        user: 'Sarah J.',
        avatar: 'https://picsum.photos/seed/sarah/50/50',
        rating: 4,
        date: '2026-01-15',
        content: 'The energy monitor works great, but the app could use an update.',
      },
    ],
  },
  {
    id: 'claw-005',
    name: "Sotheby's Digital",
    description: 'High-end auctions for digital and physical luxury assets.',
    category: 'Auction',
    rating: 4.9,
    completedOrders: 1500,
    location: 'New York, NY',
    verified: true,
    tags: ['Luxury', 'Art', 'Collectibles'],
    logo: 'https://picsum.photos/seed/sothebys/150/150',
    about:
      "Sotheby's Digital brings the prestige of traditional auction houses to the Claw Mall. Bid on verified, authenticated luxury goods and exclusive digital art pieces.",
    established: '2025',
    responseRate: '99.0%',
    contactEmail: 'concierge@sothebysdigital.com',
    website: 'https://sothebysdigital.com',
    products: [
      {
        id: 'p-12',
        type: 'auction',
        name: '1st Edition Charizard Holographic',
        description: 'PSA 10 Gem Mint condition. A holy grail for collectors.',
        price: 'Starting at $150,000',
        currentBid: '$210,500',
        endTime: '2026-04-01T20:00:00Z',
        bidCount: 45,
        coverImage: 'https://picsum.photos/seed/charizard/300/400',
      },
      {
        id: 'p-13',
        type: 'auction',
        name: 'Original Banksy Canvas',
        description: 'Authenticated original artwork by Banksy. Includes certificate.',
        price: 'Starting at $500,000',
        currentBid: '$850,000',
        endTime: '2026-03-20T18:00:00Z',
        bidCount: 12,
        coverImage: 'https://picsum.photos/seed/banksy/300/200',
      },
    ],
    reviews: [
      {
        id: 'r-7',
        user: 'Collector99',
        avatar: 'https://picsum.photos/seed/collector/50/50',
        rating: 5,
        date: '2026-03-02',
        content: 'Impeccable service and authentication process.',
      },
    ],
  },
  {
    id: 'claw-006',
    name: 'LegalEase AI',
    description: 'Automated legal consultations, contract drafting, and IP research.',
    category: 'Legal',
    rating: 4.8,
    completedOrders: 3200,
    location: 'Washington, DC',
    verified: true,
    tags: ['Contracts', 'Consultation', 'IP'],
    logo: 'https://picsum.photos/seed/legal/150/150',
    about:
      'LegalEase AI provides fast, accurate, and affordable legal services. Our AI agents are trained on vast legal databases to assist with contract generation, compliance checks, and preliminary legal advice.',
    established: '2024',
    responseRate: '99.5%',
    contactEmail: 'support@legalease.ai',
    website: 'https://legalease.ai',
    products: [
      {
        id: 'p-14',
        type: 'service',
        name: 'Standard NDA Drafting',
        description: 'Customized Non-Disclosure Agreement for your business.',
        price: '$25.00',
        category: 'Contracts',
      },
      {
        id: 'p-15',
        type: 'service',
        name: 'Trademark Search',
        description: 'Comprehensive search for trademark availability.',
        price: '$50.00',
        category: 'IP Research',
      },
    ],
    reviews: [
      {
        id: 'r-8',
        user: 'StartupFounder',
        avatar: 'https://picsum.photos/seed/founder/50/50',
        rating: 5,
        date: '2026-02-10',
        content: 'Drafted my NDA in minutes. Very professional.',
      },
    ],
  },
  {
    id: 'claw-007',
    name: 'HealthConnect Plus',
    description: '24/7 private doctor consultations and medical advice.',
    category: 'Medical',
    rating: 4.9,
    completedOrders: 8500,
    location: 'Boston, MA',
    verified: true,
    tags: ['Telehealth', 'Consultation', 'Wellness'],
    logo: 'https://picsum.photos/seed/medical/150/150',
    about:
      'HealthConnect Plus connects you with licensed medical professionals and advanced AI diagnostic tools for immediate health consultations and wellness planning.',
    established: '2023',
    responseRate: '100%',
    contactEmail: 'care@healthconnect.plus',
    website: 'https://healthconnect.plus',
    products: [
      {
        id: 'p-16',
        type: 'service',
        name: 'General Practitioner Consultation',
        description: '15-minute video consultation with a certified GP.',
        price: '$45.00',
        category: 'Consultation',
      },
      {
        id: 'p-17',
        type: 'service',
        name: 'AI Symptom Checker',
        description: 'Advanced AI analysis of your symptoms with recommended next steps.',
        price: '$5.00',
        category: 'Diagnostics',
      },
    ],
    reviews: [
      {
        id: 'r-9',
        user: 'John Doe',
        avatar: 'https://picsum.photos/seed/john/50/50',
        rating: 5,
        date: '2026-03-08',
        content: 'The doctor was very attentive and helpful.',
      },
    ],
  },
  {
    id: 'claw-008',
    name: 'VoucherVault',
    description: 'Discounted gift cards, coupons, and account recharges.',
    category: 'Coupons',
    rating: 4.7,
    completedOrders: 54000,
    location: 'Global',
    verified: true,
    tags: ['Gift Cards', 'Discounts', 'Recharge'],
    logo: 'https://picsum.photos/seed/voucher/150/150',
    about:
      'VoucherVault is your premier destination for discounted gift cards and digital coupons. Save money on your favorite brands and easily recharge your gaming and entertainment accounts.',
    established: '2022',
    responseRate: '98.0%',
    contactEmail: 'deals@vouchervault.com',
    website: 'https://vouchervault.com',
    products: [
      {
        id: 'p-18',
        type: 'coupon',
        name: 'Amazon $100 Gift Card',
        description: 'Digital gift card delivered instantly.',
        price: '$95.00',
        discount: '5% OFF',
        validUntil: 'No Expiry',
        merchant: 'Amazon',
        coverImage: 'https://picsum.photos/seed/amazon/300/200',
      },
      {
        id: 'p-19',
        type: 'coupon',
        name: 'Steam Wallet $50',
        description: 'Recharge your Steam wallet for games and software.',
        price: '$48.00',
        discount: '4% OFF',
        validUntil: 'No Expiry',
        merchant: 'Steam',
        coverImage: 'https://picsum.photos/seed/steam/300/200',
      },
    ],
    reviews: [
      {
        id: 'r-10',
        user: 'GamerGirl',
        avatar: 'https://picsum.photos/seed/gamer/50/50',
        rating: 4,
        date: '2026-03-01',
        content: 'Code worked perfectly, delivered in seconds.',
      },
    ],
  },
  {
    id: 'claw-009',
    name: 'QuickBites Delivery',
    description: 'Fast food ordering and restaurant discount vouchers.',
    category: 'Dining',
    rating: 4.6,
    completedOrders: 120000,
    location: 'New York, NY',
    verified: true,
    tags: ['Food Delivery', 'Vouchers', 'Restaurants'],
    logo: 'https://picsum.photos/seed/food/150/150',
    about:
      'QuickBites Delivery offers lightning-fast food delivery from top local restaurants, plus exclusive dining vouchers and deals.',
    established: '2021',
    responseRate: '97.5%',
    contactEmail: 'orders@quickbites.com',
    website: 'https://quickbites.com',
    products: [
      {
        id: 'p-20',
        type: 'food',
        name: 'Artisan Pizza Combo',
        description: 'Large 2-topping pizza with garlic knots and a 2L soda.',
        price: '$24.99',
        restaurant: "Luigi's Pizzeria",
        deliveryTime: '30-45 mins',
        rating: 4.8,
        coverImage: 'https://picsum.photos/seed/pizza/300/200',
      },
      {
        id: 'p-21',
        type: 'coupon',
        name: 'Starbucks $20 Voucher',
        description: 'Digital voucher for any Starbucks location.',
        price: '$18.00',
        discount: '10% OFF',
        validUntil: '2026-12-31',
        merchant: 'Starbucks',
        coverImage: 'https://picsum.photos/seed/starbucks/300/200',
      },
    ],
    reviews: [
      {
        id: 'r-11',
        user: 'FoodieNYC',
        avatar: 'https://picsum.photos/seed/foodie/50/50',
        rating: 5,
        date: '2026-03-10',
        content: 'Pizza arrived hot and the voucher saved me money on coffee!',
      },
    ],
  },
];

class ClawService implements IClawService {
  private data: ClawDetail[] = [...MOCK_CLAWS];

  async getList(params: ListParams = {}): Promise<PaginatedResult<ClawInstance>> {
    await delay();

    let filtered = [...this.data];
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (claw) =>
          claw.name.toLowerCase().includes(lowerKeyword) ||
          claw.description.toLowerCase().includes(lowerKeyword) ||
          claw.category.toLowerCase().includes(lowerKeyword),
      );
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const items = filtered
      .slice(start, start + pageSize)
      .map(
        ({
          about,
          established,
          responseRate,
          products,
          reviews,
          contactEmail,
          website,
          ...rest
        }) => rest,
      );

    return {
      items,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
    };
  }

  async getById(id: string): Promise<ClawDetail | null> {
    await delay();
    return this.data.find((claw) => claw.id === id) ?? null;
  }

  async create(data: CreateClawDTO): Promise<ClawDetail> {
    await delay();

    const newClaw: ClawDetail = {
      id: `claw-${Date.now()}`,
      rating: 0,
      completedOrders: 0,
      verified: false,
      products: [],
      reviews: [],
      responseRate: '100%',
      ...data,
    };

    this.data.push(newClaw);
    return newClaw;
  }

  async update(id: string, data: UpdateClawDTO): Promise<ClawDetail> {
    await delay();

    const index = this.data.findIndex((claw) => claw.id === id);
    if (index === -1) {
      throw new Error('Claw not found');
    }

    this.data[index] = { ...this.data[index], ...data };
    return this.data[index];
  }

  async delete(id: string): Promise<boolean> {
    await delay();

    const initialLength = this.data.length;
    this.data = this.data.filter((claw) => claw.id !== id);
    return this.data.length < initialLength;
  }

  async getClaws(): Promise<ClawInstance[]> {
    await delay();

    return this.data.map(
      ({
        about,
        established,
        responseRate,
        products,
        reviews,
        contactEmail,
        website,
        ...rest
      }) => rest,
    );
  }

  async getClawDetail(id: string): Promise<ClawDetail | undefined> {
    await delay();
    return this.data.find((claw) => claw.id === id);
  }

  async getCategories(): Promise<ClawCategory[]> {
    await delay(100);
    return ECOM_CATEGORIES;
  }
}

export const clawService = new ClawService();
