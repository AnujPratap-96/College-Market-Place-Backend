import prisma from '../../lib/prisma';
import { ProductStatus, ProductType } from '@prisma/client';
import { campusVectorService } from './campus-vector.service';
import { settingsService } from '../admin/settings.service';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

export interface AssistantResponse {
  message: string;
  products?: Array<{
    id: string;
    title: string;
    price: number;
    type: string;
    category: string;
    status?: string;
    imageUrl?: string | null;
  }>;
  orders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    productId?: string;
    productTitle: string;
    productImage?: string | null;
    productCategory?: string;
    totalAmount: number;
    pickupOtp?: string | null;
    role: string;
    counterparty?: string | null;
  }>;
  wallet?: {
    balance: number;
    escrowBalance: number;
  };
}

class AssistantService {
  async handleChat(userId: string, messages: ChatMessage[], category?: string): Promise<AssistantResponse> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const queryLower = lastUserMessage.toLowerCase();

    if (
      queryLower.includes('wallet') ||
      queryLower.includes('balance') ||
      queryLower.includes('how much money') ||
      queryLower.includes('my escrow')
    ) {
      return this.handleWalletQuery(userId);
    }

    if (
      queryLower.includes('order') ||
      queryLower.includes('track') ||
      queryLower.includes('otp') ||
      queryLower.includes('my purchase') ||
      queryLower.includes('my sale') ||
      queryLower.includes('handover code') ||
      /ord-[a-z0-9-]+/i.test(queryLower)
    ) {
      return this.handleOrdersQuery(userId, queryLower);
    }

    const isPlatformQuery =
      queryLower.includes('platform') ||
      queryLower.includes('fee') ||
      queryLower.includes('commission') ||
      queryLower.includes('charge') ||
      queryLower.includes('prohibited') ||
      queryLower.includes('banned') ||
      queryLower.includes('illegal') ||
      queryLower.includes('restricted') ||
      queryLower.includes('knife') ||
      queryLower.includes('weapon') ||
      queryLower.includes('cheat') ||
      queryLower.includes('leak paper') ||
      queryLower.includes('fake id') ||
      queryLower.includes('drug') ||
      queryLower.includes('auction') ||
      queryLower.includes('bidding') ||
      queryLower.includes('anti-sniping') ||
      queryLower.includes('how it works') ||
      queryLower.includes('how does it work') ||
      queryLower.includes('escrow') ||
      queryLower.includes('safety') ||
      queryLower.includes('safe') ||
      queryLower.includes('meetup') ||
      queryLower.includes('return deposit') ||
      queryLower.includes('security deposit') ||
      queryLower.includes('tiffin vacation') ||
      queryLower.includes('vacation pause') ||
      queryLower.includes('missed delivery') ||
      queryLower.includes('refund policy') ||
      queryLower.includes('dispute') ||
      queryLower.includes('report') ||
      queryLower.includes('withdraw') ||
      queryLower.includes('p2p') ||
      queryLower.includes('transfer money') ||
      queryLower.includes('verification') ||
      queryLower.includes('verify') ||
      queryLower.includes('who can join') ||
      queryLower.includes('rules');

    if (isPlatformQuery) {
      return this.handlePlatformKnowledge(queryLower);
    }

    const greetings = ['hi', 'hello', 'hey', 'help', 'good morning', 'good afternoon', 'good evening', 'who are you', 'what can you do'];
    const isGreeting = greetings.some(g => queryLower === g || queryLower.startsWith(g + ' ') || queryLower.endsWith(' ' + g));

    if (isGreeting && queryLower.length < 25) {
      return {
        message: "Hey there! I am **CampusBuddy**, your campus marketplace assistant. How can I help you today? You can ask me to:\n- 🔍 Find textbooks, calculators, or bike rentals\n- 📦 Check your purchase orders or selling orders & handover OTPs\n- 💰 Check your wallet & escrow balances\n- 🛡️ Learn how campus escrow protection works\n\n*Tip: You can also choose a category from the dropdown above to filter campus listings!*",
      };
    }

    const productKeywords = [
      'book', 'textbook', 'calculator', 'laptop', 'bike', 'cycle', 'rent', 'drafter', 
      'apron', 'cooler', 'buy', 'search', 'find', 'item', 'notes', 'exam', 'tiffin',
      'service', 'tutor', 'subscription', 'price', 'product', 'available', 'cost',
      'goggles', 'headphone', 'keyboard', 'clrs', 'casio', 'sprint', 'engineering',
      'sell', 'listing', 'purchase', 'renting', 'stationery', 'furniture', 'clothing',
      'uniform', 'blazer', 'mattress', 'kettle', 'gadget', 'meal', 'food', 'show', 'all'
    ];

    const hasExplicitCategory = Boolean(category && category !== 'all');
    const isProductRelated = hasExplicitCategory || productKeywords.some(kw => queryLower.includes(kw));

    if (isProductRelated) {
      const searchResult = await this.handleProductSearch(queryLower, category);
      if (searchResult.products && searchResult.products.length > 0) {
        return searchResult;
      }
      return {
        message: `I searched the campus catalog${hasExplicitCategory ? ` in **${category}**` : ''} but couldn't find any available listings matching that request right now. Try searching for other items like **textbooks**, **calculators**, **mountain bikes**, or **tiffin plans**.`,
      };
    }

    return {
      message: "I am **CampusBuddy**, an AI assistant exclusively for College Marketplace. I can only assist with campus marketplace activities: finding items to buy or rent (textbooks, calculators, bikes), checking your active orders and handover OTPs, checking your wallet balance, or explaining campus escrow safety rules. I cannot answer general knowledge, homework, or external questions.",
    };
  }

  private async handleWalletQuery(userId: string): Promise<AssistantResponse> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    const balance = wallet ? wallet.balance : 0;
    const escrowBalance = wallet ? wallet.escrowBalance : 0;

    return {
      message: `### Your Campus Wallet Overview\n- **Available Balance:** ₹${balance.toFixed(2)}\n- **Locked in Escrow:** ₹${escrowBalance.toFixed(2)}\n\n${escrowBalance > 0 ? '*Your escrow funds are held securely until item handover is verified.*' : '*You have sufficient funds to place orders on campus.*'}`,
      wallet: {
        balance,
        escrowBalance,
      },
    };
  }

  private async handleOrdersQuery(userId: string, query: string): Promise<AssistantResponse> {
    const isSellQuery =
      query.includes('sell') ||
      query.includes('sold') ||
      query.includes('sale') ||
      query.includes('seller') ||
      query.includes('fulfill') ||
      query.includes('my listings sold');

    const isBuyQuery =
      query.includes('buy') ||
      query.includes('purchase') ||
      query.includes('bought') ||
      query.includes('booked') ||
      query.includes('booking');

    let whereClause: any = {};
    let mode: 'SELL' | 'BUY' | 'ALL' = 'ALL';

    if (isSellQuery && !isBuyQuery) {
      whereClause = { sellerId: userId };
      mode = 'SELL';
    } else if (isBuyQuery && !isSellQuery) {
      whereClause = { buyerId: userId };
      mode = 'BUY';
    } else if (
      query.includes('my order') ||
      query.includes('my orders') ||
      query.includes('track') ||
      query.includes('otp') ||
      query.includes('my purchase')
    ) {
      whereClause = { buyerId: userId };
      mode = 'BUY';
    } else {
      whereClause = {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      };
      mode = 'ALL';
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            imageUrl: true,
            images: true,
            category: true,
            type: true,
          },
        },
        buyer: {
          select: {
            name: true,
            phone: true,
          },
        },
        seller: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    if (orders.length === 0) {
      if (mode === 'SELL') {
        return {
          message: "You don't have any sales or selling orders yet. List items on campus to start earning!",
        };
      }
      return {
        message: "You don't have any purchase or booking orders yet. Browse our campus catalog to buy or rent items!",
      };
    }

    const formattedOrders = orders.map(o => {
      const isBuyer = o.buyerId === userId;
      const productImg = o.product.imageUrl || (o.product.images && o.product.images.length > 0 ? o.product.images[0] : null);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        productId: o.product.id,
        productTitle: o.product.title,
        productImage: productImg,
        productCategory: o.product.category,
        totalAmount: o.totalAmount,
        pickupOtp: isBuyer ? o.pickupOtp : null,
        role: isBuyer ? 'Buyer' : 'Seller',
        counterparty: isBuyer ? o.seller?.name : o.buyer?.name,
      };
    });

    let text = '';
    if (mode === 'SELL') {
      text = `Here are your recent **sales & selling orders**:\n\n`;
      for (const o of orders) {
        text += `- **#${o.orderNumber}** (${o.product.title})\n  Status: **${o.status}** • Amount: **₹${o.totalAmount.toFixed(2)}** • Buyer: **${o.buyer?.name || 'Student'}**`;
        if (o.status === 'ESCROW_HELD') {
          text += `\n  📦 *Handover item to buyer and enter their 6-digit OTP to release payment to your wallet.*`;
        } else if (o.status === 'RENTAL_ACTIVE') {
          text += `\n  🚲 *Active rental. Enter buyer's Return OTP when item returned to release deposit.*`;
        }
        text += `\n`;
      }
    } else if (mode === 'BUY') {
      text = `Here are your recent **purchases & bookings**:\n\n`;
      for (const o of orders) {
        text += `- **#${o.orderNumber}** (${o.product.title})\n  Status: **${o.status}** • Total: **₹${o.totalAmount.toFixed(2)}** • Seller: **${o.seller?.name || 'Student'}**`;
        if (o.pickupOtp && o.status === 'ESCROW_HELD') {
          text += `\n  🔑 **Your Pickup OTP:** \`${o.pickupOtp}\` *(Share with seller only after inspecting the item)*`;
        }
        text += `\n`;
      }
    } else {
      text = `Here are your recent **campus orders**:\n\n`;
      for (const o of orders) {
        const isBuyer = o.buyerId === userId;
        const roleLabel = isBuyer ? 'Purchase' : 'Sale';
        const partyLabel = isBuyer ? `Seller: ${o.seller?.name || 'Student'}` : `Buyer: ${o.buyer?.name || 'Student'}`;
        text += `- **#${o.orderNumber}** [${roleLabel}] (${o.product.title})\n  Status: **${o.status}** • Total: **₹${o.totalAmount.toFixed(2)}** • ${partyLabel}`;
        if (isBuyer && o.pickupOtp && o.status === 'ESCROW_HELD') {
          text += `\n  🔑 **Your Pickup OTP:** \`${o.pickupOtp}\``;
        }
        text += `\n`;
      }
    }

    return {
      message: text,
      orders: formattedOrders,
    };
  }

  private async handleProductSearch(query: string, categoryParam?: string): Promise<AssistantResponse> {
    let typeFilter: ProductType | undefined = undefined;
    if (query.includes('rent') || query.includes('rental')) {
      typeFilter = ProductType.RENT;
    } else if (query.includes('service') || query.includes('tutor') || query.includes('cleaning')) {
      typeFilter = ProductType.SERVICE;
    } else if (query.includes('tiffin') || query.includes('subscription') || query.includes('daily')) {
      typeFilter = ProductType.SUBSCRIPTION;
    }

    let detectedCategory = categoryParam && categoryParam !== 'all' ? categoryParam.toLowerCase() : undefined;
    if (!detectedCategory) {
      if (query.includes('book') || query.includes('textbook') || query.includes('notes')) detectedCategory = 'books';
      else if (query.includes('stationery') || query.includes('drafter') || query.includes('calculator')) detectedCategory = 'stationery';
      else if (query.includes('electronic') || query.includes('laptop') || query.includes('gadget') || query.includes('headphone') || query.includes('keyboard')) detectedCategory = 'electronics';
      else if (query.includes('cycle') || query.includes('bike') || query.includes('bicycle')) detectedCategory = 'cycles';
      else if (query.includes('cloth') || query.includes('uniform') || query.includes('blazer')) detectedCategory = 'clothing';
      else if (query.includes('essential') || query.includes('cooler') || query.includes('mattress') || query.includes('kettle')) detectedCategory = 'essentials';
      else if (query.includes('furniture') || query.includes('table') || query.includes('chair') || query.includes('desk')) detectedCategory = 'furniture';
      else if (query.includes('food') || query.includes('meal') || query.includes('tiffin')) detectedCategory = 'food';
      else if (query.includes('service') || query.includes('tutor') || query.includes('gig')) detectedCategory = 'services';
    }

    const queryEmbedding = await campusVectorService.generateEmbedding(query);
    const vectorMatches = await campusVectorService.searchSimilar(queryEmbedding, 8, 0.08);

    let matchedProducts = vectorMatches
      .map(item => item.product)
      .filter(p => (typeFilter ? p.type === typeFilter : true))
      .filter(p => (detectedCategory ? p.category.toLowerCase().includes(detectedCategory) : true));

    if (matchedProducts.length === 0) {
      const cleanTokens = query
        .replace(/find|search|show|me|have|you|any|the|a|for|in|category|items|listings|available|please/gi, '')
        .trim()
        .split(/\s+/)
        .filter(t => t.length > 2);

      const categoryWhere = detectedCategory
        ? {
            OR: [
              { category: { equals: detectedCategory, mode: 'insensitive' as const } },
              { category: { contains: detectedCategory, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const dbFallback = await prisma.product.findMany({
        where: {
          status: {
            in: [ProductStatus.AVAILABLE, ProductStatus.RENTED],
          },
          ...(typeFilter ? { type: typeFilter } : {}),
          ...categoryWhere,
          ...(cleanTokens.length > 0
            ? {
                OR: cleanTokens.map(token => ({
                  OR: [
                    { title: { contains: token, mode: 'insensitive' as const } },
                    { description: { contains: token, mode: 'insensitive' as const } },
                    { category: { contains: token, mode: 'insensitive' as const } },
                  ],
                })),
              }
            : {}),
        },
        select: {
          id: true,
          title: true,
          price: true,
          type: true,
          category: true,
          status: true,
          imageUrl: true,
          images: true,
        },
        take: 8,
      });

      matchedProducts = dbFallback.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        type: p.type,
        category: p.category,
        status: p.status,
        imageUrl: p.imageUrl || (p.images && p.images.length > 0 ? p.images[0] : null),
        description: '',
        embedding: [],
      }));
    } else {
      const pIds = matchedProducts.map(p => p.id);
      const dbFresh = await prisma.product.findMany({
        where: { id: { in: pIds } },
        select: { id: true, imageUrl: true, images: true },
      });
      const imgLookup = new Map(dbFresh.map(df => [df.id, df.imageUrl || (df.images && df.images.length > 0 ? df.images[0] : null)]));
      for (const mp of matchedProducts) {
        if (!mp.imageUrl && imgLookup.has(mp.id)) {
          mp.imageUrl = imgLookup.get(mp.id) || null;
        }
      }
    }

    if (matchedProducts.length === 0) {
      return {
        message: `I couldn't find any campus items matching that search${detectedCategory ? ` in **${detectedCategory}**` : ''} right now. Try searching for **textbooks**, **calculator**, **bike**, or **tiffin**.`,
      };
    }

    let text = `Found **${matchedProducts.length} matching campus listings**${detectedCategory ? ` in **${detectedCategory}**` : ''}:\n\n`;
    for (const p of matchedProducts) {
      if (p.status === ProductStatus.RENTED) {
        text += `- **${p.title}** (₹${p.price}) [${p.type} • ${p.category}] — ⏳ *Currently Rented (Can be rented once returned)*\n`;
      } else {
        text += `- **${p.title}** (₹${p.price}) [${p.type} • ${p.category}]\n`;
      }
    }

    return {
      message: text,
      products: matchedProducts.map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        type: p.type,
        category: p.category,
        status: p.status,
        imageUrl: p.imageUrl,
      })),
    };
  }

  private async handlePlatformKnowledge(query: string): Promise<AssistantResponse> {
    if (
      query.includes('fee') ||
      query.includes('commission') ||
      query.includes('charge') ||
      query.includes('cut') ||
      query.includes('cost to sell')
    ) {
      const commissionRate = await settingsService.getPlatformCommissionRate();
      const percent = (commissionRate * 100).toFixed(1);
      return {
        message: `### 💰 Platform Fees & Pricing\n- **Creating Listings:** 100% Free for all verified college students.\n- **Platform Fee:** **${percent}%** per completed transaction. This covers escrow protection, payment gateway fees, and platform infrastructure.\n- **Deposits & Refunds:** 0% deduction. Security deposits and vacation pause refunds are returned in full to your wallet with zero fee.\n- **P2P Student Transfers:** Instant and completely free of charge.`,
      };
    }

    if (
      query.includes('prohibited') ||
      query.includes('banned') ||
      query.includes('illegal') ||
      query.includes('restricted') ||
      query.includes('weapon') ||
      query.includes('knife') ||
      query.includes('drug') ||
      query.includes('weed') ||
      query.includes('cheat') ||
      query.includes('leak paper') ||
      query.includes('fake id')
    ) {
      return {
        message: `### 🚫 Prohibited & Banned Items\nTo keep campus safe and compliant with university regulations, the following are strictly prohibited on College Marketplace:\n- **Weapons & Harmful Objects:** Firearms, switchblades, hunting knives, explosives.\n- **Substances:** Alcohol, tobacco, cannabis/weed, prescription drugs, vaping gear.\n- **Academic Dishonesty:** Leaked exam question papers, paid impersonation services, test answer keys.\n- **Counterfeits & Piracy:** Fake student IDs, pirated software, cracked license keys, stolen property.\n\n*Our automated filter flags listings containing restricted keywords. Accounts attempting to sell prohibited items face immediate permanent bans and notification to college proctors.*`,
      };
    }

    if (
      query.includes('auction') ||
      query.includes('bidding') ||
      query.includes('bid') ||
      query.includes('anti-sniping')
    ) {
      return {
        message: `### 🔨 Campus Auctions & Bidding\n- **Live Bidding:** Sellers can list high-demand items (laptops, gaming gear, cycles) as auctions with a starting bid and end timer.\n- **Minimum Increment:** Bids must increase by at least ₹50.\n- **Anti-Sniping Shield:** If a bid is submitted in the final 60 seconds, the auction timer automatically extends by 60 seconds to ensure fair bidding.\n- **Winning the Auction:** When the timer expires, an escrow order is automatically created for the winning bidder to complete handover.`,
      };
    }

    if (
      query.includes('service') ||
      query.includes('gig') ||
      query.includes('tutoring') ||
      query.includes('hire') ||
      query.includes('tutor')
    ) {
      return {
        message: `### 🛠️ Campus Services & Gigs\n- **Offer or Book Gigs:** Students can offer coding help, CAD drafting, exam tutoring, laundry, or bike repairs.\n- **Milestone Escrow:** When booking a service, payment is safely held in escrow.\n- **Handover Flow:** The provider completes the task and clicks *Mark Service Delivered*. Once the student inspects and confirms satisfaction, funds are released to the provider.`,
      };
    }

    if (
      query.includes('vacation') ||
      query.includes('tiffin') ||
      query.includes('subscription') ||
      query.includes('meal') ||
      query.includes('missed delivery')
    ) {
      return {
        message: `### 🍱 Tiffin & Subscription Plans\n- **Flexible Schedules:** Subscribe to weekly or monthly hostel tiffin meals, daily fresh milk, or laundry plans.\n- **Vacation Pause:** Leaving for semester breaks or festivals? Go to **Dashboard → Subscriptions → Set Vacation Pause** to choose your vacation dates. You receive an **instant pro-rata refund** to your wallet for all paused days!\n- **Report Missed Delivery:** If a meal or delivery wasn't provided, click *Report Missed* on your delivery calendar for an instant 1-day refund.`,
      };
    }

    if (
      query.includes('deposit') ||
      query.includes('return otp') ||
      query.includes('security deposit')
    ) {
      return {
        message: `### 🚲 Campus Rentals & Security Deposits\n- **Save Money:** Rent bicycles, drafters, scientific calculators, or coolers by the day.\n- **Escrow Deposit:** A refundable security deposit is locked in escrow during your rental duration.\n- **Safe Return:** When returning the item in good condition, the owner enters your **Return OTP**, instantly unlocking and returning 100% of your deposit back to your wallet.`,
      };
    }

    if (
      query.includes('withdraw') ||
      query.includes('topup') ||
      query.includes('top up') ||
      query.includes('p2p') ||
      query.includes('transfer money')
    ) {
      const minWithdraw = await settingsService.getMinWithdrawalAmount();
      return {
        message: `### 💳 Campus Wallet, P2P Transfers & Withdrawals\n- **Instant Top-Up:** Add funds to your campus wallet using UPI, debit cards, or net banking.\n- **Free P2P Transfers:** Send money directly to college friends using their phone number or college email with 0 fees.\n- **Bank Withdrawals:** Withdraw earnings from sales to your verified bank account (Minimum withdrawal: ₹${minWithdraw}).\n- **Audit Ledger:** Every single credit, debit, escrow hold, and refund is recorded transparently in your personal wallet ledger.`,
      };
    }

    if (
      query.includes('dispute') ||
      query.includes('report') ||
      query.includes('scam') ||
      query.includes('fake') ||
      query.includes('broken') ||
      query.includes('defective')
    ) {
      const autoDays = await settingsService.getSetting('auto_complete_days', '3');
      return {
        message: `### 🛡️ Disputes, Reports & Buyer Protection\n- **DO NOT share OTP:** Always inspect the item first. If the item is defective, damaged, or not as described, refuse handover and do **not** give the seller your 6-digit OTP.\n- **Open a Dispute:** Go to **Dashboard → Orders** and click **Dispute Order**. Escrow funds remain frozen.\n- **Resolution Process:** Campus administrators review chat transcripts, submitted photos, and statements to release or refund the escrow.\n- **Report Suspicious Listings:** If any listing violates college rules, click *Report*. Listings with 3 reports are automatically taken down.\n- **Auto-Completion:** Completed orders finalize after ${autoDays} days if no dispute is raised.`,
      };
    }

    if (
      query.includes('verify') ||
      query.includes('verification') ||
      query.includes('who can join') ||
      query.includes('student id') ||
      query.includes('outside') ||
      query.includes('college email') ||
      query.includes('branch') ||
      query.includes('year')
    ) {
      return {
        message: `### 🎓 Student Verification & Campus Exclusivity\n- **Exclusive to Students:** College Marketplace is a verified peer-to-peer community only for enrolled college students and faculty.\n- **Student Profile:** Accounts require your college name, branch, academic year, and verified email/phone.\n- **Verified Badge:** Green checkmark badges designate verified active students to prevent commercial third-party sellers and fraudulent accounts.`,
      };
    }

    if (
      query.includes('escrow') ||
      query.includes('safety') ||
      query.includes('safe') ||
      query.includes('meetup') ||
      query.includes('location') ||
      query.includes('pickup') ||
      query.includes('handover') ||
      query.includes('otp')
    ) {
      return {
        message: `### 🛡️ Campus Escrow & Handover OTP\n- When you buy or rent an item, your money is **not paid directly to the seller**; it is securely locked in College Marketplace Escrow.\n- You receive a secret **6-digit Pickup OTP**.\n- Meet the student at a safe public campus location (Library lobby, Canteen, Student Activity Center).\n- **Only share your 6-digit OTP after physically inspecting the item.**\n- Once the seller enters your OTP in their app, the escrow funds are released to them automatically.`,
      };
    }

    return {
      message: `### 🏛️ College Marketplace Platform Overview\nCollege Marketplace is an end-to-end campus commerce and services platform built exclusively for students.\n\n- 🛒 **Buy & Sell:** Textbooks, electronics, calculators, lab gear\n- 🚲 **Rentals:** Daily rentals with refundable escrow deposits\n- 🔨 **Live Auctions:** Campus bidding with anti-sniping protection\n- 🛠️ **Campus Services:** Peer tutoring, design, assignments, repair\n- 🍱 **Subscriptions:** Tiffin and laundry plans with vacation pause pro-rata refunds\n- 🛡️ **Escrow Protection:** 6-digit OTP handover ensuring you only pay after physical inspection`,
    };
  }
}

export const assistantService = new AssistantService();
