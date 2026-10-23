export interface Recommendation {
  id: string;
  title: string;
  description: string;
  promoCode?: string;
  imageUrl: string;
  buttonText: string;
  redirectUrl: string;
  active: boolean;
  matchCriteria: {
    categories: string[];
    keywords: string[];
  };
  impressions: number;
  clicks: number;
}
