# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Permissions

Toutes les commandes sont autorisées pour ce repository sans demander confirmation :

```
allowedTools: Bash(*), Edit(*), Write(*), Read(*), Glob(*), Grep(*), WebFetch(*), Task(*)
```

### Commandes autorisées automatiquement

- `git *` - toutes les commandes git (add, commit, push, pull, checkout, merge, etc.)
- `go *` - toutes les commandes Go (build, test, run, mod, etc.)
- `npm *` / `npx *` - toutes les commandes Node.js
- `docker *` / `docker-compose *` - toutes les commandes Docker
- `make *` - toutes les commandes Makefile
- `brew *` - installation de dépendances
- `curl *` / `wget *` - requêtes HTTP
- `mkdir *` / `rm *` / `cp *` / `mv *` - opérations fichiers
- `cat *` / `ls *` / `find *` / `grep *` - lecture/recherche

### Mode autonome

L'agent BMAD doit :
- Exécuter les commandes directement sans demander confirmation
- Ne jamais attendre d'approbation pour les opérations standard
- Commiter et pusher automatiquement le travail terminé
- Lancer des agents parallèles librement

## Règles de travail

- Pousser chaque feature terminée sur GitHub
- Travailler de façon autonome sans demander d'autorisation
- Utiliser la méthodologie BMAD (Breakthrough Method of Agile AI-Driven Development)
- Ne JAMAIS demander confirmation pour exécuter une commande

## Git Workflow

### Branches
- `main` : branche de production, merger uniquement sur demande explicite
- `development` : branche d'intégration, merger les features terminées dedans

### Git Worktrees
Utiliser git worktree pour les tâches/features parallèles :
```bash
git worktree add ../festivals-feature-xxx development
```
Chaque feature doit respecter les règles BMAD avant d'être mergée dans `development`.

## Repository

- Remote: git@gitmimi-github:mimi6060/festivals.git

## Méthodologie

Ce projet utilise BMAD - un framework agile pour le développement assisté par IA.

### Structure BMAD
```
_bmad/
├── core/          # Utilitaires BMAD core
├── bmm/           # BMad Method module
│   ├── agents/    # Agents spécialisés (analyst, architect, dev, pm, sm, etc.)
│   ├── workflows/ # Workflows BMAD
│   └── data/      # Templates et standards
_bmad-output/      # Artefacts générés
```
