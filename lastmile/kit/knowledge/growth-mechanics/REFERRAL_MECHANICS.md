# REFERRAL_MECHANICS

## Purpose

Decide WHEN a referral program is worth building and HOW to build one that a solo founder can defend against fraud. Referrals amplify a product that already retains; they cannot fix one that doesn't.

## Doctrine

- **Retention before referrals.** A referral loop pointed at a leaky bucket pays acquisition cost to accelerate churn. Gate the build on demonstrated returning-user retention for the product's natural frequency.
- **Architecture:** share link + deferred deep-link attribution. Firebase Dynamic Links is **deprecated** — new builds use Branch / AppsFlyer OneLink / Adjust-class links or plain server-side referral codes. 100% deterministic attribution is not achievable on iOS; accept probabilistic edges or use explicit codes.
- **Rewards:** double-sided by default (both referrer and invitee get value — vendor data favors it strongly, multipliers are vendor-sourced). Match reward type to economics: subscription time for subscriptions, credits for consumable/usage products, feature unlocks for freemium. Cash/cash-equivalent only with real fraud capacity.
- **K-factor reality:** organic virality (k ≥ 1) is a unicorn property. Plan referrals as a CAC-reducing channel (k well under 0.5), not the growth strategy.

## Rules

- `GRW-REF-01 FAIL`: A referral program is specced/built before the product shows retention evidence at its natural usage frequency.
- `GRW-REF-02 FAIL`: New attribution built on a deprecated link service (Firebase Dynamic Links) or on the assumption of deterministic iOS install attribution.
- `GRW-REF-03 PASS`: Rewards are double-sided (or single-sided with a stated reason) and the reward type matches the product's monetization model.
- `GRW-REF-04 FAIL`: Rewards grant at invitee signup rather than after invitee activation or first payment, or refunds don't claw back the reward.
- `GRW-REF-05 PASS`: The minimum fraud set is present: self-referral block, device/payment-method dedup, velocity caps per referrer.
- `GRW-REF-06 WARN`: Plan assumes k-factor > 0.5 or "viral growth" without measured evidence.

*Last reviewed: 2026-06.*
