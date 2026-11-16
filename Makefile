.PHONY: help install dev dev-firefox test lint build zip

help: ## List the targets
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (needs Node 22+)
	npm ci

dev: ## Open Chrome with the extension loaded; WXT's dev server runs on :3210
	npm run dev

dev-firefox: ## The same in Firefox
	npm run dev:firefox

test: ## Run the unit tests
	npm test

lint: ## Typecheck TS and Svelte, then build for Firefox and run Mozilla's web-ext lint
	npm run check
	npm run lint:firefox

build: ## Build both browsers into .output/
	npm run build
	npm run build:firefox

zip: ## Store-ready zips for both browsers in .output/
	npm run zip
	npm run zip:firefox
