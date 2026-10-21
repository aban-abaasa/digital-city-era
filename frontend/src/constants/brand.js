// Legal owner of the IcanEra family of apps (IcanEra, SupermartKera, BodaGoEra, AgriBone, ...).
// The owner is a business on IcanEra like any other, so its website is icanera.space/<business-name>.
// Every "A product of ..." credit in this app links here.
export const PRODUCT_OWNER = 'GODMINDERA ORGANISATION (U) LTD';
export const PRODUCT_OWNER_URL = 'https://icanera.space/godmindera-organisation-u-ltd';

// The credit for places that build text by hand.
// Plain text (e-mail bodies): the name followed by its address, which mail apps turn into a link.
export const PRODUCT_OF_TEXT = `A product of ${PRODUCT_OWNER} (${PRODUCT_OWNER_URL})`;
// HTML (printable pages, e-mails): the company name is the link.
export const PRODUCT_OF_HTML = `A product of <a href="${PRODUCT_OWNER_URL}" style="color:inherit">${PRODUCT_OWNER}</a>`;
