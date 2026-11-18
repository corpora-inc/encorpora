#!/bin/bash
# Chatterbox (GitHub main ab55923c2: Multilingual V3, Turbo, Nano) in its own env; cu130 torch 2.11 like the other voice-lab envs.
set -e
cd ~/voice-lab/chatterbox
python3 -m venv env
env/bin/pip -q install --upgrade pip
env/bin/pip -q install torch==2.11.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/cu130
[ -d src/chatterbox ] || git clone -q https://github.com/resemble-ai/chatterbox src/chatterbox
git -C src/chatterbox checkout -q ab55923c2
env/bin/pip -q install --no-deps -e src/chatterbox
env/bin/pip -q install "numpy<2" librosa==0.11.0 s3tokenizer transformers==5.2.0 diffusers==0.29.0 "resemble-perth @ git+https://github.com/resemble-ai/Perth.git@master" conformer==0.3.2 safetensors==0.5.3 pyloudnorm omegaconf soundfile huggingface_hub pykakasi==2.3.0
echo ENVOK
