export type UserRole =
  | 'customer'
  | 'electrician'
  | 'plumber'
  | 'contractor'
  | 'supplier'
  | 'super_admin';

export type AppView =
  | 'home'
  | 'about'
  | 'how-it-works'
  | 'electrical'
  | 'plumbing'
  | 'find-suppliers'
  | 'contact'
  | 'help'
  | 'privacy'
  | 'terms'
  | 'login'
  | 'register'
  | 'builder'
  | 'customer-dashboard'
  | 'customer-projects'
  | 'customer-lists'
  | 'customer-quotations'
  | 'compare-quotations'
  | 'customer-orders'
  | 'customer-notifications'
  | 'customer-profile'
  | 'supplier-dashboard'
  | 'supplier-profile'
  | 'supplier-products'
  | 'supplier-requests'
  | 'supplier-orders'
  | 'supplier-reports'
  | 'admin-dashboard';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  mobile: string | null;
  fullName: string;
  preferredLanguage: 'en' | 'ta' | string;
  activeRole: UserRole;
  roles: UserRole[];
  isVerified: boolean;
  isSuspended: boolean;
  supplierId: number | null;
  supplierVerificationStatus: string | null;
}

export interface Category {
  id: number;
  domain: 'electrical' | 'plumbing';
  name: string;
  slug: string;
  sortOrder: number;
  description?: string;
}

export interface Brand {
  id: number;
  name: string;
  domain: string;
  country: string;
}

export interface Product {
  id: number;
  domain: 'electrical' | 'plumbing';
  categoryId: number;
  categoryName: string;
  brandId: number;
  brandName: string;
  name: string;
  imageUrl: string;
  description: string;
  specification: string;
  size: string;
  diameter: string;
  unit: string;
  sku: string;
  gstRate: number;
  estimatedPrice: number;
  isActive: boolean;
}

export interface SupplierDirectoryItem {
  id: number;
  shopName: string;
  city: string;
  state: string;
  pinCode: string;
  businessAddress: string;
  serviceAreas: string;
  productCategories: string;
  shopDescription: string;
  shopImageUrl: string | null;
  verificationStatus: string;
  gstinMasked: string | null;
}

export interface DraftMaterialItem {
  localId: string;
  productId?: number | null;
  isCustom: boolean;
  domain: 'electrical' | 'plumbing';
  categoryName: string;
  productName: string;
  brand: string;
  specification: string;
  unit: string;
  quantity: number;
  estimatedUnitPrice: number;
  gstRate: number;
  notes?: string;
}

export interface Project {
  id: number;
  ownerId: number;
  projectName: string;
  customerName: string;
  contactNumber: string;
  siteAddress: string;
  city: string;
  state: string;
  pinCode: string;
  buildingType: string;
  numFloors: number;
  approxAreaSqft: number;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  linkView: string | null;
  isRead: boolean;
  createdAt: string;
}
