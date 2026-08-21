/**
 * Official Amazon India "Computers & Accessories" Category Registry
 * Standardized taxonomy for MP2TECH Hardware Store & AI Auto-Categorization
 */

export const AMAZON_DEPARTMENTS = [
  {
    id: "all",
    name: "All Departments",
    icon: "fa-th-large"
  },
  {
    id: "components",
    name: "Components",
    icon: "fa-microchip",
    description: "Internal PC & Laptop hardware components"
  },
  {
    id: "accessories",
    name: "Accessories & Peripherals",
    icon: "fa-keyboard-o",
    description: "Input devices, cables, adapters, and tools"
  },
  {
    id: "external-storage",
    name: "External Devices & Storage",
    icon: "fa-hdd-o",
    description: "Portable hard drives, external SSDs, USB drives"
  },
  {
    id: "systems-networking",
    name: "Systems & Networking",
    icon: "fa-laptop",
    description: "Laptops, desktops, monitors, routers, and Wi-Fi"
  }
];

export const AMAZON_CATEGORIES = [
  // ==========================================
  // COMPONENTS (Department: components)
  // ==========================================
  {
    id: "internal-ssds",
    deptId: "components",
    name: "Internal Solid State Drives",
    shortName: "Internal SSDs",
    icon: "fa-hdd-o",
    image: "https://m.media-amazon.com/images/I/61YaG1YInzL._SL1342_.jpg",
    keywords: ["ssd", "nvme", "m.2", "sata ssd", "solid state drive", "pcie 4.0", "pcie 3.0", "internal ssd", "m2 ssd"]
  },
  {
    id: "memory-ram",
    deptId: "components",
    name: "Memory (RAM)",
    shortName: "Memory (RAM)",
    icon: "fa-microchip",
    image: "https://m.media-amazon.com/images/I/515m2W95tPL._SL1100_.jpg",
    keywords: ["ram", "memory", "ddr3", "ddr4", "ddr5", "sodimm", "dimm", "long dimm", "desktop ram", "laptop ram", "3200mhz", "1600mhz", "2133mhz"]
  },
  {
    id: "motherboards",
    deptId: "components",
    name: "Motherboards",
    shortName: "Motherboards",
    icon: "fa-server",
    image: "https://images-na.ssl-images-amazon.com/images/P/B0C4ZQXM6X.01.LZZZZZZZ.jpg",
    keywords: ["motherboard", "mainboard", "h510", "b650", "b760", "z790", "intel motherboard", "amd motherboard", "lga1700", "am5", "am4"]
  },
  {
    id: "fans-cooling",
    deptId: "components",
    name: "Fans & Cooling",
    shortName: "Fans & Cooling",
    icon: "fa-snowflake-o",
    image: "https://m.media-amazon.com/images/I/61tJ0W7zV+L._SL1000_.jpg",
    keywords: ["fan", "cooling", "thermal paste", "thermal compound", "cooler", "heatsink", "cpu cooler", "cabinet fan", "thermal grease", "arctic mx-4", "thermal pad"]
  },
  {
    id: "power-supplies",
    deptId: "components",
    name: "Power Supplies",
    shortName: "Power Supplies (PSUs)",
    icon: "fa-plug",
    image: "https://m.media-amazon.com/images/I/71YyP9f1UYL._SL1500_.jpg",
    keywords: ["psu", "power supply", "smps", "atx power", "550w", "650w", "750w", "850w", "80 plus", "modular psu"]
  },
  {
    id: "processors",
    deptId: "components",
    name: "Processors (CPUs)",
    shortName: "Processors",
    icon: "fa-tachometer",
    image: "https://m.media-amazon.com/images/I/51w7w00Z9xL._SL1000_.jpg",
    keywords: ["processor", "cpu", "intel core", "ryzen", "core i3", "core i5", "core i7", "core i9", "ryzen 5", "ryzen 7"]
  },
  {
    id: "graphics-cards",
    deptId: "components",
    name: "Graphics Cards",
    shortName: "Graphics Cards",
    icon: "fa-gamepad",
    image: "https://m.media-amazon.com/images/I/71h6PpGaq3L._SL1500_.jpg",
    keywords: ["gpu", "graphics card", "geforce", "rtx", "gtx", "radeon", "nvidia", "vga card", "4gb graphics", "8gb graphics"]
  },
  {
    id: "computer-cases",
    deptId: "components",
    name: "Computer Cases",
    shortName: "Computer Cases",
    icon: "fa-desktop",
    image: "https://m.media-amazon.com/images/I/61k3pE78G1L._SL1200_.jpg",
    keywords: ["case", "cabinet", "chassis", "pc case", "mid tower", "mini itx", "rgb cabinet"]
  },
  {
    id: "internal-hard-drives",
    deptId: "components",
    name: "Internal Hard Drives",
    shortName: "Internal HDDs",
    icon: "fa-database",
    image: "https://m.media-amazon.com/images/I/71D0Y7kXNML._SL1500_.jpg",
    keywords: ["internal hdd", "internal hard drive", "barracuda", "wd blue", "sata hdd", "7200rpm", "2tb hdd"]
  },
  {
    id: "io-port-cards",
    deptId: "components",
    name: "I/O Port Cards",
    shortName: "I/O Port Cards",
    icon: "fa-exchange",
    image: "https://m.media-amazon.com/images/I/61S1q0p5eEL._SL1000_.jpg",
    keywords: ["pcie card", "expansion card", "sata card", "usb card", "sound card", "network card", "capture card"]
  },
  {
    id: "computer-screws",
    deptId: "components",
    name: "Computer Screws",
    shortName: "Computer Screws",
    icon: "fa-wrench",
    image: "https://m.media-amazon.com/images/I/61VzYfM5eGL._SL1000_.jpg",
    keywords: ["screw", "standoff", "mounting screws", "m.2 screw", "motherboard screws", "pc screw kit"]
  },
  {
    id: "barebones",
    deptId: "components",
    name: "Barebones",
    shortName: "Barebones",
    icon: "fa-cube",
    image: "https://m.media-amazon.com/images/I/51w7w00Z9xL._SL1000_.jpg",
    keywords: ["barebone", "mini pc kit", "nuc", "diy pc kit"]
  },

  // ==========================================
  // ACCESSORIES & PERIPHERALS (Department: accessories)
  // ==========================================
  {
    id: "keyboards-mice",
    deptId: "accessories",
    name: "Keyboards, Mice & Input Devices",
    shortName: "Keyboards & Mice",
    icon: "fa-keyboard-o",
    image: "https://m.media-amazon.com/images/I/711vfmr7pOL._SL1500_.jpg",
    keywords: ["keyboard", "mouse", "wireless combo", "gaming mouse", "mechanical keyboard", "trackpad", "wireless mouse", "logitech combo", "dell combo"]
  },
  {
    id: "adapters",
    deptId: "accessories",
    name: "Adapters",
    shortName: "Adapters",
    icon: "fa-plug",
    image: "https://images-na.ssl-images-amazon.com/images/P/B098K3H92Z.01.LZZZZZZZ.jpg",
    keywords: ["adapter", "bluetooth adapter", "wifi adapter", "power adapter", "laptop charger", "dongle", "usb bluetooth", "nano usb", "type c adapter"]
  },
  {
    id: "cables-accessories",
    deptId: "accessories",
    name: "Cables & Accessories",
    shortName: "Cables & Interconnects",
    icon: "fa-link",
    image: "https://m.media-amazon.com/images/I/61r5K8M+6LL._SL1500_.jpg",
    keywords: ["cable", "hdmi cable", "displayport cable", "sata cable", "usb c cable", "cat6 cable", "ethernet cable", "aux cable"]
  },
  {
    id: "usb-hubs",
    deptId: "accessories",
    name: "USB Hubs",
    shortName: "USB Hubs & Docks",
    icon: "fa-usb",
    image: "https://m.media-amazon.com/images/I/61k1jY-Yn5L._SL1500_.jpg",
    keywords: ["usb hub", "type c hub", "docking station", "multiport adapter", "usb-c dock", "thunderbolt dock", "4 port hub"]
  },
  {
    id: "laptop-accessories",
    deptId: "accessories",
    name: "Laptop Accessories",
    shortName: "Laptop Accessories",
    icon: "fa-laptop",
    image: "https://m.media-amazon.com/images/I/71V2+5k0FvL._SL1500_.jpg",
    keywords: ["laptop stand", "cooling pad", "laptop bag", "laptop sleeve", "keyboard cover", "screen protector", "cleaning kit"]
  },
  {
    id: "uninterrupted-power-supplies",
    deptId: "accessories",
    name: "Uninterrupted Power Supplies",
    shortName: "UPS Units",
    icon: "fa-battery-full",
    image: "https://m.media-amazon.com/images/I/61iV8C7M-SL._SL1500_.jpg",
    keywords: ["ups", "inverter", "apc ups", "600va", "1100va", "backup power", "microtek ups"]
  },
  {
    id: "pc-gaming-peripherals",
    deptId: "accessories",
    name: "PC Gaming Peripherals",
    shortName: "Gaming Peripherals",
    icon: "fa-gamepad",
    image: "https://m.media-amazon.com/images/I/61lCL0eG-gL._SL1500_.jpg",
    keywords: ["gaming headset", "gaming pad", "mousepad", "controller", "joystick", "flight stick", "steering wheel"]
  },
  {
    id: "cleaners-tools",
    deptId: "accessories",
    name: "Cleaners & Repair Tools",
    shortName: "Tools & Cleaners",
    icon: "fa-wrench",
    image: "https://m.media-amazon.com/images/I/71c6S-9Y1WL._SL1500_.jpg",
    keywords: ["toolkit", "screwdriver kit", "precision tool", "blower", "screen cleaner", "anti static brush", "soldering iron", "multimeter"]
  },
  {
    id: "audio-video-accessories",
    deptId: "accessories",
    name: "Audio & Video Accessories",
    shortName: "Audio & Video",
    icon: "fa-headphones",
    image: "https://m.media-amazon.com/images/I/61N+b5Z7zML._SL1500_.jpg",
    keywords: ["headphone", "headset", "earphone", "microphone", "webcam", "speaker", "soundbar"]
  },

  // ==========================================
  // EXTERNAL STORAGE (Department: external-storage)
  // ==========================================
  {
    id: "external-hard-drives",
    deptId: "external-storage",
    name: "External Hard Drives",
    shortName: "External HDDs",
    icon: "fa-hdd-o",
    image: "https://m.media-amazon.com/images/I/81uLs51EWeL._SL1500_.jpg",
    keywords: ["external hdd", "external hard drive", "portable hard drive", "1tb external", "2tb external", "seagate one touch", "wd elements", "transcend"]
  },
  {
    id: "external-ssds",
    deptId: "external-storage",
    name: "External Solid State Drives",
    shortName: "External SSDs",
    icon: "fa-hdd-o",
    image: "https://m.media-amazon.com/images/I/71YyP9f1UYL._SL1500_.jpg",
    keywords: ["external ssd", "portable ssd", "t7 shield", "crucial x6", "crucial x9", "sandisk extreme", "type c ssd"]
  },
  {
    id: "pen-drives",
    deptId: "external-storage",
    name: "Pen Drives & Flash Storage",
    shortName: "Pen Drives",
    icon: "fa-usb",
    image: "https://m.media-amazon.com/images/I/61c1i-5Y1bL._SL1500_.jpg",
    keywords: ["pen drive", "flash drive", "usb drive", "sd card", "micro sd", "32gb pen drive", "64gb pen drive", "128gb pen drive"]
  },

  // ==========================================
  // SYSTEMS & NETWORKING (Department: systems-networking)
  // ==========================================
  {
    id: "laptops",
    deptId: "systems-networking",
    name: "Laptops",
    shortName: "Laptops",
    icon: "fa-laptop",
    image: "https://m.media-amazon.com/images/I/71V2+5k0FvL._SL1500_.jpg",
    keywords: ["laptop", "notebook", "ultrabook", "gaming laptop", "macbook", "thinkpad", "latitude", "elitebook"]
  },
  {
    id: "desktops",
    deptId: "systems-networking",
    name: "Desktops",
    shortName: "Desktops & AIO",
    icon: "fa-desktop",
    image: "https://m.media-amazon.com/images/I/61k3pE78G1L._SL1200_.jpg",
    keywords: ["desktop", "all in one", "aio pc", "tower pc", "workstation", "mini pc"]
  },
  {
    id: "monitors",
    deptId: "systems-networking",
    name: "Monitors",
    shortName: "Monitors",
    icon: "fa-television",
    image: "https://m.media-amazon.com/images/I/71h6PpGaq3L._SL1500_.jpg",
    keywords: ["monitor", "display", "ips monitor", "144hz", "gaming monitor", "24 inch monitor", "27 inch monitor", "4k monitor"]
  },
  {
    id: "networking-devices",
    deptId: "systems-networking",
    name: "Networking Devices",
    shortName: "Networking",
    icon: "fa-wifi",
    image: "https://m.media-amazon.com/images/I/61N+b5Z7zML._SL1500_.jpg",
    keywords: ["router", "wifi router", "mesh wifi", "ethernet switch", "access point", "range extender", "wi-fi 6", "tp-link router"]
  }
];

/**
 * Helper: Find category by ID or alias
 */
export function getCategoryById(catId) {
  if (!catId) return null;
  const clean = String(catId).toLowerCase().trim();
  
  // Direct ID match
  const match = AMAZON_CATEGORIES.find((c) => c.id === clean);
  if (match) return match;

  // Legacy mappings
  if (clean === "storage" || clean === "ssd" || clean === "ssds") {
    return AMAZON_CATEGORIES.find((c) => c.id === "internal-ssds");
  }
  if (clean === "ram" || clean === "memory") {
    return AMAZON_CATEGORIES.find((c) => c.id === "memory-ram");
  }
  if (clean === "thermal" || clean === "cooling") {
    return AMAZON_CATEGORIES.find((c) => c.id === "fans-cooling");
  }
  if (clean === "tools" || clean === "toolkits" || clean === "diagnostics") {
    return AMAZON_CATEGORIES.find((c) => c.id === "cleaners-tools");
  }
  if (clean === "accessories") {
    return AMAZON_CATEGORIES.find((c) => c.id === "adapters");
  }

  // Keyword match
  const keywordMatch = AMAZON_CATEGORIES.find((c) =>
    c.keywords.some((k) => clean.includes(k) || k.includes(clean))
  );
  return keywordMatch || null;
}

/**
 * Helper: Get all categories belonging to a department
 */
export function getCategoriesByDepartment(deptId) {
  if (!deptId || deptId === "all") return AMAZON_CATEGORIES;
  return AMAZON_CATEGORIES.filter((c) => c.deptId === deptId);
}

/**
 * Helper: Resolve department ID for any category
 */
export function getDepartmentForCategory(catId) {
  const cat = getCategoryById(catId);
  return cat ? cat.deptId : "components";
}
