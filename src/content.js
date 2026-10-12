// Customer-facing facts, each taken from Make Room's own pages on 12 October
// 2026 (research/website-2026-10-12/findings.md). Change wording here only.

export const CONTACT = {
  phone: "01422 580172",
  phoneHref: "tel:+441422580172",
  email: "halifax@makeroomoutside.co.uk",
  site: "https://www.makeroomoutside.co.uk/",
  // Make Room publishes no privacy page at a stable URL; this preview's notice.
  privacy: "/privacy.html",
};

export const SHOW_VILLAGE = {
  name: "Halifax Show Village",
  address: ["Wakefield Road", "Copley", "Halifax", "HX3 0UA"],
  hours: [
    ["Monday to Friday", "9.30am – 4.30pm"],
    ["Saturday", "10.30am – 4.30pm"],
    ["Sunday", "By appointment"],
  ],
  page: "https://www.makeroomoutside.co.uk/our-show-villages/halifax/",
  directions: "https://www.google.com/maps/dir/?api=1&destination=Make+Room+Outside+Living,+Wakefield+Road,+Copley,+Halifax+HX3+0UA",
  claim: "One of the biggest garden room villages in the UK, with nine rooms to walk round.",
};

// Make Room has no downloadable brochure today: its brochure buttons open a
// request form. Set a PDF URL here when they supply one and the header button
// becomes a direct download.
export const BROCHURE_URL = "";
export const BROCHURE_REQUEST_PAGE = "https://www.makeroomoutside.co.uk/our-show-villages/halifax/?request=Request%20a%20brochure";

export const USPS = [
  { id: "warranty", title: "10-year warranty", detail: "Built to last, and backed for a decade." },
  { id: "lead", title: "Installed within 6 weeks", detail: "Delivered within 6 weeks of order, installed from 3 days." },
  { id: "planning", title: "No planning in most cases", detail: "No planning permission required in the majority of cases." },
  { id: "uk", title: "Made in the UK", detail: "Manufactured right here in the UK, delivered and installed UK-wide." },
  { id: "insulated", title: "Fully insulated", detail: "50mm rigid foam insulation in the base and walls, 75mm in the roof." },
  { id: "village", title: "9-room show village", detail: "Walk round finished rooms in Halifax before you decide." },
];
export const usp = (id) => USPS.find((u) => u.id === id);

// Make Room's five stages from first visit to handover.
export const PROCESS = [
  { title: "Visit or talk it through", detail: "See finished rooms at the Halifax Show Village, or speak to the team by phone or video." },
  { title: "Site survey", detail: "We check access, levels and services at your home." },
  { title: "Design and quote", detail: "Your design is finalised and you receive a written quotation." },
  { title: "Built in our factory", detail: "Your room is manufactured in Make Room's own UK factory." },
  { title: "Installed", detail: "Delivered within 6 weeks of order, with installation from 3 days." },
];

export const STEP_TIPS = {
  size: "Every width and length here is one of Make Room's standard module sizes. Need something different? Our team can arrange custom dimensions.",
  cladding: "Western red cedar is Make Room's most premium timber finish. Composite boards are low-maintenance.",
  openings: "All doors and windows come in uPVC or aluminium, with a choice of anthracite grey or black frames.",
  interior: "Every Make Room is fully insulated: 50mm rigid foam to the base and walls, 75mm to the roof.",
};
