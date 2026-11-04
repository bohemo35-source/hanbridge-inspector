# @agent:   claude-code
# @project: hanbridge-inspector
# @purpose: Muse Glimmer 30B (Meta open weights) served with vLLM on Modal (H100), OpenAI-compatible photo-triage endpoint
# @created: 2026-10-29
# @updated: 2026-11-04 claude-code — scaledown_window 5 → 15 min (no min_containers, no GPU snapshots); header added
# Muse Glimmer 30B (Meta open weights, Apache 2.0) served with vLLM on Modal.
# OpenAI-compatible API: <url>/v1/chat/completions, auth: Bearer $VLLM_API_KEY (Modal secret "glimmer-key").
# Deploy: modal deploy infra/modal/glimmer_vllm.py
import subprocess

import modal

MODEL = "meta-models/Muse-Glimmer-30B"
PORT = 8000

# official vLLM image: ships the CUDA toolkit (nvcc) that vLLM JIT kernels need; Modal needs `python` on PATH
image = modal.Image.from_registry(
    "vllm/vllm-openai:latest",
    setup_dockerfile_commands=["RUN ln -sf $(which python3) /usr/local/bin/python"],
).entrypoint([])
hf_cache = modal.Volume.from_name("hf-cache-glimmer", create_if_missing=True)
vllm_cache = modal.Volume.from_name("vllm-cache-glimmer", create_if_missing=True)

app = modal.App("hanbridge-glimmer")


@app.function(
    image=image,
    gpu="H100",
    timeout=60 * 60,
    scaledown_window=15 * 60,  # scale to zero after 15 idle minutes: a visitor's second run skips the 1–3 min cold start; we pay only for idle time after real use
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
    secrets=[modal.Secret.from_name("glimmer-key")],
)
@modal.concurrent(max_inputs=16)
@modal.web_server(port=PORT, startup_timeout=20 * 60)
def serve():
    import os

    cmd = [
        "vllm", "serve", MODEL,
        "--host", "0.0.0.0", "--port", str(PORT),
        "--served-model-name", "muse-glimmer-30b",
        "--max-model-len", "32768",
        "--api-key", os.environ["VLLM_API_KEY"],
    ]
    subprocess.Popen(cmd)
