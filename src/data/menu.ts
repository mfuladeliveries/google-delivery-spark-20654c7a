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

export interface CutOption {
  name: string;
  price: number;
  popular?: boolean;
  description?: string;
  min_pieces?: number;
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
  has_sizes?: boolean;
  sizes?: SizeOption[];
  has_add_ons?: boolean;
  add_ons?: AddOnOption[];
  max_add_ons?: number;
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
  paymentNote: "Secure card payments powered by Yoco",
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

  // ─── Kitchen ──────────────────────────────────────────────────────────────
  {
    id: id(), name: "Steam Bread & Umleqwa (Full)", category: "Kitchen",
    caption: "Steam bread & Umleqwa",
    image: "https://i.ibb.co/gFps2Mg/IMG-8939.jpg",
    price: 180, available: true,
  },
  {
    id: id(), name: "Samp & Beef Plate", category: "Kitchen",
    caption: "Samp & Beef Plate",
    image: "https://i.ibb.co/tZJhSyf/4383-C27-A-BB23-485-D-888-B-CECBC8-E947-A9.jpg",
    price: 70, available: true,
  },
  {
    id: id(), name: "Rice & Beef Plate", category: "Kitchen",
    caption: "Rice & Beef Plate",
    image: "https://i.ibb.co/dWd1S0s/03-AE7381-F691-4-B38-82-EA-2-A5-AFBFB8-B0-A.jpg",
    price: 70, available: true,
  },
  {
    id: id(), name: "Rice & Umleqwa Plate", category: "Kitchen",
    caption: "Rice & Umleqwa Plate",
    image: "https://i.ibb.co/zJgtprm/334-B8-AB4-D1-BB-4979-A9-A5-B7-DAE0-DBD08-D.jpg",
    price: 70, available: true,
  },
  {
    id: id(), name: "Isibindi", category: "Kitchen",
    caption: "Isibindi", price: 70, available: true,
  },
  {
    id: id(), name: "Bowl (Umnqambulo)", category: "Kitchen",
    caption: "Cow Head Meat Bowl",
    image: "https://i.ibb.co/7Vsjyp5/Whats-App-Image-2021-10-26-at-21-56-53.jpg",
    price: 85, available: true,
  },

  // ─── Mdala Tshisanyama ────────────────────────────────────────────────────
  {
    id: id(), name: "Pork Piece", category: "Mdala Tshisanyama",
    caption: "Pork Piece",
    image: "https://i.ibb.co/JqLC5q6/1-C437-FB3-5-A28-4972-BCF9-83-F177-F5-CB11.jpg",
    price: 30, available: true,
  },
  {
    id: id(), name: "Beef Piece", category: "Mdala Tshisanyama",
    caption: "Beef Piece",
    image: "https://i.ibb.co/7WJLbxj/B6133353-6-A59-4048-A36-E-0-ED4-C57-B4-F20.jpg",
    price: 30, available: true,
  },
  {
    id: id(), name: "Sausage Piece", category: "Mdala Tshisanyama",
    caption: "Sausage Piece",
    image: "https://i.ibb.co/vjvxcms/C51-CF6-A6-3906-49-A2-85-DF-945-E0999-BD71.jpg",
    price: 20, available: true,
  },
  {
    id: id(), name: "Gusha Braai Meat", category: "Mdala Tshisanyama",
    caption: "Gusha eNenyongo",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629240870Dx4l4Y1CZ8.jpg",
    price: 15, available: true,
  },

  // ─── KFC ──────────────────────────────────────────────────────────────────
  {
    id: id(), name: "1 Piece", category: "KFC",
    caption: "1 Piece Original Recipe chicken",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisetwo_chips.jpg?v=2.35",
    price: 28, available: true,
  },
  {
    id: id(), name: "Streetwise 2 & Chips", category: "KFC",
    caption: "2 Pieces & Chips",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisetwo_chips.jpg?v=2.35",
    price: 50, available: true,
  },
  {
    id: id(), name: "Streetwise 3 & Chips", category: "KFC",
    caption: "3 Pieces & Chips",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisethree_chip.jpg?v=2.35",
    price: 70, available: true,
  },
  {
    id: id(), name: "Streetwise 5 & Chips", category: "KFC",
    caption: "5 Pieces & Chips",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwisefive_chips.jpg?v=2.35",
    price: 110, available: true,
  },
  {
    id: id(), name: "Bucket for One", category: "KFC",
    caption: "2 pieces, chips & drink",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/streetwise_bucket_for_one.jpg?v=2.35",
    price: 50, available: true,
  },
  {
    id: id(), name: "9 Pieces Bucket", category: "KFC",
    caption: "9 Pieces Original Recipe",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/9pcbucket3.jpg?v=2.35",
    price: 160, available: true,
  },
  {
    id: id(), name: "15 Pieces Bucket", category: "KFC",
    caption: "15 Pieces Original Recipe",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/15pcbucket3.jpg?v=2.35",
    price: 240, available: true,
  },
  {
    id: id(), name: "21 Pieces Bucket", category: "KFC",
    caption: "21 Pieces Original Recipe",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/21pcbucket3.jpg?v=2.35",
    price: 310, available: true,
  },
  {
    id: id(), name: "Family Treat 10 Pieces", category: "KFC",
    caption: "10 pieces, 3 large chips & 4 bread rolls",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/Family_Treat_10pc.jpg?v=2.35",
    price: 275, available: true,
  },
  {
    id: id(), name: "Crunch Burger", category: "KFC",
    caption: "Crispy chicken fillet burger",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/crunchburger_only.jpg?v=2.35",
    price: 40, available: true,
  },
  {
    id: id(), name: "Zinger Burger", category: "KFC",
    caption: "Spicy crispy chicken fillet burger",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/originalzingerburger_only.jpg?v=2.35",
    price: 60, available: true,
  },
  {
    id: id(), name: "Double Crunch Burger", category: "KFC",
    caption: "Double crispy chicken fillet burger",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/doublecrunchburger_only.jpg?v=2.35",
    price: 65, available: true,
  },
  {
    id: id(), name: "Colonel Burger", category: "KFC",
    caption: "Crispy chicken, bacon & cheese burger",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/colonelburger_only.jpg?v=2.35",
    price: 60, available: true,
  },
  {
    id: id(), name: "Boxmaster", category: "KFC",
    caption: "Tortilla wrap with chicken, chips & sauces",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/boxmaster_ori.jpg?v=2.35",
    price: 70, available: true,
  },
  {
    id: id(), name: "Classic Twister", category: "KFC",
    caption: "Chicken strip wrap with lettuce & sauce",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/sweetchillitwister_only.jpg?v=2.35",
    price: 70, available: true,
  },
  {
    id: id(), name: "Wrapsta", category: "KFC",
    caption: "Soft tortilla wrap with crispy chicken",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/wrapsta.jpg?v=2.35",
    price: 42, available: true,
  },
  {
    id: id(), name: "6 Nuggets", category: "KFC",
    caption: "6 crispy chicken nuggets",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/6pc_Nuggets_Items.jpg?v=2.35",
    price: 40, available: true,
  },
  {
    id: id(), name: "9 Nuggets", category: "KFC",
    caption: "9 crispy chicken nuggets",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/9_Nuggets.jpg?v=2.35",
    price: 50, available: true,
  },
  {
    id: id(), name: "Nugget Box", category: "KFC",
    caption: "4 nuggets, crunch burger, small chips & drink",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/Nugg_Box.jpg?v=2.29",
    price: 75, available: true,
  },
  {
    id: id(), name: "4 Dunked Wings", category: "KFC",
    caption: "4 saucy dunked wings",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/4dunkedwings_only.jpg?v=2.35",
    price: 55, available: true,
  },
  {
    id: id(), name: "10 Dunked Wings", category: "KFC",
    caption: "10 saucy dunked wings",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/10dunkedwings_only.jpg?v=2.35",
    price: 95, available: true,
  },
  {
    id: id(), name: "10 Zinger Wings", category: "KFC",
    caption: "10 spicy zinger wings",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/10dunkedwings_only.jpg?v=2.35",
    price: 85, available: true,
  },
  {
    id: id(), name: "24 Zinger Wings", category: "KFC",
    caption: "24 spicy zinger wings bucket",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/24wingbucket.jpg?v=2.35",
    price: 170, available: true,
  },
  {
    id: id(), name: "Allstar Lunch Box", category: "KFC",
    caption: "Burger, chips, drink & chocolate",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/allstarlunchbb.jpg?v=2.35",
    price: 95, available: true,
  },
  {
    id: id(), name: "Fully Loaded Box Meal", category: "KFC",
    caption: "Fully loaded box meal with buddy drink",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/Fullyfullyburger_original.jpg?v=2.35",
    price: 115, available: true,
  },
  {
    id: id(), name: "Ducked Twisted Box", category: "KFC",
    caption: "Twister wrap, chips & drink combo",
    image: "https://order.kfc.co.za/Content/OnlineOrderingImages/Menu/Items/lg2x/sweetchillitwister_only.jpg?v=2.35",
    price: 115, available: true,
  },
  {
    id: id(), name: "KFC Small Chips", category: "KFC",
    caption: "Small portion of KFC chips",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 20, available: true,
  },
  {
    id: id(), name: "KFC Large Chips", category: "KFC",
    caption: "Large portion of KFC chips",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 30, available: true,
  },
  {
    id: id(), name: "KFC Coleslaw", category: "KFC",
    caption: "Creamy KFC coleslaw side",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    price: 22, available: true,
  },
  {
    id: id(), name: "Krushers Oreo", category: "KFC",
    caption: "Thick Oreo blended iced drink",
    image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop",
    price: 45, available: true,
  },

  // ─── McDonalds ────────────────────────────────────────────────────────────
  // Burgers
  {
    id: id(), name: "Big Mac", category: "McDonalds",
    caption: "Two beef patties, special sauce, lettuce, cheese, pickles & onions",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 69.90, available: true,
  },
  {
    id: id(), name: "Big Mac Meal", category: "McDonalds",
    caption: "Big Mac, medium chips & medium cold drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_new_bigmac-meal.png",
    price: 109.90, available: true,
  },
  {
    id: id(), name: "McFeast Burger", category: "McDonalds",
    caption: "Beef patty, lettuce, tomato, onion, pickles, cheese & Big Mac sauce",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 69.90, available: true,
  },
  {
    id: id(), name: "McFeast Burger Meal", category: "McDonalds",
    caption: "McFeast, medium chips & medium cold drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_2043_medium-evm_mcfeast-medium-meal.png",
    price: 109.90, available: true,
  },
  {
    id: id(), name: "Quarter Pounder with Cheese", category: "McDonalds",
    caption: "100% beef, two cheese slices, onions, pickles, mustard & ketchup",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_2503_medium-evm_quarter-cheese-medium-meal.png",
    price: 74.90, available: true,
  },
  {
    id: id(), name: "Quarter Pounder Meal", category: "McDonalds",
    caption: "Quarter Pounder with Cheese, medium chips & cold drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_2503_medium-evm_quarter-cheese-medium-meal.png",
    price: 114.90, available: true,
  },
  {
    id: id(), name: "McRoyale Burger Meal", category: "McDonalds",
    caption: "McRoyale burger, chips & drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_2504_medium-evm_mcroyale-medium-meal.png",
    price: 95, available: true,
  },
  {
    id: id(), name: "Double Cheeseburger", category: "McDonalds",
    caption: "Two beef patties, two cheese slices, onions, pickles, mustard & ketchup",
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop",
    price: 52.90, available: true,
  },
  {
    id: id(), name: "Double Cheeseburger Meal", category: "McDonalds",
    caption: "Double Cheeseburger, medium chips & cold drink",
    image: "https://cdn-assets.b2b-vegas.kroc.orderin.co.za/product-images/double_cheese_burger_meal.png",
    price: 94.90, available: true,
  },
  {
    id: id(), name: "Cheeseburger", category: "McDonalds",
    caption: "Beef patty, cheese, onions, pickles, mustard & ketchup",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop",
    price: 38.90, available: true,
  },
  {
    id: id(), name: "Cheeseburger Meal", category: "McDonalds",
    caption: "Cheeseburger, chips & cold drink",
    image: "https://cdn-assets.scoot.co.za/product-images/chilli-cheese-chk-sgl-meal.png",
    price: 75, available: true,
  },
  {
    id: id(), name: "Hamburger", category: "McDonalds",
    caption: "Beef patty, onions, pickles, mustard & ketchup",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 35.90, available: true,
  },
  // Chicken
  {
    id: id(), name: "McChicken Burger Meal", category: "McDonalds",
    caption: "Crispy chicken patty, lettuce, mayo, chips & drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_2502_medium-evm_mcchicken-medium-meal.png",
    price: 94.90, available: true,
  },
  {
    id: id(), name: "Cajun Chicken Burger Meal", category: "McDonalds",
    caption: "Spiced cajun chicken fillet, chips & drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_2507_medium-evm_cajun-chicken-medium-meal.png",
    price: 95, available: true,
  },
  {
    id: id(), name: "Grand Chicken Spicy Meal", category: "McDonalds",
    caption: "Grand spicy crispy chicken fillet, chips & drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_grand-chicken-spicy-regular-meal.png",
    price: 95, available: true,
  },
  {
    id: id(), name: "Chicken Foldover Meal", category: "McDonalds",
    caption: "Chicken foldover wrap, chips & drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_evm_spicy_foldover_meal.png",
    price: 95, available: true,
  },
  {
    id: id(), name: "Double Jalapeño Chicken Meal", category: "McDonalds",
    caption: "Double jalapeño chicken burger, chips & drink",
    image: "https://cdn-assets.scoot.co.za/product-images/cso_jalapeno-double-med-meal.png",
    price: 105, available: true,
  },
  {
    id: id(), name: "6 Piece McNuggets", category: "McDonalds",
    caption: "6 tender crispy McNuggets with dipping sauce",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop",
    price: 49.90, available: true,
  },
  {
    id: id(), name: "9 Piece McNuggets", category: "McDonalds",
    caption: "9 tender crispy McNuggets with dipping sauce",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop",
    price: 69.90, available: true,
  },
  {
    id: id(), name: "20 Piece McNuggets", category: "McDonalds",
    caption: "20 tender crispy McNuggets with two dipping sauces",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop",
    price: 129.90, available: true,
  },
  // Wraps
  {
    id: id(), name: "Crispy Chicken Wrap", category: "McDonalds",
    caption: "Crispy chicken strips, lettuce, tomato, cheese & mayo in a tortilla",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop",
    price: 59.90, available: true,
  },
  {
    id: id(), name: "Grilled Chicken Wrap", category: "McDonalds",
    caption: "Grilled chicken strips, lettuce, tomato, cheese & mayo in a tortilla",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop",
    price: 59.90, available: true,
  },
  // Sides
  {
    id: id(), name: "Small Fries", category: "McDonalds",
    caption: "Golden crispy McDonald's fries",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 29.90, available: true,
  },
  {
    id: id(), name: "Medium Fries", category: "McDonalds",
    caption: "Golden crispy McDonald's fries",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 34.90, available: true,
  },
  {
    id: id(), name: "Large Fries", category: "McDonalds",
    caption: "Golden crispy McDonald's fries",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 39.90, available: true,
  },
  // Breakfast
  {
    id: id(), name: "Egg McMuffin", category: "McDonalds",
    caption: "Freshly cracked egg, bacon & cheese on a toasted English muffin",
    image: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  {
    id: id(), name: "Egg McMuffin Meal", category: "McDonalds",
    caption: "Egg McMuffin, hash brown & coffee or juice",
    image: "https://images.unsplash.com/photo-1603046891726-36bfd957e0bf?w=400&h=300&fit=crop",
    price: 74.90, available: true,
  },
  {
    id: id(), name: "Big Breakfast", category: "McDonalds",
    caption: "Scrambled egg, sausage patty, hash brown & English muffin",
    image: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=300&fit=crop",
    price: 69.90, available: true,
  },
  {
    id: id(), name: "Hotcakes", category: "McDonalds",
    caption: "Three fluffy pancakes with syrup & whipped butter",
    image: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  {
    id: id(), name: "Hash Brown", category: "McDonalds",
    caption: "Crispy golden hash brown",
    image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400&h=300&fit=crop",
    price: 19.90, available: true,
  },
  // Desserts & Drinks
  {
    id: id(), name: "McFlurry Oreo", category: "McDonalds",
    caption: "Soft serve ice cream blended with Oreo cookie pieces",
    image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop",
    price: 39.90, available: true,
  },
  {
    id: id(), name: "McFlurry Smarties", category: "McDonalds",
    caption: "Soft serve ice cream blended with Smarties",
    image: "https://images.unsplash.com/photo-1570197788417-0e82375c9371?w=400&h=300&fit=crop",
    price: 39.90, available: true,
  },
  {
    id: id(), name: "Soft Serve Cone", category: "McDonalds",
    caption: "Creamy McDonald's soft serve in a crispy cone",
    image: "https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop",
    price: 14.90, available: true,
  },
  {
    id: id(), name: "Caramel Sundae", category: "McDonalds",
    caption: "Soft serve ice cream with rich caramel sauce",
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop",
    price: 29.90, available: true,
  },
  {
    id: id(), name: "Apple Pie", category: "McDonalds",
    caption: "Warm flaky pastry filled with sweet spiced apple",
    image: "https://images.unsplash.com/photo-1562007908-17c67e878c88?w=400&h=300&fit=crop",
    price: 24.90, available: true,
  },
  {
    id: id(), name: "McCafé Cappuccino", category: "McDonalds",
    caption: "Espresso with steamed milk and thick foam",
    image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400&h=300&fit=crop",
    price: 34.90, available: true,
  },
  {
    id: id(), name: "McCafé Latte", category: "McDonalds",
    caption: "Smooth espresso with steamed milk",
    image: "https://images.unsplash.com/photo-1570968915860-54d520919b45?w=400&h=300&fit=crop",
    price: 34.90, available: true,
  },
  {
    id: id(), name: "Chocolate Milkshake", category: "McDonalds",
    caption: "Thick creamy chocolate milkshake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  {
    id: id(), name: "Strawberry Milkshake", category: "McDonalds",
    caption: "Thick creamy strawberry milkshake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  // Happy Meal & Share
  {
    id: id(), name: "Happy Meal McNuggets", category: "McDonalds",
    caption: "4 McNuggets, small chips, juice box & toy",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop",
    price: 62.90, available: true,
  },
  {
    id: id(), name: "Happy Meal Cheeseburger", category: "McDonalds",
    caption: "Cheeseburger, small chips, juice box & toy",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop",
    price: 62.90, available: true,
  },
  {
    id: id(), name: "Family Box 20 McNuggets", category: "McDonalds",
    caption: "20 McNuggets, 2 large chips & 4 cold drinks",
    image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&h=300&fit=crop",
    price: 249.90, available: true,
  },

  // ─── Debonnairs Pizza ─────────────────────────────────────────────────────
  {
    id: id(), name: "Club Pizza", category: "Debonnairs Pizza",
    caption: "Chicken, mushroom & peppers on a classic base",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629837575HXY1EWWPw0.jpg",
    price: 90, available: true,
  },
  {
    id: id(), name: "Something Meaty Pizza", category: "Debonnairs Pizza",
    caption: "Loaded meat lovers pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629837537YE8JRT1ZGf.jpg",
    price: 105, available: true,
  },
  {
    id: id(), name: "Chicken & Mushroom Pizza", category: "Debonnairs Pizza",
    caption: "Grilled chicken & mushroom on a classic base",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629838069dbDSKhNQaX.jpg",
    price: 85, available: true,
  },
  {
    id: id(), name: "Tikka Chicken Pizza", category: "Debonnairs Pizza",
    caption: "Spiced tikka chicken on a creamy base",
    image: "https://mfuladeliveries.co.za/assets/img/items/162983803949UQGi0cii.jpg",
    price: 86, available: true,
  },
  {
    id: id(), name: "BBQ Chicken Pizza", category: "Debonnairs Pizza",
    caption: "Smoky BBQ chicken, peppers & onions",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    price: 88, available: true,
  },
  {
    id: id(), name: "Margherita Pizza", category: "Debonnairs Pizza",
    caption: "Classic tomato base, mozzarella & fresh basil",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    price: 75, available: true,
  },
  {
    id: id(), name: "Hawaiian Pizza", category: "Debonnairs Pizza",
    caption: "Ham, pineapple & mozzarella on a tomato base",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    price: 82, available: true,
  },
  {
    id: id(), name: "Veggie Supreme Pizza", category: "Debonnairs Pizza",
    caption: "Roasted peppers, mushrooms, onions & olives",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop",
    price: 80, available: true,
  },
  {
    id: id(), name: "Sweet Chilli Chicken Triple Decker", category: "Debonnairs Pizza",
    caption: "Sweet chilli chicken triple decker pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629839131uZEQKzJyyV.jpg",
    price: 95, available: true,
  },
  {
    id: id(), name: "Creamy Chicken Triple Decker", category: "Debonnairs Pizza",
    caption: "Creamy chicken triple decker pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629839179xbIlRObjBZ.jpg",
    price: 95, available: true,
  },
  {
    id: id(), name: "Meaty Triple Decker", category: "Debonnairs Pizza",
    caption: "Three layers of loaded meat pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/16298392371bIt9NVbP2.jpg",
    price: 95, available: true,
  },
  {
    id: id(), name: "Cram Decker Large Pizza", category: "Debonnairs Pizza",
    caption: "Chicken or meaty cram decker large pizza",
    image: "https://mfuladeliveries.co.za/assets/img/items/1629838471XVLYf7rsYQ.jpg",
    price: 250, available: true,
  },
  {
    id: id(), name: "2x Real Deal Large Pizzas", category: "Debonnairs Pizza",
    caption: "Two large real deal pizzas",
    image: "https://mfuladeliveries.co.za/assets/img/items/1634755459Hu0xj8829B.jpg",
    price: 200, available: true,
  },
  {
    id: id(), name: "Small Beef Pizza", category: "Debonnairs Pizza",
    caption: "Small beef pizza",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    price: 40, available: true,
  },
  {
    id: id(), name: "Cocktail Cheese Grillers", category: "Debonnairs Pizza",
    caption: "Crispy cocktail cheese grillers",
    image: "https://debonairspizza.co.za/images/menu/sides/cocktail-cheese-grillers.webp",
    price: 60, available: true,
  },
  {
    id: id(), name: "Garlic Bread", category: "Debonnairs Pizza",
    caption: "Toasted garlic bread with herb butter",
    image: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&h=300&fit=crop",
    price: 35, available: true,
  },
  {
    id: id(), name: "Cheesy Garlic Bread", category: "Debonnairs Pizza",
    caption: "Toasted garlic bread loaded with mozzarella",
    image: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=400&h=300&fit=crop",
    price: 45, available: true,
  },
  {
    id: id(), name: "Death by Chocolate", category: "Debonnairs Pizza",
    caption: "Rich molten chocolate dessert pizza",
    image: "https://debonairspizza.co.za/images/menu/sides/death-by-chocolate.webp",
    price: 75, available: true,
  },

  // ─── Pedros ───────────────────────────────────────────────────────────────
  {
    id: id(), name: "Full Chicken Only", category: "Pedros",
    caption: "Whole flame-grilled Pedros chicken",
    image: "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/Full-Chicken.png?fit=500%2C500&ssl=1",
    price: 140, available: true,
  },
  {
    id: id(), name: "Full Chicken & Chips", category: "Pedros",
    caption: "Whole flame-grilled chicken with large chips",
    image: "https://static.yumbi.com/management/api/resource/?id=251197&ts=1692341562000",
    price: 160, available: true,
  },
  {
    id: id(), name: "Viva Meal", category: "Pedros",
    caption: "Full chicken, large chips & 4 rolls",
    image: "https://static.yumbi.com/management/api/resource/?id=251197&ts=1692341562000",
    price: 170, available: true,
  },
  {
    id: id(), name: "Happy Meal", category: "Pedros",
    caption: "Full chicken, large chips, 4 rolls & 2L drink",
    image: "https://static.yumbi.com/management/api/resource/?id=251197&ts=1692341562000",
    price: 200, available: true,
  },
  {
    id: id(), name: "1/2 Chicken & Chips", category: "Pedros",
    caption: "Half flame-grilled chicken with chips",
    image: "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/1%EF%80%A62-Chicken-Chips.png?fit=500%2C500&ssl=1",
    price: 90, available: true,
  },
  {
    id: id(), name: "1/4 Chicken, Chips & Roll", category: "Pedros",
    caption: "Quarter flame-grilled chicken, chips & roll",
    image: "https://static.yumbi.com/management/api/resource/?id=251199&ts=1692341562000",
    price: 60, available: true,
  },
  {
    id: id(), name: "1/4 Chicken, Pap & Chakalaka", category: "Pedros",
    caption: "Quarter chicken with pap & chakalaka",
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop",
    price: 55, available: true,
  },
  {
    id: id(), name: "4 Wings", category: "Pedros",
    caption: "4 flame-grilled chicken wings",
    image: "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/4-Wings-Chips.png?fit=500%2C500&ssl=1",
    price: 50, available: true,
  },
  {
    id: id(), name: "8 Wings", category: "Pedros",
    caption: "8 flame-grilled chicken wings",
    image: "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/4-Wings-Chips.png?fit=500%2C500&ssl=1",
    price: 95, available: true,
  },
  {
    id: id(), name: "Chicken Espetada", category: "Pedros",
    caption: "Portuguese-style chicken skewer with chips & roll",
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop",
    price: 85, available: true,
  },
  {
    id: id(), name: "Chicken Prego Roll", category: "Pedros",
    caption: "Spicy flame-grilled chicken in a soft roll",
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop",
    price: 55, available: true,
  },
  {
    id: id(), name: "1/4 Chicken Paella", category: "Pedros",
    caption: "Sprinkle chicken, basting sauce & rice",
    image: "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/1%EF%80%A64-Chicken-Paella.png?fit=500%2C500&ssl=1",
    price: 55, available: true,
  },
  {
    id: id(), name: "1/2 Chicken Paella", category: "Pedros",
    caption: "4 pieces sprinkle chicken with large rice",
    image: "https://i0.wp.com/pedroschicken.co.za/wp-content/uploads/2024/01/1%EF%80%A62-Chicken-Paella.png?fit=500%2C500&ssl=1",
    price: 85, available: true,
  },
  {
    id: id(), name: "Pedros Burger", category: "Pedros",
    caption: "Flame-grilled chicken fillet burger with chips",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 65, available: true,
  },
  {
    id: id(), name: "Pedros Large Chips", category: "Pedros",
    caption: "Large portion of crispy chips",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 30, available: true,
  },
  {
    id: id(), name: "Coleslaw", category: "Pedros",
    caption: "Creamy coleslaw side",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    price: 20, available: true,
  },
  {
    id: id(), name: "Chicken Platter", category: "Pedros",
    caption: "Large sharing platter — full chicken, chips, rolls & sides",
    image: "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=400&h=300&fit=crop",
    price: 520, available: true,
  },

  // ─── Steers ───────────────────────────────────────────────────────────────
  {
    id: id(), name: "Steers Original Burger", category: "Steers",
    caption: "100% pure beef patty, fresh lettuce, tomato & Steers sauce",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 59.90, available: true,
  },
  {
    id: id(), name: "Steers Original Burger Meal", category: "Steers",
    caption: "Original burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 99.90, available: true,
  },
  {
    id: id(), name: "Cheese Original Burger", category: "Steers",
    caption: "Beef patty, cheddar cheese, lettuce, tomato & Steers sauce",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=300&fit=crop",
    price: 64.90, available: true,
  },
  {
    id: id(), name: "Cheese Original Burger Meal", category: "Steers",
    caption: "Cheese burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 104.90, available: true,
  },
  {
    id: id(), name: "Double Steers Burger", category: "Steers",
    caption: "Double beef patty, cheese, lettuce & tomato",
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop",
    price: 84.90, available: true,
  },
  {
    id: id(), name: "Double Steers Burger Meal", category: "Steers",
    caption: "Double burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 124.90, available: true,
  },
  {
    id: id(), name: "Bacon Cheese Burger", category: "Steers",
    caption: "Beef patty, streaky bacon, cheddar, lettuce & tomato",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 74.90, available: true,
  },
  {
    id: id(), name: "Bacon Cheese Burger Meal", category: "Steers",
    caption: "Bacon cheese burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 114.90, available: true,
  },
  {
    id: id(), name: "BBQ Bacon Burger", category: "Steers",
    caption: "Beef patty, smoky BBQ sauce, bacon & cheddar",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 79.90, available: true,
  },
  {
    id: id(), name: "BBQ Bacon Burger Meal", category: "Steers",
    caption: "BBQ bacon burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 119.90, available: true,
  },
  {
    id: id(), name: "Chicken Burger", category: "Steers",
    caption: "Crispy chicken fillet, lettuce, tomato & mayo",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 64.90, available: true,
  },
  {
    id: id(), name: "Chicken Burger Meal", category: "Steers",
    caption: "Chicken burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 104.90, available: true,
  },
  {
    id: id(), name: "Boerie Roll", category: "Steers",
    caption: "Flame-grilled boerewors in a fresh roll with onions",
    image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop",
    price: 49.90, available: true,
  },
  {
    id: id(), name: "Boerie Roll Meal", category: "Steers",
    caption: "Boerie roll, chips & cold drink",
    image: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=400&h=300&fit=crop",
    price: 89.90, available: true,
  },
  {
    id: id(), name: "Half Rack Ribs", category: "Steers",
    caption: "Slow-cooked BBQ pork ribs, half rack with chips",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    price: 149.90, available: true,
  },
  {
    id: id(), name: "Full Rack Ribs", category: "Steers",
    caption: "Slow-cooked BBQ pork ribs, full rack with chips & coleslaw",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    price: 249.90, available: true,
  },
  {
    id: id(), name: "Ribs & Burger Combo", category: "Steers",
    caption: "Half rack ribs, original burger & chips",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    price: 179.90, available: true,
  },
  {
    id: id(), name: "Loaded Fries Bacon & Cheese", category: "Steers",
    caption: "Crispy fries loaded with bacon bits & melted cheddar",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop",
    price: 54.90, available: true,
  },
  {
    id: id(), name: "Loaded Fries Chilli", category: "Steers",
    caption: "Crispy fries with spicy chilli sauce & cheese",
    image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop",
    price: 49.90, available: true,
  },
  {
    id: id(), name: "Regular Chips", category: "Steers",
    caption: "Classic Steers crispy chips",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 29.90, available: true,
  },
  {
    id: id(), name: "Onion Rings", category: "Steers",
    caption: "Golden crispy battered onion rings",
    image: "https://images.unsplash.com/photo-1639024471283-03518883512d?w=400&h=300&fit=crop",
    price: 34.90, available: true,
  },
  {
    id: id(), name: "Steers Thick Shake Chocolate", category: "Steers",
    caption: "Thick creamy chocolate shake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  {
    id: id(), name: "Steers Thick Shake Strawberry", category: "Steers",
    caption: "Thick creamy strawberry shake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  {
    id: id(), name: "Steers Thick Shake Vanilla", category: "Steers",
    caption: "Thick creamy vanilla shake",
    image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&h=300&fit=crop",
    price: 44.90, available: true,
  },
  {
    id: id(), name: "Kids Meal Burger", category: "Steers",
    caption: "Small beef burger, small chips & juice",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 54.90, available: true,
  },

  // ─── Hungry Lion ──────────────────────────────────────────────────────────
  {
    id: id(), name: "1 Piece & Chips", category: "Hungry Lion",
    caption: "1 piece crispy chicken with chips",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 39.90, available: true,
  },
  {
    id: id(), name: "2 Piece & Chips", category: "Hungry Lion",
    caption: "2 pieces crispy chicken with chips",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 59.90, available: true,
  },
  {
    id: id(), name: "3 Piece & Chips", category: "Hungry Lion",
    caption: "3 pieces crispy chicken with chips",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 79.90, available: true,
  },
  {
    id: id(), name: "5 Piece & Chips", category: "Hungry Lion",
    caption: "5 pieces crispy chicken with chips",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 109.90, available: true,
  },
  {
    id: id(), name: "8 Piece Bucket", category: "Hungry Lion",
    caption: "8 pieces crispy chicken bucket",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 149.90, available: true,
  },
  {
    id: id(), name: "12 Piece Bucket", category: "Hungry Lion",
    caption: "12 pieces crispy chicken bucket",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 199.90, available: true,
  },
  {
    id: id(), name: "Hungry Lion Burger", category: "Hungry Lion",
    caption: "Crispy chicken fillet burger with lettuce & mayo",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 49.90, available: true,
  },
  {
    id: id(), name: "Hungry Lion Burger Meal", category: "Hungry Lion",
    caption: "Chicken burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 89.90, available: true,
  },
  {
    id: id(), name: "Spicy Chicken Burger", category: "Hungry Lion",
    caption: "Spicy crispy chicken fillet, lettuce & spicy mayo",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 54.90, available: true,
  },
  {
    id: id(), name: "Spicy Chicken Burger Meal", category: "Hungry Lion",
    caption: "Spicy chicken burger, chips & cold drink",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 94.90, available: true,
  },
  {
    id: id(), name: "Chicken Wrap", category: "Hungry Lion",
    caption: "Crispy chicken strips, lettuce & sauce in a tortilla",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=400&h=300&fit=crop",
    price: 54.90, available: true,
  },
  {
    id: id(), name: "6 Chicken Strips", category: "Hungry Lion",
    caption: "6 crispy chicken strips with dipping sauce",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 59.90, available: true,
  },
  {
    id: id(), name: "10 Chicken Strips", category: "Hungry Lion",
    caption: "10 crispy chicken strips with dipping sauce",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 89.90, available: true,
  },
  {
    id: id(), name: "6 Chicken Wings", category: "Hungry Lion",
    caption: "6 crispy chicken wings",
    image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=300&fit=crop",
    price: 54.90, available: true,
  },
  {
    id: id(), name: "10 Chicken Wings", category: "Hungry Lion",
    caption: "10 crispy chicken wings",
    image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400&h=300&fit=crop",
    price: 84.90, available: true,
  },
  {
    id: id(), name: "Family Meal", category: "Hungry Lion",
    caption: "6 pieces chicken, 2 large chips, 4 rolls & 2L drink",
    image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=400&h=300&fit=crop",
    price: 199.90, available: true,
  },
  {
    id: id(), name: "Hungry Lion Chips Small", category: "Hungry Lion",
    caption: "Small portion crispy chips",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 19.90, available: true,
  },
  {
    id: id(), name: "Hungry Lion Chips Large", category: "Hungry Lion",
    caption: "Large portion crispy chips",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 29.90, available: true,
  },
  {
    id: id(), name: "Coleslaw Side", category: "Hungry Lion",
    caption: "Creamy coleslaw",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
    price: 19.90, available: true,
  },
  {
    id: id(), name: "Cold Drink 500ml", category: "Hungry Lion",
    caption: "Coke, Sprite or Fanta 500ml",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop",
    price: 19.90, available: true,
  },

  // ─── BURGER KING ──────────────────────────────────────────────────────────
  {
    id: id(), name: "Whopper", category: "BURGER KING",
    caption: "Flame-grilled beef, tomato, lettuce, mayo, ketchup & pickles",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    price: 79.90, available: true,
  },
  {
    id: id(), name: "Whopper Meal", category: "BURGER KING",
    caption: "Whopper, medium fries & medium cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 119.90, available: true,
  },
  {
    id: id(), name: "Double Whopper", category: "BURGER KING",
    caption: "Double flame-grilled beef patty Whopper",
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop",
    price: 99.90, available: true,
  },
  {
    id: id(), name: "Double Whopper Large Meal", category: "BURGER KING",
    caption: "Double Whopper, large fries & large cold drink",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    price: 149.90, available: true,
  },
  {
    id: id(), name: "Whopper Jnr with Cheese", category: "BURGER KING",
    caption: "Junior Whopper with cheese",
    image: "https://i.ibb.co/ZLC2bng/IMG-5287.webp",
    price: 60, available: true,
  },
  {
    id: id(), name: "Big King Sandwich", category: "BURGER KING",
    caption: "Double beef patty with special sauce",
    image: "https://i.ibb.co/rfJ9qR6/IMG-5289.webp",
    price: 55, available: true,
  },
  {
    id: id(), name: "Big King Medium Meal", category: "BURGER KING",
    caption: "Big King, medium fries & cold drink",
    image: "https://i.ibb.co/LS7qmgx/IMG-5292.webp",
    price: 75, available: true,
  },
  {
    id: id(), name: "Big King XXL Medium Meal", category: "BURGER KING",
    caption: "Big King XXL, medium fries & cold drink",
    image: "https://i.ibb.co/51nLC1H/IMG-5281.webp",
    price: 115, available: true,
  },
  {
    id: id(), name: "Original Chicken Sandwich", category: "BURGER KING",
    caption: "Crispy chicken fillet with lettuce & mayo",
    image: "https://i.ibb.co/2dmCGGS/IMG-5290.webp",
    price: 55, available: true,
  },
  {
    id: id(), name: "Crispy Chicken Cheese Meal", category: "BURGER KING",
    caption: "Crispy chicken with cheese, medium fries & drink",
    image: "https://i.ibb.co/52fbsYC/IMG-5293.webp",
    price: 86, available: true,
  },
  {
    id: id(), name: "Double Chilli Cheeseburger Meal", category: "BURGER KING",
    caption: "Double chilli cheeseburger, fries & drink",
    image: "https://i.ibb.co/YNF927Z/IMG-5291.webp",
    price: 75, available: true,
  },
  {
    id: id(), name: "Fience Whopper", category: "BURGER KING",
    caption: "Fience Whopper everyday value deal",
    image: "https://i.ibb.co/ZmtDdzn/IMG-5279.webp",
    price: 95, available: true,
  },
  {
    id: id(), name: "Fience Chicken", category: "BURGER KING",
    caption: "Fience chicken everyday value deal",
    image: "https://i.ibb.co/Jv1Zdcn/IMG-5280.webp",
    price: 93, available: true,
  },
  {
    id: id(), name: "4pc Crispy Chicken Wings", category: "BURGER KING",
    caption: "4 crispy seasoned chicken wings",
    image: "https://i.ibb.co/G0z8FGj/IMG-5282.webp",
    price: 44, available: true,
  },
  {
    id: id(), name: "6pc Crispy Chicken Wings", category: "BURGER KING",
    caption: "6 crispy seasoned chicken wings",
    image: "https://i.ibb.co/G0z8FGj/IMG-5282.webp",
    price: 80, available: true,
  },
  {
    id: id(), name: "4pc Crispy Chicken Nuggets", category: "BURGER KING",
    caption: "4 crispy chicken nuggets with dipping sauce",
    image: "https://i.ibb.co/fFNgJVG/IMG-5288.webp",
    price: 45, available: true,
  },
  {
    id: id(), name: "Nacho Cheesy Loaded Fries", category: "BURGER KING",
    caption: "Fries loaded with nacho cheese sauce",
    image: "https://i.ibb.co/563GPMK/IMG-5299.webp",
    price: 42, available: true,
  },
  {
    id: id(), name: "2x BK Fusions", category: "BURGER KING",
    caption: "Two BK Fusion ice cream desserts",
    image: "https://i.ibb.co/LvnZV4q/IMG-5283.webp",
    price: 73, available: true,
  },
  {
    id: id(), name: "Big King + Cheeseburger", category: "BURGER KING",
    caption: "Big King medium meal + cheeseburger",
    image: "https://i.ibb.co/SvqVJjk/IMG-5284.webp",
    price: 100, available: true,
  },
  {
    id: id(), name: "King Size Combo 1", category: "BURGER KING",
    caption: "King size combo deal 1",
    image: "https://i.ibb.co/jy3HqP5/IMG-5295.webp",
    price: 100, available: true,
  },
  {
    id: id(), name: "King Size Combo 2", category: "BURGER KING",
    caption: "King size combo deal 2",
    image: "https://i.ibb.co/wschWvH/IMG-5296.webp",
    price: 140, available: true,
  },
  {
    id: id(), name: "King Size Combo 3", category: "BURGER KING",
    caption: "King size combo deal 3",
    image: "https://i.ibb.co/gWP2db8/IMG-5297.webp",
    price: 245, available: true,
  },
  {
    id: id(), name: "King Size Combo 4", category: "BURGER KING",
    caption: "King size combo deal 4",
    image: "https://i.ibb.co/qdMWPXq/IMG-5298.webp",
    price: 265, available: true,
  },
  {
    id: id(), name: "Quad Stack Medium Meal", category: "BURGER KING",
    caption: "Quadruple stacker burger, medium fries & drink",
    image: "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=400&h=300&fit=crop",
    price: 158, available: true,
  },
  {
    id: id(), name: "BK Regular Fries", category: "BURGER KING",
    caption: "Crispy golden BK fries",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 29.90, available: true,
  },
  {
    id: id(), name: "BK Large Fries", category: "BURGER KING",
    caption: "Large crispy golden BK fries",
    image: "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=400&h=300&fit=crop",
    price: 39.90, available: true,
  },
  {
    id: id(), name: "BK Cold Drink", category: "BURGER KING",
    caption: "Coke, Sprite or Fanta — small, medium or large",
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&h=300&fit=crop",
    price: 24.90, available: true,
  },

  // ─── Fellos Fishery ───────────────────────────────────────────────────────
  {
    id: id(), name: "Snoek Parcel", category: "Fellos Fishery",
    caption: "Snoek & chips",
    image: "https://i.ibb.co/DR2gK3x/OIP.jpg",
    price: 110, available: true,
  },
  {
    id: id(), name: "Hake Parcel", category: "Fellos Fishery",
    caption: "Hake & chips",
    image: "https://i.ibb.co/DR2gK3x/OIP.jpg",
    price: 120, available: true,
  },
  {
    id: id(), name: "Ladies Parcel", category: "Fellos Fishery",
    caption: "Snoek, hake & chips parcel",
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=400&h=300&fit=crop",
    price: 120, available: true,
  },

  // ─── Shop ─────────────────────────────────────────────────────────────────
  {
    id: id(), name: "2 Litre Drinks", category: "Shop",
    caption: "Coke / Stoney / Sprite / Fanta",
    price: 30, available: true,
  },
  {
    id: id(), name: "1.5 Litre Drinks", category: "Shop",
    caption: "Coke / Stoney / Sprite / Fanta",
    price: 20, available: true,
  },
  {
    id: id(), name: "White Loaf Bread", category: "Shop",
    caption: "White loaf",
    price: 20, available: true,
  },
  {
    id: id(), name: "Brown Loaf Bread", category: "Shop",
    caption: "Brown loaf",
    price: 20, available: true,
  },

  // ─── Liquor ───────────────────────────────────────────────────────────────
  {
    id: id(), name: "Gordons Gin 750ml", category: "Liquor",
    caption: "Gordons Gin (750ml)",
    image: "https://i.ibb.co/826FPQv/IMG-8951.webp",
    price: 200, available: true,
  },
  {
    id: id(), name: "Savanna 500ml 6pk", category: "Liquor",
    caption: "Savanna (500ml) 6 pack",
    image: "https://i.ibb.co/tJWMczF/IMG-8945.webp",
    price: 200, available: true,
  },
  {
    id: id(), name: "Savanna 330ml 6pk", category: "Liquor",
    caption: "Savanna (330ml) 6 pack",
    image: "https://i.ibb.co/GP8pzbL/IMG-8958.webp",
    price: 150, available: true,
  },
  {
    id: id(), name: "Brutal Fruit 440ml 6pk", category: "Liquor",
    caption: "Brutal Fruit (440ml) 6 pack",
    image: "https://i.ibb.co/nRzG6Wq/IMG-8949.webp",
    price: 150, available: true,
  },
  {
    id: id(), name: "Flying Fish 500ml 6pk", category: "Liquor",
    caption: "Flying Fish (500ml) 6 pack",
    image: "https://i.ibb.co/1dxsr6X/IMG-8954.jpg",
    price: 150, available: true,
  },
  {
    id: id(), name: "Black Label 500ml 6pk", category: "Liquor",
    caption: "Black Label (500ml) 6 pack",
    image: "https://i.ibb.co/4RqBjGJ/IMG-8953.webp",
    price: 150, available: true,
  },
  {
    id: id(), name: "Castle Lager 440ml 6pk", category: "Liquor",
    caption: "Castle Lager (440ml) 6 pack",
    image: "https://i.ibb.co/n3NBvq2/IMG-8952.webp",
    price: 150, available: true,
  },
  {
    id: id(), name: "Castle Lite 440ml 6pk", category: "Liquor",
    caption: "Castle Lite (440ml) 6 pack",
    image: "https://i.ibb.co/9WM9p79/IMG-8947.webp",
    price: 150, available: true,
  },
  {
    id: id(), name: "Amarula 750ml", category: "Liquor",
    caption: "Amarula (750ml)",
    image: "https://i.ibb.co/ZSv7JRm/IMG-8957.webp",
    price: 200, available: true,
  },
];
