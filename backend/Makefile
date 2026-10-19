PYTHON ?= .venv/bin/python

.PHONY: format lint check-format check test

format:
	$(PYTHON) -m ruff check --select I --fix .
	$(PYTHON) -m ruff format .

lint:
	$(PYTHON) -m flake8 .
	$(PYTHON) -m ruff check .

check-format:
	$(PYTHON) -m ruff format --check .

check: lint check-format

test:
	DJANGO_DEBUG=true $(PYTHON) manage.py test
