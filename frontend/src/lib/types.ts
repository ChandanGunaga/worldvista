export type Role = "MEMBER" | "SUPER_ADMIN" | "FINANCE_ADMIN" | "SUPPORT_ADMIN" | "CONTENT_ADMIN";
export type SessionUser = { id: string; memberId: string; fullName: string; email: string; role: Role };

export type TourPackage = {
  id: string; slug: string; name: string; destination: string; price: string; currency: string; chargeNote: string;
  nights: number; days: number; summary: string; description: string; hotelCategory: string; tag: string | null;
  validityDays: number | null; inclusions: string[]; exclusions: string[]; imageUrl: string | null;
  availableFrom: string | null; availableTo: string | null; cancellationPolicy: string; active: boolean; verified: boolean; sortOrder: number;
};

export type Course = {
  id: string; slug: string; title: string; tuition: string; currency: string; duration: string; schedule: string;
  topics: string[]; syllabus: string; trainer: string | null; startDate: string | null; enrollmentOpen: boolean;
  disclaimer: string; imageUrl: string | null; active: boolean;
};

export type Faq = { id: string; question: string; answer: string; sortOrder: number; active: boolean };
export type Page = { id: string; slug: string; title: string; body: string; isPolicy: boolean; version: number; published: boolean; updatedAt: string };

export type TreeNode = {
  id: string; memberId: string; fullName: string; status: string; side: "LEFT" | "RIGHT" | null; joinedAt: string;
  left?: TreeNode | null; right?: TreeNode | null;
};
