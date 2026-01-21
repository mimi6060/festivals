# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Règles de travail

- Pousser chaque feature terminée sur GitHub
- Travailler de façon autonome sans demander d'autorisation
- Utiliser la méthodologie BMAD (Breakthrough Method of Agile AI-Driven Development)

## Git Workflow

### Branches
- `master` : branche de production, merger uniquement sur demande explicite
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
