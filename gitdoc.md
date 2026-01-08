# Git Branching Strategy Documentation

## Overview
This document outlines our Git branching strategy and workflow procedures. The strategy is designed to maintain a stable main branch while allowing parallel development and proper testing before production deployment.

## Branch Structure
- `main` - Production/stable code (backup)
- `dev` - Development branch, source of feature branches
- `feature/*` - Feature development branches
- `release/*` - Release preparation branches
- `hotfix/*` - Emergency fixes for production

## Workflow Steps

### 1. Development Branch Setup
Ensure you're on the dev branch and it's up to date:
```bash
git checkout dev
git pull origin dev
```

### 2. Feature Development
Create and switch to a new feature branch:
```bash
git checkout -b feature/whatsapp
```

Make changes and commit them:
```bash
git add .
git commit -m "feat: technician dashboard"
```

Push your feature branch to remote:
```bash
git push origin feature/whatsapp
```

### 3. Feature Completion
Merge feature back to dev:
```bash
git checkout dev
git pull origin dev  # ensure dev is up to date
git merge feature/whatsapp
git push origin dev

git checkout main
git pull origin main # ensure main is up to date
git merge feature/whatsapp
git push origin main

git checkout feature/whatsapp



node supabase-connection-test.js  #to test supabase
```

Clean up by deleting feature branch:
```bash
# Delete local branch
git branch -d feature/ticketeditbutton

# Delete remote branch
git push origin --delete feature/ticketeditbutton
```

### 4. Release Process
Create release branch from dev:
```bash
git checkout -b release/v1.0.8 dev
git push origin release/v1.0.8
```

### 5. Release Deployment
After testing, merge release to both main and dev:
```bash
# Merge to main
git checkout main
git pull origin main
git merge release/v1.0.8
git push origin main

# Merge back to dev
git checkout dev
git pull origin dev
git merge release/v1.0.8
git push origin dev



```

Clean up by deleting release branch:
```bash
git branch -d release/v1.0.8
git push origin --delete release/v1.0.8


npm run typecheck
npm run build
```
still its showing few errors run this npm run typecheck after every correction and check if error count is decrementing , also use smart approch to resolve all the file at once and show result after every execution 


## Best Practices

### Commit Messages
- Use conventional commit messages:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation
  - `style:` for formatting
  - `refactor:` for code restructuring
  - `test:` for adding tests
  - `chore:` for maintenance

### Branch Naming
- Feature branches: `feature/description`
- Release branches: `release/v1.x.x`
- Hotfix branches: `hotfix/description`

### Code Review
1. Create Pull Request from feature branch to dev
2. Get code review from team
3. Address review comments
4. Merge only after approval

### Merge Conflict Resolution
1. Always pull latest changes before starting work
2. Resolve conflicts locally before pushing
3. Use `git rebase` when appropriate
4. Consult team when unsure about conflict resolution

## Workflow Benefits
- Maintains stable main branch
- Enables parallel development
- Facilitates proper testing
- Provides clean history
- Allows easy rollback if needed

## Emergency Hotfix Process
For critical production fixes:
1. Create hotfix branch from main
2. Fix the issue
3. Merge to both main and dev
4. Create new release if needed

## Tools and Integration
- Git GUI clients recommended: GitKraken, SourceTree
- IDE integration: Use built-in Git tools
- CI/CD: Automated testing on branch pushes

## Common Issues and Solutions
- **Merge Conflicts**: Pull latest changes frequently
- **Lost Work**: Commit often, use stash when needed
- **Wrong Branch**: Check current branch before starting work
- **Bad Merge**: Use `git revert` if needed

## Additional Commands

### Status and Information
```bash
git status  # Check working tree status
git log --oneline  # View commit history
git branch -a  # List all branches
```

### Stashing Changes
```bash
git stash  # Stash changes
git stash pop  # Apply stashed changes
```

### Reverting Changes
```bash
git revert <commit>  # Revert specific commit
git reset --hard origin/<branch>  # Reset to remote state
```

## Questions and Support
For questions or issues with this workflow:
1. Consult team lead
2. Check Git documentation
3. Use team communication channels
