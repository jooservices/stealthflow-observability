# Contributing Guide

Thank you for contributing to StealthFlow Observability!

---

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone git@github.com:jooservices/stealthflow.git
   cd stealthflow-observability
   ```
3. **Set up development environment**
   - See [Setup Guide](setup.md)
4. **Create a feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

---

## Branch Strategy

### Branch Types

- `main` - Production branch (protected)
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Critical production fixes
- `docs/*` - Documentation updates

### Naming Convention

- Use kebab-case: `feature/user-authentication`
- Be descriptive: `fix/redis-connection-timeout`
- Prefix with type: `feature/`, `fix/`, `docs/`

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### Examples

```bash
feat(api): add batch log submission endpoint

fix(worker): handle Elasticsearch connection errors

docs(readme): update installation instructions

chore(deps): update dependencies
```

---

## Code Standards

### JavaScript Style

- Use ES6+ features
- Follow ESLint rules
- Use Prettier for formatting

### Code Quality

- Write clean, readable code
- Add comments for complex logic
- Follow existing patterns
- Keep functions small and focused

### Testing

- Write tests for new features
- Maintain test coverage (70%+)
- Test edge cases
- Update tests when changing code

---

## Pull Request Process

### Before Submitting

1. **Update documentation**
   - Update README if needed
   - Add/update API docs
   - Update user guides

2. **Run tests**
   ```bash
   npm test
   ```

3. **Run linting**
   ```bash
   npm run lint
   ```

4. **Format code**
   ```bash
   npm run format
   ```

5. **Validate all**
   ```bash
   npm run validate
   ```

### PR Checklist

- [ ] Code passes linting
- [ ] Tests pass
- [ ] Test coverage maintained (70%+)
- [ ] No hardcoded secrets
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Commit messages follow convention
- [ ] Branch is up to date with base branch

### PR Description

Include:
- **What** - What changes were made
- **Why** - Why these changes were needed
- **How** - How the changes work
- **Testing** - How to test the changes

### Review Process

1. PR is reviewed by maintainers
2. Address review comments
3. Once approved, PR is merged
4. Delete feature branch after merge

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

### 2. Make Changes

- Write code
- Add tests
- Update documentation

### 3. Test Locally

```bash
npm run validate
```

### 4. Commit Changes

```bash
git add .
git commit -m "feat: add new feature"
```

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Create pull request targeting `develop` branch.

---

## Code Review Guidelines

### For Authors

- Be responsive to feedback
- Address all comments
- Keep PRs focused and small
- Explain complex changes

### For Reviewers

- Be constructive and respectful
- Focus on code, not person
- Suggest improvements
- Approve when ready

---

## Documentation

### When to Update Docs

- New features require documentation
- API changes need API docs updates
- Configuration changes need setup guide updates
- Bug fixes may need troubleshooting updates

### Documentation Structure

- **README.md** - Overview and quick start
- **docs/guides/** - User-facing guides
- **docs/api/** - API documentation
- **docs/operations/** - Operations guides
- **docs/development/** - Developer docs

---

## Testing Guidelines

### Unit Tests

- Test individual functions
- Mock external dependencies
- Test edge cases
- Maintain high coverage

### Integration Tests

- Test API endpoints
- Test Redis Stream operations
- Test Elasticsearch indexing
- Test error scenarios

### Test Files

- Location: `src/**/*.test.js`
- Naming: `*.test.js`
- Use Jest framework

---

## Questions?

- Check existing documentation
- Search issues/PRs
- Ask in discussions
- Contact maintainers

---

## Code of Conduct

- Be respectful
- Be inclusive
- Be constructive
- Follow project guidelines

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## See Also

- [Setup Guide](setup.md) - Development setup
- [Architecture Guide](architecture.md) - Architecture details
- [API Reference](../api/reference.md) - API documentation

