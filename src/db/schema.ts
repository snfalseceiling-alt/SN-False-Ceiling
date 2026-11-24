import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  mobile: text('mobile'),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash'),
  preferredLanguage: text('preferred_language').notNull().default('en'),
  activeRole: text('active_role').notNull().default('customer'),
  isVerified: boolean('is_verified').notNull().default(false),
  isSuspended: boolean('is_suspended').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userRoles = pgTable('user_roles', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customerProfiles = pgTable('customer_profiles', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  companyName: text('company_name'),
  gstin: text('gstin'),
  defaultCity: text('default_city'),
  defaultState: text('default_state'),
  defaultPinCode: text('default_pin_code'),
  address: text('address'),
});

export const supplierProfiles = pgTable('supplier_profiles', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  shopName: text('shop_name').notNull(),
  ownerName: text('owner_name').notNull(),
  mobile: text('mobile').notNull(),
  email: text('email').notNull(),
  gstin: text('gstin'),
  businessAddress: text('business_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pinCode: text('pin_code').notNull(),
  serviceAreas: text('service_areas').notNull(), // comma-separated cities/PINs
  productCategories: text('product_categories').notNull(), // e.g., "electrical,plumbing"
  shopDescription: text('shop_description'),
  shopImageUrl: text('shop_image_url'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  verificationStatus: text('verification_status').notNull().default('pending'), // pending | verified | rejected | suspended
  verifiedAt: timestamp('verified_at'),
  verifiedBy: integer('verified_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const supplierDocuments = pgTable('supplier_documents', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id')
    .references(() => supplierProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  docType: text('doc_type').notNull(),
  docNumber: text('doc_number').notNull(),
  fileName: text('file_name').notNull(),
  status: text('status').notNull().default('submitted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  projectName: text('project_name').notNull(),
  customerName: text('customer_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  siteAddress: text('site_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pinCode: text('pin_code').notNull(),
  buildingType: text('building_type').notNull(),
  numFloors: integer('num_floors').notNull().default(1),
  approxAreaSqft: integer('approx_area_sqft').notNull().default(1000),
  description: text('description'),
  status: text('status').notNull().default('Planning'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  domain: text('domain').notNull(), // 'electrical' | 'plumbing'
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
});

export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  domain: text('domain').notNull(), // 'electrical' | 'plumbing' | 'both'
  country: text('country').notNull().default('India'),
  isActive: boolean('is_active').notNull().default(true),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  domain: text('domain').notNull(), // 'electrical' | 'plumbing'
  categoryId: integer('category_id')
    .references(() => categories.id)
    .notNull(),
  brandId: integer('brand_id')
    .references(() => brands.id)
    .notNull(),
  name: text('name').notNull(),
  imageUrl: text('image_url').notNull(),
  description: text('description').notNull(),
  specification: text('specification').notNull(),
  size: text('size'),
  diameter: text('diameter'),
  unit: text('unit').notNull(),
  sku: text('sku').notNull().unique(),
  gstRate: doublePrecision('gst_rate').notNull().default(18),
  estimatedPrice: doublePrecision('estimated_price').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  imageUrl: text('image_url').notNull(),
  isPrimary: boolean('is_primary').notNull().default(true),
});

export const supplierProducts = pgTable('supplier_products', {
  id: serial('id').primaryKey(),
  supplierId: integer('supplier_id')
    .references(() => supplierProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id),
  domain: text('domain').notNull().default('electrical'),
  categoryName: text('category_name').notNull(),
  customName: text('custom_name').notNull(),
  brandName: text('brand_name').notNull(),
  specification: text('specification').notNull(),
  unit: text('unit').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  gstRate: doublePrecision('gst_rate').notNull().default(18),
  stockQty: integer('stock_qty').notNull().default(0),
  isAvailable: boolean('is_available').notNull().default(true),
  imageUrl: text('image_url'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  supplierProductId: integer('supplier_product_id')
    .references(() => supplierProducts.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  quantityOnHand: integer('quantity_on_hand').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(10),
  lastRestockedAt: timestamp('last_restocked_at').defaultNow().notNull(),
});

export const materialTemplates = pgTable('material_templates', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  domain: text('domain').notNull().default('both'),
  description: text('description'),
  itemsJson: jsonb('items_json').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const materialLists = pgTable('material_lists', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  deliveryEstimate: doublePrecision('delivery_estimate').notNull().default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const materialListItems = pgTable('material_list_items', {
  id: serial('id').primaryKey(),
  materialListId: integer('material_list_id')
    .references(() => materialLists.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  isCustom: boolean('is_custom').notNull().default(false),
  domain: text('domain').notNull().default('electrical'),
  categoryName: text('category_name').notNull(),
  productName: text('product_name').notNull(),
  brand: text('brand').notNull(),
  specification: text('specification').notNull(),
  unit: text('unit').notNull(),
  quantity: doublePrecision('quantity').notNull().default(1),
  estimatedUnitPrice: doublePrecision('estimated_unit_price').notNull().default(0),
  gstRate: doublePrecision('gst_rate').notNull().default(18),
  notes: text('notes'),
});

export const quotationRequests = pgTable('quotation_requests', {
  id: serial('id').primaryKey(),
  requestNumber: text('request_number').notNull().unique(),
  customerId: integer('customer_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  materialListId: integer('material_list_id').references(() => materialLists.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pinCode: text('pin_code').notNull(),
  requiredByDate: text('required_by_date'),
  notes: text('notes'),
  itemsSnapshotJson: jsonb('items_snapshot_json').notNull(),
  status: text('status').notNull().default('Request Submitted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const quotationRequestSuppliers = pgTable('quotation_request_suppliers', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id')
    .references(() => quotationRequests.id, { onDelete: 'cascade' })
    .notNull(),
  supplierId: integer('supplier_id')
    .references(() => supplierProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull().default('pending'), // pending | viewed | quoted | declined
  viewedAt: timestamp('viewed_at'),
  notifiedAt: timestamp('notified_at').defaultNow().notNull(),
});

export const quotations = pgTable('quotations', {
  id: serial('id').primaryKey(),
  quotationNumber: text('quotation_number').notNull().unique(),
  requestId: integer('request_id')
    .references(() => quotationRequests.id, { onDelete: 'cascade' })
    .notNull(),
  supplierId: integer('supplier_id')
    .references(() => supplierProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  status: text('status').notNull().default('draft'), // draft | submitted | accepted | rejected | clarification_requested
  deliveryCharges: doublePrecision('delivery_charges').notNull().default(0),
  estimatedDeliveryDays: integer('estimated_delivery_days').notNull().default(3),
  validUntil: text('valid_until').notNull(),
  notes: text('notes'),
  terms: text('terms'),
  clarificationNote: text('clarification_note'),
  subtotal: doublePrecision('subtotal').notNull().default(0),
  gstTotal: doublePrecision('gst_total').notNull().default(0),
  grandTotal: doublePrecision('grand_total').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const quotationItems = pgTable('quotation_items', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id')
    .references(() => quotations.id, { onDelete: 'cascade' })
    .notNull(),
  requestItemIndex: integer('request_item_index').notNull().default(0),
  productName: text('product_name').notNull(),
  categoryName: text('category_name').notNull(),
  brandOffered: text('brand_offered').notNull(),
  specification: text('specification').notNull(),
  availableQty: doublePrecision('available_qty').notNull(),
  requestedQty: doublePrecision('requested_qty').notNull(),
  unit: text('unit').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  gstRate: doublePrecision('gst_rate').notNull().default(18),
  lineSubtotal: doublePrecision('line_subtotal').notNull(),
  lineGst: doublePrecision('line_gst').notNull(),
  lineTotal: doublePrecision('line_total').notNull(),
  isAlternative: boolean('is_alternative').notNull().default(false),
  alternativeDetails: text('alternative_details'),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  customerId: integer('customer_id')
    .references(() => profiles.id)
    .notNull(),
  supplierId: integer('supplier_id')
    .references(() => supplierProfiles.id)
    .notNull(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'set null' }),
  quotationId: integer('quotation_id').references(() => quotations.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('Order Confirmed'),
  subtotal: doublePrecision('subtotal').notNull(),
  gstTotal: doublePrecision('gst_total').notNull(),
  deliveryCharges: doublePrecision('delivery_charges').notNull().default(0),
  grandTotal: doublePrecision('grand_total').notNull(),
  paymentMethod: text('payment_method').notNull().default('Cash on Delivery'),
  paymentStatus: text('payment_status').notNull().default('Pending'),
  deliveryAddress: text('delivery_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  pinCode: text('pin_code').notNull(),
  notes: text('notes'),
  historyJson: jsonb('history_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productName: text('product_name').notNull(),
  brand: text('brand').notNull(),
  specification: text('specification').notNull(),
  unit: text('unit').notNull(),
  quantity: doublePrecision('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  gstRate: doublePrecision('gst_rate').notNull().default(18),
  lineTotal: doublePrecision('line_total').notNull(),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  customerId: integer('customer_id')
    .references(() => profiles.id)
    .notNull(),
  method: text('method').notNull(), // Razorpay | UPI | Bank Transfer | Cash on Delivery
  amount: doublePrecision('amount').notNull(),
  currency: text('currency').notNull().default('INR'),
  status: text('status').notNull().default('pending'), // pending | awaiting_confirmation | verified | failed
  gatewayOrderId: text('gateway_order_id'),
  gatewayPaymentId: text('gateway_payment_id'),
  referenceNumber: text('reference_number'),
  confirmedBy: integer('confirmed_by'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const deliveries = pgTable('deliveries', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  status: text('status').notNull().default('Preparing'),
  carrierName: text('carrier_name'),
  trackingNumber: text('tracking_number'),
  driverPhone: text('driver_phone'),
  estimatedDate: text('estimated_date'),
  deliveredAt: timestamp('delivered_at'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  linkView: text('link_view'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  customerId: integer('customer_id')
    .references(() => profiles.id)
    .notNull(),
  supplierId: integer('supplier_id')
    .references(() => supplierProfiles.id)
    .notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const complaints = pgTable('complaints', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id)
    .notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('Open'), // Open | Under Review | Resolved | Closed
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id'),
  actorEmail: text('actor_email'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const otpCodes = pgTable('otp_codes', {
  id: serial('id').primaryKey(),
  identifier: text('identifier').notNull(),
  codeHash: text('code_hash').notNull(),
  purpose: text('purpose').notNull(), // registration | password_reset
  expiresAt: timestamp('expires_at').notNull(),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const profilesRelations = relations(profiles, ({ many, one }) => ({
  roles: many(userRoles),
  customerProfile: one(customerProfiles),
  supplierProfile: one(supplierProfiles),
  projects: many(projects),
  materialLists: many(materialLists),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  images: many(productImages),
}));
