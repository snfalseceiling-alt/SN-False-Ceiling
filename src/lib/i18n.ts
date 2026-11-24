export type LanguageCode = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  available: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', available: true },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', available: true },
  { code: 'hi', label: 'Hindi (Coming Soon)', nativeLabel: 'हिन्दी', available: false },
  { code: 'te', label: 'Telugu (Coming Soon)', nativeLabel: 'తెలుగు', available: false },
  { code: 'kn', label: 'Kannada (Coming Soon)', nativeLabel: 'ಕನ್ನಡ', available: false },
  { code: 'ml', label: 'Malayalam (Coming Soon)', nativeLabel: 'മലയാളം', available: false },
];

type TranslationDict = Record<string, string>;

const en: TranslationDict = {
  brandName: 'BuildMate',
  tagline: 'Smart Material Planning. Easy Quotations. Better Buying.',
  navHome: 'Home',
  navElectrical: 'Electrical',
  navPlumbing: 'Plumbing',
  navFindShops: 'Find Shops',
  navHowItWorks: 'How It Works',
  navDashboard: 'Dashboard',
  navLogin: 'Sign In',
  navRegister: 'Register',
  navCreateList: 'Create Material List',
  heroHeadline: 'Everything You Need for Electrical & Plumbing Projects',
  heroSubheadline:
    'Create your material list, request quotations from multiple shops, compare prices and order materials easily.',
  heroPrimaryCta: 'Create Material List',
  heroSecondaryCta: 'Explore Materials',
  heroSearchPlaceholder: 'Search electrical or plumbing materials...',
  catElectricalTitle: 'Electrical Materials',
  catElectricalDesc: '20 structured categories from copper wires & MCBs to LED lighting and earthing.',
  catPlumbingTitle: 'Plumbing Materials',
  catPlumbingDesc: '20 structured categories from CPVC/UPVC pipes & valves to sanitaryware and pumps.',
  howItWorksTitle: 'How BuildMate Works',
  popularMaterialsTitle: 'Popular Catalogue Materials',
  browseCategoriesTitle: 'Browse 40 Specialized Categories',
  findSuppliersTitle: 'Find Verified Nearby Suppliers',
  benefitsContractorsTitle: 'Built for Electricians, Plumbers & Contractors',
  benefitsSuppliersTitle: 'Built for Electrical & Plumbing Shop Owners',
  faqTitle: 'Frequently Asked Questions',
  estimatedBadge: 'Estimated Catalogue Price',
  confirmedBadge: 'Supplier-Confirmed Price',
  addToList: 'Add to Material List',
  addedToList: 'In Material List',
  quantity: 'Quantity',
  unit: 'Unit',
  unitPrice: 'Unit Price',
  gst: 'GST',
  subtotal: 'Subtotal',
  deliveryCharges: 'Delivery Charges',
  grandTotal: 'Grand Total',
  downloadPdf: 'Download PDF',
  printPdf: 'Print Quotation',
  sharePdf: 'Share Quote',
  sendToSuppliers: 'Send to Suppliers',
  saveList: 'Save Material List',
  saveTemplate: 'Save as Template',
  addCustomMaterial: 'Add Custom Material',
  projects: 'My Projects',
  materialLists: 'My Material Lists',
  quotations: 'My Quotations',
  compareQuotations: 'Compare Quotations',
  orders: 'My Orders',
  notifications: 'Notifications',
  profileSettings: 'Profile Settings',
  supplierDashboard: 'Supplier Dashboard',
  adminDashboard: 'Admin Dashboard',
  logout: 'Sign Out',
  loading: 'Loading...',
  noResults: 'No matching records found.',
  estimateDisclaimer:
    'Catalogue prices and AI-suggested quantities are estimates for planning only. Always verify exact quantities against approved construction drawings and consult qualified engineers before ordering.',
  footerAbout: 'About Us',
  footerContact: 'Contact Us',
  footerHelp: 'Help Centre',
  footerPrivacy: 'Privacy Policy',
  footerTerms: 'Terms & Conditions',
};

const ta: TranslationDict = {
  brandName: 'BuildMate',
  tagline: 'சிறந்த பொருள் திட்டமிடல். எளிதான விலைப்புள்ளிகள். நம்பிக்கையான கொள்முதல்.',
  navHome: 'முகப்பு',
  navElectrical: 'மின்சாரம்',
  navPlumbing: 'குழாய் & நீர்',
  navFindShops: 'கடைகளைத் தேடு',
  navHowItWorks: 'செயல்முறை',
  navDashboard: 'டாஷ்போர்டு',
  navLogin: 'உள்நுழைக',
  navRegister: 'பதிவு செய்க',
  navCreateList: 'பட்டியல் உருவாக்கு',
  heroHeadline: 'மின்சாரம் & பிளம்பிங் திட்டங்களுக்கான அனைத்து பொருட்களும் ஒரே இடத்தில்',
  heroSubheadline:
    'உங்கள் பொருள் பட்டியலை உருவாக்கி, பல கடைகளில் விலைப்புள்ளி கேட்டு, ஒப்பிட்டு எளிதாக ஆர்டர் செய்யுங்கள்.',
  heroPrimaryCta: 'பொருள் பட்டியல் உருவாக்கு',
  heroSecondaryCta: 'பொருட்களைப் பார்க்க',
  heroSearchPlaceholder: 'மின்சாரம் அல்லது பிளம்பிங் பொருட்களைத் தேடுங்கள்...',
  catElectricalTitle: 'மின்சாரப் பொருட்கள்',
  catElectricalDesc: 'செப்பு கம்பிகள், MCB சுவிட்சுகள் முதல் LED விளக்குகள் வரை 20 பிரிவுகள்.',
  catPlumbingTitle: 'பிளம்பிங் பொருட்கள்',
  catPlumbingDesc: 'CPVC/UPVC குழாய்கள், வால்வுகள் முதல் பம்புகள் வரை 20 பிரிவுகள்.',
  howItWorksTitle: 'BuildMate எவ்வாறு செயல்படுகிறது',
  popularMaterialsTitle: 'பிரபலமான பொருட்கள்',
  browseCategoriesTitle: '40 சிறப்பு பிரிவுகள்',
  findSuppliersTitle: 'அருகிலுள்ள சான்றளிக்கப்பட்ட கடைகள்',
  benefitsContractorsTitle: 'எலக்ட்ரீஷியன்கள், பிளம்பர்கள் & ஒப்பந்ததாரர்களுக்கான பயன்கள்',
  benefitsSuppliersTitle: 'மின்சாரம் & பிளம்பிங் கடை உரிமையாளர்களுக்கான பயன்கள்',
  faqTitle: 'அடிக்கடி கேட்கப்படும் கேள்விகள்',
  estimatedBadge: 'மதிப்பிடப்பட்ட பட்டியல் விலை',
  confirmedBadge: 'சப்ளையர் உறுதிப்படுத்திய விலை',
  addToList: 'பட்டியலில் சேர்',
  addedToList: 'பட்டியலில் உள்ளது',
  quantity: 'அளவு',
  unit: 'அலகு',
  unitPrice: 'ஒற்றை விலை',
  gst: 'GST வரி',
  subtotal: 'துணை மொத்தம்',
  deliveryCharges: 'டெலிவரி கட்டணம்',
  grandTotal: 'மொத்த தொகை',
  downloadPdf: 'PDF பதிவிறக்கு',
  printPdf: 'அச்சிடு',
  sharePdf: 'பகிர்',
  sendToSuppliers: 'கடைகளுக்கு அனுப்பு',
  saveList: 'பட்டியலை சேமி',
  saveTemplate: 'டெம்ப்ளேட்டாக சேமி',
  addCustomMaterial: 'புதிய பொருளை கைமுறையாக சேர்',
  projects: 'என் திட்டங்கள்',
  materialLists: 'பொருள் பட்டியல்கள்',
  quotations: 'விலைப்புள்ளிகள்',
  compareQuotations: 'விலைப்புள்ளிகளை ஒப்பிடு',
  orders: 'என் ஆர்டர்கள்',
  notifications: 'அறிவிப்புகள்',
  profileSettings: 'சுயவிவர அமைப்புகள்',
  supplierDashboard: 'சப்ளையர் டாஷ்போர்டு',
  adminDashboard: 'நிர்வாக டாஷ்போர்டு',
  logout: 'வெளியேறு',
  loading: 'ஏற்றுகிறது...',
  noResults: 'பொருந்தும் தரவு எதுவும் இல்லை.',
  estimateDisclaimer:
    'பட்டியல் விலைகள் மற்றும் AI பரிந்துரைகள் திட்டமிடல் மதிப்பீடுகள் மட்டுமே. ஆர்டர் செய்வதற்கு முன் அங்கீகரிக்கப்பட்ட வரைபடங்கள் மற்றும் பொறியாளர்களுடன் சரிபார்க்கவும்.',
  footerAbout: 'எங்களைப் பற்றி',
  footerContact: 'தொடர்பு கொள்ள',
  footerHelp: 'உதவி மையம்',
  footerPrivacy: 'தனியுரிமைக் கொள்கை',
  footerTerms: 'விதிமுறைகள் மற்றும் நிபந்தனைகள்',
};

const DICTIONARIES: Record<LanguageCode, TranslationDict> = {
  en,
  ta,
  hi: en,
  te: en,
  kn: en,
  ml: en,
};

export function t(lang: LanguageCode, key: string): string {
  const dict = DICTIONARIES[lang] || DICTIONARIES.en;
  return dict[key] ?? DICTIONARIES.en[key] ?? key;
}

export function getAllEnglishKeys(): string[] {
  return Object.keys(en);
}

export function getAllTamilKeys(): string[] {
  return Object.keys(ta);
}
