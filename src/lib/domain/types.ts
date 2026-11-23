export type Role = "FOUNDER" | "CONTRACTOR_MANAGER" | "CONTRACTOR_ADMIN" | "HEAD_COOK" | "KITCHEN_STAFF";

export type KitchenSearchResult = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  contractorId: string;
  contractorName: string;
};

export type ContractorStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type CreateContractorInput = {
  name: string;
  displayName?: string;
  organizationType?: string;
  address?: string;
  region?: string;
  contactEmail?: string;
  contactPhone?: string;
  primaryContactName?: string;
};

export type ContractorSummary = {
  id: string;
  code?: string | null;
  name: string;
  status: string;
  primaryContactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  createdAt: Date;
};

export type ContractorDetail = {
  id: string;
  code?: string | null;
  name: string;
  status: string;
  primaryContactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  createdAt: Date;
  kitchens: { id: string; name: string; location: string | null; status: string }[];
  users: { id: string; code?: string | null; email: string; name: string | null; role: string }[];
};

export type CreateKitchenInput = {
  contractorId: string;
  name: string;
  location?: string;
};

export type KitchenSummary = {
  id: string;
  name: string;
  location: string | null;
  status: string;
  contractorId: string;
  contractorName: string;
};


