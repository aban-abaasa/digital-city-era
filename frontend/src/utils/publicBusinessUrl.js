const PUBLIC_BUSINESS_SITE_ORIGIN = 'https://icanera.space';

export const getPublicBusinessPageUrl = (companyId) => (
  companyId
    ? `${PUBLIC_BUSINESS_SITE_ORIGIN}/notices/${encodeURIComponent(companyId)}`
    : PUBLIC_BUSINESS_SITE_ORIGIN
);
