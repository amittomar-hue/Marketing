# Marketing LLM — Fine-Tuning Pipeline

End-to-end pipeline to fine-tune Llama 3.1 8B Instruct on marketing-specific tasks using Kaggle's free GPU and Hugging Face Hub.

## Why this exists

The deployed Marketing LLM uses Groq's Llama 3.3 70B (hosted). It's smart and fast, but it's *generic* — not specialized on your brand voice or campaigns. Fine-tuning produces a smaller, specialized model that knows your team's playbook.

Trade-off: we can only realistically fine-tune **8B** for free (Kaggle GPUs can't fit 70B). The 8B model is meaningfully less capable than 70B baseline — but once fine-tuned on enough good examples, it can match 70B on your specific tasks.

## Pipeline overview

```
1. Synthesize 200 training examples via Groq Llama 70B (teacher)
   ↓
2. Merge Supabase feedback (high-rated user interactions)
   ↓
3. Upload notebook + data to Kaggle
   ↓
4. Run QLoRA fine-tune on Kaggle GPU (T4×2, ~90-150 min)
   ↓
5. Push LoRA adapter to Hugging Face Hub
   ↓
6. Wire into Marketing LLM inference
```

## Files

| File | Purpose |
|---|---|
| `marketing_llm_finetune.ipynb` | Kaggle notebook with full QLoRA training pipeline |
| `scripts/generate_dataset.js` | Synthesizes training data using Groq Llama 70B |
| `scripts/merge_supabase_feedback.js` | Adds high-rated user feedback to the dataset |
| `data/marketing_sft.jsonl` | The training dataset (200 synth + N feedback examples) |
| `package.json` | npm scripts to run generation |

## Step-by-step: First training run

### 1. Generate the base synthetic dataset

```bash
cd training
GROQ_API_KEY=gsk_... npm run generate
```

This will call Groq ~200 times (~5-8 minutes) and write `data/marketing_sft.jsonl`. Each line is a JSON record like:

```json
{"intent":"ad_copy","instruction":"Write 3 Google Ads variants for a fintech app for freelancers.","output":"**Variant 1 — Tax simplicity**\n\nHeadline: ..."}
```

The script covers 9 intents at weighted frequencies matching real marketing query distribution: ad_copy, email, social, landing_page, blog, strategy, competitor, brand_voice, trend.

### 2. (Optional) Merge user feedback from Supabase

If you've collected thumbs-up feedback in production:

```bash
SUPABASE_URL=https://...supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
npm run merge-feedback
```

This appends every high-rated interaction (score ≥ 1.0) to `marketing_sft.jsonl`. Deduped by user query.

### 3. Commit the dataset to the repo

```bash
git add training/data/marketing_sft.jsonl
git commit -m "Update training dataset: <N> examples"
git push
```

Kaggle will clone this repo directly inside the notebook (no upload needed).

### 4. Run on Kaggle

1. **Sign in to Kaggle** at https://www.kaggle.com/login (Google or email)
2. Go to **Create → New Notebook** (or import directly: **File → Upload Notebook** → select `marketing_llm_finetune.ipynb`)
3. **Settings panel (right side):**
   - Accelerator: **GPU T4 x2** (default and best free option)
   - Internet: **ON**
4. (Optional but recommended) **Add a Secret** for Hugging Face:
   - Add-ons → Secrets → Add Secret
   - Label: `HF_TOKEN`
   - Value: your `hf_...` token from https://huggingface.co/settings/tokens (role = Write)
5. Click **Run All** (top right)
6. Wait ~90-150 minutes

The notebook will:
- Install Unsloth + dependencies (~3 min)
- Load Llama 3.1 8B in 4-bit (~1 min)
- Attach LoRA adapters
- Train 3 epochs (~80-120 min on T4×2)
- Run 2 sample inferences
- Save adapter to `/kaggle/working/marketing-llm-8b-lora/`
- Push to Hugging Face Hub if HF_TOKEN is set

### 5. Download artifacts

After the run completes:
- **From Kaggle UI:** click the notebook output, download `marketing-llm-8b-lora.zip`
- **From Hugging Face Hub** (if you pushed): the model is at `https://huggingface.co/<your-username>/marketing-llm-8b-lora`

## Inference options (after training)

| Option | Cost | Setup difficulty | Latency |
|---|---|---|---|
| **Hugging Face Inference API** (Serverless) | Free tier — limited | Easy | Cold start ~10s |
| **HF Inference Endpoints** (Dedicated) | $0.60+/hr | Easy | ~200ms |
| **Together.ai LoRA Serving** | Pay-per-token | Medium | ~150ms |
| **Replicate** | Pay-per-second | Medium | Cold start ~30s |
| **Self-hosted vLLM on Modal/RunPod** | $0.50+/hr | Hard | Fastest |
| **Ollama / llama.cpp local** | Free | Medium | Depends on CPU/GPU |

For the deployed Marketing LLM frontend, the easiest path is HF Inference API free tier — add `HUGGINGFACE_API_TOKEN` to Vercel and switch a single env var to route to your fine-tuned model instead of Groq.

## Iteration cycle

Every 2-4 weeks:
1. `npm run merge-feedback` to pull new high-rated examples
2. Push the updated `marketing_sft.jsonl` to GitHub
3. Re-run the Kaggle notebook (it auto-clones the latest data)
4. The new LoRA replaces the old one

The model gets measurably better each cycle as more user feedback flows in.

## Troubleshooting

**Out-of-memory on Kaggle T4×2:**
- Lower `per_device_train_batch_size` from 2 → 1
- Lower `max_seq_length` from 2048 → 1024

**Training loss not decreasing:**
- Check dataset quality with `head data/marketing_sft.jsonl`
- Increase `num_train_epochs` to 5
- Verify all examples have `intent`, `instruction`, `output` keys

**HF push fails:**
- Token role must be **Write**, not Read
- Repo will be created automatically if it doesn't exist
- If repo name collision, change `REPO_NAME` in the notebook
