# No-Codex ChatGPT contract

FlickSmith does not require the Codex product. In ChatGPT, use either an execution-capable ChatGPT environment that can run the repository or an installed FlickSmith plugin backed by an authenticated runtime. The GitHub repository contains the portable plugin manifest, onboarding skill, marketplace entry, bootstrap script, and smoke gate.

A plain text-only chat cannot acquire Node, FFmpeg, Rust, GPU access, or arbitrary process execution from a GitHub URL alone. That is a host capability boundary, not a FlickSmith limitation. For such chats, a remote plugin backend is required.
