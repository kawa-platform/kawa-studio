.PHONY: help release

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

release: ## Tag v$(VERSION) on origin/main and push it (starts the Release workflow). VERSION=x.y.z[-rc.N]
	@./scripts/release.sh '$(VERSION)'
