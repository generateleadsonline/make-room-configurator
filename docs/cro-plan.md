# Conversion design and measurement

The original Salesqueze embed starts with an opaque timber box and a long technical, wall-by-wall specification. The redesign starts with a glazed, furnished room and a purpose choice, then translates compatible dimensions into two sliders. A persistent 3D view makes the result of each choice visible. Four named steps with direct navigation, saved device state and config-only share links reduce restarts.

The enquiry gate explains its reward before asking for information: estimate, illustrated room, plan and specification. Name, email and postcode are required; phone, timing, notes and marketing preference are optional. Marketing starts unchecked. The server only reports success after private storage confirms the enquiry. A saved session permits revisions without asking for the same details again. Failed writes never reveal a price.

The PDF puts visual ownership first, followed by sourced estimate and scope, two renders, dimensioned floor plan, exact specification, electrical package and next-step checklist. It gives practical reasons to keep the design, visit the Show Village and contact Make Room.

Events are exposed to a future analytics integration via window.dataLayer, without PII: `make_room_step_completed` with step, `make_room_quote_unlocked` with step4, `make_room_pdf_download`, `make_room_design_shared`. No external analytics library or advertising tag is installed.

Primary metric: unique accepted enquiries / unique configurator entrants. Secondary: form completion, qualified enquiries and showroom bookings. Guardrails: lead quality, error rates, duplicate leads, mobile abandonment and delivery response time. Establish an original baseline, run a controlled test and evaluate qualified-lead cost. No conversion uplift is claimed before measurement.

Before acquisition launch, approve current price calibration, configure CRM/notification destination and retention, and add approved analytics to measure outcomes. Published2024 guide estimates are transparent planning aids, not quotes.
