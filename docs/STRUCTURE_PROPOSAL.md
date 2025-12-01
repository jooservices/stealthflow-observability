# Documentation Structure Proposal

## Current State

### Files ở Root (cần di chuyển):
- `DEPLOYMENT.md` → Move to `docs/`
- `USER_GUIDE.md` → Move to `docs/`
- `README.md` → Keep at root ✅

### Files trong docs/ (hiện tại):
- `README.md` - Technical reference
- `README_REVIEW.md` - Review document
- `SA_DOCUMENTATION_REVIEW.md` - Review document

### Files trong client/:
- `client/README.md` - Client integration guide

## Proposed Structure

```
docs/
├── README.md                    # Index/Overview của docs
│
├── guides/                      # User-facing guides
│   ├── deployment.md            # Deployment guide (from DEPLOYMENT.md)
│   ├── user-guide.md            # User guide (from USER_GUIDE.md)
│   └── client-integration.md    # Client library guide (from client/README.md)
│
├── api/                         # API documentation
│   └── reference.md             # Complete API reference
│
├── operations/                   # Operations & maintenance
│   ├── monitoring.md            # Monitoring guide
│   └── troubleshooting.md      # Troubleshooting guide
│
├── development/                  # Development docs
│   ├── setup.md                 # Development setup
│   ├── architecture.md          # Architecture details
│   └── contributing.md          # Contributing guidelines
│
└── reviews/                     # Review documents (optional)
    ├── readme-review.md
    └── sa-documentation-review.md
```

## Naming Convention

### Recommendation: **lowercase-with-hyphens.md**

**Rules:**
- ✅ All lowercase
- ✅ Use hyphens (-) to separate words
- ✅ No spaces
- ✅ No underscores
- ✅ No special characters except hyphens

**Examples:**
- ✅ `deployment.md`
- ✅ `user-guide.md`
- ✅ `client-integration.md`
- ✅ `api-reference.md`
- ✅ `monitoring.md`
- ❌ `DEPLOYMENT.md` (uppercase)
- ❌ `USER_GUIDE.md` (uppercase + underscore)
- ❌ `userGuide.md` (camelCase)
- ❌ `user guide.md` (spaces)

**Rationale:**
- Standard convention for documentation
- Works well with GitHub/GitLab
- Easy to type and remember
- Consistent across all files

## Migration Plan

### Step 1: Create new structure
```bash
mkdir -p docs/guides
mkdir -p docs/api
mkdir -p docs/operations
mkdir -p docs/development
mkdir -p docs/reviews
```

### Step 2: Move and rename files
```bash
# Move root files
mv DEPLOYMENT.md docs/guides/deployment.md
mv USER_GUIDE.md docs/guides/user-guide.md
mv client/README.md docs/guides/client-integration.md

# Move review files
mv docs/README_REVIEW.md docs/reviews/readme-review.md
mv docs/SA_DOCUMENTATION_REVIEW.md docs/reviews/sa-documentation-review.md
```

### Step 3: Update links
- Update README.md to point to new locations
- Update all internal links in moved files
- Update cross-references

### Step 4: Create docs/README.md
- Index page for all documentation
- Navigation structure
- Quick links

## File Organization Logic

### guides/
**Purpose:** User-facing documentation for end users
- How to deploy
- How to use the service
- How to integrate

### api/
**Purpose:** Technical API documentation
- Endpoint specifications
- Request/Response schemas
- Authentication

### operations/
**Purpose:** Operations and maintenance
- Monitoring
- Troubleshooting
- Maintenance procedures

### development/
**Purpose:** Developer documentation
- Setup instructions
- Architecture details
- Contributing guidelines

### reviews/
**Purpose:** Review and audit documents
- Documentation reviews
- Code reviews
- Architecture reviews

## Alternative Structure (Simpler)

If you prefer a simpler structure:

```
docs/
├── README.md                    # Index
├── deployment.md                # Deployment guide
├── user-guide.md                # User guide
├── client-integration.md        # Client guide
├── api-reference.md             # API docs
├── monitoring.md                # Monitoring
├── troubleshooting.md           # Troubleshooting
└── architecture.md              # Architecture
```

**Pros:** Simpler, flatter structure
**Cons:** Less organized, harder to scale

## Recommendation

**Use the structured approach** (with subdirectories) because:
1. Better organization as docs grow
2. Easier to find specific topics
3. More professional
4. Scalable

Choose the simpler approach if:
- Team prefers flat structure
- Small project
- Don't expect many docs

