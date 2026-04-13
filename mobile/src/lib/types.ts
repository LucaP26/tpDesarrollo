export type UserCategory = "comun" | "especial" | "plata" | "oro" | "platino";
export type Currency = "ARS" | "USD";
export type PaymentType = "cuenta_bancaria" | "tarjeta_credito" | "cheque_certificado";
export type PaymentStatus = "pendiente" | "verificado" | "rechazado";
export type ConsignmentStatus = "borrador" | "enviada" | "en_revision" | "aceptada" | "rechazada" | "devuelta";
export type UserRole = "cliente" | "duenio";
export type BankIssuer = "Galicia" | "Macro" | "BNA" | "Santander" | "BBVA" | "Patagonia" | "Banco Provincia" | "ICBC" | "HSBC" | "Ciudad";

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  document_number: string;
  legal_address: string;
  country_code: number;
  category: UserCategory;
  approved: boolean;
  registration_stage: string;
  roles: string[];
  avatar_image_url?: string | null;
}

export interface AuthPayload {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface PreRegisterPayload {
  email: string;
  document_number: string;
  first_name: string;
  last_name: string;
  legal_address: string;
  country_code: number;
  roles: UserRole[];
  document_front_image_url: string;
  document_back_image_url: string;
}

export interface RegistrationProgress {
  user_id: number;
  registration_stage: string;
  approved: boolean;
  message: string;
}

export interface ProfileUpdatePayload {
  first_name: string;
  last_name: string;
  email: string;
  legal_address: string;
}

export interface ApiMessage {
  message: string;
}

export interface JoinAuctionResult {
  auction_id: number;
  connected: boolean;
  can_bid: boolean;
  block_reason?: string | null;
  websocket_path: string;
  user_category: UserCategory;
}

export interface ActiveAuction {
  auction_id: number;
  title: string;
  category: UserCategory;
  currency: Currency;
  scheduled_at: string;
  location: string;
  current_lot_id?: number | null;
  current_lot_title?: string | null;
  current_lot_image_url?: string | null;
  current_price?: number | null;
  my_latest_bid?: number | null;
  my_is_leading: boolean;
}

export interface LeaveAuctionResult {
  message: string;
  auction_id: number;
  removed_bid_amount?: number | null;
  new_current_bid?: number | null;
  new_current_bidder_id?: number | null;
}

export interface CompleteRegistrationPayload {
  user_id: number;
  password: string;
}

export interface AuctionSummary {
  id: number;
  title: string;
  scheduled_at: string;
  category: UserCategory;
  currency: Currency;
  state: string;
  auctioneer_name: string;
  location: string;
  can_view_catalog: boolean;
  view_block_reason?: string | null;
  can_bid: boolean;
  block_reason?: string | null;
  current_lot_title?: string | null;
  best_offer?: number | null;
  preview_lot_title?: string | null;
  preview_image_url?: string | null;
  preview_base_price?: number | null;
  total_lots: number;
  remaining_lots: number;
}

export interface AuctionLot {
  id: number;
  piece_number: string;
  title: string;
  description: string;
  story?: string | null;
  artist?: string | null;
  image_urls: string[];
  base_price: number;
  commission_rate: number;
  current_bid?: number | null;
  current_bidder_id?: number | null;
  min_bid: number;
  max_bid?: number | null;
  can_bid: boolean;
  block_reason?: string | null;
  sold: boolean;
  sold_to_company: boolean;
}

export interface AuctionDetail extends AuctionSummary {
  auctioneer_name: string;
  current_lot?: AuctionLot | null;
  upcoming_lots: AuctionLot[];
  completed_lots: AuctionLot[];
  lots: AuctionLot[];
}

export interface BidResponse {
  bid_id: number;
  auction_id: number;
  lot_id: number;
  amount: number;
  status: string;
  current_best_bid: number;
  current_best_bidder_id: number;
  min_bid: number;
  max_bid?: number | null;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  kind: string;
  created_at: string;
  read: boolean;
}

export interface Metrics {
  auctions_joined: number;
  auctions_won: number;
  active_bids: number;
  total_amount_bid: number;
  total_amount_paid: number;
  categories_joined: Record<string, number>;
}

export interface PaymentMethod {
  id: number;
  type: PaymentType;
  display_name: string;
  currency: Currency;
  issuer_country: string;
  available_amount: number;
  status: PaymentStatus;
  last_four?: string | null;
  holder_first_name?: string | null;
  holder_last_name?: string | null;
  issuing_bank?: string | null;
  expiration_date?: string | null;
}

export interface PaymentMethodCreatePayload {
  type: PaymentType;
  display_name: string;
  currency: Currency;
  issuer_country: string;
  available_amount: number;
  last_four?: string | null;
  holder_first_name?: string | null;
  holder_last_name?: string | null;
  issuing_bank?: string | null;
  expiration_date?: string | null;
}

export interface Consignment {
  id: number;
  title: string;
  description: string;
  status: ConsignmentStatus;
  rejection_reason?: string | null;
  proposed_base_price?: number | null;
  commission_rate?: number | null;
  assigned_auction_id?: number | null;
  storage_location?: string | null;
  insurance_policy?: string | null;
  photos: string[];
}
