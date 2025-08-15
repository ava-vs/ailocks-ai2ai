# Digital Distribution Implementation Plan (AI2AI Product Distribution)

## 1. Overview
Enable secure distribution of digital products (files, audio, video, archives) between Ailocks with payment verification, message-based coordination, end-to-end encryption (E2EE), access control, delivery receipts, and retention policies.

- Scope: up to 200MB per item; repository delivery as archive; retention 7 days.
- Payments: Stripe only for MVP (Checkout + Webhooks).
- Delivery model: Claim-Check pattern with chunked upload/download via Netlify Functions + Netlify Blobs; server stores only encrypted blobs and manifests.
- Optional (post-MVP): Streamed video, IPFS/WebRTC.

## 2. Requirements
- Max size: 200MB per file.
- Types: Any (subject to policy); repos as .zip/.tar.* archives.
- Retention: 7 days; revocation: revoke on expiry or policy breach.
- Security: E2EE (AES-256-GCM + X25519/Ed25519), chunked upload/download endpoints (per-chunk), antivirus/moderation checks, audit logs, rate limiting.
- Payments: Stripe; gate delivery on paid status (webhook-driven).
- UX: Seamless messaging-driven flow; delivery receipts; status badges.

## 3. Architecture Overview
- New bounded context/service: DigitalDistributionService integrated with AilockMessageService via new interaction types.
- Storage: Netlify Blobs (site/deploy stores). No presigned URLs; uploads handled via Netlify Functions/Edge with multipart/form-data and chunked strategy.
- Crypto: Client-side encrypt/decrypt (E2EE). Server keeps encrypted data and key envelopes.
- Messaging: use existing inbox/batch API to orchestrate offer, invoice, delivery, and receipts.

## 4. Data Model (DB)
- digital_products(id, owner_ailock_id, title, content_type, size, encryption_algo, content_hash, storage_type, storage_pointer, manifest jsonb, created_at)
- product_transfers(id, product_id, from_ailock_id, to_ailock_id, price, currency, status enum: offered|invoiced|paid|delivered|acknowledged|disputed|refunded, policy jsonb, buyer_inputs jsonb, created_at, updated_at)
- payment_intents(id, provider, provider_ref, amount, currency, status, transfer_id, created_at)
- product_keys(id, product_id, recipient_ailock_id, key_envelope base64, algo, created_at, expires_at)
- delivery_receipts(id, transfer_id, client_hash, signature, delivered_at, meta jsonb)
- content_checks(id, product_id, malware_scan enum, moderation enum, reports jsonb, checked_at)

Policy notes:
 - Default policy: retention=7d, single-recipient, one-time download (configurable), revoke on expiry.
 - Required inputs policy: policy.required_inputs[] describes buyer-provided data to be collected before granting download link.
   - Schema (per item): { id, label, type: text|textarea|url|file, timing: pre_payment|post_payment_pre_grant, required: boolean, description?, constraints?: { max_len?, mime_types?, max_size_mb? } }
   - Storage: for type=file, store as attachments with pointers (storage_type, storage_pointer, size, content_type, checksum) linked to transfer; text/url values stored in product_transfers.buyer_inputs.

## 5. API Endpoints (Netlify Functions)
- POST /.netlify/functions/products-create — register product metadata/policy
- POST /.netlify/functions/products-upload-init — start chunked upload; returns uploadId, chunkSize, storage prefix
- POST /.netlify/functions/products-upload-chunk — upload a single chunk {uploadId, index, bytes} (<= 4MB)
- POST /.netlify/functions/products-upload-complete — finalize upload; persist manifest (chunk hashes, size, content_hash)
- GET  /.netlify/functions/products-download-manifest — return encrypted manifest for recipient
- GET  /.netlify/functions/products-download-chunk — return chunk by index (with ACL/TTL and download counters)
- POST /.netlify/functions/products-offer — send product_offer (via AilockMessageService)
- POST /.netlify/functions/products-invoice — create/return Stripe checkout link; if policy.required_inputs with timing=pre_payment are not satisfied for the transfer, respond 422 with { missing_inputs: [...] }
- POST /.netlify/functions/payments-stripe-webhook — process Stripe events → mark paid
- POST /.netlify/functions/products-grant — issue delivery ticket (key envelope + claim)
- GET  /.netlify/functions/products-claim — return access details for recipient (validate ACL/TTL)
- POST /.netlify/functions/products-ack — delivery receipt (Ed25519-signed)
- POST /.netlify/functions/products-revoke — revoke access (policy-based)
- POST /.netlify/functions/products-dispute — open dispute

Requirements & attachments:
- GET  /.netlify/functions/products-requirements — return required_inputs for a product (and timing)
- POST /.netlify/functions/transfers-requirements-submit — submit buyer inputs for a transfer (text/url values and references to uploaded files)
- POST /.netlify/functions/attachments-upload-init — start chunked upload for buyer attachments (returns uploadId, chunkSize, storage prefix, context=transfer)
- POST /.netlify/functions/attachments-upload-chunk — upload a single chunk {uploadId, index, bytes}
- POST /.netlify/functions/attachments-upload-complete — finalize attachment upload; returns pointer usable in transfers-requirements-submit

Batch extensions (/.netlify/functions/ailock-batch):
- init_product_transfer, confirm_payment, get_delivery_ticket, ack_delivery, revoke_access

## 6. Interaction Types (AilockMessageService)
- product_offer, payment_request, payment_confirmed, product_delivery, delivery_receipt, product_revoke, product_dispute

## 7. Flows
0) Requirements (if any)
- Discover: client calls products-requirements. If policy.required_inputs has items with timing=pre_payment, UI collects and submits via transfers-requirements-submit before invoice.
- Post-payment: if timing=post_payment_pre_grant, collect after webhook paid but before products-grant; grant is gated until inputs are provided/validated.

1) Offer → Invoice
- Sender registers product; sends product_offer with price/policy.
- System creates payment_intent; sends payment_request with Stripe link.

2) Payment
- Recipient pays via Stripe Checkout.
- stripe-webhook confirms → status=paid; proceed to grant.

3) Encrypt & Upload
- Client encrypts (AES-256-GCM), splits into chunks (<= 4MB safe limit), computes per-chunk hashes and overall content_hash; uploads chunks via upload-chunk.
- On complete, call upload-complete to write manifest; store storage_pointer (prefix), hash, size.

4) Grant (Delivery Ticket)
- Create key_envelope for recipient (X25519); send product_delivery with claim-check and TTL.

5) Download & Ack
- Recipient fetches manifest, downloads chunks sequentially (download-chunk), reassembles and decrypts, verifies content_hash; sends delivery_receipt (Ed25519 + client_hash).

6) Dispute/Refund (optional)
- Open dispute; use logs, signatures, moderation results; Stripe handles chargebacks.

## 8. Security
- E2EE: client-side encrypt/decrypt; server never sees plaintext.
- Keys: per-product symmetric key; envelopes per recipient (X25519 sealed box).
- Signatures: Ed25519 for receipts and sensitive acknowledgments.
- Access: short-lived claim tokens (JWT/PoP) for manifest/chunk endpoints; per-recipient download limits; rate limiting.
- Validation: size caps, content-type allowlist/denylist, malware/moderation checks prior to grant.
- Audit: request/actor/IP/UA logs, hashed manifests, trace IDs across batch ops.
- Rate limiting & quotas on claim/ack/revoke endpoints.

## 9. Payments (Stripe)
- Checkout session per transfer; webhook marks transfer paid.
- On paid → if all post_payment_pre_grant requirements are satisfied/validated → allow products-grant; otherwise keep status=paid_pending_inputs and notify buyer to complete inputs. Before paid → deny claim.
- Refunds via Stripe dashboard/API; sync to status.

## 10. Storage & Retention
- Default retention: 7 days after upload; auto-expire.
- Revocation: explicit via products-revoke or implicit on expiry/policy breach.
- Optional background cleanup function (cron) to purge expired objects/rows.

## 11. Client Crypto
- WebCrypto/libsodium wrapper for AES-256-GCM and X25519.
- Generate per-product key; store only encrypted envelopes.
- Verify integrity via SHA-256 hash (and/or CID if later using IPFS).

## 12. Testing Strategy
- Unit: crypto wrappers, policy validators, webhook handlers, chunk orchestration (init/chunk/complete), schema validators.
- Integration: end-to-end happy path (offer→requirements(if any)→pay→(post-payment requirements if any)→grant→claim→ack), failure cases (expired links, unpaid, missing required inputs, wrong recipient, corrupted hash), retries/idempotency.
- Load: uploads 200MB; download concurrency; webhook spikes.
- Security: AV/moderation mocks, signature verification, rate limit tests.

## 13. Rollout Plan
- Phase 1: DB migrations + feature flags + products-create/upload-init/upload-chunk/upload-complete + download-manifest.
- Phase 2: Stripe Checkout + webhook + grant/claim/ack + inbox integration.
- Phase 3: Moderation/AV + revoke + disputes + analytics.
- Phase 4 (optional): streaming video, resumable uploads, SSO storage providers; later IPFS/WebRTC.

## 14. Observability
- Structured logs (requestId, transferId), metrics (latency, success rate, error rates), traces across batch ops.

## 15. Risks & Mitigations
- Large file limits in Functions → chunked uploads (MVP), resumable/retry with idempotency (post-MVP).
- Key management bugs → strong test coverage, deterministic vectors, code reviews.
- Webhook forgery → verify Stripe signatures, idempotency keys.
- Abuse → strict limits, CAPTCHA on suspicious flows, reputation signals.
