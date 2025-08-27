# Production Readiness Audit Roadmap
> **Status**: 🔴 Not Started | **Type**: AUDIT-FIRST (Static Only). Produce proposed diffs but DO NOT apply or merge.  
> **All findings must be pinned to a commit SHA with file + line numbers.**

---

## 📋 Pre-Audit Checklist
Before starting any phase, gather these artifacts:
- [ ] Commit SHA: `_______________`
- [ ] Date of audit: `_______________`
- [ ] `package.json` + lockfile snapshot
- [ ] `.env.example` (sanitized)
- [ ] Database schema export (SQL) + ER diagram
- [ ] Supabase RLS policies export
- [ ] Supabase Realtime config export
- [ ] List of channels/topics used for presence/broadcast
- [ ] `netlify.toml` copy
- [ ] `next.config.js` copy
- [ ] Security headers/CSP currently set
- [ ] List of all server actions
- [ ] List of all public routes
- [ ] Optional: bundle analyzer JSON, coverage reports, gitleaks output

---

## ⚖️ Severity Rubric & SLAs
**Likelihood (1–5) × Impact (1–5) → Score**
- **20–25**: Critical (fix before release)
- **12–19**: High (≤ 1 week)
- **6–11**: Medium (≤ 1 sprint)
- **1–5**: Low (backlog)

**SLA Policy**: No shipping if any Critical remains open or any High without compensating control.

## 📁 Evidence Requirements
For every finding include:
- `id`: Unique identifier (e.g., SEC-001)
- `severity`: Score + label (e.g., 20/Critical)
- `file`: Full path from repo root
- `lines`: Line numbers (e.g., 45-52)
- `sha`: Commit SHA
- `impact`: Business/technical consequence
- `exploitability`: How to exploit (PoC steps)
- `evidence`: Code snippet
- `remediation`: Step-by-step fix
- `diff`: Optional unified diff (as text, not applied)
- `references`: OWASP/CWE numbers
- `residual_risk`: Risk after fix (if any)

## 📂 Output Structure
```
/audit/
  00-preflight/
  01-threat-model/
  02-security/
  03-performance/
  04-architecture/
  05-infra/
  06-quality/
  evidence.jsonl       # one JSON object per finding
```

---

## ⚠️ Phase 0: Preflight Kill-Switch
**Timebox**: 15 minutes | **Priority**: MUST DO FIRST | **Status**: ⬜ Not Started

### Scope
Grep for catastrophic issues that would halt the audit:
- [ ] Service-role keys in client code
- [ ] `NEXT_PUBLIC_` environment variables containing secrets
- [ ] `dangerouslySetInnerHTML` usage
- [ ] `select * from` with string concatenation
- [ ] Missing `SameSite`/`HttpOnly` on auth cookies
- [ ] Hardcoded API keys or passwords

### Exit Criteria
- [ ] No catastrophic issues found OR issues documented and escalated
- [ ] Decision made to proceed or halt

### Outcome
If any found, **HALT** and escalate before proceeding with remaining phases.

### Agent Prompt
```
Preflight security check against commit {SHA}. 
Search for: service-role keys client-side, NEXT_PUBLIC secrets, dangerouslySetInnerHTML, SQL concatenation, missing cookie security.
Report ANY occurrence with file:line.
If found, mark as STOP-SHIP.
Timebox: 15 minutes.
```

---

## 🎯 Phase 1: Foundation & Security Critical
**Timebox**: 2-3 hours | **Priority**: CRITICAL | **Status**: ⬜ Not Started

### Scope
- **Threat Model & Trust Boundaries**
  - [ ] C4 L2 diagram of system
  - [ ] Enumerate assets, actors, goals
  - [ ] Define trust boundaries
  - [ ] Top 10 abuse cases with PoC

- **Authentication & Authorization**
  - [ ] Room code entropy analysis
  - [ ] Identity persistence mechanism
  - [ ] Server action authorization checks
  - [ ] Cross-room isolation verification

- **Critical Security Vulnerabilities**
  - [ ] XSS vectors (user strings to UI)
  - [ ] SQL injection risks
  - [ ] SSRF vulnerabilities
  - [ ] Command execution risks

### Target Files
- `src/app/game/actions.ts`
- `src/app/game/[roomCode]/*`
- `middleware.ts` (if exists)
- Components rendering user content

### Exit Criteria
- [ ] All Critical/High authz/XSS/secret exposures identified with evidence
- [ ] Threat model + top-10 abuse cases delivered
- [ ] No "Unknown" auth paths in server actions list
- [ ] Unverified items documented with artifact commands

### Deliverables
- Security findings with severity scores (Critical/High only)
- Exploit PoCs for each vulnerability
- Proposed diffs as text (do not apply)
- Trust boundary diagram

### Agent Prompt
```
Audit Phase 1 against commit {SHA}. Static-only.
Scope: Threat model, authentication/authorization, XSS/injection vulnerabilities.
Only report Critical/High severity issues.
For each finding: include severity (L×I), file:lines, evidence snippet, exploitability, remediation steps, and references.
Label runtime-dependent items as "status: Unverified (requires artifact)" with exact command to verify.
Timebox: 3 hours. If time expires, focus only on Critical findings.
```

---

## 🚀 Phase 2: Performance & Architecture 
**Timebox**: 2-3 hours | **Priority**: HIGH | **Status**: ⬜ Not Started

### Scope
- **Performance & Latency**
  - [ ] Define latency budgets (p95 targets)
  - [ ] Identify N+1 queries
  - [ ] Find missing indexes
  - [ ] Analyze caching strategy
  - [ ] Bundle size audit

- **Architecture & Code Organization**
  - [ ] Dead code detection
  - [ ] Cyclomatic complexity (>10)
  - [ ] Circular dependencies
  - [ ] Service/repository extraction

- **State Management & Realtime**
  - [ ] Race condition patterns
  - [ ] Memory leak risks
  - [ ] Re-render inefficiencies

### Target Files
- All server actions
- React contexts (`src/contexts/*`)
- Heavy components
- Database query patterns

### Exit Criteria
- [ ] All N+1 queries and missing indexes identified
- [ ] Architecture anti-patterns documented
- [ ] Performance bottlenecks with severity ratings
- [ ] Unverified metrics marked with test commands

### Deliverables
- Performance issues ranked by impact
- Query optimization recommendations
- Architecture refactoring proposals
- Bundle analysis (if artifacts available)

### Agent Prompt
```
Audit Phase 2 against commit {SHA}. Static-only.
Scope: Performance bottlenecks, N+1 queries, architecture issues, state management.
Report High/Critical performance issues only.
For each finding: include severity (L×I), file:lines, evidence snippet, impact on latency, remediation.
Mark runtime metrics as "Unverified" with commands to measure.
Timebox: 3 hours. If time expires, focus on database performance only.
```

---

## 🛡️ Phase 3: Infrastructure & API Security
**Timebox**: 2 hours | **Priority**: HIGH | **Status**: ⬜ Not Started

### Scope
- **API/Infrastructure Security**
  - [ ] CSRF protection audit
  - [ ] CORS configuration review
  - [ ] Rate limiting gaps
  - [ ] Secrets management
  - [ ] Security headers

- **Supabase Specific**
  - [ ] RLS policy audit
  - [ ] Realtime channel security
  - [ ] Connection configuration

- **Game Integrity**
  - [ ] Anti-cheat mechanisms
  - [ ] Server-authoritative validation
  - [ ] Replay protection

### Target Files
- `next.config.js`
- `netlify.toml`
- Supabase configuration
- RLS policies (SQL)

### Exit Criteria
- [ ] All infrastructure misconfigurations identified
- [ ] RLS policies reviewed with test matrix
- [ ] Security headers gaps documented
- [ ] Rate limiting requirements specified

### Deliverables
- Infrastructure vulnerabilities
- RLS test matrix (proposed)
- Security header additions
- Rate limiting implementation spec

### Agent Prompt
```
Audit Phase 3 against commit {SHA}. Static-only.
Scope: CSRF/CORS, rate limiting, RLS policies, security headers, game integrity.
Focus on Critical/High infrastructure vulnerabilities.
For each finding: include severity (L×I), config location, current vs recommended setting.
RLS policies: mark as "Unverified" with SQL test queries to validate.
Timebox: 2 hours.
```

---

## 📝 Phase 4: Code Quality & Type Safety
**Timebox**: 2 hours | **Priority**: MEDIUM | **Status**: ⬜ Not Started

### Scope
- **Type Safety & Errors**
  - [ ] TypeScript strictness
  - [ ] `any` type usage
  - [ ] Error boundaries
  - [ ] Null safety
  - [ ] Unhandled promises

- **Testing Strategy**
  - [ ] Unit test coverage gaps
  - [ ] Integration test needs
  - [ ] E2E scenarios
  - [ ] RLS test requirements

### Target Files
- All TypeScript files
- Test files
- Error handling patterns

### Exit Criteria
- [ ] All `any` types documented
- [ ] Critical path test gaps identified
- [ ] Error handling gaps with severity
- [ ] Testing strategy recommendations

### Deliverables
- Type safety issues (High/Critical only)
- Testing gap analysis
- Coverage recommendations
- Error boundary requirements

### Agent Prompt
```
Audit Phase 4 against commit {SHA}. Static-only.
Scope: TypeScript strictness, error handling, testing gaps.
Report issues that could cause runtime crashes or data corruption.
For each finding: include severity (L×I), file:lines, type safety issue, fix.
Testing: identify critical paths without coverage.
Timebox: 2 hours.
```

---

## 🏭 Phase 5: Production Operations
**Timebox**: 2 hours | **Priority**: MEDIUM | **Status**: ⬜ Not Started

### Scope
- **Supply Chain & CI/CD**
  - [ ] SBOM generation
  - [ ] CVE scanning
  - [ ] CI/CD pipeline
  - [ ] Pre-commit hooks

- **Observability & Incidents**
  - [ ] Logging strategy
  - [ ] Monitoring gaps
  - [ ] Incident playbook
  - [ ] Backup/recovery

### Target Files
- `package.json` dependencies
- CI/CD configuration
- Logging implementation

### Exit Criteria
- [ ] All Critical CVEs identified
- [ ] CI/CD security gaps documented
- [ ] Observability requirements defined
- [ ] Incident response gaps identified

### Deliverables
- Supply chain vulnerabilities (Critical/High)
- CI/CD improvements
- Observability checklist
- Incident templates

### Agent Prompt
```
Audit Phase 5 against commit {SHA}. Static-only.
Scope: Dependencies CVEs, CI/CD security, logging/monitoring gaps.
Focus on Critical/High supply chain risks.
For each finding: include CVE number, affected package, remediation.
Observability: identify blind spots in error detection.
Timebox: 2 hours.
```

---

## ♿ Phase 6: Compliance & UX
**Timebox**: 1-2 hours | **Priority**: LOW | **Status**: ⬜ Not Started

### Scope
- **Accessibility**
  - [ ] WCAG 2.1 AA compliance
  - [ ] Keyboard navigation
  - [ ] Screen reader support
  - [ ] Motion preferences

- **Privacy & Compliance**
  - [ ] Data classification
  - [ ] PII handling
  - [ ] GDPR/CCPA readiness
  - [ ] Cookie consent

### Target Files
- UI components
- Forms
- Data handling code

### Exit Criteria
- [ ] WCAG violations documented by level
- [ ] Privacy gaps identified
- [ ] Compliance requirements listed

### Deliverables
- Accessibility violations (AA level)
- Compliance gaps
- Privacy recommendations

### Agent Prompt
```
Audit Phase 6 against commit {SHA}. Static-only.
Scope: WCAG 2.1 AA violations, privacy/GDPR gaps.
For each finding: include WCAG criterion, file:lines, user impact.
Privacy: identify PII handling without consent.
Timebox: 2 hours. If time expires, focus on keyboard nav and contrast only.
```

---

## 📊 Audit Summary Template

After each phase, fill in:

### Phase X Completed: [DATE]
- **Commit SHA**: _______________
- **Critical Issues Found**: X
- **High Issues Found**: X  
- **Medium Issues Found**: X
- **Low Issues Found**: X
- **Unverified Items**: X
- **Estimated Fix Effort**: X days
- **Stop-ship Issues**: [List]

---

## 🎬 Post-Audit Actions

Once ALL phases complete:

1. **Consolidate Findings**
   - [ ] Merge all phase reports
   - [ ] Remove duplicates
   - [ ] Update severity scores
   - [ ] Generate `evidence.jsonl`

2. **Create Remediation Plan**
   - [ ] Group by fix complexity
   - [ ] Define fix order (dependencies)
   - [ ] Assign owners
   - [ ] Set timeline

3. **Generate Deliverables**
   - [ ] Executive summary (1 page)
   - [ ] Technical report (full)
   - [ ] Security checklist
   - [ ] Quick wins list

4. **Decision Gate**
   - [ ] Stop-ship issues that block launch?
   - [ ] **No shipping if any Critical remains open or any High without compensating control**
   - [ ] Fix-now vs fix-later triage
   - [ ] Resource allocation

---

## 📝 Notes Section

### Assumptions
- Static analysis only (no code execution)
- Serverless deployment constraints
- No existing user data in production
- Timeboxes are targets, not guarantees

### Out of Scope
- Performance testing under load
- Penetration testing
- Third-party service audits
- Runtime verification without artifacts

### Risk Accepted (Document Here)
- [Issue]: [Reason for accepting risk]
- [Issue]: [Reason for accepting risk]

---

## 🔄 Revision History
| Date | Phase | Auditor | Commit SHA | Notes |
|------|-------|---------|------------|--------|
| | | | | |