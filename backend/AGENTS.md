# Backend checks

After every backend code change:

1. Run `make format` from `backend/`.
2. Run `make check` (Flake8, Ruff lint, and Ruff format verification).
3. Fix all violations before finishing; do not disable rules or add blanket
   suppressions to make a change pass.
4. Run the relevant Django tests for behavior changes; use `make test` when the
   change affects shared behavior or multiple modules.

Install tooling with `.venv/bin/python -m pip install -r requirements-dev.txt`.
Use `PYTHON=python` with make when using a different active Python environment.
