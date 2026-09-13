export interface CatalogItem {
  title: string;
  description: string;
  price: number;
  type: 'SELL' | 'RENT' | 'SERVICE' | 'SUBSCRIPTION' | 'AUCTION';
  category: string;
  imageUrl: string;
  images: string[];
  securityDeposit?: number;
  rentalDuration?: string;
  serviceDuration?: string;
  frequency?: 'WEEKLY' | 'MONTHLY';
  deliverySlots?: string;
  // Auction specific fields
  startingBid?: number;
  minIncrement?: number;
  reservePrice?: number;
  durationHours?: number;
  antiSnipingSeconds?: number;
}

export const AUTHENTIC_CAMPUS_CATALOG: CatalogItem[] = [
  {
    title: "Higher Engineering Mathematics (44th Edition) - B.S. Grewal",
    description: "Standard prescribed textbook for 1st and 2nd year Engineering Mathematics. All pages intact with zero torn sheets. Contains previous 5 years solved university question papers. Ideal for Sem 1/2 exams.",
    price: 420,
    type: "SELL",
    category: "books",
    imageUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Operating System Concepts (10th Edition Dinosaur Book) - Silberschatz",
    description: "Mint condition OS concepts textbook covering processes, threads, memory management, and file systems. Used for 1 semester in CS 3rd year. Comes with handwritten revision summary sheets tucked inside.",
    price: 550,
    type: "SELL",
    category: "books",
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Introduction to Algorithms (CLRS 4th International Edition)",
    description: "The bible of Data Structures and Algorithms by Cormen, Leiserson, Rivest, and Stein. Paperback international edition, like new. Must-have for tech placements and competitive programming preparation.",
    price: 780,
    type: "SELL",
    category: "books",
    imageUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Casio FX-991CW ClassWiz Scientific Calculator (Non-Programmable)",
    description: "Official non-programmable high-resolution natural textbook display scientific calculator approved for university exams. Features quadratic equation solver, matrix 4x4, and calculus operations. Original slide cover included.",
    price: 850,
    type: "SELL",
    category: "electronics",
    imageUrl: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Arduino Mega 2560 Complete IoT Starter Kit + Sensors & Breadboard",
    description: "Used for college Embedded Systems & Robotics minor project. Includes Arduino Mega 2560 R3 board, ultrasonic sensor HC-SR04, DHT11 temp sensor, servo motor, 830-point breadboard, and 65 jumper wires.",
    price: 1199,
    type: "SELL",
    category: "electronics",
    imageUrl: "https://images.unsplash.com/photo-1553406830-ef2513450d76?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1553406830-ef2513450d76?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Logitech MX Master 2S Wireless Ergonomic Mouse",
    description: "Legendary ergonomic coding and productivity mouse. Features hyper-fast electromagnetic scrolling, dual Bluetooth and 2.4GHz dongle connectivity, and gesture button. Battery lasts over 40 days on a single charge.",
    price: 2200,
    type: "SELL",
    category: "electronics",
    imageUrl: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Hero Sprint Pro 26T 21-Speed Hybrid Mountain Bike (With Cable Lock)",
    description: "Sturdy campus commute bicycle with front suspension, dual disc brakes, and 21-speed Shimano gearing. Serviced just 3 weeks ago with new brake pads and lubricated chain. Includes heavy-duty numeric lock and front bell.",
    price: 2600,
    type: "SELL",
    category: "cycles",
    imageUrl: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Ergonomic High-Back Breathable Mesh Study Chair with Lumbar Support",
    description: "Essential for late-night hostel study sessions. Breathable mesh backrest, pneumatic height adjustment, smooth 360-degree swivel wheels, and padded armrests. Extremely comfortable for long hours.",
    price: 1350,
    type: "SELL",
    category: "furniture",
    imageUrl: "https://images.unsplash.com/photo-1580481077195-c54625b0445a?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1580481077195-c54625b0445a?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Bajaj PX 97 Torque 36L Personal Room Air Cooler (Hostel Room Sized)",
    description: "36-liter water tank with Turbo-Fan technology and 3-side honeycomb cooling pads. Compact footprint fits easily in single or double hostel rooms. Super silent and chills the room quickly during hot summer semesters.",
    price: 1850,
    type: "SELL",
    category: "essentials",
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "1-on-1 Data Structures & Algorithms (LeetCode Medium) Mentorship",
    description: "60-minute interactive live coding mentorship session. Includes guidance on Dynamic Programming, Graphs, and Trees with real interview patterns asked at top tech companies. Conducted by an incoming SDE Intern.",
    price: 350,
    type: "SERVICE",
    category: "services",
    serviceDuration: "1 hour session",
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Daily North Indian Homestyle Tiffin Meal (Lunch & Dinner Plan)",
    description: "Fresh, hygienic, homestyle meals delivered directly to your hostel gate. Includes 4 chapatis, dal, dry seasonal sabzi, rice, and salad. Supports CollegeMart 1-click Vacation Pause so you never pay for missed days.",
    price: 2400,
    type: "SUBSCRIPTION",
    category: "services",
    frequency: "MONTHLY",
    deliverySlots: "Lunch (12:45 PM) & Dinner (8:15 PM)",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Senior Clearance: Haier 50L Single Door Compact Hostel Mini-Fridge",
    description: "Outgoing senior clearance sale! 50-liter compact refrigerator with built-in mini ice tray. Runs whisper-quiet on standard hostel power socket. Keeps drinks, milk, fruits, and snacks ice cold. Clean and defrosted.",
    price: 2800,
    type: "AUCTION",
    category: "essentials",
    startingBid: 2400,
    minIncrement: 100,
    reservePrice: 3200,
    durationHours: 48,
    antiSnipingSeconds: 60,
    imageUrl: "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Senior Clearance: Mi 24-inch Full HD 75Hz IPS Gaming & Study Monitor",
    description: "Graduation move-out auction! 24-inch 1080p IPS display with ultra-thin bezels, 75Hz refresh rate, and eye-care low blue light mode. Flawless panel with zero dead pixels. Includes power adapter and braided HDMI cable.",
    price: 3200,
    type: "AUCTION",
    category: "electronics",
    startingBid: 2800,
    minIncrement: 150,
    reservePrice: 4000,
    durationHours: 36,
    antiSnipingSeconds: 60,
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop&q=80"
    ]
  },
  {
    title: "Senior Clearance: Sony WH-1000XM4 Noise Canceling Headphones",
    description: "Industry-leading active noise canceling headphones. Outstanding sound quality and mic for study and library sessions. Includes original hardshell case, 3.5mm audio wire, and USB-C charging cord.",
    price: 5200,
    type: "AUCTION",
    category: "electronics",
    startingBid: 4200,
    minIncrement: 200,
    reservePrice: 6500,
    durationHours: 24,
    antiSnipingSeconds: 60,
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
    ]
  }
];
