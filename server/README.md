# Private enquiry and PDF gate

`POST /api/quote` validates the exact modular design and name/email/UK postcode, saves an immutable receipt in strongly consistent Netlify Blobs, then issues a Secure HttpOnly SameSite=Lax session scoped to `/api`. A rejected or unconfirmed storage write never returns a price or success. Follow-up design revisions require that saved session and cannot change the original lead receipt.

`POST /api/design-pack` accepts a complete PDF up to 4MB only for a design belonging to the saved enquiry. `GET /api/design-pack?designReference=...` also requires that enquiry session. PDF and API responses are private and uncached. Production storage is `make-room-leads`; deploy previews use an isolated store. No personal information or session tokens appear in function logs.

Planning estimates use the company's published size examples, not an official rate card. Source links, scope and exclusions are returned with the saved quote. Option prices are not guessed. Configure `MAKE_ROOM_PRICING_MODE=quote-only` to show specialist pricing for every request. All monetary calculations are server-only.

The application stores enquiries privately and does not send email or CRM messages. Configure any notification integration separately. Test records used for deployed QA should be clearly labelled and removed after verification. Review your retention policy and analytics consent before installing the prototype on the production company site.
