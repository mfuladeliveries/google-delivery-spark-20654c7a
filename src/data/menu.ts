export interface SizeOption {
  name: string;
  price: number;
  popular?: boolean;
  description?: string;
}

export interface AddOnOption {
  name: string;
  price: number;
}

/** A meat/portion cut (e.g. Full / Half / Quarter / Wings / Drumsticks). Sets the base price. */
export interface CutOption {
  name: string;
  /** Price per piece (or per portion if min/max pieces are not configured). */
  price: number;
  popular?: boolean;
  description?: string;
  /** Minimum pieces a customer must order for this cut. Defaults to 1. */
  min_pieces?: number;
  /** Maximum pieces a customer can order for this cut. Defaults to 1 (no piece-stepper shown). */
  max_pieces?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  restaurantId?: string;
  restaurantName?: string;
  caption: string;
  image?: string;
  price: number;
  available: boolean;
  // Optional product-customization config (driven by admin)
  has_sizes?: boolean;
  sizes?: SizeOption[];
  has_add_ons?: boolean;
  add_ons?: AddOnOption[];
  max_add_ons?: number;
  /** Required-pick "cut" portion (e.g. chicken cuts). When enabled, replaces the base price. */
  has_cuts?: boolean;
  cuts?: CutOption[];
}

export interface StoreInfo {
  name: string;
  logo: string;
  whatsapp: string;
  email: string;
  currency: string;
  deliveryCharge: number;
  tax: number;
  minimumOrder: number;
  paymentNote: string;
  areas: string;
}

export const storeInfo: StoreInfo = {
  name: "Mfula Deliveries",
  logo: "https://i.ibb.co/1MGVgVv/304529508-450634917088840-7886016806199137700-n.jpg",
  whatsapp: "27686768409",
  email: "mfuladeliveries@gmail.com",
  currency: "R",
  deliveryCharge: 55,
  tax: 0.05,
  minimumOrder: 40,
  paymentNote: "Pay securely online or with cash on delivery",
  areas: "Mfuleni, Bluedowns, Bosasa, Eesteriver, Summerville",
};

export const categories = [
  "All",
  "Kitchen",
  "Mdala Tshisanyama",
  "KFC",
  "Debonnairs Pizza",
  "McDonalds",
  "Pedros",
  "Steers",
  "BURGER KING",
  "Hungry Lion",
  "Fellos Fishery",
  "Shop",
  "Liquor",
];

let _id = 0;
const id = () => String(++_id);

export const menuItems: MenuItem[] = [
  // Kitchen
  {
    id: id(),
    name: "Steam Bread & Umleqwa (Full)",
    category: "Kitchen",
    caption: "Steam bread & Umleqwa",
    image: "https://i.ibb.co/gFps2Mg/IMG-8939.jpg",
    price: 180,
    available: true,
  },
  {
    id: id(),
    name: "Samp & Beef Plate",
    category: "Kitchen",
    caption: "Samp & Beef Plate",
    image: "https://i.ibb.co/tZJhSyf/4383-C27-A-BB23-485-D-888-B-CECBC8-E947-A9.jpg",
    price: 70,
    available: true,
  },
  {
    id: id(),
    name: "Rice & Beef Plate",
    category: "Kitchen",
    caption: "Rice & Beef Plate",
    image: "https://i.ibb.co/dWd1S0s/03-AE7381-F691-4-B38-82-EA-2-A5-AFBFB8-B0-A.jpg",
    price: 70,
    available: true,
  },
  {
    id: id(),
    name: "Rice & Umleqwa Plate",
    category: "Kitchen",
    caption: "Rice & Umleqwa Plate",
    image: "https://i.ibb.co/zJgtprm/334-B8-AB4-D1-BB-4979-A9-A5-B7-DAE0-DBD08-D.jpg",
    price: 70,
    available: true,
  },
  {
    id: id(),
    name: "Isibindi",
    category: "Kitchen",
    caption: "Isibindi",
    price: 70,
    available: true,
  },

  // Mdala Tshisanyama
  {
    id: id(),
    name: "Pork Piece",
    category: "Mdala Tshisanyama",
    caption: "Pork Piece",
    image: "https://i.ibb.co/JqLC5q6/1-C437-FB3-5-A28-4972-BCF9-83-F177-F5-CB11.jpg",
    price: 30,
    available: true,
  },
  {
    id: id(),
    name: "Beef Piece",
    category: "Mdala Tshisanyama",
    caption: "Beef Piece",
    image: "https://i.ibb.co/7WJLbxj/B6133353-6-A59-4048-A36-E-0-ED4-C57-B4-F20.jpg",
    price: 30,
    available: true,
  },
  {
    id: id(),
    name: "Sausage Piece",
    category: "Mdala Tshisanyama",
    caption: "Sausage Piece",
    image: "https://i.ibb.co/vjvxcms/C51-CF6-A6-3906-49-A2-85-DF-945-E0999-BD71.jpg",
    price: 20,
    available: true,
  },

  // KFC
  { id: id(), name: "1 Piece", category: "KFC", caption: "1 Piece", price: 28, available: true },
  {
    id: id(),
    name: "Streetwise 2 & Chips",
    category: "KFC",
    caption: "2 Pieces & Chips",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisetwo_chips.jpg?v=2.35",
    price: 50,
    available: true,
  },
  {
    id: id(),
    name: "Streetwise 3 & Chips",
    category: "KFC",
    caption: "3 Pieces & Chips",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisethree_chip.jpg?v=2.35",
    price: 70,
    available: true,
  },
  {
    id: id(),
    name: "Streetwise 5 & Chips",
    category: "KFC",
    caption: "5 Pieces & Chips",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisefive_chips.jpg?v=2.35",
    price: 110,
    available: true,
  },
  {
    id: id(),
    name: "9 Pieces Bucket",
    category: "KFC",
    caption: "9 Pieces Only",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/9pcbucket3.jpg?v=2.35",
    price: 160,
    available: true,
  },
  {
    id: id(),
    name: "15 Pieces Bucket",
    category: "KFC",
    caption: "15 Pieces Only",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/15pcbucket3.jpg?v=2.35",
    price: 240,
    available: true,
  },
  {
    id: id(),
    name: "21 Pieces Bucket",
    category: "KFC",
    caption: "21 Pieces Only",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/21pcbucket3.jpg?v=2.35",
    price: 310,
    available: true,
  },
  {
    id: id(),
    name: "Nugget Box",
    category: "KFC",
    caption: "4 Nuggets, a crunch burger, small chips & drink",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/Nugg_Box.jpg?v=2.29",
    price: 75,
    available: true,
  },
  {
    id: id(),
    name: "6 Nuggets",
    category: "KFC",
    caption: "6 Nuggets",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/6pc_Nuggets_Items.jpg?v=2.35",
    price: 40,
    available: true,
  },
  {
    id: id(),
    name: "9 Nuggets",
    category: "KFC",
    caption: "9 Nuggets",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/9_Nuggets.jpg?v=2.35",
    price: 50,
    available: true,
  },
  {
    id: id(),
    name: "Classic Twister",
    category: "KFC",
    caption: "Classic Twister",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/sweetchillitwister_only.jpg?v=2.35",
    price: 70,
    available: true,
  },
  {
    id: id(),
    name: "Wrapsta",
    category: "KFC",
    caption: "Wrapsta Only",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/wrapsta.jpg?v=2.35",
    price: 42,
    available: true,
  },
  {
    id: id(),
    name: "Crunch Burger",
    category: "KFC",
    caption: "Crunch Burger",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/crunchburger_only.jpg?v=2.35",
    price: 40,
    available: true,
  },
  {
    id: id(),
    name: "Zinger Burger",
    category: "KFC",
    caption: "Zinger Burger",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/originalzingerburger_only.jpg?v=2.35",
    price: 60,
    available: true,
  },
  {
    id: id(),
    name: "Colonel Burger",
    category: "KFC",
    caption: "Colonel Burger",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/colonelburger_only.jpg?v=2.35",
    price: 60,
    available: true,
  },
  {
    id: id(),
    name: "Double Crunch Burger",
    category: "KFC",
    caption: "Double Crunch Burger",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/doublecrunchburger_only.jpg?v=2.35",
    price: 65,
    available: true,
  },
  {
    id: id(),
    name: "Boxmaster",
    category: "KFC",
    caption: "Boxmaster",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/boxmaster_ori.jpg?v=2.35",
    price: 70,
    available: true,
  },
  {
    id: id(),
    name: "Bucket for One",
    category: "KFC",
    caption: "Bucket for One",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwise_bucket_for_one.jpg?v=2.35",
    price: 50,
    available: true,
  },
  {
    id: id(),
    name: "24 Zinger Wings",
    category: "KFC",
    caption: "24 Zinger Wings",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/24wingbucket.jpg?v=2.35",
    price: 170,
    available: true,
  },
  {
    id: id(),
    name: "10 Zinger Wings",
    category: "KFC",
    caption: "10 Zinger Wings",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/10dunkedwings_only.jpg?v=2.35",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "Family Treat 10 Pieces",
    category: "KFC",
    caption: "Family Treat 10 Pieces",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/Family_Treat_10pc.jpg?v=2.35",
    price: 275,
    available: true,
  },
  {
    id: id(),
    name: "Fully Loaded Box Meal",
    category: "KFC",
    caption: "Fully loaded box meal with buddy drink",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/Fullyfullyburger_original.jpg?v=2.35",
    price: 115,
    available: true,
  },
  {
    id: id(),
    name: "Allstar Lunch Box",
    category: "KFC",
    caption: "Allster Lunch Box with Bottle drink",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/allstarlunchbb.jpg?v=2.35",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Ducked Twisted Box",
    category: "KFC",
    caption: "Ducked Twisted Box",
    price: 115,
    available: true,
  },
  {
    id: id(),
    name: "4 Dunked Wings",
    category: "KFC",
    caption: "4 Dunked Wings",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/4dunkedwings_only.jpg?v=2.35",
    price: 55,
    available: true,
  },
  {
    id: id(),
    name: "10 Dunked Wings",
    category: "KFC",
    caption: "10 Dunked Wings",
    image:
      "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/10dunkedwings_only.jpg?v=2.35",
    price: 95,
    available: true,
  },

  // Debonnairs Pizza
  {
    id: id(),
    name: "Club Pizza",
    category: "Debonnairs Pizza",
    caption: "Club Pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629837575HXY1EWWPw0.jpg",
    price: 90,
    available: true,
  },
  {
    id: id(),
    name: "Something Meaty Pizza",
    category: "Debonnairs Pizza",
    caption: "Something Meaty Pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629837537YE8JRT1ZGf.jpg",
    price: 105,
    available: true,
  },
  {
    id: id(),
    name: "Chicken & Mushroom Pizza",
    category: "Debonnairs Pizza",
    caption: "Chicken & Mushroom Pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629838069dbDSKhNQaX.jpg",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "Tikka Chicken Pizza",
    category: "Debonnairs Pizza",
    caption: "Tikka Chicken Pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/162983803949UQGi0cii.jpg",
    price: 86,
    available: true,
  },
  {
    id: id(),
    name: "Sweet Chilli Chicken Triple Decker",
    category: "Debonnairs Pizza",
    caption: "Sweet Chilli Chicken Tripple Decker Pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629839131uZEQKzJyyV.jpg",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Creamy Chicken Triple Decker",
    category: "Debonnairs Pizza",
    caption: "Creamy Chicken Tripple Decker Pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629839179xbIlRObjBZ.jpg",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Meaty Triple Decker",
    category: "Debonnairs Pizza",
    caption: "MEATY TRIPLE-DECKER PIZZA",
    image: "https://mfuladeliveries.co.za/assets/img/items/16298392371bIt9NVbP2.jpg",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Cocktail Cheese Grillers",
    category: "Debonnairs Pizza",
    caption: "COCKTAIL CHEESE GRILLERS",
    image: "https://debonairspizza.co.za/images/menu/sides/cocktail-cheese-grillers.webp",
    price: 60,
    available: true,
  },
  {
    id: id(),
    name: "Death by Chocolate",
    category: "Debonnairs Pizza",
    caption: "DEATH BY CHOCOLATE",
    image: "https://debonairspizza.co.za/images/menu/sides/death-by-chocolate.webp",
    price: 75,
    available: true,
  },
  {
    id: id(),
    name: "2x Real Deal Large Pizzas",
    category: "Debonnairs Pizza",
    caption: "2 x Real Deal Pizzas",
    image: "https://mfuladeliveries.co.za/assets/img/items/1634755459Hu0xj8829B.jpg",
    price: 200,
    available: true,
  },
  {
    id: id(),
    name: "Small Beef Pizza",
    category: "Debonnairs Pizza",
    caption: "Small Beef Pizza",
    price: 40,
    available: true,
  },
  {
    id: id(),
    name: "Cram Decker Large Pizza",
    category: "Debonnairs Pizza",
    caption: "CHICKEN / MEATY CRAM DECKER PIZZA",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629838471XVLYf7rsYQ.jpg",
    price: 250,
    available: true,
  },
// src/data/menu.ts — McDonald's South Africa full menu

export const mcdonaldsMenu = [

  // ─── BURGERS ───────────────────────────────────────────
  {
    name: "Big Mac",
    description: "Two beef patties, special sauce, lettuce, cheese, pickles, onions on a sesame seed bun",
    price: 69.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"
  },
  {
    name: "Big Mac Meal",
    description: "Big Mac burger with medium fries and medium cold drink",
    price: 109.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
  },
  {
    name: "Quarter Pounder with Cheese",
    description: "100% beef patty, two slices of cheese, onions, pickles, mustard and ketchup",
    price: 74.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&h=300&fit=crop"
  },
  {
    name: "Quarter Pounder with Cheese Meal",
    description: "Quarter Pounder with medium fries and medium cold drink",
    price: 114.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
  },
  {
    name: "McFeast",
    description: "Beef patty, lettuce, tomato, onion, pickles, cheese, Big Mac sauce",
    price: 69.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"
  },
  {
    name: "McFeast Meal",
    description: "McFeast burger with medium fries and medium cold drink",
    price: 109.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
  },
  {
    name: "Double Cheese Burger",
    description: "Two beef patties, two slices of cheese, onions, pickles, mustard and ketchup",
    price: 52.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop"
  },
  {
    name: "Double Cheese Burger Meal",
    description: "Double Cheese Burger with medium fries and medium cold drink",
    price: 94.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
  },
  {
    name: "Cheese Burger",
    description: "Beef patty, cheese, onions, pickles, mustard and ketchup",
    price: 38.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop"
  },
  {
    name: "Hamburger",
    description: "Beef patty, onions, pickles, mustard and ketchup on a soft bun",
    price: 35.90,
    category: "Burgers",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"
  },

  // ─── CHICKEN ───────────────────────────────────────────
  {
    name: "McChicken",
    description: "Crispy chicken patty, lettuce and mayo on a sesame seed bun",
    price: 52.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"
  },
  {
    name: "McChicken Meal",
    description: "McChicken burger with medium fries and medium cold drink",
    price: 94.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"
  },
  {
    name: "Chicken Legends",
    description: "Crispy chicken fillet, lettuce, tomato and mayo on a sesame seed bun",
    price: 64.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"
  },
  {
    name: "Chicken Legends Meal",
    description: "Chicken Legends burger with medium fries and medium cold drink",
    price: 104.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"
  },
  {
    name: "Spicy Chicken Legends",
    description: "Spicy crispy chicken fillet, lettuce, tomato and spicy mayo",
    price: 67.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"
  },
  {
    name: "Spicy Chicken Legends Meal",
    description: "Spicy Chicken Legends with medium fries and medium cold drink",
    price: 107.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop"
  },
  {
    name: "6 Piece McNuggets",
    description: "6 tender crispy chicken McNuggets served with your choice of dipping sauce",
    price: 49.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop"
  },
  {
    name: "9 Piece McNuggets",
    description: "9 tender crispy chicken McNuggets served with your choice of dipping sauce",
    price: 69.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop"
  },
  {
    name: "20 Piece McNuggets",
    description: "20 tender crispy chicken McNuggets served with two dipping sauces",
    price: 129.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop"
  },
  {
    name: "6 Piece McNuggets Meal",
    description: "6 McNuggets with medium fries and medium cold drink",
    price: 89.90,
    category: "Chicken",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop"
  },

  // ─── WRAPS ─────────────────────────────────────────────
  {
    name: "Crispy Chicken Wrap",
    description: "Crispy chicken strips, lettuce, tomato, cheese and mayo in a flour tortilla",
    price: 59.90,
    category: "Wraps",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop"
  },
  {
    name: "Grilled Chicken Wrap",
    description: "Grilled chicken strips, lettuce, tomato, cheese and mayo in a flour tortilla",
    price: 59.90,
    category: "Wraps",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop"
  },
  {
    name: "Spicy Chicken Wrap",
    description: "Spicy crispy chicken strips, lettuce, tomato, cheese and spicy mayo in a flour tortilla",
    price: 62.90,
    category: "Wraps",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop"
  },

  // ─── SIDES ─────────────────────────────────────────────
  {
    name: "Small Fries",
    description: "Golden crispy McDonald's fries lightly salted",
    price: 29.90,
    category: "Sides",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"
  },
  {
    name: "Medium Fries",
    description: "Golden crispy McDonald's fries lightly salted",
    price: 34.90,
    category: "Sides",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"
  },
  {
    name: "Large Fries",
    description: "Golden crispy McDonald's fries lightly salted",
    price: 39.90,
    category: "Sides",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop"
  },
  {
    name: "Mozzarella Sticks (4 piece)",
    description: "Crispy golden mozzarella sticks served with marinara dipping sauce",
    price: 44.90,
    category: "Sides",
    image: "https://images.unsplash.com/photo-1548340748-6780b5d28aeb?w=400&h=300&fit=crop"
  },
  {
    name: "Apple Slices",
    description: "Fresh apple slices, a lighter side option",
    price: 19.90,
    category: "Sides",
    image: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?w=400&h=300&fit=crop"
  },

  // ─── BREAKFAST ─────────────────────────────────────────
  {
    name: "Egg McMuffin",
    description: "Freshly cracked egg, Canadian bacon and cheese on a toasted English muffin",
    price: 44.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=400&h=300&fit=crop"
  },
  {
    name: "Egg McMuffin Meal",
    description: "Egg McMuffin with hash brown and medium coffee or juice",
    price: 74.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=400&h=300&fit=crop"
  },
  {
    name: "Sausage McMuffin with Egg",
    description: "Pork sausage patty, freshly cracked egg and cheese on a toasted English muffin",
    price: 49.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=400&h=300&fit=crop"
  },
  {
    name: "Sausage McMuffin with Egg Meal",
    description: "Sausage McMuffin with Egg, hash brown and medium coffee or juice",
    price: 79.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=400&h=300&fit=crop"
  },
  {
    name: "Big Breakfast",
    description: "Scrambled egg, pork sausage patty, hash brown and toasted English muffin",
    price: 69.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop"
  },
  {
    name: "Hotcakes",
    description: "Three fluffy pancakes served with syrup and whipped butter",
    price: 44.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&h=300&fit=crop"
  },
  {
    name: "Hotcakes and Sausage",
    description: "Three fluffy pancakes with a pork sausage patty, syrup and whipped butter",
    price: 59.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&h=300&fit=crop"
  },
  {
    name: "Hash Brown",
    description: "Crispy golden hash brown",
    price: 19.90,
    category: "Breakfast",
    image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&h=300&fit=crop"
  },

  // ─── DESSERTS ──────────────────────────────────────────
  {
    name: "McFlurry Oreo",
    description: "Creamy soft serve ice cream blended with Oreo cookie pieces",
    price: 39.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop"
  },
  {
    name: "McFlurry Smarties",
    description: "Creamy soft serve ice cream blended with Smarties",
    price: 39.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop"
  },
  {
    name: "Soft Serve Cone",
    description: "Creamy McDonald's soft serve ice cream in a crispy cone",
    price: 14.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop"
  },
  {
    name: "Sundae Caramel",
    description: "Creamy soft serve ice cream topped with rich caramel sauce",
    price: 29.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop"
  },
  {
    name: "Sundae Chocolate",
    description: "Creamy soft serve ice cream topped with rich chocolate sauce",
    price: 29.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop"
  },
  {
    name: "Apple Pie",
    description: "Warm flaky pastry filled with sweet spiced apple filling",
    price: 24.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1562007908-17c67e878c88?w=400&h=300&fit=crop"
  },
  {
    name: "Chocolate Muffin",
    description: "Rich moist chocolate muffin",
    price: 24.90,
    category: "Desserts",
    image: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&h=300&fit=crop"
  },

  // ─── DRINKS ────────────────────────────────────────────
  {
    name: "Cold Drink Small",
    description: "Your choice of Coca-Cola, Sprite, Fanta Orange or Fanta Grape",
    price: 22.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop"
  },
  {
    name: "Cold Drink Medium",
    description: "Your choice of Coca-Cola, Sprite, Fanta Orange or Fanta Grape",
    price: 27.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop"
  },
  {
    name: "Cold Drink Large",
    description: "Your choice of Coca-Cola, Sprite, Fanta Orange or Fanta Grape",
    price: 32.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop"
  },
  {
    name: "McCafé Americano",
    description: "Rich espresso with hot water, smooth and bold",
    price: 29.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop"
  },
  {
    name: "McCafé Cappuccino",
    description: "Espresso with steamed milk and a thick layer of foam",
    price: 34.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop"
  },
  {
    name: "McCafé Latte",
    description: "Espresso with steamed milk, smooth and creamy",
    price: 34.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1570968915860-54d520919b45?w=400&h=300&fit=crop"
  },
  {
    name: "McCafé Hot Chocolate",
    description: "Rich creamy hot chocolate made with steamed milk",
    price: 32.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400&h=300&fit=crop"
  },
  {
    name: "Orange Juice",
    description: "100% pure squeezed orange juice",
    price: 27.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop"
  },
  {
    name: "Milkshake Chocolate",
    description: "Thick creamy chocolate milkshake",
    price: 44.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop"
  },
  {
    name: "Milkshake Strawberry",
    description: "Thick creamy strawberry milkshake",
    price: 44.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop"
  },
  {
    name: "Milkshake Vanilla",
    description: "Thick creamy vanilla milkshake",
    price: 44.90,
    category: "Drinks",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop"
  },

  // ─── HAPPY MEAL ────────────────────────────────────────
  {
    name: "Happy Meal Hamburger",
    description: "Hamburger, small fries, small cold drink or juice box and a toy",
    price: 59.90,
    category: "Happy Meal",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop"
  },
  {
    name: "Happy Meal Cheese Burger",
    description: "Cheeseburger, small fries, small cold drink or juice box and a toy",
    price: 62.90,
    category: "Happy Meal",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop"
  },
  {
    name: "Happy Meal 4 McNuggets",
    description: "4 McNuggets, small fries, small cold drink or juice box and a toy",
    price: 62.90,
    category: "Happy Meal",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop"
  },

  // ─── SHAREBOXES ────────────────────────────────────────
  {
    name: "Family Box",
    description: "20 McNuggets, 2 large fries, 4 medium cold drinks",
    price: 249.90,
    category: "Shareboxes",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop"
  },
  {
    name: "Burger Bundle",
    description: "4 McFeasts or Big Macs, 4 medium fries, 4 medium cold drinks",
    price: 349.90,
    category: "Shareboxes",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"
  },
];
  // McDonalds
  {
    id: id(),
    name: "Chicken Foldover Meal",
    category: "McDonalds",
    caption: "Chicken Foldover, Chips & Drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_evm_spicy_foldover_meal.png",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Big Mac Meal",
    category: "McDonalds",
    caption: "Big Mac Burger, Chips & Drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_new_bigmac-meal.png",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "Cheeseburger Meal",
    category: "McDonalds",
    caption: "Cheeseburger, Chips & Drink",
    image: "https://cdn-assets.scoot.co.za/product-images/chilli-cheese-chk-sgl-meal.png",
    price: 75,
    available: true,
  },
  {
    id: id(),
    name: "Chilli Cheese Double Burger Meal",
    category: "McDonalds",
    caption: "Chilli Cheese Double Burger, Chips & Drink",
    image: "https://cdn-assets.scoot.co.za/product-images/chilli-cheese-chk-dbl-meal.png",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "Double Cheeseburger Meal",
    category: "McDonalds",
    caption: "Double Cheeseburger, Chips & Drink",
    image:
      "https://cdn-assets.b2b-vegas.kroc.orderin.co.za/product-images/double_cheese_burger_meal.png",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "McFeast Burger Meal",
    category: "McDonalds",
    caption: "McFeast Burger, Chips & Drink",
    image:
      "https://cdn-assets.scoot.co.za/product-images/cso_2043_medium-evm_mcfeast-medium-meal.png",
    price: 120,
    available: true,
  },
  {
    id: id(),
    name: "McRoyale Burger Meal",
    category: "McDonalds",
    caption: "McRoyale Burger, Chips & Drink",
    image:
      "https://cdn-assets.scoot.co.za/product-images/cso_2504_medium-evm_mcroyale-medium-meal.png",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Quarter Pounder with Cheese",
    category: "McDonalds",
    caption: "Quarter Pounder with Cheese Burger, Chips & Drink",
    image:
      "https://cdn-assets.scoot.co.za/product-images/cso_2503_medium-evm_quarter-cheese-medium-meal.png",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "Chicken McNuggets",
    category: "McDonalds",
    caption: "Pieces of Chicken McNuggets",
    image:
      "https://cdn-assets.scoot.co.za/product-images/cso_2507_medium-evm_cajun-chicken-medium-meal.png",
    price: 47,
    available: true,
  },
  {
    id: id(),
    name: "Cajun Chicken Burger Meal",
    category: "McDonalds",
    caption: "Cajun Chicken Burger, Chips & Drink",
    image:
      "https://cdn-assets.scoot.co.za/product-images/cso_2507_medium-evm_cajun-chicken-medium-meal.png",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Double Jalapeño Chicken Burger",
    category: "McDonalds",
    caption: "Double Jalapeño Chicken Burger, Chips & Drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_jalapeno-double-med-meal.png",
    price: 80,
    available: true,
  },
  {
    id: id(),
    name: "Grand Chicken Spicy Meal",
    category: "McDonalds",
    caption: "Grand Chicken Spicy Burger, Chips & Drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_grand-chicken-spicy-regular-meal.png",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "McChicken Burger Meal",
    category: "McDonalds",
    caption: "McChicken Burger, Chips & Drink",
    image:
      "https://cdn-assets.scoot.co.za/product-images/cso_2502_medium-evm_mcchicken-medium-meal.png",
    price: 80,
    available: true,
  },

  // Pedros
  {
    id: id(),
    name: "Happy Meal",
    category: "Pedros",
    caption: "Full Chicken",
    image: "https://static.yumbi.com/management/api/resource/?id=251197&ts=1692341562000",
    price: 170,
    available: true,
  },
  {
    id: id(),
    name: "Viva Meal",
    category: "Pedros",
    caption: "Full Chicken, Large Chips & 4 Rolls",
    image: "https://static.yumbi.com/management/api/resource/?id=251197&ts=1692341562000",
    price: 170,
    available: true,
  },
  {
    id: id(),
    name: "Full Chicken & Chips",
    category: "Pedros",
    caption: "Full Chicken & Large Chips",
    image: "https://static.yumbi.com/management/api/resource/?id=251197&ts=1692341562000",
    price: 160,
    available: true,
  },
  {
    id: id(),
    name: "4 Wings",
    category: "Pedros",
    caption: "4 Wings",
    image:
      "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/4-Wings-Chips.png?fit=500%2C500&ssl=1",
    price: 50,
    available: true,
  },
  {
    id: id(),
    name: "1/4 Chicken, Chips & Roll",
    category: "Pedros",
    caption: "1/4 Chicken, Chips & Roll",
    image: "https://static.yumbi.com/management/api/resource/?id=251199&ts=1692341562000",
    price: 60,
    available: true,
  },
  {
    id: id(),
    name: "1/2 Chicken & Chips",
    category: "Pedros",
    caption: "1/2 Chicken & Chips",
    image:
      "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/1%EF%80%A62-Chicken-Chips.png?fit=500%2C500&ssl=1",
    price: 90,
    available: true,
  },
  {
    id: id(),
    name: "Full Chicken Only",
    category: "Pedros",
    caption: "Full Chicken Only",
    image:
      "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/Full-Chicken.png?fit=500%2C500&ssl=1",
    price: 140,
    available: true,
  },
  {
    id: id(),
    name: "1/4 Chicken, Pap & Chakalaka",
    category: "Pedros",
    caption: "1/4 Chicken, Pap & Chakalaka",
    price: 55,
    available: true,
  },
  {
    id: id(),
    name: "1/4 Chicken Paella",
    category: "Pedros",
    caption: "Sprinkle Chicken, Basting Sauce & Rice",
    image:
      "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/1%EF%80%A64-Chicken-Paella.png?fit=500%2C500&ssl=1",
    price: 55,
    available: true,
  },
  {
    id: id(),
    name: "1/2 Chicken Paella",
    category: "Pedros",
    caption: "4 Pieces of Sprinkle Chicken & Large Rice",
    image:
      "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/1%EF%80%A62-Chicken-Paella.png?fit=500%2C500&ssl=1",
    price: 85,
    available: true,
  },
  {
    id: id(),
    name: "Chicken Platter",
    category: "Pedros",
    caption: "Chicken Platter",
    price: 520,
    available: true,
  },

  // Fellos Fishery
  {
    id: id(),
    name: "Snoek Parcel",
    category: "Fellos Fishery",
    caption: "Snoek & Chips",
    image: "https://i.ibb.co/DR2gK3x/OIP.jpg",
    price: 110,
    available: true,
  },
  {
    id: id(),
    name: "Hake Parcel",
    category: "Fellos Fishery",
    caption: "Hake & Chips",
    image: "https://i.ibb.co/DR2gK3x/OIP.jpg",
    price: 120,
    available: true,
  },
  {
    id: id(),
    name: "Ladies Parcel",
    category: "Fellos Fishery",
    caption: "Snoek, Hake & Chips parcel",
    price: 120,
    available: true,
  },

  // Emcimbini / Gusha / Mnqambulo
  {
    id: id(),
    name: "Gusha Braai Meat",
    category: "Mdala Tshisanyama",
    caption: "Gusha eNenyongo",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629240870Dx4l4Y1CZ8.jpg",
    price: 15,
    available: true,
  },
  {
    id: id(),
    name: "Bowl (Umnqambulo)",
    category: "Kitchen",
    caption: "Cow Head Meat Bowl",
    image: "https://i.ibb.co/7Vsjyp5/Whats-App-Image-2021-10-26-at-21-56-53.jpg",
    price: 85,
    available: true,
  },

  // Shop
  {
    id: id(),
    name: "2 Litre Drinks",
    category: "Shop",
    caption: "Coke / Stoney / Sprite / Fanta",
    price: 30,
    available: true,
  },
  {
    id: id(),
    name: "1.5 Litre Drinks",
    category: "Shop",
    caption: "Coke / Stoney / Sprite / Fanta",
    price: 20,
    available: true,
  },
  {
    id: id(),
    name: "White Loaf Bread",
    category: "Shop",
    caption: "White Loaf",
    price: 20,
    available: true,
  },
  {
    id: id(),
    name: "Brown Loaf Bread",
    category: "Shop",
    caption: "Brown Loaf",
    price: 20,
    available: true,
  },

  // Burger King
  {
    id: id(),
    name: "4pc Crispy Chicken Wings",
    category: "BURGER KING",
    caption: "4pc Crispy Chicken Wings",
    image: "https://i.ibb.co/G0z8FGj/IMG-5282.webp",
    price: 44,
    available: true,
  },
  {
    id: id(),
    name: "Fience Whopper",
    category: "BURGER KING",
    caption: "Fience Whopper Everyday",
    image: "https://i.ibb.co/ZmtDdzn/IMG-5279.webp",
    price: 95,
    available: true,
  },
  {
    id: id(),
    name: "Fience Chicken",
    category: "BURGER KING",
    caption: "Fience Chicken Everyday",
    image: "https://i.ibb.co/Jv1Zdcn/IMG-5280.webp",
    price: 93,
    available: true,
  },
  {
    id: id(),
    name: "Big King XXL Medium Meal",
    category: "BURGER KING",
    caption: "Big King XXL Medium Meal",
    image: "https://i.ibb.co/51nLC1H/IMG-5281.webp",
    price: 115,
    available: true,
  },
  {
    id: id(),
    name: "6pc Crispy Chicken Wings",
    category: "BURGER KING",
    caption: "6pc Crispy Chicken Wings",
    image: "https://i.ibb.co/G0z8FGj/IMG-5282.webp",
    price: 80,
    available: true,
  },
  {
    id: id(),
    name: "Big King + Cheeseburger",
    category: "BURGER KING",
    caption: "Big King Medium Meal + Cheeseburger",
    image: "https://i.ibb.co/SvqVJjk/IMG-5284.webp",
    price: 100,
    available: true,
  },
  {
    id: id(),
    name: "Whopper Jnr with Cheese",
    category: "BURGER KING",
    caption: "Whopper Jnr with Cheese",
    image: "https://i.ibb.co/ZLC2bng/IMG-5287.webp",
    price: 60,
    available: true,
  },
  {
    id: id(),
    name: "4Pc Crispy Chicken Nuggets",
    category: "BURGER KING",
    caption: "4Pc Crispy Chicken Nuggets",
    image: "https://i.ibb.co/fFNgJVG/IMG-5288.webp",
    price: 45,
    available: true,
  },
  {
    id: id(),
    name: "Big King Sandwich",
    category: "BURGER KING",
    caption: "Big King Sandwich",
    image: "https://i.ibb.co/rfJ9qR6/IMG-5289.webp",
    price: 55,
    available: true,
  },
  {
    id: id(),
    name: "Double Chilli Cheeseburger Meal",
    category: "BURGER KING",
    caption: "Double Chilli Cheeseburger Meal",
    image: "https://i.ibb.co/YNF927Z/IMG-5291.webp",
    price: 75,
    available: true,
  },
  {
    id: id(),
    name: "Original Chicken Sandwich",
    category: "BURGER KING",
    caption: "Original Chicken Sandwich",
    image: "https://i.ibb.co/2dmCGGS/IMG-5290.webp",
    price: 55,
    available: true,
  },
  {
    id: id(),
    name: "Big King Medium Meal",
    category: "BURGER KING",
    caption: "Big King Medium Meal",
    image: "https://i.ibb.co/LS7qmgx/IMG-5292.webp",
    price: 75,
    available: true,
  },
  {
    id: id(),
    name: "Crispy Chicken Cheese Meal",
    category: "BURGER KING",
    caption: "Crispy Chicken With Cheese Medium Meal",
    image: "https://i.ibb.co/52fbsYC/IMG-5293.webp",
    price: 86,
    available: true,
  },
  {
    id: id(),
    name: "King Size Combo 1",
    category: "BURGER KING",
    caption: "King Size Combo 1",
    image: "https://i.ibb.co/jy3HqP5/IMG-5295.webp",
    price: 100,
    available: true,
  },
  {
    id: id(),
    name: "King Size Combo 2",
    category: "BURGER KING",
    caption: "King Size Combo 2",
    image: "https://i.ibb.co/wschWvH/IMG-5296.webp",
    price: 140,
    available: true,
  },
  {
    id: id(),
    name: "King Size Combo 3",
    category: "BURGER KING",
    caption: "King Size Combo 3",
    image: "https://i.ibb.co/gWP2db8/IMG-5297.webp",
    price: 245,
    available: true,
  },
  {
    id: id(),
    name: "King Size Combo 4",
    category: "BURGER KING",
    caption: "King Size Combo 4",
    image: "https://i.ibb.co/qdMWPXq/IMG-5298.webp",
    price: 265,
    available: true,
  },
  {
    id: id(),
    name: "Nacho Cheesy Loaded Fries",
    category: "BURGER KING",
    caption: "Nacho Cheesy Loaded Fries",
    image: "https://i.ibb.co/563GPMK/IMG-5299.webp",
    price: 42,
    available: true,
  },
  {
    id: id(),
    name: "2x BK Fusions",
    category: "BURGER KING",
    caption: "2x BK Fusions",
    image: "https://i.ibb.co/LvnZV4q/IMG-5283.webp",
    price: 73,
    available: true,
  },
  {
    id: id(),
    name: "Quad Stack Medium Meal",
    category: "BURGER KING",
    caption: "Quadruple Stacker Medium Meal",
    price: 158,
    available: true,
  },
  {
    id: id(),
    name: "Double Whopper Large Meal",
    category: "BURGER KING",
    caption: "Double Whooper Large meal",
    price: 120,
    available: true,
  },

  // Liquor
  {
    id: id(),
    name: "Gordons Gin 750ml",
    category: "Liquor",
    caption: "Gordons Gin (750ml)",
    image: "https://i.ibb.co/826FPQv/IMG-8951.webp",
    price: 200,
    available: true,
  },
  {
    id: id(),
    name: "Savanna 500ml 6pk",
    category: "Liquor",
    caption: "Savanna (500ml) 6pck",
    image: "https://i.ibb.co/tJWMczF/IMG-8945.webp",
    price: 200,
    available: true,
  },
  {
    id: id(),
    name: "Savanna 330ml 6pk",
    category: "Liquor",
    caption: "Savanna (330ml) 6pck",
    image: "https://i.ibb.co/GP8pzbL/IMG-8958.webp",
    price: 150,
    available: true,
  },
  {
    id: id(),
    name: "Brutal Fruit 440ml 6pk",
    category: "Liquor",
    caption: "Brutal Fruit (440ml) 6pck",
    image: "https://i.ibb.co/nRzG6Wq/IMG-8949.webp",
    price: 150,
    available: true,
  },
  {
    id: id(),
    name: "Flying Fish 500ml 6pk",
    category: "Liquor",
    caption: "Flying Fish (500ml) 6pck",
    image: "https://i.ibb.co/1dxsr6X/IMG-8954.jpg",
    price: 150,
    available: true,
  },
  {
    id: id(),
    name: "Black Label 500ml 6pk",
    category: "Liquor",
    caption: "Black Label (500ml)",
    image: "https://i.ibb.co/4RqBjGJ/IMG-8953.webp",
    price: 150,
    available: true,
  },
  {
    id: id(),
    name: "Castle Lager 440ml 6pk",
    category: "Liquor",
    caption: "Castle Lager (440ml) 6pck",
    image: "https://i.ibb.co/n3NBvq2/IMG-8952.webp",
    price: 150,
    available: true,
  },
  {
    id: id(),
    name: "Castle Lite 440ml 6pk",
    category: "Liquor",
    caption: "Castle Lite (440ml) 6pck",
    image: "https://i.ibb.co/9WM9p79/IMG-8947.webp",
    price: 150,
    available: true,
  },
  {
    id: id(),
    name: "Amarula 750ml",
    category: "Liquor",
    caption: "Amarula (750ml)",
    image: "https://i.ibb.co/ZSv7JRm/IMG-8957.webp",
    price: 200,
    available: true,
  },
];
