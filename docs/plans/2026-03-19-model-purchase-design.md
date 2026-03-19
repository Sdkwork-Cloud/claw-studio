# API Router Model Purchase Design

## Goal

Add a model-purchase experience under the existing `/api-router` entry, while keeping purchase logic in a dedicated feature package and presenting vendor packages through a left sidebar with monthly, quarterly, and yearly purchase plans.

## Architecture

- Keep the global app sidebar unchanged with a single `API Router` entry so the shell route surface still matches the existing V5 constraints.
- Add a shell-owned `/api-router` workspace wrapper that composes two feature modules:
  - `@sdkwork/claw-apirouter` for the existing routing control plane
  - `@sdkwork/claw-model-purchase` for vendor package browsing and purchase presentation
- Keep `@sdkwork/claw-model-purchase` independent from other feature packages. It may depend only on `@sdkwork/claw-infrastructure`, `@sdkwork/claw-types`, `@sdkwork/claw-ui`, and shared React libraries.

## Product Decisions

- The model purchase entry is exposed inside the API Router workspace instead of as a new top-level route.
- The purchase screen uses a dedicated left vendor sidebar with:
  - one `Default` package page
  - ten US vendor package pages
  - ten China vendor package pages
- The vendor lineup is curated as:
  - US: OpenAI, Anthropic, Google, xAI, Meta, Mistral, Cohere, Microsoft, Amazon Nova, NVIDIA
  - China: DeepSeek, Qwen, Zhipu, Baidu, Tencent Hunyuan, Doubao, Moonshot, MiniMax, Baichuan, Yi
- Every vendor page exposes three billing cycles:
  - monthly
  - quarterly
  - yearly
- Each billing cycle shows tailored packages instead of a flat copy of the same three cards. Pricing, token budgets, concurrency, and support benefits scale by vendor tier and billing cycle.

## Data Model

- The new package owns a purchase catalog service that:
  - reads API Router channel metadata from the shared infrastructure mock service
  - merges it with a curated vendor purchase definition table
  - derives per-cycle package cards
- Each vendor entry includes:
  - stable id
  - display name
  - region
  - channel id when applicable
  - hero copy
  - recommended scenarios
  - purchase plans grouped by billing cycle
- Each purchase plan includes:
  - name
  - price
  - billing label
  - token allowance
  - included models
  - support level
  - badges such as `Most Popular`, `Best Value`, or `Enterprise`

## UI Structure

- Shell wrapper:
  - top segmented control for `Router Console` and `Model Purchase`
  - existing `ApiRouter` feature renders unchanged inside the console segment
  - new purchase feature renders inside the purchase segment
- Model purchase page:
  - left vendor sidebar
  - sticky cycle switcher for monthly, quarterly, yearly
  - hero summary for the selected vendor
  - responsive plan grid
  - summary cards for region, supported models, and routed channel footprint

## Package Planning Rules

- `Default` packages emphasize blended routing and shared quotas for teams that do not want vendor lock-in.
- Vendor-specific packages bias included models and quota messaging to each vendor:
  - ChatGPT packages emphasize GPT and reasoning access
  - MiniMax packages emphasize multimodal and long-context usage
  - DeepSeek and Qwen packages emphasize high-throughput or cost-performance routing
- Quarterly plans emphasize business growth with better unit economics.
- Yearly plans emphasize team consolidation, higher concurrency, and priority support.

## Testing

- Add a package-local service test to prove the catalog includes `Default`, the required US top 10 vendors, the required China top 10 vendors, and all three billing cycles.
- Add a dedicated workspace contract test for the new package.
- Extend shell contract coverage so `/api-router` is composed through a shell wrapper that imports both feature packages.
- Extend structure and parity scripts so the new package is treated as a first-class workspace package.
