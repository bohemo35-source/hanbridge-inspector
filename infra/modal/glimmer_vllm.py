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
    scaledown_window=5 * 60,  # scale to zero after 5 idle minutes (saves credits)
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
